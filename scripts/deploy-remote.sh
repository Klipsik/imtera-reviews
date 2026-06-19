#!/usr/bin/env bash
# Выполняется на VPS после git pull (вручную или из GitHub Actions).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/imtera}"
cd "$APP_DIR"

export PATH="/home/kp/.bun/bin:/usr/local/bin:$PATH"

echo "==> Composer"
if ! composer install --no-dev --optimize-autoloader --no-interaction 2>/dev/null; then
  echo "composer on server failed, expecting vendor from CI/rsync" >&2
  composer dump-autoload --optimize --no-dev --no-scripts -q
fi

echo "==> Frontend"
if [ "${SKIP_FRONTEND_BUILD:-0}" = "1" ] && [ -f public/build/manifest.json ]; then
  echo "skip (manifest exists)"
else
  bun install --frozen-lockfile
  # vue-tsc на слабом VPS падает по OOM; типы проверяются в CI
  bunx vite build
fi

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

sudo chown -R kp:www-data storage bootstrap/cache 2>/dev/null || true
find storage bootstrap/cache -type d -exec chmod 2775 {} + 2>/dev/null || true
find storage bootstrap/cache -type f -exec chmod 664 {} + 2>/dev/null || true

echo "Deploy complete: $(grep APP_URL .env | head -1)"
