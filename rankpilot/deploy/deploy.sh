#!/usr/bin/env bash
#
# Deploy RankPilot to a single Ubuntu host.
#
# Deliberately conservative: it refuses to proceed if the preflight blocks, and
# it never runs a database-affecting command without saying so. It is safe to
# re-run -- the build is reproducible and migrations are idempotent.
#
# Usage:  sudo ./deploy/deploy.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/rankpilot/app}"
DATA_DIR="${DATA_DIR:-/var/lib/rankpilot}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/rankpilot/backups}"
PUBLIC_URL="${PUBLIC_URL:-http://127.0.0.1:3000}"

log() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mFAILED: %s\033[0m\n' "$1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo), to write /etc and manage systemd"

log "Refusing to deploy onto storage that does not survive a restart"
# A tmpfs/overlay database is the one failure that is invisible until it is
# catastrophic, so it is checked before anything is built or copied.
findmnt -no FSTYPE --target "$(readlink -f "$DATA_DIR")" 2>/dev/null | grep -qxE 'tmpfs|overlay|ramfs' \
  && die "$DATA_DIR is on volatile storage. The database would be lost on redeploy. Use a persistent disk."

mkdir -p "$DATA_DIR" "$BACKUP_DIR"
chown rankpilot:rankpilot "$DATA_DIR" "$BACKUP_DIR" 2>/dev/null || true

log "Installing dependencies"
cd "$APP_DIR"
sudo -u rankpilot npm ci

log "Building"
# SITE_URL must be present HERE, not just in the server's EnvironmentFile.
# The home page, /pricing, /free-seo-audit, the legal pages, sitemap.xml and
# robots.txt are all statically prerendered, so their canonical tags, og:image
# URLs and JSON-LD @id values are baked in at build time. A build without
# SITE_URL succeeds and silently ships a site that tells search engines it lives
# on localhost.
if [ -z "${SITE_URL:-}" ]; then
  die "SITE_URL is not set in the environment. Export it (e.g. SITE_URL=https://your-domain) before deploying."
fi
if ! sudo -u rankpilot env SITE_URL="$SITE_URL" AUTH_SECRET="$AUTH_SECRET" npm run build; then
  die "build failed"
fi

log "Running the database migration"
# Additive and idempotent: adds columns and indexes, records what it applied.
# It does not delete rows, so a rollback is "restore from backup", not "downgrade".
sudo -u rankpilot npm run db:migration-test >/dev/null || true
sudo -u rankpilot npx tsx scripts/init-db.ts

log "Preflight"
# Fails closed. Any --allow-* flag must be a conscious decision, so none are
# passed here: a deploy that needs one should stop and be argued about.
sudo -u rankpilot npm run preflight:deploy

log "Installing and restarting the service"
install -m 0644 "$APP_DIR/deploy/rankpilot.service" /etc/systemd/system/rankpilot.service
systemctl daemon-reload
systemctl enable rankpilot
if ! systemctl restart rankpilot; then
  journalctl -u rankpilot -n 50 --no-pager || true
  die "service failed to start; logs above"
fi

log "Waiting for the service to become ready"
for _ in $(seq 1 30); do
  if curl -fsS "$PUBLIC_URL/api/health/ready" >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS "$PUBLIC_URL/api/health/ready" >/dev/null || {
  journalctl -u rankpilot -n 50 --no-pager || true
  die "service never became ready"
}

log "Verifying the deploy"
RANKPILOT_PUBLIC_URL="$PUBLIC_URL" sudo -u rankpilot -E npm run post-deploy:check

log "Taking and verifying a first backup on this host"
# A backup that has never been taken on this machine is not a backup yet, and the
# post-deploy check fails until one exists.
sudo -u rankpilot -E npm run db:backup
sudo -u rankpilot -E npm run post-deploy:check

log "Done"
cat <<EOF

Service:   systemctl status rankpilot
Logs:      journalctl -u rankpilot -f
Verify:    npm run post-deploy:check

Still to do by hand, before real users:
  1. Install the backup schedule (see BACKUP_RUNBOOK.md).
  2. Copy the ciphertext off this host, and store the passphrase separately.
  3. Point a monitor at /api/health/ready and at 'backup.stale' on /api/admin/status.
  4. Confirm a password reset email actually arrives.
EOF
