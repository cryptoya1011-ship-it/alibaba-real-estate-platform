#!/usr/bin/env bash
# Full check: migrations + test suite.
set -e
cd "$(dirname "$0")/../backend"
. .venv/bin/activate
alembic upgrade head
python -m pytest -p no:warnings
