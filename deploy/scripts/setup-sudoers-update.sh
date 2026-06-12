#!/bin/bash
# Einmalig als root ausführen: sudo bash setup-sudoers-update.sh
# Richtet passwordlose sudo-Rechte für feuerwehrapp-User ein (Update + Git)

set -e
APP_USER="feuerwehrapp"
REPO_DIR="/opt/feuerwehr-app"

# Update-Wrapper installieren
cp "$REPO_DIR/deploy/scripts/update-from-git.sh" /usr/local/bin/fw-update
chmod 700 /usr/local/bin/fw-update
chown root:root /usr/local/bin/fw-update
echo "✓ /usr/local/bin/fw-update installiert"

# Sudoers-Datei für Update + Git schreiben
cat > /etc/sudoers.d/feuerwehr-update << SUDOERS
# Feuerwehr App - passwordlose sudo-Rechte für Update und Git
$APP_USER ALL=(root) NOPASSWD: /usr/local/bin/fw-update
$APP_USER ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app *
$APP_USER ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app fetch origin main
$APP_USER ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app rev-parse *
$APP_USER ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app log *
$APP_USER ALL=(root) NOPASSWD: /usr/bin/git -C /opt/feuerwehr-app show *
$APP_USER ALL=(root) NOPASSWD: /usr/bin/apt-get update -qq
$APP_USER ALL=(root) NOPASSWD: /usr/bin/apt-get upgrade -y *
$APP_USER ALL=(root) NOPASSWD: /usr/bin/apt-get dist-upgrade -y *
$APP_USER ALL=(root) NOPASSWD: /usr/bin/apt-get dist-upgrade --simulate
$APP_USER ALL=(root) NOPASSWD: /usr/bin/apt list --upgradable
$APP_USER ALL=(root) NOPASSWD: /sbin/reboot
$APP_USER ALL=(root) NOPASSWD: /usr/local/bin/fw-reboot
SUDOERS
chmod 440 /etc/sudoers.d/feuerwehr-update
echo "✓ /etc/sudoers.d/feuerwehr-update gesetzt"

# fw-reboot Script installieren
cp "$SCRIPT_DIR/../deploy/scripts/fw-reboot.sh" /usr/local/bin/fw-reboot 2>/dev/null || \
  cp "$(dirname "$0")/../deploy/scripts/fw-reboot.sh" /usr/local/bin/fw-reboot 2>/dev/null || \
  cp "/opt/feuerwehr-app/deploy/scripts/fw-reboot.sh" /usr/local/bin/fw-reboot
chmod 700 /usr/local/bin/fw-reboot
chown root:root /usr/local/bin/fw-reboot
echo "✓ fw-reboot installiert"

# Syntax prüfen
visudo -c -f /etc/sudoers.d/feuerwehr-update && echo "✓ Sudoers-Syntax OK" || echo "✗ Syntaxfehler!"
