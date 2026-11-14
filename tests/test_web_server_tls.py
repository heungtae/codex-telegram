import ssl
from unittest.mock import Mock, patch

import pytest

from app_runtime.web_server import WebServerThread


@pytest.mark.parametrize('cert,key', [('', ''), ('cert.pem', ''), ('', 'key.pem')])
def test_https_requires_certificate_and_key(cert, key):
    with pytest.raises(ValueError, match='requires both'):
        WebServerThread('127.0.0.1', 9090, Mock(), True, cert, key)


@pytest.mark.parametrize('error', [FileNotFoundError('missing'), ssl.SSLError('invalid key')])
def test_https_certificate_errors_fail_before_start(error):
    with patch('app_runtime.web_server.ssl.SSLContext') as context:
        context.return_value.load_cert_chain.side_effect = error
        with pytest.raises(type(error)):
            WebServerThread('127.0.0.1', 9090, Mock(), True, 'cert.pem', 'key.pem')


@pytest.mark.parametrize('enabled', [False, True])
def test_server_passes_tls_configuration_only_when_enabled(enabled):
    factory = Mock()
    with patch('app_runtime.web_server.ssl.SSLContext') as context:
        server = WebServerThread(
            '127.0.0.1', 9090, factory, enabled, 'cert.pem', 'key.pem'
        )
        if enabled:
            context.return_value.load_cert_chain.assert_called_once_with('cert.pem', 'key.pem')
        else:
            context.assert_not_called()
    with patch('uvicorn.Config') as config, patch('uvicorn.Server') as runner:
        server.run()
        expected = {'ssl_certfile': 'cert.pem', 'ssl_keyfile': 'key.pem'} if enabled else {}
        config.assert_called_once_with(
            factory.return_value, host='127.0.0.1', port=9090,
            log_level='info', access_log=False, **expected
        )
        runner.return_value.run.assert_called_once_with()
