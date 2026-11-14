import tomllib
from unittest.mock import patch

import pytest

from utils.config import remove_project_profile, save_project_profile, update_project_profile


@pytest.fixture
def project_config(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text('project = "alpha"\n\n[projects.alpha]\nname = "Alpha"\npath = "/alpha"\nextra = true\n\n[web]\nenabled = true\n')
    with patch("utils.config._get_config_path", return_value=path):
        yield path


def test_modify_and_change_default_preserves_other_settings(project_config):
    save_project_profile("beta", "Beta", "/beta")
    update_project_profile("beta", 'New "Beta"', r"/new\beta", make_default=True)
    parsed = tomllib.loads(project_config.read_text())
    assert parsed["project"] == "beta"
    assert parsed["projects"]["beta"] == {"name": 'New "Beta"', "path": r"/new\beta"}
    assert parsed["projects"]["alpha"]["extra"] is True
    assert parsed["web"]["enabled"] is True
    with pytest.raises(ValueError, match="default project"):
        remove_project_profile("beta")
    remove_project_profile("alpha")
    assert "alpha" not in tomllib.loads(project_config.read_text())["projects"]


def test_add_default_and_modify_without_unsetting_default(project_config):
    save_project_profile("beta", "Beta", "/beta", make_default=True)
    update_project_profile("beta", "Changed", "/changed")
    assert tomllib.loads(project_config.read_text())["project"] == "beta"


@pytest.mark.parametrize("key,name,path", [("missing", "Name", "/path"), ("alpha", " ", "/path"), ("alpha", "Name", " ")])
def test_invalid_modify_does_not_write(project_config, key, name, path):
    original = project_config.read_text()
    with pytest.raises(ValueError):
        update_project_profile(key, name, path, make_default=True)
    assert project_config.read_text() == original
