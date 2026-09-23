#!/data/data/com.termux/files/usr/bin/bash
# Fix for: ALLOW_DEV_LOGIN must be false in production
# Run: bash scripts/fix_env.sh
set -e
cd "$(dirname "$0")/../backend"
echo "==> Current .env:"
cat .env | grep -E "^(ENV|ALLOW_DEV_LOGIN|JWT_SECRET|TELEGRAM_BOT_TOKEN)" || true
echo ""
echo "==> Backing up to .env.bak"
cp .env .env.bak 2>/dev/null || true
echo "==> Recreating .env from .env.example with ENV=local"
cp .env.example .env
SECRET=$(python -c "import secrets;print(secrets.token_urlsafe(48))")
python - "$SECRET" <<'PY'
import pathlib, sys
p = pathlib.Path(".env")
txt = p.read_text()
txt = txt.replace("JWT_SECRET=dev-only-insecure-secret", f"JWT_SECRET={sys.argv[1]}")
# Ensure local mode
txt = txt.replace("ENV=production", "ENV=local")
if "ENV=" not in txt:
    txt = "ENV=local\n" + txt
p.write_text(txt)
print(txt)
PY
echo ""
echo "==> FIXED! Now try:"
echo "bash scripts/termux_start.sh"
