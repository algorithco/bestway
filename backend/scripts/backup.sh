#!/usr/bin/env bash
# Kunlik avtomatik zaxira nusxa (Linux server uchun).
# Cron misoli (har kuni 02:00 da):
#   0 2 * * * /bin/bash /path/to/backend/scripts/backup.sh >> /var/log/edu-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/education_center}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="$BACKUP_DIR/education_center_$STAMP.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$FILE"
echo "Zaxira yaratildi: $FILE"

# Eski nusxalarni tozalash
find "$BACKUP_DIR" -name "education_center_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
echo "$KEEP_DAYS kundan eski nusxalar o'chirildi."
