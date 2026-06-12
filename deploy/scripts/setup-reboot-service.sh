#!/bin/bash
# Einmalig als root ausführen
# Installiert einen sicheren systemd-Service für den Reboot

APP_USER="feuerwehrapp"

# 1. Systemd-Service installieren
cp "$(dirname "$0")/fw-reboot.service" /etc/systemd/system/fw-reboot.service
chmod 644 /etc/systemd/system/fw-reboot.service
systemctl daemon-reload
echo "✓ fw-reboot.service installiert"

# 2. Sudoers: feuerwehrapp darf NUR diesen Service starten
cat > /etc/sudoers.d/feuerwehr-reboot << SUDOERS
# Feuerwehr App – Reboot via systemd (sicher, auditierbar)
$APP_USER ALL=(root) NOPASSWD: /bin/systemctl start fw-reboot.service
SUDOERS
chmod 440 /etc/sudoers.d/feuerwehr-reboot
echo "✓ sudoers für fw-reboot gesetzt"

# 3. Watchdog-Cron entfernen (nicht mehr nötig)
rm -f /etc/cron.d/fw-watchdog
rm -f /usr/local/bin/fw-watchdog
echo "✓ Watchdog-Cron entfernt"

echo "=== Reboot-Service eingerichtet ==="
