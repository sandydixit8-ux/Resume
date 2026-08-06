#!/usr/bin/env bash
#
# ResumeIQ AI — install from the publish folder onto a fresh Ubuntu VPS (bare-metal).
#
# Steps:
#   1. Copy/upload the whole publish/ folder to the server.
#   2. cd into it and run:
#        sudo bash setup.sh
#   3. Edit backend/.env (set SECRET_KEY, ADMIN_PASSWORD, ANTHROPIC_API_KEY, ...)
#      then: sudo systemctl restart resumeiq-backend
#
set -euo pipefail

YOUR_DOMAIN="yourdomain.com"
INSTALL_DIR="/var/www/resumeiq"
DATA_DIR="$INSTALL_DIR/data"
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"
VENV_DIR="$INSTALL_DIR/venv"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
# Allow running as publish/setup.sh or publish/deploy/setup-from-publish.sh
if [ "$(basename "$SRC_DIR")" = "deploy" ]; then SRC_DIR="$(dirname "$SRC_DIR")"; fi

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run with sudo / as root." >&2
  exit 1
fi
if [ "$YOUR_DOMAIN" = "yourdomain.com" ]; then
  echo "ERROR: set YOUR_DOMAIN at the top of setup.sh first." >&2
  exit 1
fi

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv nodejs npm caddy

log "Copying application to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR" "$DATA_DIR/uploads"
rm -rf "$BACKEND_DIR" "$FRONTEND_DIR"
cp -r "$SRC_DIR/backend" "$BACKEND_DIR"
cp -r "$SRC_DIR/frontend" "$FRONTEND_DIR"
cp "$SRC_DIR/.dockerignore" "$INSTALL_DIR/.dockerignore" 2>/dev/null || true

log "Installing backend dependencies"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$SRC_DIR/deploy/.env.production.example" "$BACKEND_DIR/.env"
  echo "-> Created $BACKEND_DIR/.env from template. EDIT IT NOW (secrets marked CHANGE_ME)." >&2
else
  echo "-> $BACKEND_DIR/.env already exists (kept as-is)."
fi

log "Building frontend"
cd "$FRONTEND_DIR"
npm ci
npm run build

log "Installing systemd units"
cp "$SRC_DIR/deploy/resumeiq-backend.service" /etc/systemd/system/
cp "$SRC_DIR/deploy/resumeiq-frontend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now resumeiq-backend
systemctl enable --now resumeiq-frontend

log "Configuring Caddy (HTTPS for $YOUR_DOMAIN)"
sed "s/yourdomain\.com/$YOUR_DOMAIN/g" "$SRC_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable --now caddy

log "Setting data directory ownership"
chown -R www-data:www-data "$DATA_DIR"

log "Deploy complete!"
echo
echo "  Site:        https://$YOUR_DOMAIN"
echo "  Admin login: https://$YOUR_DOMAIN/admin/login"
echo "  Backend log: journalctl -u resumeiq-backend -f"
echo "  Frontend log: journalctl -u resumeiq-frontend -f"
echo
echo "NEXT STEPS:"
echo "  1. Edit $BACKEND_DIR/.env and set SECRET_KEY, ADMIN_PASSWORD,"
echo "     ADMIN_EMAIL, ANTHROPIC_API_KEY (and Stripe keys if going live)."
echo "  2. sudo systemctl restart resumeiq-backend"
echo
echo "NOTE: set DATABASE_URL=sqlite:////var/www/resumeiq/data/dpiic.db and"
echo "UPLOAD_DIR=/var/www/resumeiq/data/uploads in the .env."
