import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest


@pytest.mark.parametrize('arguments,build,python_args', [
    ([], True, ['main.py']),
    (['--web-only'], True, ['-m', 'codex_telegram', '--web-only']),
    (['--setup-https', '--domain', 'example.com'], False,
     ['-m', 'codex_telegram', '--setup-https', '--domain', 'example.com']),
    (['--config', '/path with spaces/conf.toml', '--validate-config'], False,
     ['-m', 'codex_telegram', '--config', '/path with spaces/conf.toml', '--validate-config']),
    (['--help'], False, ['-m', 'codex_telegram', '--help']),
    (['--version'], False, ['-m', 'codex_telegram', '--version']),
])
def test_build_script_routes_arguments(tmp_path, arguments, build, python_args):
    if not shutil.which('bash'):
        pytest.skip('bash is required')
    root = tmp_path / 'checkout'
    frontend = root / 'web' / 'frontend'
    frontend.mkdir(parents=True)
    source = Path(__file__).resolve().parents[1] / 'run_build_and_main.sh'
    shutil.copyfile(source, root / source.name)
    bin_dir = tmp_path / 'bin'
    bin_dir.mkdir()
    output = tmp_path / 'calls.jsonl'
    import sys
    script = (
        f'#!{sys.executable}\n'
        'import json, os, sys\n'
        'with open(os.environ["CALL_LOG"], "a") as f:\n'
        '    f.write(json.dumps([os.path.basename(sys.argv[0]), os.getcwd(), sys.argv[1:]]) + "\\n")\n'
    )
    for name in ('npm', 'selected-python'):
        executable = bin_dir / name
        executable.write_text(script)
        executable.chmod(0o755)
    environment = dict(os.environ, PATH=f'{bin_dir}:{os.environ["PATH"]}',
                       PYTHON_BIN=str(bin_dir / 'selected-python'), CALL_LOG=str(output))
    subprocess.run(['bash', str(root / source.name), *arguments], env=environment, check=True)
    calls = [json.loads(line) for line in output.read_text().splitlines()]
    assert len(calls) == (2 if build else 1)
    if build:
        assert calls[0] == ['npm', str(frontend), ['run', 'build']]
    assert calls[-1] == ['selected-python', str(root), python_args]
