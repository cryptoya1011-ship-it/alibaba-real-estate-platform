#!/data/data/com.termux/files/usr/bin/bash
# Start the API on Android/Termux:  bash scripts/termux_start.sh
set -e
cd "$(dirname "$0")/../backend"
. .venv/bin/activate

# Auto-fix .env if it has ENV=production (common mistake that blocks dev login)
if [ -f .env ] && grep -q "^ENV=production" .env; then
  echo "==> FIXING .env: ENV=production -> ENV=local (for Termux dev)"
  echo "==> Backup old .env to .env.bak"
  cp .env .env.bak
  cp .env.example .env
  SECRET=$(python -c "import secrets;print(secrets.token_urlsafe(48))")
  python - "$SECRET" <<'PY'
import pathlib, sys
p = pathlib.Path(".env")
txt = p.read_text()
txt = txt.replace("JWT_SECRET=dev-only-insecure-secret", f"JWT_SECRET={sys.argv[1]}")
p.write_text(txt)
PY
  echo "==> .env fixed! Now ENV=local, ALLOW_DEV_LOGIN=true"
fi

# Ensure .env exists
if [ ! -f .env ]; then
  echo "==> .env missing, creating from .env.example"
  cp .env.example .env
fi

echo "==> applying migrations"
alembic upgrade head
echo "==> starting API on 0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
