#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.docker.example .env
  echo "создан .env из .env.docker.example"
fi

docker compose build
docker compose up -d

echo ""
echo "приложение: http://localhost:8000"
echo "логин: admin@imtera.local / password"
echo ""
echo "логи: docker compose logs -f app queue reverb parser"
