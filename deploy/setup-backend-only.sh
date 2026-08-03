#!/usr/bin/env bash
#
# ResumeIQ AI - install ONLY the backend on an Oracle Cloud free VM.
# Use when the frontend runs on Netlify (see deploy/NETLIFY_ORACLE_FREE_GUIDE.md).
#
# Steps:
#   1. Upload/clone this repo on the VM.
#   2. Set YOUR_DOMAIN below (e.g. resumeiq-api.duckdns.org).
#   3. Run:  sudo bash deploy/setup-backend-only.sh
#   4. Edit backend/.env, then: sudo systemctl restart resumeiq-backend
#
set -euo pipefail

YOUR_DOMAIN="yourdomain.com"
INSTALL_DIR="/var/www/resumeiq"
BACKEND_DIR="$INSTALL_DIR/backend"
VENV_DIR="$INSTALL_DIR/venv"
DATA_DIR="$INSTALL_DIR/data"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
if [ "$(basename "$SRC_DIR")" = "deploy" ]; then SRC_DIR="$(dirname "$SRC_DIR")"; fi

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run with sudo / as root." >&2
  exit 1
fi
if [ "$YOUR_DOMAIN" = "yourdomain.com" ]; then
  echo "ERROR: set YOUR_DOMAIN at the top of setup-backend-only.sh first." >&2
  exit 1
fi

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv caddy curl

log "Copying backend to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR" "$DATA_DIR/uploads"
rm -rf "$BACKEND_DIR"
cp -r "$SRC_DIR/backend" "$BACKEND_DIR"

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

log "Installing systemd unit (resumeiq-backend)"
cp "$SRC_DIR/deploy/resumeiq-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now resumeiq-backend

log "Configuring Caddy (HTTPS for $YOUR_DOMAIN)"
cat > /etc/caddy/Caddyfile <<EOF
$YOUR_DOMAIN {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8000
}
EOF
systemctl enable --now caddy

log "Setting data directory ownership"
chown -R www-data:www-data "$DATA_DIR"

log "Backend install complete!"
echo
echo "  Backend URL: https://$YOUR_DOMAIN  (health: https://$YOUR_DOMAIN/api/v1/health)"
echo "  Logs: journalctl -u resumeiq-backend -f"
echo
echo "NEXT STEPS:"
echo "  1. Edit $BACKEND_DIR/.env and set SECRET_KEY, ADMIN_PASSWORD,"
echo "     ANTHROPIC_API_KEY (and Stripe keys if going live)."
echo "  2. Set CORS_ORIGINS to your Netlify site URL, then:"
echo "     sudo systemctl restart resumeiq-backend"
echo
echo "NOTE: set DATABASE_URL=sqlite:////var/www/resumeiq/data/dpiic.db and"
echo "UPLOAD_DIR=/var/www/resumeiq/data/uploads in the .env."
