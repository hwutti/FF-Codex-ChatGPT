#!/usr/bin/env bash
# =============================================================================
# Feuerwehr App - Datenbank-Backup-Skript
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

BACKUP_DIR="${BACKUP_DIR:-/var/backups/feuerwehr-app}"
DB_NAME="${DB_NAME:-feuerwehrapp}"
DB_USER="${DB_USER:-feuerwehrapp}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Verzeichnis erstellen
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Umgebungsvariablen laden
ENV_FILE="${ENV_FILE:-/var/www/feuerwehr-app/backend/.env}"
if [ -f "$ENV_FILE" ]; then
  DB_PASS=$(grep "^DATABASE_URL=" "$ENV_FILE" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
fi

log "Erstelle Backup der Datenbank '$DB_NAME'..."
log "Zieldatei: $BACKUP_FILE"

# Backup mit pg_dump
PGPASSWORD="${DB_PASS:-}" pg_dump \
  -U "$DB_USER" \
  -h localhost \
  -d "$DB_NAME" \
  --no-password \
  --format=plain \
  --verbose 2>/dev/null | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  log "Backup erfolgreich: $BACKUP_FILE ($BACKUP_SIZE)"
else
  error "Backup fehlgeschlagen!"
fi

# Alte Backups löschen
log "Lösche Backups älter als $KEEP_DAYS Tage..."
DELETED=$(find "$BACKUP_DIR" -name "db_${DB_NAME}_*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
log "$DELETED alte Backup(s) gelöscht"

# Backup-Übersicht
echo ""
log "Aktuelle Backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/db_${DB_NAME}_*.sql.gz 2>/dev/null || warn "Keine Backups gefunden"

echo ""
echo "=== Wiederherstellung ==="
echo "So stellen Sie ein Backup wieder her:"
echo ""
echo "  # Backup entpacken:"
echo "  gunzip -c $BACKUP_FILE > /tmp/restore.sql"
echo ""
echo "  # Datenbank wiederherstellen:"
echo "  sudo -u postgres psql -d $DB_NAME < /tmp/restore.sql"
echo ""
echo "  # ODER direkt:"
echo "  gunzip -c $BACKUP_FILE | sudo -u postgres psql -d $DB_NAME"
