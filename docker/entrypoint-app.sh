#!/bin/sh
set -e

cd /var/www/html

if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:" ]; then
  php artisan key:generate --force
fi

php artisan config:clear
php artisan migrate --force --seed

exec php artisan serve --host=0.0.0.0 --port=8000
