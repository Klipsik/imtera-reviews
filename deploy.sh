#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
if [ -f "$ROOT_DIR/deploy.env" ]; then
  source "$ROOT_DIR/deploy.env"
fi

REMOTE_HOST="${REMOTE_HOST:-194.226.142.147}"
REMOTE_USER="${REMOTE_USER:-kp}"
REMOTE_BASE="${REMOTE_BASE:-/var/www/imtera}"
APP_URL="${APP_URL:-https://imtera.servers31.ru}"
SSH_KEY="${REMOTE_SSH_KEY:-}"

if [ -z "$SSH_KEY" ]; then
  [ -f "$HOME/.ssh/id_ed25519" ] && SSH_KEY="$HOME/.ssh/id_ed25519"
  [ -z "$SSH_KEY" ] && [ -f "$HOME/.ssh/id_rsa" ] && SSH_KEY="$HOME/.ssh/id_rsa"
fi

ssh_opts=(-o StrictHostKeyChecking=no)
[ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && ssh_opts+=(-i "$SSH_KEY")

remote() {
  ssh "${ssh_opts[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"
}

show_connection_info() {
  local ssh_app="ssh"
  [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && ssh_app="ssh -i $SSH_KEY"
  echo "Сайт:     $APP_URL"
  echo "SSH:      $ssh_app $REMOTE_USER@$REMOTE_HOST"
  echo "Путь:     $REMOTE_BASE"
  echo "Деплой:   cd $REMOTE_BASE && git pull && bash scripts/deploy-remote.sh"
}

for arg in "$@"; do
  case "$arg" in
    --connection-info) show_connection_info; exit 0 ;;
    -h|--help)
      echo "deploy.sh [--connection-info]  — деплой на VPS (git pull + deploy-remote.sh)"
      exit 0
      ;;
  esac
done

echo "═══ Деплой на $REMOTE_HOST ═══"
remote "cd $REMOTE_BASE && git fetch origin main && git reset --hard origin/main && bash scripts/deploy-remote.sh"
echo "✓ Готово: $APP_URL"
