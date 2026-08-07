#!/usr/bin/env bash
# Daily pg_dump backup of the production database — infra spec §7 (todo.md:86).
# Runs pg_dump inside the postgres container (matches server version exactly,
# no host package needed), gzips the output to a directory outside the repo,
# and prunes anything older than RETENTION_DAYS.
#
# Restore: gunzip -c /home/ubuntu/bty/backups/better-YYYY-MM-DD.sql.gz | \
#   docker compose -f /home/ubuntu/bty/app/docker-compose.yml exec -T postgres \
#   psql -U better -d better
set -euo pipefail

COMPOSE_FILE=/home/ubuntu/bty/app/docker-compose.yml
BACKUP_DIR=/home/ubuntu/bty/backups
RETENTION_DAYS=14
STAMP="$(date +%F)"
OUT="$BACKUP_DIR/better-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U better -d better | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"

find "$BACKUP_DIR" -name 'better-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
