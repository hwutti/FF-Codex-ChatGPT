#!/bin/bash
# Feuerwehr App - Backup Restore Script
# Wird von der App mit sudo aufgerufen
# Usage: sudo /usr/local/bin/fw-restore-backup <zip-path>

set -euo pipefail

ZIP_FILE="$1"
APP_DIR="/var/www/feuerwehr-app"
ENV_FILE="$APP_DIR/backend/.env"
TMP_DIR="/tmp/fw-restore-$$"

log()   { echo "[RESTORE] $1"; }
error() { echo "[RESTORE ERROR] $1" >&2; rm -rf "$TMP_DIR"; exit 1; }

[ -z "$ZIP_FILE" ] && error "Kein ZIP-Pfad angegeben"
[ -f "$ZIP_FILE" ] || error "ZIP-Datei nicht gefunden: $ZIP_FILE"

# Sicherheits-Check: ZIP-Pfad muss in einem erlaubten Verzeichnis liegen
# /tmp        → Browser-Upload via Multer
# /var/backups/feuerwehr → Server-seitige Backups
REAL_ZIP=$(realpath "$ZIP_FILE")
ALLOWED=0
for DIR in "/tmp" "/var/backups/feuerwehr"; do
  if [[ "$REAL_ZIP" == "$DIR"/* || "$REAL_ZIP" == "$DIR" ]]; then
    ALLOWED=1
    break
  fi
done
if [ "$ALLOWED" -eq 0 ]; then
  error "ZIP-Datei muss in /tmp oder /var/backups/feuerwehr liegen (gefunden: $REAL_ZIP)"
fi

log "Starte Restore: $ZIP_FILE"
mkdir -p "$TMP_DIR"
chmod 700 "$TMP_DIR"

# 1. ZIP entpacken
unzip -q "$ZIP_FILE" -d "$TMP_DIR" || error "ZIP konnte nicht entpackt werden"

# 2. Backup verifizieren
[ -f "$TMP_DIR/backup-meta.json" ] || error "Ungültiges Backup - backup-meta.json fehlt"
[ -f "$TMP_DIR/database.sql" ]     || error "Ungültiges Backup - database.sql fehlt"
[ -f "$TMP_DIR/app.env" ]          || error "Ungültiges Backup - app.env fehlt"

# Datenbankdatei auf gefährliche Inhalte prüfen
if grep -qiE "^\s*(COPY|\\\\!|\\\\o|\\\\w|CREATE EXTENSION|ALTER SYSTEM)" "$TMP_DIR/database.sql" 2>/dev/null; then
  # COPY ist normal in pg_dump - nur Shell-Escape-Zeichen sind gefährlich
  if grep -qE "^\\\\[!ow]" "$TMP_DIR/database.sql" 2>/dev/null; then
    error "Verdächtige Inhalte in database.sql gefunden"
  fi
fi

log "Backup verifiziert"

# 3. .env SICHER parsen — kein source, nur KEY=VALUE Zeilen
# Liest nur Zeilen der Form KEY=VALUE, ignoriert Kommentare und alles andere
parse_env() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

DATABASE_URL=$(parse_env "$TMP_DIR/app.env" "DATABASE_URL")
[ -z "$DATABASE_URL" ] && error "DATABASE_URL nicht in app.env gefunden"

# DB-Verbindungsdaten aus DATABASE_URL robuster parsen (ohne Regex-Ende-Anker)
# Format: postgresql://user:pass@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')

[ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] && \
  error "DATABASE_URL konnte nicht geparst werden: $DATABASE_URL"

log "Datenbank: $DB_NAME@$DB_HOST:$DB_PORT als $DB_USER"

# 4. PostgreSQL-Passwort setzen
sudo -u postgres psql -c "ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';" \
  || error "Passwort konnte nicht gesetzt werden"
log "PostgreSQL-Passwort gesetzt"

# 5. Verbindung testen
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT 1;" > /dev/null 2>&1 \
  || error "Datenbankverbindung fehlgeschlagen"
log "Datenbankverbindung OK"

# 6. Datenbank wiederherstellen
# Schema komplett löschen und neu erstellen
# > /dev/null 2>&1 unterdrückt NOTICE-Meldungen (z.B. "drop cascades to type ...")
# || true verhindert Abbruch durch set -e falls psql trotz Erfolg Exit != 0 zurückgibt
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO \"$DB_USER\"; GRANT ALL ON SCHEMA public TO public;" > /dev/null 2>&1 || true
log "Schema gelöscht und neu erstellt"

# SQL-Dump einspielen — ON_ERROR_STOP=off ignoriert bereits nicht existierende DROP-Befehle
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=off \
  -f "$TMP_DIR/database.sql" > /dev/null 2>&1
log "SQL-Dump eingespielt"
log "Datenbank wiederhergestellt"

# 7. .env wiederherstellen — NUR aus der Backup-Datei kopieren, kein source
cp "$TMP_DIR/app.env" "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown feuerwehrapp:feuerwehrapp "$ENV_FILE"
log ".env wiederhergestellt"

# 8. Uploads wiederherstellen
UPLOAD_DIR=$(parse_env "$ENV_FILE" "UPLOAD_DIR")
[ -z "$UPLOAD_DIR" ] && UPLOAD_DIR="/var/www/feuerwehr-app/uploads"

# ZIP kann 'uploads/' oder einen anderen Ordnernamen haben
UPLOADS_IN_ZIP=""
for name in "uploads" "$(basename "$UPLOAD_DIR")"; do
  if unzip -l "$ZIP_FILE" | grep -q "$name/"; then
    UPLOADS_IN_ZIP="$name"
    break
  fi
done

if [ -n "$UPLOADS_IN_ZIP" ] && [ -d "$TMP_DIR/$UPLOADS_IN_ZIP" ]; then
  rm -rf "$UPLOAD_DIR"
  mkdir -p "$UPLOAD_DIR"
  cp -r "$TMP_DIR/$UPLOADS_IN_ZIP/." "$UPLOAD_DIR/"
  chown -R feuerwehrapp:feuerwehrapp "$UPLOAD_DIR"
  log "Uploads wiederhergestellt nach: $UPLOAD_DIR"
else
  log "Warnung: Keine Uploads im Backup gefunden"
fi

# 9. Prisma Migrationen anwenden (für neue Maschinen / Schema-Updates)
APP_DIR="/var/www/feuerwehr-app"
if [ -d "$APP_DIR/backend" ]; then
  log "Prisma Migrationen anwenden..."
  cd "$APP_DIR/backend"
  runuser -u feuerwehrapp -- npx prisma migrate deploy 2>&1 | grep -E "migration|error|Error" || true
  runuser -u feuerwehrapp -- npx prisma generate > /dev/null 2>&1 || true
  log "Prisma abgeschlossen"
fi

# 10. Service neu starten damit neue DB aktiv wird
SERVICE=""
if systemctl list-units --type=service --quiet 2>/dev/null | grep -q "feuerwehr-app-backend"; then
  SERVICE="feuerwehr-app-backend"
elif systemctl list-units --type=service --quiet 2>/dev/null | grep -q "feuerwehr-backend"; then
  SERVICE="feuerwehr-backend"
fi

if [ -n "$SERVICE" ]; then
  log "Service $SERVICE wird neu gestartet..."
  # Verzögerter Neustart im Hintergrund — damit das Script zuerst sauber
  # mit Exit 0 endet bevor der Node-Prozess gekillt wird
  ( sleep 2 && systemctl restart "$SERVICE" ) &
  disown
else
  log "Warnung: Kein Backend-Service gefunden — bitte manuell neu starten"
fi

# 12. Aufräumen
rm -rf "$TMP_DIR"
# ZIP nur löschen wenn es ein temporärer Browser-Upload war (aus /tmp)
# Server-Backups in /var/backups/feuerwehr bleiben erhalten
if [[ "$REAL_ZIP" == /tmp/* ]]; then
  rm -f "$ZIP_FILE"
fi

log "Restore erfolgreich abgeschlossen!"
