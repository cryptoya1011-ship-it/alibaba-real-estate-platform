#!/data/data/com.termux/files/usr/bin/bash
# Fix for "sh: 1: vite: not found" on Termux
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"

echo "==> Termux frontend fix — vite not found"
echo "Node: $(node -v 2>&1) NPM: $(npm -v 2>&1)"

cd "$ROOT/frontend"

echo "==> cleaning old install"
rm -rf node_modules package-lock.json
npm cache clean --force 2>&1 | tail -n 3 || true

echo "==> checking pkg nodejs"
pkg install -y nodejs 2>&1 | tail -n 5 || true

echo "==> installing deps (this may take 2-3 minutes on phone)"
npm install --verbose 2>&1 | tail -n 30

echo "==> checking vite binary"
ls -lh node_modules/.bin/vite || echo "vite binary still missing!"
./node_modules/.bin/vite --version || echo "vite version check failed"

echo ""
echo "==> trying npx vite --host"
echo "If this works, you can use: npx vite --host"
echo "Or: npm run dev"

# Try to fix vite.config hmr for Termux (clientPort 443 may fail on local)
echo "==> If still fails, try:"
echo "cd ~/alibaba-real-estate-platform/frontend && npx vite --host --port 5173"
