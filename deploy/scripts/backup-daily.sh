#!/bin/bash
# Feuerwehr App - Tägliches Backup
# Wird automatisch durch Cron-Job ausgeführt (täglich 02:00 Uhr)

set -euo pipefail

APP_DIR="/var/www/feuerwehr-app"
BACKUP_DIR="/var/backups/feuerwehr"
KEEP_COUNT=5
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/feuerwehr-backup-$TIMESTAMP.zip"
LOG_FILE="/var/log/feuerwehr-backup.log"
TMP_DIR="/tmp/fw-daily-backup-$$"

log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true; }
error() { log "FEHLER: $1"; rm -rf "$TMP_DIR"; exit 1; }

touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/feuerwehr-backup.log"
log "=== Starte tägliches Backup ==="

mkdir -p "$BACKUP_DIR" "$TMP_DIR"
chmod 700 "$TMP_DIR"

# .env SICHER parsen — kein source, nur KEY=VALUE Zeilen lesen
ENV_FILE="$APP_DIR/backend/.env"
[ -f "$ENV_FILE" ] || error ".env nicht gefunden: $ENV_FILE"

parse_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

DATABASE_URL=$(parse_env "DATABASE_URL")
[ -z "$DATABASE_URL" ] && error "DATABASE_URL nicht gefunden"

# URL robuster parsen (unterstützt ?schema=public etc.)
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')

[ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] && \
  error "DATABASE_URL konnte nicht geparst werden"

log "Datenbank: $DB_NAME@$DB_HOST:$DB_PORT"

# 1. PostgreSQL Dump — Passwort über Umgebungsvariable, kein Shell-Injection
log "Erstelle Datenbank-Dump..."
PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password \
  --clean \
  --if-exists \
  -F p \
  -f "$TMP_DIR/database.sql" || error "pg_dump fehlgeschlagen"

SQL_SIZE=$(du -sh "$TMP_DIR/database.sql" | cut -f1)
log "Datenbank-Dump: $SQL_SIZE"

# 2. .env kopieren (nicht sourced)
cp "$ENV_FILE" "$TMP_DIR/app.env"
chmod 600 "$TMP_DIR/app.env"
log ".env gesichert"

# 3. UPLOAD_DIR aus .env lesen (Fallback auf Standard-Pfad)
UPLOAD_DIR=$(parse_env "UPLOAD_DIR")
if [ -z "$UPLOAD_DIR" ]; then
  UPLOAD_DIR="$APP_DIR/uploads"
  log "UPLOAD_DIR nicht in .env gefunden — verwende Standard: $UPLOAD_DIR"
else
  log "UPLOAD_DIR aus .env: $UPLOAD_DIR"
fi

# 4. Backup-Metadaten
cat > "$TMP_DIR/backup-meta.json" << EOF
{
  "version": "1.0",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "automatic",
  "hostname": "$(hostname)",
  "appVersion": "2.2.0",
  "uploadDir": "$UPLOAD_DIR"
}
EOF

# 5. ZIP erstellen
log "Erstelle ZIP-Archiv..."
cd "$TMP_DIR"
zip -r "$BACKUP_FILE" database.sql app.env backup-meta.json \
  || error "ZIP-Erstellung fehlgeschlagen (zip installiert? sudo apt install zip)"

# Uploads hinzufügen (aus UPLOAD_DIR)
if [ -d "$UPLOAD_DIR" ]; then
  UPLOAD_SIZE=$(du -sh "$UPLOAD_DIR" | cut -f1)
  log "Füge Uploads hinzu ($UPLOAD_SIZE) aus $UPLOAD_DIR..."
  # Uploads immer als 'uploads/' im ZIP speichern (einheitliche Struktur)
  UPLOAD_PARENT=$(dirname "$UPLOAD_DIR")
  UPLOAD_BASE=$(basename "$UPLOAD_DIR")
  cd "$UPLOAD_PARENT"
  zip -r "$BACKUP_FILE" "$UPLOAD_BASE/" 2>/dev/null || true
  cd "$TMP_DIR"
else
  log "Warnung: Upload-Verzeichnis nicht gefunden: $UPLOAD_DIR"
fi

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup erstellt: $BACKUP_FILE ($BACKUP_SIZE)"

# 5. Alte Backups bereinigen — nur die neuesten $KEEP_COUNT behalten
log "Bereinige alte Backups (behalte neueste $KEEP_COUNT)..."
ls -t "$BACKUP_DIR"/feuerwehr-backup-*.zip 2>/dev/null | tail -n +$((KEEP_COUNT + 1)) | while read -r f; do
  rm -f "$f"
  log "  Gelöscht: $(basename "$f")"
done

# 6. Aufräumen
rm -rf "$TMP_DIR"

# 7. Übersicht
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "feuerwehr-backup-*.zip" 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "Backups vorhanden: $BACKUP_COUNT (gesamt: $TOTAL_SIZE)"
log "=== Backup erfolgreich abgeschlossen ==="
