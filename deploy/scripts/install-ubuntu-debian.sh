#!/usr/bin/env bash
# Feuerwehr App — Installations-Script
#
# Verwendung (ein Befehl):
#   curl -fsSL https://raw.githubusercontent.com/hwutti/ff-goertschach/main/deploy/scripts/install-ubuntu-debian.sh | sudo bash -s -- https://github.com/hwutti/ff-goertschach.git
#
# Oder manuell:
#   curl -fsSL https://raw.githubusercontent.com/hwutti/ff-goertschach/main/deploy/scripts/install-ubuntu-debian.sh -o /tmp/install.sh
#   sudo bash /tmp/install.sh https://github.com/hwutti/ff-goertschach.git
#
# NICHT: sudo bash <(curl ...) — sudo kann auf den /proc/self/fd File Descriptor nicht zugreifen
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header() { echo -e "\n${BLUE}========================================${NC}\n${BLUE} $1${NC}\n${BLUE}========================================${NC}\n"; }

[ $EUID -ne 0 ] && error "Bitte als root ausfuehren: sudo bash $0"

# ── Optional: Aus Git-Repository installieren ─────────────────────────
# Verwendung: sudo bash install-ubuntu-debian.sh https://github.com/USER/REPO.git
if [ -n "${1:-}" ]; then
  REPO_URL="$1"
  REPO_DIR="/opt/feuerwehr-app"
  header "Installation aus Git Repository"
  log "Repository: $REPO_URL"
  apt-get install -y git > /dev/null 2>&1
  if [ -d "$REPO_DIR/.git" ]; then
    log "Repository bereits vorhanden – aktualisiere..."
    git -C "$REPO_DIR" pull
  else
    git clone "$REPO_URL" "$REPO_DIR"
  fi
  log "Code geklont nach $REPO_DIR"
  # Skript aus dem geklonten Repo weiterführen
  exec bash "$REPO_DIR/deploy/scripts/install-ubuntu-debian.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_DIR="${REPO_DIR:-/opt/feuerwehr-app}"
APP_DIR="/var/www/feuerwehr-app"
APP_USER="feuerwehrapp"
DB_NAME="feuerwehrapp"
DB_USER="feuerwehrapp"
DB_PASS=$(openssl rand -base64 18 | tr -d '/+=')
JWT_SECRET=$(openssl rand -base64 36 | tr -d '/+=')
ENCRYPTION_KEY=$(openssl rand -hex 32)

log "Projektverzeichnis: $PROJECT_DIR"
git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true
git config --global --add safe.directory "/opt/feuerwehr-app" 2>/dev/null || true
[ -d "$PROJECT_DIR/backend" ] || error "Backend nicht gefunden: $PROJECT_DIR/backend"
[ -d "$PROJECT_DIR/frontend" ] || error "Frontend nicht gefunden: $PROJECT_DIR/frontend"

# Sudoers-Eintrag SOFORT setzen - wird für Backup-Restore benötigt
# Backup-Script installieren (braucht root für DB-Passwort-Reset)
cp "$PROJECT_DIR/deploy/scripts/restore-backup.sh" /usr/local/bin/fw-restore-backup
chmod 700 /usr/local/bin/fw-restore-backup
chown root:root /usr/local/bin/fw-restore-backup
printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-restore-backup
" > /etc/sudoers.d/feuerwehr-backup
chmod 440 /etc/sudoers.d/feuerwehr-backup
log "Sudoers-Regel für Backup-Restore gesetzt"

# Update-Script SOFORT als Root-Wrapper registrieren
cp "$PROJECT_DIR/deploy/scripts/update-from-git.sh" /usr/local/bin/fw-update
chmod 700 /usr/local/bin/fw-update
chown root:root /usr/local/bin/fw-update
printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-update\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app *\n" > /etc/sudoers.d/feuerwehr-update
chmod 440 /etc/sudoers.d/feuerwehr-update
log "Sudoers-Regel für Update + Git gesetzt"

# Ollama-Scripts als Root-Wrapper registrieren
cat > /usr/local/bin/fw-ollama-install << 'OLSCRIPT'
#!/bin/bash
LOG=/tmp/ollama-install.log
rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"
echo ">>> Ollama Installation startet..." > "$LOG"
curl -fsSL https://ollama.com/install.sh | sh >> "$LOG" 2>&1
if [ $? -ne 0 ]; then echo "FEHLER: Ollama Installation fehlgeschlagen" >> "$LOG"; exit 1; fi
systemctl enable ollama >> "$LOG" 2>&1
systemctl start ollama >> "$LOG" 2>&1
# CPU-Limit für Ollama setzen (1200% = 12 Kerne)
mkdir -p /etc/systemd/system/ollama.service.d
printf "[Service]\nEnvironment=\"OLLAMA_KEEP_ALIVE=-1\"\n" > /etc/systemd/system/ollama.service.d/override.conf
systemctl daemon-reload >> "$LOG" 2>&1
systemctl restart ollama >> "$LOG" 2>&1
log ">>> CPU/RAM Limits werden über die App-Einstellungen konfiguriert"
echo ">>> Ollama erfolgreich installiert" >> "$LOG"
exit 0
OLSCRIPT
chmod 700 /usr/local/bin/fw-ollama-install
chown root:root /usr/local/bin/fw-ollama-install

cat > /usr/local/bin/fw-ollama-pull << 'OLSCRIPT'
#!/bin/bash
MODEL="$1"
if [ -z "$MODEL" ]; then echo "FEHLER: Kein Modell angegeben" >&2; exit 1; fi
LOG="/tmp/ollama-pull-$(echo $MODEL | tr ':/' '__').log"
rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"
echo ">>> Lade Modell: $MODEL" > "$LOG"
ollama pull "$MODEL" >> "$LOG" 2>&1
EXIT=$?
if [ $EXIT -eq 0 ]; then echo ">>> Modell $MODEL erfolgreich geladen" >> "$LOG"
else echo "FEHLER: Download fehlgeschlagen (exit $EXIT)" >> "$LOG"; fi
exit $EXIT
OLSCRIPT
chmod 700 /usr/local/bin/fw-ollama-pull
chown root:root /usr/local/bin/fw-ollama-pull
printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-ollama-install\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-ollama-pull *\n" > /etc/sudoers.d/feuerwehr-ollama
chmod 440 /etc/sudoers.d/feuerwehr-ollama
printf "feuerwehrapp ALL=(root) NOPASSWD: /bin/bash /tmp/fw_whisper_install.sh\nfeuerwehrapp ALL=(root) NOPASSWD: /bin/bash /tmp/fw_whisper_cpp_install.sh\nfeuerwehrapp ALL=(root) NOPASSWD: /bin/bash /tmp/fw_model_download.sh\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/bin/python3\n" > /etc/sudoers.d/feuerwehr-whisper
chmod 440 /etc/sudoers.d/feuerwehr-whisper
log "Sudoers-Regel fuer Ollama eingerichtet"

header "Systempakete installieren"
apt-get update -y
apt-get install -y curl wget gnupg2 ca-certificates lsb-release unzip zip openssl rsync cmake build-essential ffmpeg

header "Node.js 20 installieren"
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "Node: $(node -v), npm: $(npm -v)"

header "PostgreSQL installieren"
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

header "Nginx installieren"
apt-get install -y nginx
systemctl enable nginx

header "Systembenutzer anlegen"
id "$APP_USER" &>/dev/null || useradd --system --create-home --shell /bin/bash "$APP_USER"
log "Benutzer: $APP_USER"

header "Verzeichnisse anlegen"
mkdir -p "$APP_DIR"/{frontend/dist,backend,uploads,uploads/avatars,uploads/branding,uploads/protocols,uploads/documents}
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 775 "$APP_DIR/uploads"
chmod 775 "$APP_DIR/uploads/avatars"
# www-data (nginx) braucht Lesezugriff auf uploads
chmod o+rx "$APP_DIR"
chmod o+rx "$APP_DIR/uploads"
chmod o+rx "$APP_DIR/uploads/avatars"

header "Datenbank einrichten"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true

# PostgreSQL Authentifizierung auf scram-sha-256 umstellen (verhindert "Authentication failed")
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | tr -d ' ')
log "pg_hba.conf: $PG_HBA"

# Backup erstellen
cp "$PG_HBA" "${PG_HBA}.bak"

# Alle local/host Einträge auf scram-sha-256 umstellen
sed -i 's/^\(local\s\+all\s\+all\s\+\)peer/\1scram-sha-256/' "$PG_HBA"
sed -i 's/^\(host\s\+all\s\+all\s\+.*\s\+\)ident/\1scram-sha-256/' "$PG_HBA"
sed -i 's/^\(host\s\+all\s\+all\s\+.*\s\+\)md5/\1scram-sha-256/' "$PG_HBA"

# Falls noch kein host-Eintrag für 127.0.0.1 mit scram existiert, hinzufügen
grep -q "127.0.0.1.*scram-sha-256" "$PG_HBA" || \
  echo "host    all             all             127.0.0.1/32            scram-sha-256" >> "$PG_HBA"
grep -q "::1.*scram-sha-256" "$PG_HBA" || \
  echo "host    all             all             ::1/128                 scram-sha-256" >> "$PG_HBA"

# PostgreSQL neu laden damit pg_hba aktiv wird
systemctl reload postgresql
sleep 1
log "PostgreSQL Authentifizierung konfiguriert"

# password_encryption auf scram-sha-256 setzen
PG_CONF=$(sudo -u postgres psql -t -c "SHOW config_file;" | tr -d ' ')
sed -i "s/^#*password_encryption\s*=.*/password_encryption = scram-sha-256/" "$PG_CONF" || true
grep -q "^password_encryption" "$PG_CONF" || echo "password_encryption = scram-sha-256" >> "$PG_CONF"

# PostgreSQL komplett neu starten (reload reicht nicht für password_encryption)
systemctl restart postgresql
sleep 3

# Passwort nochmal setzen damit es mit scram-sha-256 gehasht wird
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"

# Verbindung testen
PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1   && log "Datenbankverbindung erfolgreich getestet"   || error "Datenbankverbindung fehlgeschlagen! Passwort oder pg_hba.conf Problem."
log "Datenbank '$DB_NAME' bereit"

header "Backend einrichten"
SERVER_IP=$(hostname -I | awk '{print $1}')
cp -r "$PROJECT_DIR/backend/." "$APP_DIR/backend/"

cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
PORT=3001
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
NODE_ENV=production
FRONTEND_URL=http://${SERVER_IP}:39615
UPLOAD_DIR=${APP_DIR}/uploads
EOF
chmod 600 "$APP_DIR/backend/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend"

log "npm install..."
cd "$APP_DIR/backend"
sudo -u "$APP_USER" npm install

# VAPID Keys für Push-Benachrichtigungen generieren (web-push npm Paket nötig)
log "VAPID Keys generieren..."
VAPID_KEYS=$(sudo -u "$APP_USER" node -e "
try {
  const wp = require('./node_modules/web-push');
  const k = wp.generateVAPIDKeys();
  console.log(k.publicKey + '|' + k.privateKey);
} catch(e) { console.log('|'); }
" 2>/dev/null || echo "|")
VAPID_PUBLIC=$(echo "$VAPID_KEYS" | cut -d'|' -f1)
VAPID_PRIVATE=$(echo "$VAPID_KEYS" | cut -d'|' -f2)
if [ -n "$VAPID_PUBLIC" ] && [ "$VAPID_PUBLIC" != "" ]; then
  echo "" >> "$APP_DIR/backend/.env"
  echo "VAPID_PUBLIC_KEY=${VAPID_PUBLIC}" >> "$APP_DIR/backend/.env"
  echo "VAPID_PRIVATE_KEY=${VAPID_PRIVATE}" >> "$APP_DIR/backend/.env"
  echo "VAPID_EMAIL=admin@feuerwehr.local" >> "$APP_DIR/backend/.env"
  log "VAPID Keys erfolgreich generiert ✓"
else
  log "WARNUNG: VAPID Keys konnten nicht generiert werden — Push-Benachrichtigungen manuell einrichten"
fi

log "Datenbank-Schema erstellen..."
sudo -u "$APP_USER" npx prisma db push --accept-data-loss || error "Prisma db push fehlgeschlagen"

log "Prisma generate..."
sudo -u "$APP_USER" npx prisma generate || error "Prisma generate fehlgeschlagen"

log "TypeScript build..."
sudo -u "$APP_USER" npm run build || error "TypeScript build fehlgeschlagen"

log "Seed-Daten einspielen..."
sudo -u "$APP_USER" npx prisma db seed 2>/dev/null || true
log "Seed abgeschlossen"

header "Frontend bauen"
rm -rf /tmp/feuerwehr-frontend
mkdir -p /tmp/feuerwehr-frontend
cp -r "$PROJECT_DIR/frontend/." /tmp/feuerwehr-frontend/
cd /tmp/feuerwehr-frontend
npm install
npm run build
cp -r dist/. "$APP_DIR/frontend/dist/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/frontend"
chmod -R 755 "$APP_DIR/frontend/dist"
rm -rf /tmp/feuerwehr-frontend
log "Frontend gebaut"

# ── Automatisches Backup einrichten ───────────────────────────────────────────
header "Backup-System einrichten"

# feuerwehrapp darf postgres psql für Passwort-Reset aufrufen (für Backup-Restore)
# Backup-Script installieren (braucht root für DB-Passwort-Reset)
cp "$PROJECT_DIR/deploy/scripts/restore-backup.sh" /usr/local/bin/fw-restore-backup
chmod 700 /usr/local/bin/fw-restore-backup
chown root:root /usr/local/bin/fw-restore-backup
printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-restore-backup
" > /etc/sudoers.d/feuerwehr-backup
chmod 440 /etc/sudoers.d/feuerwehr-backup
log "Sudoers-Regel für Backup-Restore eingerichtet"

# Update-Script als Root-Wrapper installieren (für In-App-Update ohne Passwort)
cp "$PROJECT_DIR/deploy/scripts/update-from-git.sh" /usr/local/bin/fw-update
chmod 700 /usr/local/bin/fw-update
chown root:root /usr/local/bin/fw-update
printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-update\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app *\n" > /etc/sudoers.d/feuerwehr-update
chmod 440 /etc/sudoers.d/feuerwehr-update
log "Sudoers-Regel für Update + Git eingerichtet"

# Ollama-Scripts als Root-Wrapper registrieren
cat > /usr/local/bin/fw-ollama-install << 'OLSCRIPT'
#!/bin/bash
LOG=/tmp/ollama-install.log
rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"
echo ">>> Ollama Installation startet..." > "$LOG"
curl -fsSL https://ollama.com/install.sh | sh >> "$LOG" 2>&1
if [ $? -ne 0 ]; then echo "FEHLER: Ollama Installation fehlgeschlagen" >> "$LOG"; exit 1; fi
systemctl enable ollama >> "$LOG" 2>&1
systemctl start ollama >> "$LOG" 2>&1
# CPU-Limit für Ollama setzen (1200% = 12 Kerne)
mkdir -p /etc/systemd/system/ollama.service.d
printf "[Service]\nCPUQuota=1200%%\nEnvironment=\"OLLAMA_KEEP_ALIVE=-1\"\n" > /etc/systemd/system/ollama.service.d/override.conf
systemctl daemon-reload >> "$LOG" 2>&1
systemctl restart ollama >> "$LOG" 2>&1
echo ">>> Ollama erfolgreich installiert" >> "$LOG"
exit 0
OLSCRIPT
chmod 700 /usr/local/bin/fw-ollama-install
chown root:root /usr/local/bin/fw-ollama-install

cat > /usr/local/bin/fw-ollama-pull << 'OLSCRIPT'
#!/bin/bash
MODEL="$1"
if [ -z "$MODEL" ]; then echo "FEHLER: Kein Modell angegeben" >&2; exit 1; fi
LOG="/tmp/ollama-pull-$(echo $MODEL | tr ':/' '__').log"
rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"
echo ">>> Lade Modell: $MODEL" > "$LOG"
ollama pull "$MODEL" >> "$LOG" 2>&1
EXIT=$?
if [ $EXIT -eq 0 ]; then echo ">>> Modell $MODEL erfolgreich geladen" >> "$LOG"
else echo "FEHLER: Download fehlgeschlagen (exit $EXIT)" >> "$LOG"; fi
exit $EXIT
OLSCRIPT
chmod 700 /usr/local/bin/fw-ollama-pull
chown root:root /usr/local/bin/fw-ollama-pull
printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-ollama-install\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-ollama-pull *\n" > /etc/sudoers.d/feuerwehr-ollama
chmod 440 /etc/sudoers.d/feuerwehr-ollama
printf "feuerwehrapp ALL=(root) NOPASSWD: /bin/bash /tmp/fw_whisper_install.sh\nfeuerwehrapp ALL=(root) NOPASSWD: /bin/bash /tmp/fw_whisper_cpp_install.sh\nfeuerwehrapp ALL=(root) NOPASSWD: /bin/bash /tmp/fw_model_download.sh\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/bin/python3\n" > /etc/sudoers.d/feuerwehr-whisper
chmod 440 /etc/sudoers.d/feuerwehr-whisper
log "Sudoers-Regel fuer Ollama eingerichtet"

# Backup-Verzeichnis - feuerwehrapp braucht Schreibzugriff für Backup-Erstellung
mkdir -p /var/backups/feuerwehr
chown "$APP_USER:$APP_USER" /var/backups/feuerwehr
chmod 750 /var/backups/feuerwehr

# Backup-Script installieren
cp "$PROJECT_DIR/deploy/scripts/backup-daily.sh" /usr/local/bin/feuerwehr-backup
chmod +x /usr/local/bin/feuerwehr-backup

# Cron-Job: täglich 02:00 Uhr
CRON_JOB="0 2 * * * root /usr/local/bin/feuerwehr-backup >> /var/log/feuerwehr-backup.log 2>&1"
CRON_FILE="/etc/cron.d/feuerwehr-backup"
echo "$CRON_JOB" > "$CRON_FILE"
chmod 644 "$CRON_FILE"
log "Automatisches Backup eingerichtet (täglich 02:00 Uhr)"
log "Backup-Verzeichnis: /var/backups/feuerwehr"
log "Log-Datei: /var/log/feuerwehr-backup.log"

header "systemd Service einrichten"
cat > /etc/systemd/system/feuerwehr-app-backend.service <<EOF
[Unit]
Description=Feuerwehr App Backend
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=/usr/bin/node ${APP_DIR}/backend/dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=feuerwehr-backend
CPUQuota=400%

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable feuerwehr-app-backend
systemctl start feuerwehr-app-backend
sleep 2
systemctl is-active --quiet feuerwehr-app-backend && log "Backend laeuft" || warn "Backend-Problem"

header "Nginx konfigurieren"
cat > /etc/nginx/sites-available/feuerwehr-app.conf <<EOF
server {
    listen 39615;
    server_name _;
    root ${APP_DIR}/frontend/dist;
    index index.html;
    client_max_body_size 500M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_connect_timeout 60s;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    location /uploads/ {
        alias ${APP_DIR}/uploads/;
    }

    location ~* \.(js|css|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/feuerwehr-app.conf /etc/nginx/sites-enabled/feuerwehr-app.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if command -v ufw &>/dev/null; then
  ufw allow OpenSSH 2>/dev/null || true
  ufw allow 39615/tcp 2>/dev/null || true
  ufw --force enable 2>/dev/null || true
fi


cat > /root/feuerwehr-app-credentials.txt <<EOF
=== Feuerwehr App Zugangsdaten ===
Erstellt: $(date)

Web-App:        http://${SERVER_IP}:39615
Login:          admin@feuerwehr.local
Passwort:       admin123  (BITTE SOFORT AENDERN!)

DB-Passwort:    ${DB_PASS}
EOF
chmod 600 /root/feuerwehr-app-credentials.txt

header "Installation abgeschlossen!"
echo -e "${GREEN}"
echo "  URL:      http://${SERVER_IP}:39615"
echo "  Login:    admin@feuerwehr.local"
echo "  Passwort: admin123"
echo -e "${NC}"
echo "Logs: sudo journalctl -u feuerwehr-backend -f"
