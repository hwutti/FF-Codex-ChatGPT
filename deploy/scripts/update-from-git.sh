#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# Feuerwehr Verwaltung – Update aus Git Repository
# Verwendung: sudo bash update-from-git.sh [REPO_URL]
# ══════════════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/feuerwehr-app"
APP_USER="feuerwehrapp"
REPO_DIR="/opt/feuerwehr-app"
STATUS_FILE="/tmp/feuerwehr-update-status.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗ FEHLER:${NC} $1" >&2; exit 1; }

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Feuerwehr Verwaltung – Git Update  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Root-Check ────────────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && error "Bitte als root ausführen: sudo bash update-from-git.sh"

# ── Status: läuft ─────────────────────────────────────────────────────
rm -f "$STATUS_FILE"
echo '{"running":true,"done":false,"exitCode":null}' > "$STATUS_FILE"
chmod 666 "$STATUS_FILE"

# Bei Fehler: Status auf fehlgeschlagen setzen
trap 'rm -f "$STATUS_FILE"; echo "{\"running\":false,\"done\":true,\"exitCode\":1,\"finishedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATUS_FILE"; chmod 666 "$STATUS_FILE"' ERR

# ── ENCRYPTION_KEY in .env sicherstellen ─────────────────────────────
ENV_FILE="$APP_DIR/backend/.env"
# ── GitHub Token direkt aus DB entschlüsseln (kein Backend-Aufruf nötig) ──────
GITHUB_TOKEN=""
GITHUB_REPO=""
ENV_FILE="$APP_DIR/backend/.env"

# ENCRYPTION_KEY sicherstellen
if [ -f "$ENV_FILE" ] && ! grep -q "^ENCRYPTION_KEY=" "$ENV_FILE"; then
  NEW_KEY=$(openssl rand -hex 32)
  echo "ENCRYPTION_KEY=$NEW_KEY" >> "$ENV_FILE"
  log "ENCRYPTION_KEY generiert und in .env geschrieben"
fi

# Token aus DB lesen + entschlüsseln via psql (kein pg-Modul nötig)
if [ -f "$APP_DIR/backend/.env" ]; then
  # ENCRYPTION_KEY + DATABASE_URL aus .env laden
  _ENC_KEY=$(grep "^ENCRYPTION_KEY=" "$APP_DIR/backend/.env" | cut -d= -f2- | tr -d '"'"'" | tr -d '\r')
  _DB_URL=$(grep "^DATABASE_URL=" "$APP_DIR/backend/.env" | cut -d= -f2- | tr -d '"'"'" | tr -d '\r')

  if [ -n "$_ENC_KEY" ] && [ -n "$_DB_URL" ]; then
    _DB_ROW=$(psql "$_DB_URL" -t -A -c "SELECT \"githubToken\", \"githubRepo\" FROM app_settings WHERE id='singleton';" 2>/dev/null || true)
    _GH_TOKEN_ENC=$(echo "$_DB_ROW" | cut -d'|' -f1)
    _GH_REPO_DB=$(echo "$_DB_ROW" | cut -d'|' -f2)

    if [ -n "$_GH_TOKEN_ENC" ] && [ -n "$_GH_REPO_DB" ]; then
      _GH_RESULT=$(node -e "
        const crypto = require('crypto');
        const key = crypto.createHash('sha256').update('$_ENC_KEY').digest();
        const parts = '$_GH_TOKEN_ENC'.split(':');
        if (parts.length !== 3) process.exit(1);
        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const enc = Buffer.from(parts[2], 'hex');
        const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
        d.setAuthTag(tag);
        const token = Buffer.concat([d.update(enc), d.final()]).toString('utf8');
        console.log(token);
      " 2>/dev/null || true)

      if [ -n "$_GH_RESULT" ]; then
        GITHUB_TOKEN="$_GH_RESULT"
        GITHUB_REPO="$_GH_REPO_DB"
        log "GitHub Token aus DB geladen"
      fi
    fi
  fi
fi

# ── Git Repository URL ────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  REPO_URL="$1"
elif [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPO" ]; then
  REPO_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
  log "GitHub Token aus App geladen (privates Repo)"
elif [ -d "$REPO_DIR/.git" ]; then
  REPO_URL=$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || echo "")
else
  echo -e "${YELLOW}Kein Repository gefunden.${NC}"
  read -rp "Git Repository URL eingeben: " REPO_URL
  [ -z "$REPO_URL" ] && error "Keine URL angegeben."
fi

echo -e "Repository: ${YELLOW}${REPO_URL}${NC}"
echo ""

# ── Backup vor Update ─────────────────────────────────────────────────
echo "▶ Datenbank-Backup vor dem Update..."
BACKUP_SCRIPT="/usr/local/bin/feuerwehr-backup"
[ ! -f "$BACKUP_SCRIPT" ] && BACKUP_SCRIPT="$REPO_DIR/deploy/scripts/backup-daily.sh"
if [ -f "$BACKUP_SCRIPT" ] && bash "$BACKUP_SCRIPT"; then
  log "Backup erstellt"
else
  warn "Backup fehlgeschlagen — Update wird trotzdem fortgesetzt"
fi

# ── Repository aktualisieren ─────────────────────────────────────────
echo "▶ Repository aktualisieren..."
if [ -d "$REPO_DIR/.git" ]; then
  # Remote URL mit Token aktualisieren falls Token vorhanden
  if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPO" ]; then
    git -C "$REPO_DIR" remote set-url origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
  fi
  git -C "$REPO_DIR" fetch origin
  git -C "$REPO_DIR" reset --hard origin/main
  # Token aus Remote-URL wieder entfernen (Sicherheit)
  if [ -n "$GITHUB_REPO" ]; then
    git -C "$REPO_DIR" remote set-url origin "https://github.com/${GITHUB_REPO}.git"
  fi
else
  [ -d "$REPO_DIR" ] && rm -rf "$REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
  # Token aus Remote-URL wieder entfernen
  if [ -n "$GITHUB_REPO" ]; then
    git -C "$REPO_DIR" remote set-url origin "https://github.com/${GITHUB_REPO}.git"
  fi
fi
log "Code aktualisiert"

# ── .env sichern ─────────────────────────────────────────────────────
ENV_BACKUP=""
if [ -f "$APP_DIR/backend/.env" ]; then
  echo "▶ .env sichern..."
  ENV_BACKUP=$(mktemp)
  cp "$APP_DIR/backend/.env" "$ENV_BACKUP"
  chmod 600 "$ENV_BACKUP"
  log ".env gesichert"
fi

# ── Backend aktualisieren ─────────────────────────────────────────────
echo ""
echo "▶ Backend aktualisieren..."
rsync -a --delete \
  --exclude="node_modules" \
  --exclude=".env" \
  "$REPO_DIR/backend/" "$APP_DIR/backend/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend"

# .env wiederherstellen
if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$APP_DIR/backend/.env"
  chmod 600 "$APP_DIR/backend/.env"
  rm -f "$ENV_BACKUP"
  log ".env wiederhergestellt"
fi

cd "$APP_DIR/backend"
runuser -u "$APP_USER" -- npm install

# ── Datenbank migrieren ───────────────────────────────────────────────
echo "▶ Datenbank migrieren..."

DEPLOY_OUT=$(runuser -u "$APP_USER" -- npx prisma migrate deploy 2>&1 || true)
echo "$DEPLOY_OUT"

if echo "$DEPLOY_OUT" | grep -q "P3005\|database schema is not empty"; then
  # DB wurde mit db push angelegt — alle Migrationen als Baseline markieren
  warn "Datenbank ohne Migrationsverlauf erkannt — setze Baseline..."
  for MIGRATION in "$REPO_DIR/backend/prisma/migrations"/*/; do
    MIGRATION_NAME=$(basename "$MIGRATION")
    runuser -u "$APP_USER" -- npx prisma migrate resolve --applied "$MIGRATION_NAME" 2>/dev/null || true
  done
  log "Baseline gesetzt — zukünftige Migrationen werden normal angewendet"
elif echo "$DEPLOY_OUT" | grep -q "error\|Error\|FEHLER"; then
  error "Migration fehlgeschlagen — Update abgebrochen"
else
  log "Migrationen angewendet"
fi

runuser -u "$APP_USER" -- npx prisma generate
log "Prisma Client generiert"

echo "▶ Backend kompilieren..."
rm -rf "$APP_DIR/backend/dist"
runuser -u "$APP_USER" -- npm run build
log "Backend gebaut"

# ── Frontend bauen ────────────────────────────────────────────────────
echo ""
echo "▶ Frontend bauen..."
cd "$REPO_DIR/frontend"
# node_modules komplett neu installieren damit entfernte Pakete (z.B. react-leaflet) wirklich weg sind
rm -rf node_modules
BUILD_LOG="/tmp/feuerwehr-frontend-build.log"
npm install 2>&1 | tee "$BUILD_LOG" || error "npm install fehlgeschlagen — Log: $BUILD_LOG"
npm run build 2>&1 | tee -a "$BUILD_LOG" || error "Frontend-Build fehlgeschlagen — Log: $BUILD_LOG"
rsync -a --delete "$REPO_DIR/frontend/dist/" "$APP_DIR/frontend/dist/"
log "Frontend gebaut und kopiert"

# ── Berechtigungen ────────────────────────────────────────────────────
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── Nginx aktualisieren ───────────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/feuerwehr-app.conf"
if [ -f "$REPO_DIR/deploy/nginx/feuerwehr-app.conf" ]; then
  cp "$REPO_DIR/deploy/nginx/feuerwehr-app.conf" "$NGINX_CONF"
  nginx -t && systemctl reload nginx || warn "Nginx-Reload fehlgeschlagen"
  log "Nginx aktualisiert"
fi

# ── Backup-Script aktualisieren ───────────────────────────────────────
if [ -f "$REPO_DIR/deploy/scripts/backup-daily.sh" ]; then
  cp "$REPO_DIR/deploy/scripts/backup-daily.sh" /usr/local/bin/feuerwehr-backup
  chmod 750 /usr/local/bin/feuerwehr-backup
  chown root:root /usr/local/bin/feuerwehr-backup
  CRON_FILE="/etc/cron.d/feuerwehr-backup"
  if [ ! -f "$CRON_FILE" ]; then
    echo "0 2 * * * root /usr/local/bin/feuerwehr-backup >> /var/log/feuerwehr-backup.log 2>&1" > "$CRON_FILE"
    chmod 644 "$CRON_FILE"
    log "Backup Cron-Job eingerichtet"
  fi
  mkdir -p /var/backups/feuerwehr
  chown "$APP_USER:$APP_USER" /var/backups/feuerwehr 2>/dev/null || true
fi

# ── restore-backup aktualisieren ─────────────────────────────────────
cp "$REPO_DIR/deploy/scripts/restore-backup.sh" /usr/local/bin/fw-restore-backup
chmod 700 /usr/local/bin/fw-restore-backup
chown root:root /usr/local/bin/fw-restore-backup

if [ ! -f /etc/sudoers.d/feuerwehr-backup ]; then
  printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-restore-backup\n" \
    > /etc/sudoers.d/feuerwehr-backup
  chmod 440 /etc/sudoers.d/feuerwehr-backup
fi

# ── Sudoers für Update/OS/Reboot automatisch aktualisieren ────────────────────
bash "$REPO_DIR/deploy/scripts/setup-sudoers-update.sh" 2>/dev/null || true
log "Sudoers aktualisiert"

# ── Reboot-Service einrichten ─────────────────────────────────────────────────
if [ -f "$REPO_DIR/deploy/scripts/setup-reboot-service.sh" ]; then
  bash "$REPO_DIR/deploy/scripts/setup-reboot-service.sh" 2>/dev/null || true
  log "Reboot-Service eingerichtet"
fi

# ── CAP_SYS_BOOT für Backend-Service (ermöglicht direkten Reboot) ─────────────
OVERRIDE_DIR="/etc/systemd/system/feuerwehr-app-backend.service.d"
mkdir -p "$OVERRIDE_DIR"
cat > "$OVERRIDE_DIR/reboot-capability.conf" << 'CONF'
[Service]
AmbientCapabilities=CAP_SYS_BOOT
CONF
systemctl daemon-reload
log "CAP_SYS_BOOT Capability gesetzt"


# ── Service-Name ermitteln ────────────────────────────────────────────
SERVICE=""
# Service-Name direkt prüfen
if systemctl cat feuerwehr-app-backend.service >/dev/null 2>&1; then
  SERVICE="feuerwehr-app-backend"
elif systemctl cat feuerwehr-backend.service >/dev/null 2>&1; then
  SERVICE="feuerwehr-backend"
else
  error "Kein passender systemd-Service gefunden"
fi


# ── Ollama Scripts aktualisieren ─────────────────────────────────────
if [ -f "$REPO_DIR/deploy/scripts/setup-ollama-sudo.sh" ]; then
  # fw-ollama-pull neu schreiben (Permission-fix)
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
  log "fw-ollama-pull aktualisiert"
fi

# ── Erfolgreich VOR Neustart schreiben ───────────────────────────────
# (systemctl restart killt diesen Prozess — Status muss vorher stehen)
echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  Update erfolgreich abgeschlossen!   ${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""

echo '{"running":false,"done":true,"exitCode":0,"finishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' \
  > "$STATUS_FILE"
chmod 666 "$STATUS_FILE"

# ── Service neu starten ───────────────────────────────────────────────
echo "▶ Backend neu starten..."
systemctl restart "$SERVICE" || true
sleep 3
systemctl is-active --quiet "$SERVICE" && log "Service $SERVICE läuft" || echo "⚠ Service-Status unklar"

echo "▶ Nginx neu laden..."
nginx -t && systemctl reload nginx || true
