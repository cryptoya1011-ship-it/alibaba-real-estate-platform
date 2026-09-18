#!/data/data/com.termux/files/usr/bin/bash
# Start the API on Android/Termux:  bash scripts/termux_start.sh
set -e
cd "$(dirname "$0")/../backend"
. .venv/bin/activate
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
