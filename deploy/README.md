# Feuerwehr App – Deployment-Dokumentation

## Systemvoraussetzungen

- Ubuntu Server 22.04 LTS / 24.04 LTS **oder** Debian 12 (Bookworm) oder neuer
- Mindestens 1 GB RAM, 10 GB Festplatte
- Root-Zugriff (sudo)
- Internetverbindung für die Installation

---

## 1. Automatische Installation

```bash
# Projektdateien auf den Server kopieren (z.B. via scp oder git)
git clone https://github.com/your-org/feuerwehr-app.git /opt/feuerwehr-app
cd /opt/feuerwehr-app

# Installationsskript ausführen
sudo bash deploy/scripts/install-ubuntu-debian.sh
```

Das Skript erledigt automatisch:
- Node.js LTS, PostgreSQL, Nginx installieren
- Systembenutzer `feuerwehrapp` anlegen
- Datenbank und Benutzer erstellen
- Zufällige Passwörter generieren
- Backend bauen und konfigurieren
- Frontend bauen
- systemd-Service einrichten
- Nginx konfigurieren
- Firewall (ufw) Port 39615 freigeben

Nach der Installation sind die Zugangsdaten unter `/root/feuerwehr-app-credentials.txt` gespeichert.

---

## 2. Manuelle Installation

### 2.1 Abhängigkeiten installieren

```bash
# Systempakete
sudo apt-get update && sudo apt-get install -y curl postgresql nginx

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

### 2.2 Benutzer und Verzeichnisse

```bash
sudo useradd --system --create-home --shell /bin/bash feuerwehrapp
sudo mkdir -p /var/www/feuerwehr-app/{frontend/dist,backend,uploads}
sudo chown -R feuerwehrapp:feuerwehrapp /var/www/feuerwehr-app
```

### 2.3 Datenbank einrichten

```bash
sudo -u postgres psql -c "CREATE USER feuerwehrapp WITH PASSWORD 'ihr-passwort';"
sudo -u postgres psql -c "CREATE DATABASE feuerwehrapp OWNER feuerwehrapp;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE feuerwehrapp TO feuerwehrapp;"
```

### 2.4 .env-Datei konfigurieren

```bash
cp backend/.env.example /var/www/feuerwehr-app/backend/.env
nano /var/www/feuerwehr-app/backend/.env
```

Mindestens folgende Werte anpassen:
```env
DATABASE_URL=postgresql://feuerwehrapp:ihr-passwort@localhost:5432/feuerwehrapp
JWT_SECRET=ein-sehr-langer-zufaelliger-string
FRONTEND_URL=http://IHRE-SERVER-IP:39615
```

### 2.5 Backend bauen

```bash
cd /var/www/feuerwehr-app/backend
sudo -u feuerwehrapp npm ci
sudo -u feuerwehrapp npx prisma generate
sudo -u feuerwehrapp npx prisma migrate deploy
sudo -u feuerwehrapp npx prisma db seed
sudo -u feuerwehrapp npm run build
```

### 2.6 Frontend bauen

```bash
cd /pfad/zu/projekt/frontend
npm ci
npm run build
sudo cp -r dist/. /var/www/feuerwehr-app/frontend/dist/
sudo chown -R feuerwehrapp:feuerwehrapp /var/www/feuerwehr-app/frontend
```

### 2.7 systemd-Service aktivieren

```bash
sudo cp deploy/systemd/feuerwehr-app-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable feuerwehr-app-backend
sudo systemctl start feuerwehr-app-backend
```

### 2.8 Nginx konfigurieren

```bash
sudo cp deploy/nginx/feuerwehr-app.conf /etc/nginx/sites-available/feuerwehr-app.conf
sudo ln -s /etc/nginx/sites-available/feuerwehr-app.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2.9 Firewall freigeben

```bash
sudo ufw allow OpenSSH
sudo ufw allow 39615/tcp
sudo ufw enable
```

---

## 3. Zugriff

Nach der Installation ist die App erreichbar unter:

```
http://IHRE-SERVER-IP:39615
```

**Standard-Login:**
- E-Mail: `admin@feuerwehr.local`
- Passwort: `admin123`

⚠️ **Das Standard-Passwort muss sofort nach der Installation geändert werden!**

---

## 4. Wichtige Befehle

### Backend-Service

```bash
# Status prüfen
sudo systemctl status feuerwehr-app-backend

# Logs ansehen (live)
sudo journalctl -u feuerwehr-app-backend -f

# Neustart
sudo systemctl restart feuerwehr-app-backend

# Stoppen
sudo systemctl stop feuerwehr-app-backend
```

### Nginx

```bash
# Konfiguration testen
sudo nginx -t

# Neu laden
sudo systemctl reload nginx

# Neustart
sudo systemctl restart nginx

# Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### PostgreSQL

```bash
# Status
sudo systemctl status postgresql

# PostgreSQL-Shell öffnen
sudo -u postgres psql -d feuerwehrapp

# Datenbankgröße anzeigen
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('feuerwehrapp'));"
```

---

## 5. Backup

```bash
# Manuelles Backup erstellen
sudo bash /var/www/feuerwehr-app/deploy/scripts/backup-database.sh

# Automatisches Backup per Cron (täglich um 02:00 Uhr)
sudo crontab -e
# Folgende Zeile hinzufügen:
# 0 2 * * * /bin/bash /var/www/feuerwehr-app/deploy/scripts/backup-database.sh >> /var/log/feuerwehr-backup.log 2>&1
```

---

## 6. Update

```bash
# Neuen Code laden und App aktualisieren
sudo bash /var/www/feuerwehr-app/deploy/scripts/update-app.sh
```

---

## 7. Fehlerbehebung

### Backend startet nicht

```bash
# Logs prüfen
sudo journalctl -u feuerwehr-app-backend -n 100 --no-pager

# .env prüfen
sudo cat /var/www/feuerwehr-app/backend/.env

# Datenbankverbindung testen
sudo -u feuerwehrapp psql "$(grep DATABASE_URL /var/www/feuerwehr-app/backend/.env | cut -d= -f2-)"
```

### Nginx-Fehler 502 (Bad Gateway)

Der Backend-Service läuft nicht. Backend neu starten:
```bash
sudo systemctl restart feuerwehr-app-backend
sudo systemctl status feuerwehr-app-backend
```

### Seite nicht erreichbar

Firewall prüfen:
```bash
sudo ufw status
sudo ufw allow 39615/tcp
```

Nginx prüfen:
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Datenbankfehler

Prisma-Migrationen neu ausführen:
```bash
cd /var/www/feuerwehr-app/backend
sudo -u feuerwehrapp npx prisma migrate deploy
```

---

## 8. HTTPS mit Domain (optional, später)

Wenn eine Domain verfügbar ist, kann HTTPS mit Let's Encrypt aktiviert werden:

```bash
# Certbot installieren
sudo apt-get install -y certbot python3-certbot-nginx

# Nginx-Konfiguration für Domain anpassen
sudo nano /etc/nginx/sites-available/feuerwehr-app.conf
# server_name ihre-domain.de; setzen

# Zertifikat ausstellen
sudo certbot --nginx -d ihre-domain.de

# Zertifikat erneuern (automatisch per Cron)
sudo certbot renew --dry-run
```

---

## 9. Verzeichnisstruktur nach Installation

```
/var/www/feuerwehr-app/
├── backend/
│   ├── dist/          # Kompiliertes Backend
│   ├── node_modules/
│   ├── prisma/        # Datenbankschema
│   └── .env           # Konfiguration (nicht ins Git!)
├── frontend/
│   └── dist/          # Gebautes React-Frontend
└── uploads/           # Hochgeladene Dateien

/etc/nginx/sites-available/feuerwehr-app.conf
/etc/systemd/system/feuerwehr-app-backend.service
/var/backups/feuerwehr-app/  # Datenbank-Backups
```
