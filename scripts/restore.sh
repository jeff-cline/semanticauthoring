#!/usr/bin/env bash
#
# Semantic Authoring — restore from a backup
#
# Usage:
#   ./scripts/restore.sh /var/backups/semanticauthoring/sa-2026....tar.enc [target_db]
#
# Defaults to restoring into a SCRATCH database, not over the live one. Doing
# the safe thing by default matters most at the moment you are panicking.
# To overwrite production you must pass the database name explicitly AND
# confirm, because a restore is destructive.

set -euo pipefail

ARCHIVE=${1:-}
TARGET=${2:-sa_restore_check}
APP_DIR=/var/www/semanticauthoring
FILES_DIR=/var/lib/semanticauthoring/files

[ -n "$ARCHIVE" ] || { echo "usage: $0 <archive.tar.enc> [target_db]" >&2; exit 1; }
[ -f "$ARCHIVE" ] || { echo "no such archive: $ARCHIVE" >&2; exit 1; }

set -a; . "$APP_DIR/.env"; set +a
[ -n "${BACKUP_PASSPHRASE:-}" ] || {
  echo "BACKUP_PASSPHRASE not set. If this machine was lost, take it from your" >&2
  echo "password manager and export it before running this." >&2
  exit 1
}

if [ -f "$ARCHIVE.sha256" ]; then
  echo "→ checking integrity"
  echo "$(cat "$ARCHIVE.sha256")  $ARCHIVE" | sha256sum -c - || {
    echo "CHECKSUM MISMATCH — this archive is damaged. Try another." >&2; exit 1; }
fi

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

echo "→ decrypting"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$ARCHIVE" -pass env:BACKUP_PASSPHRASE | tar -x -C "$WORK"

echo "→ contents:"
ls -la "$WORK" | sed 's/^/     /'

if [ "$TARGET" = "semanticauthoring_prod" ]; then
  echo
  echo "!! You are about to overwrite the LIVE database."
  echo "!! Everything currently in semanticauthoring_prod will be destroyed."
  read -rp "Type RESTORE to continue: " confirm
  [ "$confirm" = "RESTORE" ] || { echo "Nothing was changed."; exit 1; }
  sudo -u postgres dropdb --if-exists "$TARGET"
fi

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET'" | grep -q 1 \
  || sudo -u postgres createdb "$TARGET"

echo "→ restoring database into $TARGET"
sudo -u postgres pg_restore -d "$TARGET" --clean --if-exists "$WORK/db.dump" 2>&1 \
  | grep -viE "does not exist, skipping|extension .vector" || true

TABLES=$(sudo -u postgres psql -tA -d "$TARGET" -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
USERS=$(sudo -u postgres psql -tA -d "$TARGET" -c "SELECT count(*) FROM users" 2>/dev/null || echo "?")
echo "   restored: $TABLES tables, $USERS users"

echo
echo "→ uploaded files are in $WORK/files.tar.gz"
echo "   to put them back:  tar -xzf $WORK/files.tar.gz -C $(dirname "$FILES_DIR")"
echo "   (not done automatically — overwriting live files should be deliberate)"
echo
echo "✓ restore complete into: $TARGET"
[ "$TARGET" != "semanticauthoring_prod" ] && \
  echo "  This was a scratch restore. The live database was not touched."
