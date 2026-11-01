import os
import time

from app import healthcheck


def test_missing_file_has_no_age(tmp_path):
    assert healthcheck.heartbeat_age(tmp_path / "missing") is None


def test_age_of_existing_file(tmp_path):
    path = tmp_path / "hb"
    path.touch()
    mtime = path.stat().st_mtime
    assert healthcheck.heartbeat_age(path, now=mtime + 12) == 12


def test_main_healthy_with_fresh_heartbeat(tmp_path, monkeypatch, capsys):
    path = tmp_path / "hb"
    path.touch()
    monkeypatch.setenv("HEARTBEAT_FILE", str(path))

    assert healthcheck.main() == 0
    assert capsys.readouterr().out.startswith("healthy")


def test_main_unhealthy_with_stale_heartbeat(tmp_path, monkeypatch, capsys):
    path = tmp_path / "hb"
    path.touch()
    old = time.time() - 60
    os.utime(path, (old, old))
    monkeypatch.setenv("HEARTBEAT_FILE", str(path))
    monkeypatch.setenv("HEARTBEAT_MAX_AGE_SECONDS", "30")

    assert healthcheck.main() == 1
    assert "60s old" in capsys.readouterr().out


def test_main_unhealthy_without_heartbeat(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("HEARTBEAT_FILE", str(tmp_path / "missing"))

    assert healthcheck.main() == 1
    assert "does not exist" in capsys.readouterr().out
