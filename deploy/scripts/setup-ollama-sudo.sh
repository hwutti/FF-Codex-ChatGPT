#!/bin/bash
# Einmalig als root ausführen: sudo bash /opt/feuerwehr-app/deploy/scripts/setup-ollama-sudo.sh

set -e

cat > /usr/local/bin/fw-ollama-install << 'SCRIPT'
#!/bin/bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl enable ollama
systemctl start ollama
echo ">>> Ollama erfolgreich installiert"
SCRIPT

chmod 700 /usr/local/bin/fw-ollama-install
chown root:root /usr/local/bin/fw-ollama-install

cat > /usr/local/bin/fw-ollama-pull << 'SCRIPT'
#!/bin/bash
MODEL="$1"
if [ -z "$MODEL" ]; then echo "FEHLER: Kein Modell angegeben" >&2; exit 1; fi
ollama pull "$MODEL"
echo ">>> Modell $MODEL erfolgreich geladen"
SCRIPT

chmod 700 /usr/local/bin/fw-ollama-pull
chown root:root /usr/local/bin/fw-ollama-pull

printf "feuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-ollama-install\nfeuerwehrapp ALL=(root) NOPASSWD: /usr/local/bin/fw-ollama-pull *\n" > /etc/sudoers.d/feuerwehr-ollama
chmod 440 /etc/sudoers.d/feuerwehr-ollama

echo "✓ Ollama sudo-Regeln eingerichtet!"

# CPU-Limits setzen
echo "✓ CPU-Limits werden gesetzt..."

# Ollama: 12 Kerne (1200%)
mkdir -p /etc/systemd/system/ollama.service.d
printf "[Service]\nCPUQuota=1200%%\nEnvironment=\"OLLAMA_KEEP_ALIVE=-1\"\n" > /etc/systemd/system/ollama.service.d/override.conf

# Backend: 4 Kerne (400%)
mkdir -p /etc/systemd/system/feuerwehr-app-backend.service.d
printf "[Service]\nCPUQuota=400%%\n" > /etc/systemd/system/feuerwehr-app-backend.service.d/override.conf

systemctl daemon-reload
systemctl restart ollama
systemctl restart feuerwehr-app-backend

echo "✓ CPU-Limits gesetzt: Ollama=12 Kerne, App=4 Kerne"
