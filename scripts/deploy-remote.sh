#!/usr/bin/env bash
# Выполняется на VPS после git pull (вручную или из GitHub Actions).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/imtera}"
cd "$APP_DIR"

export PATH="/home/kp/.bun/bin:/usr/local/bin:$PATH"

echo "==> Composer"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Frontend"
bun install --frozen-lockfile
bun run build

echo "==> Parser"
cd services/parser
bun install --production
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  bunx playwright install chromium
fi
cd "$APP_DIR"

echo "==> Laravel"
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Restart workers"
php artisan horizon:terminate 2>/dev/null || true
sudo supervisorctl restart imtera-horizon imtera-reverb 2>/dev/null \
  || sudo supervisorctl reread && sudo supervisorctl update

sudo systemctl restart imtera-parser

chown -R kp:www-data storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 2775 {} +
find storage bootstrap/cache -type f -exec chmod 664 {} +

echo "Deploy complete: $(grep APP_URL .env | head -1)"
