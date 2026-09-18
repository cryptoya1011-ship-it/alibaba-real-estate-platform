#!/data/data/com.termux/files/usr/bin/bash
# One-time setup on Android/Termux. Run:  bash scripts/termux_setup.sh
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"

echo "==> installing system packages"
pkg update -y >/dev/null 2>&1 || true
pkg install -y python git >/dev/null

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
  echo "==> backend/.env already exists; left untouched"
fi

echo "==> applying database migrations"
alembic upgrade head
python -m app.cli seed

echo
echo "SETUP DONE"
echo "Start the API with:  bash scripts/termux_start.sh"
