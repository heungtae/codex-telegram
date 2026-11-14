import ssl
import subprocess
import tomllib
from unittest.mock import patch

import pytest

from codex_telegram import cli
from codex_telegram.https_setup import setup_https


@pytest.fixture
def config(tmp_path):
    path = tmp_path / 'conf.toml'
    path.write_text('# keep comment\n[web]\nport = 9090\npassword = "env:SECRET"\nssl_enabled = false # keep TLS comment\n\n[other]\nvalue = 123\n')
    return path


@pytest.mark.parametrize('domain', ['https://example.com', 'example.com:9090', 'example.com/', '-bad.com', 'localhost'])
def test_invalid_domain_does_not_run_command(config, domain):
    with patch('codex_telegram.https_setup.subprocess.run') as run:
        with pytest.raises(ValueError):
            setup_https(config, domain)
        run.assert_not_called()


def test_missing_executable_preserves_config(config):
    before = config.read_bytes()
    with patch('codex_telegram.https_setup.shutil.which', return_value=None):
        with pytest.raises(ValueError, match='Install certbot'):
            setup_https(config, 'example.com', 'certbot')
    assert config.read_bytes() == before


def issue_files(command, **kwargs):
    if '--config-dir' in command:
        from pathlib import Path
        target = Path(command[command.index('--config-dir') + 1]) / 'live' / 'example.com'
        target.mkdir(parents=True)
        (target / 'fullchain.pem').write_text('cert')
        (target / 'privkey.pem').write_text('key')


def test_certbot_updates_only_tls_and_preserves_backup(config):
    original = config.read_bytes()
    with patch('codex_telegram.https_setup.shutil.which', return_value='/bin/certbot'), patch(
        'codex_telegram.https_setup.subprocess.run', side_effect=issue_files
    ) as run, patch('codex_telegram.https_setup.ssl.SSLContext') as context:
        cert, key = setup_https(config, 'example.com', 'certbot')
    command = run.call_args.args[0]
    assert command[:3] == ['/bin/certbot', 'certonly', '--standalone']
    assert '--keep-until-expiring' in command
    assert command[command.index('--http-01-port') + 1] == '9090'
    context.return_value.load_cert_chain.assert_called_once_with(str(cert), str(key))
    result = tomllib.loads(config.read_text())
    assert result['web']['ssl_enabled'] is True
    assert result['web']['cookie_secure'] is True
    assert result['web']['ssl_certfile'] == str(cert)
    assert result['web']['port'] == 9090
    assert result['web']['password'] == 'env:SECRET'
    assert result['other'] == {'value': 123}
    assert '# keep comment' in config.read_text()
    assert '# keep TLS comment' in config.read_text()
    assert config.with_name('conf.toml.https.bak').read_bytes() == original
    assert key.stat().st_mode & 0o777 == 0o600


@pytest.mark.parametrize('failure', ['command', 'certificate', 'concurrent'])
def test_failure_preserves_configuration(config, failure):
    original = config.read_bytes()
    def provision(command, **kwargs):
        if failure == 'command':
            raise subprocess.CalledProcessError(1, command)
        issue_files(command)
        if failure == 'concurrent':
            config.write_bytes(original + b'\n# concurrent edit\n')
    with patch('codex_telegram.https_setup.shutil.which', return_value='/bin/certbot'), patch(
        'codex_telegram.https_setup.subprocess.run', side_effect=provision
    ), patch('codex_telegram.https_setup.ssl.SSLContext') as context:
        if failure == 'certificate':
            context.return_value.load_cert_chain.side_effect = ssl.SSLError('bad certificate')
        with pytest.raises((ValueError, ssl.SSLError, subprocess.CalledProcessError)):
            setup_https(config, 'example.com', 'certbot')
    assert config.read_bytes() == original + (b'\n# concurrent edit\n' if failure == 'concurrent' else b'')
    assert not config.with_name('conf.toml.https.bak').exists()


def test_cli_defaults_to_self_signed_without_starting_server(config):
    with patch('sys.argv', ['codex-telegram', '--config', str(config), '--setup-https', '--domain', 'example.com']), patch(
        'codex_telegram.https_setup.setup_https', return_value=('cert', 'key')
    ) as setup, patch.object(cli, '_check_for_update') as update, patch.object(cli, '_load_root_main_module') as start, patch.dict('os.environ'):
        assert cli.main() == 0
        setup.assert_called_once_with(config, 'example.com', 'self-signed')
        update.assert_not_called()
        start.assert_not_called()


def test_real_self_signed_certificate(config):
    import shutil
    if not shutil.which('openssl'):
        pytest.skip('openssl not installed')
    cert, key = setup_https(config, 'example.com')
    ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER).load_cert_chain(str(cert), str(key))
    assert tomllib.loads(config.read_text())['web']['ssl_keyfile'] == str(key)


def test_mkcert_uses_explicit_output_paths(config):
    from pathlib import Path
    def provision(command, **kwargs):
        Path(command[command.index('-cert-file') + 1]).write_text('cert')
        Path(command[command.index('-key-file') + 1]).write_text('key')
    with patch('codex_telegram.https_setup.shutil.which', return_value='/bin/mkcert'), patch(
        'codex_telegram.https_setup.subprocess.run', side_effect=provision
    ) as run, patch('codex_telegram.https_setup.ssl.SSLContext'):
        setup_https(config, 'example.com', 'mkcert')
    assert run.call_args.args[0][0] == '/bin/mkcert'
    assert run.call_args.args[0][-1] == 'example.com'


@pytest.mark.parametrize('arguments', [
    ['--setup-https'], ['--domain', 'example.com'],
    ['--setup-https', '--domain', 'example.com', '--web-only'],
    ['--setup-https', '--domain', 'example.com', '--validate-config'],
])
def test_cli_rejects_invalid_combinations(arguments):
    with patch('sys.argv', ['codex-telegram', '--debug', *arguments]):
        with pytest.raises(SystemExit) as error:
            cli.main()
    assert error.value.code == 2


def test_cli_reports_provisioning_failure(config):
    with patch('sys.argv', ['codex-telegram', '--config', str(config), '--setup-https', '--domain', 'example.com']), patch(
        'codex_telegram.https_setup.setup_https', side_effect=ValueError('issuance failed')
    ), patch.dict('os.environ'):
        assert cli.main() == 1


def test_failed_atomic_replace_preserves_original(config):
    original = config.read_bytes()
    import os
    replace = os.replace
    def fail_config(source, destination):
        if destination == config:
            raise OSError('cannot replace config')
        return replace(source, destination)
    with patch('codex_telegram.https_setup.shutil.which', return_value='/bin/certbot'), patch(
        'codex_telegram.https_setup.subprocess.run', side_effect=issue_files
    ), patch('codex_telegram.https_setup.ssl.SSLContext'), patch(
        'codex_telegram.https_setup.os.replace', side_effect=fail_config
    ):
        with pytest.raises(OSError):
            setup_https(config, 'example.com', 'certbot')
    assert config.read_bytes() == original
    assert config.with_name('conf.toml.https.bak').read_bytes() == original
    assert not list(config.parent.glob('.conf.toml.*'))


@pytest.mark.parametrize('value', ['80', '65536', 'true', '"9090"'])
def test_invalid_challenge_port_does_not_run_certbot(config, value):
    original = config.read_text().replace('port = 9090', f'port = {value}')
    config.write_text(original)
    with patch('codex_telegram.https_setup.shutil.which', return_value='/bin/certbot'), patch(
        'codex_telegram.https_setup.subprocess.run'
    ) as run:
        with pytest.raises(ValueError, match='web.port'):
            setup_https(config, 'example.com', 'certbot')
        run.assert_not_called()
    assert config.read_text() == original


def test_challenge_defaults_to_8080_when_port_missing(config):
    config.write_text(config.read_text().replace('port = 9090\n', ''))
    with patch('codex_telegram.https_setup.shutil.which', return_value='/bin/certbot'), patch(
        'codex_telegram.https_setup.subprocess.run', side_effect=issue_files
    ) as run, patch('codex_telegram.https_setup.ssl.SSLContext'):
        setup_https(config, 'example.com', 'certbot')
    command = run.call_args.args[0]
    assert command[command.index('--http-01-port') + 1] == '8080'
