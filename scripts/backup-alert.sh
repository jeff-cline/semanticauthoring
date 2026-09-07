#!/usr/bin/env bash
# Called by systemd when the backup unit fails. Sends through the Core, and
# always writes the status file so /api/health reports the failure even if the
# email cannot go out.
set -uo pipefail
APP_DIR=/var/www/semanticauthoring
STATUS=/var/lib/semanticauthoring/backup-status.json
set -a; . "$APP_DIR/.env" 2>/dev/null || true; set +a

CODE=${1:-unknown}
WHEN=$(date -u +%FT%TZ)
LOG=$(journalctl -u sa-backup.service -n 25 --no-pager 2>/dev/null | tail -c 1500)

printf '{"ok":false,"at":"%s","error":"backup unit failed (exit %s)"}\n' "$WHEN" "$CODE" > "$STATUS" 2>/dev/null || true

if [ -n "${CORE_API_KEY:-}" ] && [ -n "${NOTIFY_TO:-}" ]; then
  BODY=$(printf '%s' "$LOG" | sed 's/[\\"]/\\&/g' | tr '\n' ' ')
  curl -s --max-time 20 -X POST "${CORE_API_BASE}/api/core/email" \
    -H "x-core-key: $CORE_API_KEY" -H "x-core-secret: $CORE_API_SECRET" \
    -H "content-type: application/json" \
    -d "{\"to\":\"$NOTIFY_TO\",\"subject\":\"Semantic Authoring backup FAILED\",\"provider\":\"google_workspace\",\"html\":\"<p>The nightly backup failed at $WHEN (exit $CODE).</p><p>The database was <strong>not</strong> backed up tonight.</p><pre style='font-size:12px'>$BODY</pre>\"}" \
    >/dev/null 2>&1
fi
