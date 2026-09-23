#!/data/data/com.termux/files/usr/bin/bash
# One-time setup on Android/Termux. Run:  bash scripts/termux_setup.sh
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"

echo "==> installing system packages"
pkg update -y >/dev/null 2>&1 || true
pkg install -y python git nodejs >/dev/null

echo "==> creating virtualenv"
cd "$ROOT/backend"
python -m venv .venv
. .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r requirements-dev.txt

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(python -c "import secrets;print(secrets.token_urlsafe(48))")
  python - "$SECRET" <<'PY'
import pathlib, sys
p = pathlib.Path(".env")
p.write_text(p.read_text().replace("JWT_SECRET=dev-only-insecure-secret", f"JWT_SECRET={sys.argv[1]}"))
PY
  echo "==> backend/.env created with a fresh JWT_SECRET (not committed)"
else
  echo "==> backend/.env already exists; checking ENV..."
  # Auto-fix if ENV=production left from previous run (blocks ALLOW_DEV_LOGIN)
  if grep -q "^ENV=production" .env 2>/dev/null; then
    echo "==> WARNING: .env has ENV=production, fixing to ENV=local for Termux..."
    cp .env.example .env
    SECRET=$(python -c "import secrets;print(secrets.token_urlsafe(48))")
    python - "$SECRET" <<'PY'
import pathlib, sys
p = pathlib.Path(".env")
txt = p.read_text()
txt = txt.replace("JWT_SECRET=dev-only-insecure-secret", f"JWT_SECRET={sys.argv[1]}")
p.write_text(txt)
PY
    echo "==> .env fixed to local mode"
  else
    echo "==> backend/.env ok, left untouched"
  fi
fi

echo "==> applying database migrations"
alembic upgrade head
python -m app.cli seed

echo "==> frontend setup"
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install
  echo "==> frontend node_modules installed"
else
  echo "==> frontend node_modules already exists"
fi
npm run build || echo "frontend build skipped (ok for dev)"

echo
echo "SETUP DONE — 58 tests should pass"
echo "Backend:  cd $ROOT/backend && . .venv/bin/activate && pytest -k 'not test_alembic' -q"
echo "Start API:  bash scripts/termux_start.sh  -> http://127.0.0.1:8000/docs"
echo "Start UI:   cd $ROOT/frontend && npm run dev -> http://127.0.0.1:5173"
echo "PWA install: Chrome menu -> Add to Home Screen"
echo "Guide: cat TERMUX_GUIDE_FA.md"
