#!/usr/bin/env bash
# Full backup for production VPS (DB + storage volume).
# Cron (har kuni 02:00 da):
#   0 2 * * * DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5433/education_center" BACKUP_DIR=/opt/backups /bin/bash /opt/bestway/backend/scripts/backup-full.sh >> /var/log/bestway-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/education_center}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STORAGE_VOLUME="${STORAGE_VOLUME:-education_backend_storage}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

# 1. Postgres dump
DB_FILE="$BACKUP_DIR/education_center_$STAMP.sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$DB_FILE"
echo "DB zaxira yaratildi: $DB_FILE"

# 2. Storage volume (videos, thumbnails, teachers, gallery, mock)
STORAGE_FILE="$BACKUP_DIR/education_storage_$STAMP.tar.gz"
if docker volume inspect "$STORAGE_VOLUME" >/dev/null 2>&1; then
  docker run --rm \
    -v "$STORAGE_VOLUME:/data:ro" \
    -v "$BACKUP_DIR:/backup" \
    alpine tar -czf "/backup/education_storage_$STAMP.tar.gz" -C /data .
  echo "Storage zaxira yaratildi: $STORAGE_FILE"
else
  echo "OGOHLANTIRISH: Docker volume '$STORAGE_VOLUME' topilmadi — storage backup o'tkazib yuborildi." >&2
fi

# 3. Eski nusxalarni tozalash
find "$BACKUP_DIR" -name "education_center_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "education_storage_*.tar.gz" -mtime "+$KEEP_DAYS" -delete
echo "$KEEP_DAYS kundan eski nusxalar o'chirildi."
