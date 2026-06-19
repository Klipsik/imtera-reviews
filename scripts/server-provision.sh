#!/usr/bin/env bash
# Первичная настройка imtera на уже провижененном VPS (kp, nginx, postgres, redis).
# Запуск на сервере от kp: bash scripts/server-provision.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/imtera}"
REVERB_PORT="${REVERB_PORT:-8082}"
DB_NAME="${DB_NAME:-imtera}"
DB_USER="${DB_USER:-imtera}"
DB_PASS="${DB_PASS:?Задайте DB_PASS}"

export PATH="/home/kp/.bun/bin:/usr/local/bin:$PATH"

echo "==> Bun"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="/home/kp/.bun/bin:$PATH"
fi

echo "==> PostgreSQL"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "==> Каталог приложения"
sudo install -d -o kp -g www-data -m 2775 "$APP_DIR"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Скопируйте deploy/.env.production.example в $APP_DIR/.env и задайте APP_KEY, DB_PASS" >&2
  exit 1
fi

echo "==> nginx"
sudo cp "$APP_DIR/deploy/nginx/imtera.servers31.ru.conf" /etc/nginx/sites-available/imtera
sudo ln -sf /etc/nginx/sites-available/imtera /etc/nginx/sites-enabled/imtera
sudo nginx -t
sudo systemctl reload nginx

echo "==> Supervisor"
sudo cp "$APP_DIR/deploy/supervisor/imtera-horizon.conf" /etc/supervisor/conf.d/
sudo cp "$APP_DIR/deploy/supervisor/imtera-reverb.conf" /etc/supervisor/conf.d/
sudo supervisorctl reread
sudo supervisorctl update

echo "==> Parser systemd"
sudo cp "$APP_DIR/deploy/imtera-parser.service" /etc/systemd/system/imtera-parser.service
sudo systemctl daemon-reload
sudo systemctl enable imtera-parser

echo "✓ Провижининг imtera завершён"
echo "  Далее: bash scripts/deploy-remote.sh"
