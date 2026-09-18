"""The Alembic chain must apply and roll back on a clean database."""
import os
import pathlib
import subprocess


def test_alembic_upgrade_and_downgrade(tmp_path):
    db_path = tmp_path / "migration_check.db"
    env = dict(os.environ, DATABASE_URL=f"sqlite+aiosqlite:///{db_path}")
    root = pathlib.Path(__file__).resolve().parents[1]

    up = subprocess.run(["alembic", "upgrade", "head"], cwd=root, env=env, capture_output=True, text=True)
    assert up.returncode == 0, up.stderr
    assert db_path.exists()

    down = subprocess.run(["alembic", "downgrade", "base"], cwd=root, env=env, capture_output=True, text=True)
    assert down.returncode == 0, down.stderr
