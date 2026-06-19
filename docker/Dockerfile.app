FROM oven/bun:1 AS frontend

WORKDIR /app

COPY package.json bun.lock tsconfig.json vite.config.ts env.d.ts ./
COPY resources ./resources
COPY public ./public
COPY .env.docker.example .env

RUN bun install && bun run build

FROM php:8.4-cli

RUN apt-get update && apt-get install -y \
    git unzip libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .
COPY --from=frontend /app/public/build ./public/build

RUN composer install --no-dev --optimize-autoloader \
    && chmod +x docker/entrypoint-app.sh

EXPOSE 8000

ENTRYPOINT ["docker/entrypoint-app.sh"]
