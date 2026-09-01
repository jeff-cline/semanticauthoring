#!/usr/bin/env bash
# Deploy Semantic Authoring on the Core box.
#   ssh r0cketship 'cd /var/www/semanticauthoring && ./scripts/deploy.sh'
set -euo pipefail

# NOTE: Next.js inlines process.env values into the server bundle at BUILD time.
# Changing .env therefore requires a rebuild — `pm2 restart` alone will keep
# serving the old values. This script always rebuilds, so it is the correct way
# to apply an environment change.

cd "$(dirname "$0")/.."
echo "→ pulling"
git fetch --all -q && git reset --hard origin/main -q
echo "   at $(git rev-parse --short HEAD)"

set -a && . ./.env && set +a

echo "→ installing (devDependencies needed for the build)"
npm ci --include=dev --no-audit --no-fund >/dev/null

echo "→ migrating"
npx tsx scripts/migrate.ts

echo "→ building"
NODE_OPTIONS="--max-old-space-size=3072" npx next build >/dev/null

echo "→ reloading"
pm2 reload semanticauthoring --update-env
sleep 5

code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)
echo "→ local probe: $code"
[ "$code" = "200" ] || { echo "DEPLOY FAILED — app not responding"; exit 1; }
curl -s http://127.0.0.1:3100/api/health
echo
echo "✓ deployed"
