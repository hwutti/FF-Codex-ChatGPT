#!/usr/bin/env bash
# =============================================================================
# Feuerwehr App - Datenbank-Setup-Skript
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

APP_DIR="${APP_DIR:-/var/www/feuerwehr-app}"
DB_NAME="${DB_NAME:-feuerwehrapp}"
DB_USER="${DB_USER:-feuerwehrapp}"

if [[ $EUID -ne 0 ]]; then
  error "Bitte als root ausführen: sudo bash $0"
fi

# Passwort abfragen wenn nicht gesetzt
if [ -z "${DB_PASS:-}" ]; then
  echo -n "PostgreSQL-Passwort für Benutzer '$DB_USER' eingeben: "
  read -rs DB_PASS
  echo
fi

log "Prüfe PostgreSQL..."
systemctl is-active --quiet postgresql || systemctl start postgresql

log "Erstelle Datenbankbenutzer '$DB_USER'..."
sudo -u postgres psql -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
  ELSE
    ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END \$\$;
"

log "Erstelle Datenbank '$DB_NAME'..."
sudo -u postgres psql -c "
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
" | grep -q 'CREATE DATABASE' && sudo -u postgres createdb -O "$DB_USER" "$DB_NAME" || log "Datenbank existiert bereits"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

# .env aktualisieren
if [ -f "$APP_DIR/backend/.env" ]; then
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}|" "$APP_DIR/backend/.env"
  log ".env aktualisiert"
fi

log "Prisma-Migration ausführen..."
cd "$APP_DIR/backend"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
  sudo -u feuerwehrapp npx prisma migrate deploy

log "Seed-Daten einspielen..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
  sudo -u feuerwehrapp npx prisma db seed || warn "Seed-Daten bereits vorhanden oder Fehler"

log "Datenbank erfolgreich eingerichtet!"
log "Verbindungsstring: postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}"
