#!/usr/bin/env bash
#
# ResumeIQ AI — one-shot VPS provisioning script (bare-metal + systemd + Caddy).
#
# Requirements: Ubuntu 22.04/24.04, run as root (or with sudo), and a domain
# pointing at this server. Set YOUR_DOMAIN below before running.
#
#   sudo bash deploy/setup-vps.sh
#
set -euo pipefail

YOUR_DOMAIN="yourdomain.com"
APP_DIR="/var/www/resumeiq"
REPO_URL="https://github.com/sandydixit8-ux/Resume.git"
DATA_DIR="$APP_DIR/data"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
VENV_DIR="$APP_DIR/venv"
GIT_BRANCH="${GIT_BRANCH:-main}"

if [ "$YOUR_DOMAIN" = "yourdomain.com" ]; then
  echo "ERROR: set YOUR_DOMAIN at the top of deploy/setup-vps.sh first." >&2
  exit 1
fi

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run with sudo / as root." >&2
  exit 1
fi

log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git python3 python3-venv nodejs npm caddy curl

log "Cloning application"
mkdir -p "$APP_DIR" "$DATA_DIR/uploads"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only origin "$GIT_BRANCH"
else
  git clone --branch "$GIT_BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "Provisioning backend ($BACKEND_DIR)"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$APP_DIR/deploy/.env.production.example" "$BACKEND_DIR/.env"
  echo "-> Created $BACKEND_DIR/.env from template. EDIT IT NOW (secrets marked CHANGE_ME)." >&2
else
  echo "-> $BACKEND_DIR/.env already exists (kept as-is)."
fi

log "Provisioning frontend ($FRONTEND_DIR)"
cd "$FRONTEND_DIR"
npm ci
npm run build

log "Installing systemd units"
cp "$APP_DIR/deploy/resumeiq-backend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/resumeiq-frontend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now resumeiq-backend
systemctl enable --now resumeiq-frontend

log "Configuring Caddy (HTTPS for $YOUR_DOMAIN)"
sed "s/yourdomain\.com/$YOUR_DOMAIN/g" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
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
echo "NOTE: put DATABASE_URL=sqlite:////var/www/resumeiq/data/dpiic.db and"
echo "UPLOAD_DIR=/var/www/resumeiq/data/uploads in the .env."
