"""Explicit, offline-from-runtime HTTPS provisioning."""

import os
import re
import shutil
import ssl
import subprocess
import tempfile
from pathlib import Path

import tomlkit


def _domain_name(value: str) -> str:
    domain = value.strip().rstrip('.').encode('idna').decode('ascii').lower()
    labels = domain.split('.')
    if len(domain) > 253 or len(labels) < 2 or any(
        not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label)
        for label in labels
    ):
        raise ValueError('Use a DNS hostname without scheme, port, or path')
    return domain


def _atomic_write(path: Path, contents: bytes, mode: int) -> None:
    fd, name = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            os.fchmod(output.fileno(), mode)
            output.write(contents)
            output.flush()
            os.fsync(output.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def setup_https(config_path: Path, domain: str, method: str = 'self-signed') -> tuple[Path, Path]:
    """Provision certificates, then update only TLS settings in an existing config."""
    domain = _domain_name(domain)
    executables = {'certbot': 'certbot', 'mkcert': 'mkcert', 'self-signed': 'openssl'}
    if method not in executables:
        raise ValueError(f'Unsupported HTTPS method: {method}')
    executable = shutil.which(executables[method])
    if not executable:
        raise ValueError(f'Install {executables[method]} before using --method {method}')
    config_path = config_path.expanduser().resolve(strict=True)
    original = config_path.read_bytes()
    document = tomlkit.parse(original.decode('utf-8'))
    if 'web' not in document:
        document['web'] = tomlkit.table()
    if not isinstance(document['web'], dict):
        raise ValueError('web must be a TOML table')
    if method == 'certbot':
        port = document['web'].get('port', 8080)
        if isinstance(port, bool) or not isinstance(port, int) or not 1024 <= port <= 65535:
            raise ValueError('Set web.port to an integer between 1024 and 65535 for HTTPS setup')
    root = config_path.parent / 'https'
    root.mkdir(mode=0o700, exist_ok=True)
    if method == 'certbot':
        acme = root / 'acme'
        print(f'Forward external TCP 80 to this PC TCP {port}. '
              f'Stop the application using port {port} before continuing.', flush=True)
        subprocess.run([
            executable, 'certonly', '--standalone', '--keep-until-expiring',
            '--http-01-port', str(port),
            '--cert-name', domain, '-d', domain,
            '--config-dir', str(acme), '--work-dir', str(root / 'work'),
            '--logs-dir', str(root / 'logs'),
        ], check=True)
        cert, key = acme / 'live' / domain / 'fullchain.pem', acme / 'live' / domain / 'privkey.pem'
    else:
        # New directory avoids overwriting a pair used by an existing configuration.
        target = Path(tempfile.mkdtemp(prefix=f'{domain}-', dir=root))
        cert, key = target / 'cert.pem', target / 'key.pem'
        if method == 'mkcert':
            command = [executable, '-cert-file', str(cert), '-key-file', str(key), domain]
        else:
            command = [
                executable, 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                '-days', '365', '-subj', f'/CN={domain}',
                '-addext', f'subjectAltName=DNS:{domain}',
                '-out', str(cert), '-keyout', str(key),
            ]
        subprocess.run(command, check=True)
    key.chmod(0o600)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(str(cert), str(key))
    for name, value in {
        'ssl_enabled': True, 'ssl_certfile': str(cert),
        'ssl_keyfile': str(key), 'cookie_secure': True,
    }.items():
        document['web'][name] = value
    updated = tomlkit.dumps(document).encode('utf-8')
    # Verify serialization and refuse to overwrite edits made during issuance.
    tomlkit.parse(updated.decode('utf-8'))
    if config_path.read_bytes() != original:
        raise ValueError('Configuration changed during issuance; run setup again')
    backup = config_path.with_name(config_path.name + '.https.bak')
    _atomic_write(backup, original, 0o600)
    _atomic_write(config_path, updated, config_path.stat().st_mode & 0o777)
    return cert, key
