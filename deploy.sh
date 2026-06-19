#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Composer install"
composer install --no-dev --optimize-autoloader

echo "==> Frontend build"
bun install
bun run build

echo "==> Parser dependencies"
cd services/parser
bun install --production
bunx playwright install chromium
cd "$ROOT"

echo "==> Migrations"
php artisan migrate --force

echo "==> Restart services"
sudo systemctl restart imtera-parser || true
php artisan queue:restart
php artisan octane:reload || true

echo "Deploy complete."
