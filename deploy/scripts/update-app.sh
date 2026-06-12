#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# Feuerwehr Verwaltung – Update (lokaler Build)
# Verwendung: sudo bash update-app.sh
# ══════════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗ FEHLER:${NC} $1" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_DIR="${APP_DIR:-/var/www/feuerwehr-app}"
APP_USER="${APP_USER:-feuerwehrapp}"
STATUS_FILE="/tmp/feuerwehr-update-status.json"

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Feuerwehr Verwaltung – App Update  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Root-Check ────────────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && error "Bitte als root ausführen: sudo bash $0"

# Sicherheitscheck
if [ ! -f "$PROJECT_DIR/backend/package.json" ]; then
  error "PROJECT_DIR ($PROJECT_DIR) enthält kein gültiges Backend — Abbruch"
fi

# ── Status: läuft ─────────────────────────────────────────────────────
rm -f "$STATUS_FILE"
echo '{"running":true,"done":false,"exitCode":null}' > "$STATUS_FILE"
chmod 666 "$STATUS_FILE"

trap 'rm -f "$STATUS_FILE"; echo "{\"running\":false,\"done\":true,\"exitCode\":1,\"finishedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATUS_FILE"; chmod 666 "$STATUS_FILE"' ERR

log "Projektverzeichnis: $PROJECT_DIR"
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

# ── Git Pull ──────────────────────────────────────────────────────────
if [ -d "$PROJECT_DIR/.git" ]; then
  echo "▶ Neuesten Code laden (git pull)..."
  cd "$PROJECT_DIR"
  git pull origin main || git pull origin master || warn "Git pull fehlgeschlagen"
  log "Code aktualisiert"
fi

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
  "$PROJECT_DIR/backend/" "$APP_DIR/backend/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend"

# .env wiederherstellen
if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$APP_DIR/backend/.env"
  chmod 600 "$APP_DIR/backend/.env"
  rm -f "$ENV_BACKUP"
  log ".env wiederhergestellt"
fi

cd "$APP_DIR/backend"
runuser -u "$APP_USER" -- npm ci

# ── Datenbank migrieren ───────────────────────────────────────────────
echo "▶ Datenbank migrieren..."

DEPLOY_OUT=$(runuser -u "$APP_USER" -- npx prisma migrate deploy 2>&1 || true)
echo "$DEPLOY_OUT"

if echo "$DEPLOY_OUT" | grep -q "P3005\|database schema is not empty"; then
  # DB wurde mit db push angelegt — alle Migrationen als Baseline markieren
  warn "Datenbank ohne Migrationsverlauf erkannt — setze Baseline..."
  for MIGRATION in "$PROJECT_DIR/backend/prisma/migrations"/*/; do
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
cd "$PROJECT_DIR/frontend"
# Cache und node_modules komplett leeren
rm -rf node_modules/.vite node_modules/.cache 2>/dev/null || true
BUILD_LOG="/tmp/feuerwehr-frontend-build.log"
npm ci 2>&1 | tee "$BUILD_LOG" || error "npm ci fehlgeschlagen — Log: $BUILD_LOG"
npm run build 2>&1 | tee -a "$BUILD_LOG" || error "Frontend-Build fehlgeschlagen — Log: $BUILD_LOG"
rsync -a --delete "$PROJECT_DIR/frontend/dist/" "$APP_DIR/frontend/dist/"
log "Frontend gebaut und kopiert"

# ── Berechtigungen ────────────────────────────────────────────────────
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── Nginx aktualisieren ───────────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/feuerwehr-app.conf"
if [ -f "$PROJECT_DIR/deploy/nginx/feuerwehr-app.conf" ]; then
  cp "$PROJECT_DIR/deploy/nginx/feuerwehr-app.conf" "$NGINX_CONF"
  nginx -t && systemctl reload nginx || warn "Nginx-Reload fehlgeschlagen"
  log "Nginx aktualisiert"
fi


# ── Service-Name ermitteln ────────────────────────────────────────────
SERVICE=""
if systemctl list-units --type=service --quiet | grep -q "feuerwehr-app-backend"; then
  SERVICE="feuerwehr-app-backend"
elif systemctl list-units --type=service --quiet | grep -q "feuerwehr-backend"; then
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
