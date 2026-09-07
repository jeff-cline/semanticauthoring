#!/usr/bin/env bash
#
# Semantic Authoring — nightly backup
#
# Four things a backup must do, and most don't:
#   1. Capture the database AND the uploaded files. Either alone is useless.
#   2. Go somewhere the source machine's failure cannot reach. A backup on the
#      same disk as the data is not a backup.
#   3. Be encrypted, because it contains private journals and Life Maps.
#   4. Be RESTORED and checked. An untested backup is a hope, not a plan.
#
# Exit non-zero on any failure; the systemd unit turns that into an alert.

set -euo pipefail

APP_DIR=/var/www/semanticauthoring
BACKUP_DIR=/var/backups/semanticauthoring
FILES_DIR=/var/lib/semanticauthoring/files
DB=semanticauthoring_prod
OFFSITE_HOST=207.148.0.22
OFFSITE_DIR=/var/backups/semanticauthoring
STATUS=/var/lib/semanticauthoring/backup-status.json

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DAY=$(date -u +%F)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

fail() {
  local msg="$1"
  printf '{"ok":false,"at":"%s","error":%s}\n' "$(date -u +%FT%TZ)" "$(printf '%s' "$msg" | head -c 300 | sed 's/"/\\"/g;s/^/"/;s/$/"/')" > "$STATUS" || true
  echo "BACKUP FAILED: $msg" >&2
  exit 1
}

mkdir -p "$BACKUP_DIR" "$(dirname "$STATUS")"
chmod 700 "$BACKUP_DIR"

# The passphrase lives only on this box and in the operator's password manager.
# Deliberately NOT copied offsite — an attacker holding the offsite box must not
# also hold the key to it.
set -a; . "$APP_DIR/.env"; set +a
[ -n "${BACKUP_PASSPHRASE:-}" ] || fail "BACKUP_PASSPHRASE is not set in $APP_DIR/.env"

echo "→ dumping $DB"
sudo -u postgres pg_dump -Fc "$DB" > "$WORK/db.dump" 2>"$WORK/dump.err" \
  || fail "pg_dump: $(head -c 200 "$WORK/dump.err")"
DUMP_BYTES=$(stat -c%s "$WORK/db.dump")
[ "$DUMP_BYTES" -gt 1000 ] || fail "dump suspiciously small (${DUMP_BYTES}B)"

echo "→ archiving uploaded files"
if [ -d "$FILES_DIR" ]; then
  tar -czf "$WORK/files.tar.gz" -C "$(dirname "$FILES_DIR")" "$(basename "$FILES_DIR")"
else
  tar -czf "$WORK/files.tar.gz" -T /dev/null
fi

echo "→ recording schema separately (readable without a restore)"
sudo -u postgres pg_dump -s "$DB" > "$WORK/schema.sql" 2>/dev/null || true

# ── RESTORE VERIFICATION ─────────────────────────────────────────────────────
# Restore into a scratch database and compare table and row counts against the
# live one. This is the step that turns a file into a backup.
echo "→ verifying by restoring into a scratch database"
# pg_restore runs as the postgres user, so it needs to reach the dump. The
# directory is made traversable but not listable, and the dump is handed to
# postgres with 0600 — nobody else on the box can read it.
chmod 711 "$WORK"
chown postgres:postgres "$WORK/db.dump"
chmod 600 "$WORK/db.dump"
SCRATCH="sa_verify_$$"
sudo -u postgres createdb "$SCRATCH" || fail "could not create scratch database"
cleanup_scratch() { sudo -u postgres dropdb --if-exists "$SCRATCH" >/dev/null 2>&1 || true; }
trap 'cleanup_scratch; rm -rf "$WORK"' EXIT

sudo -u postgres pg_restore -d "$SCRATCH" "$WORK/db.dump" >/dev/null 2>"$WORK/restore.err" || {
  # pg_restore warns about extensions it cannot recreate as non-superuser; only
  # a genuine error should fail the run.
  grep -qiE "error|fatal" "$WORK/restore.err" && fail "pg_restore: $(head -c 200 "$WORK/restore.err")"
}

count_tables() {
  sudo -u postgres psql -tA -d "$1" -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
}
LIVE_TABLES=$(count_tables "$DB")
REST_TABLES=$(count_tables "$SCRATCH")
[ "$LIVE_TABLES" = "$REST_TABLES" ] \
  || fail "restore mismatch: live has $LIVE_TABLES tables, restore has $REST_TABLES"

LIVE_USERS=$(sudo -u postgres psql -tA -d "$DB" -c "SELECT count(*) FROM users")
REST_USERS=$(sudo -u postgres psql -tA -d "$SCRATCH" -c "SELECT count(*) FROM users")
[ "$LIVE_USERS" = "$REST_USERS" ] \
  || fail "restore mismatch: live has $LIVE_USERS users, restore has $REST_USERS"

cleanup_scratch
chown root:root "$WORK/db.dump"
chmod 600 "$WORK/db.dump"
echo "   verified: $REST_TABLES tables, $REST_USERS users restored cleanly"

# ── package, encrypt, checksum ───────────────────────────────────────────────
echo "→ encrypting"
tar -cf "$WORK/bundle.tar" -C "$WORK" db.dump files.tar.gz schema.sql
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$WORK/bundle.tar" -out "$BACKUP_DIR/sa-$STAMP.tar.enc" \
  -pass env:BACKUP_PASSPHRASE || fail "encryption failed"
chmod 600 "$BACKUP_DIR/sa-$STAMP.tar.enc"
sha256sum "$BACKUP_DIR/sa-$STAMP.tar.enc" | awk '{print $1}' \
  > "$BACKUP_DIR/sa-$STAMP.tar.enc.sha256"

SIZE=$(stat -c%s "$BACKUP_DIR/sa-$STAMP.tar.enc")

# Confirm the encrypted file actually decrypts before we rely on it.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$BACKUP_DIR/sa-$STAMP.tar.enc" -pass env:BACKUP_PASSPHRASE 2>/dev/null \
  | tar -t >/dev/null || fail "encrypted archive does not decrypt"

# ── offsite ──────────────────────────────────────────────────────────────────
echo "→ copying offsite"
OFFSITE_OK=false
if scp -o BatchMode=yes -o ConnectTimeout=20 -q \
     "$BACKUP_DIR/sa-$STAMP.tar.enc" "$BACKUP_DIR/sa-$STAMP.tar.enc.sha256" \
     "root@$OFFSITE_HOST:$OFFSITE_DIR/" 2>/dev/null; then
  REMOTE_SUM=$(ssh -o BatchMode=yes -o ConnectTimeout=20 "root@$OFFSITE_HOST" \
    "sha256sum $OFFSITE_DIR/sa-$STAMP.tar.enc | awk '{print \$1}'" 2>/dev/null || echo "")
  LOCAL_SUM=$(cat "$BACKUP_DIR/sa-$STAMP.tar.enc.sha256")
  if [ "$REMOTE_SUM" = "$LOCAL_SUM" ] && [ -n "$REMOTE_SUM" ]; then
    OFFSITE_OK=true
    echo "   offsite copy verified by checksum"
  else
    echo "   WARNING: offsite checksum mismatch" >&2
  fi
else
  echo "   WARNING: offsite copy failed" >&2
fi

# ── retention: 7 daily, 4 weekly (Sundays), 6 monthly (1st) ──────────────────
prune() {
  local dir="$1" runner="$2"
  $runner "ls -1 $dir/sa-*.tar.enc 2>/dev/null" | while read -r f; do
    local base d
    base=$(basename "$f"); d=${base:3:8}
    local age=$(( ( $(date -u +%s) - $(date -u -d "${d:0:4}-${d:4:2}-${d:6:2}" +%s) ) / 86400 ))
    local dom=${d:6:2}
    local dow; dow=$(date -u -d "${d:0:4}-${d:4:2}-${d:6:2}" +%u)
    local keep=false
    [ "$age" -le 7 ] && keep=true
    [ "$age" -le 31 ] && [ "$dow" = "7" ] && keep=true
    [ "$age" -le 190 ] && [ "$dom" = "01" ] && keep=true
    if [ "$keep" = false ]; then
      $runner "rm -f $f ${f}.sha256"
    fi
  done
}
prune "$BACKUP_DIR" "bash -c"
$OFFSITE_OK && prune "$OFFSITE_DIR" "ssh -o BatchMode=yes root@$OFFSITE_HOST" || true

LOCAL_COUNT=$(ls -1 "$BACKUP_DIR"/sa-*.tar.enc 2>/dev/null | wc -l)

cat > "$STATUS" <<JSON
{"ok":true,"at":"$(date -u +%FT%TZ)","stamp":"$STAMP","bytes":$SIZE,
 "tables":$REST_TABLES,"users":$REST_USERS,"verified":true,
 "offsite":$OFFSITE_OK,"localCopies":$LOCAL_COUNT}
JSON

echo "✓ backup complete — $(numfmt --to=iec "$SIZE"), verified by restore, offsite: $OFFSITE_OK"
