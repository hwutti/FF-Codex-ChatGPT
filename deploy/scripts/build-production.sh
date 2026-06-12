#!/usr/bin/env bash
# =============================================================================
# Feuerwehr App - Produktions-Build-Skript
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_DIR="${APP_DIR:-/var/www/feuerwehr-app}"
APP_USER="${APP_USER:-feuerwehrapp}"

log "Starte Produktions-Build..."
log "Projektverzeichnis: $PROJECT_DIR"
log "Zielverzeichnis:    $APP_DIR"

# --- Backend bauen ---
log "Backend: Abhängigkeiten installieren..."
cd "$PROJECT_DIR/backend"
npm ci

log "Backend: Prisma Client generieren..."
npx prisma generate

log "Backend: TypeScript kompilieren..."
npm run build

log "Backend: nach $APP_DIR/backend kopieren..."
rsync -av --delete \
  --exclude="node_modules" \
  --exclude="src" \
  --exclude=".env" \
  "$PROJECT_DIR/backend/" "$APP_DIR/backend/"

log "Backend: Produktions-Abhängigkeiten installieren..."
cd "$APP_DIR/backend"
npm ci --omit=dev
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend"

# --- Frontend bauen ---
log "Frontend: Abhängigkeiten installieren..."
cd "$PROJECT_DIR/frontend"
npm ci

log "Frontend: Produktions-Build erstellen..."
npm run build

log "Frontend: Build nach $APP_DIR/frontend/dist kopieren..."
mkdir -p "$APP_DIR/frontend/dist"
rsync -av --delete "$PROJECT_DIR/frontend/dist/" "$APP_DIR/frontend/dist/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/frontend"

log "Build erfolgreich abgeschlossen!"
log "Backend: $APP_DIR/backend/dist"
log "Frontend: $APP_DIR/frontend/dist"

echo ""
echo "Nächste Schritte:"
echo "  sudo systemctl restart feuerwehr-app-backend"
echo "  sudo nginx -t && sudo systemctl reload nginx"
