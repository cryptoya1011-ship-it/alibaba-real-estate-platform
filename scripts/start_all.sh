#!/data/data/com.termux/files/usr/bin/bash
# Start both backend and frontend on Termux (simple, not using tmux)
# Recommended: use 2 Termux sessions instead. This script runs backend in background.
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"

echo "==> starting backend on 0.0.0.0:8000 (background)"
cd "$ROOT/backend"
. .venv/bin/activate
alembic upgrade head
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/arep_backend.log 2>&1 &
echo "backend pid $! log /tmp/arep_backend.log"

echo "==> starting frontend on 0.0.0.0:5173"
cd "$ROOT/frontend"
npm run dev
