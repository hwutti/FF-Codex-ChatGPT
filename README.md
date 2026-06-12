# Feuerwehr Mitglieder- und Anwesenheitsverwaltung

Eine moderne Web-Applikation zur Verwaltung von Mitgliedern, Anwesenheiten, Einsätzen, Geburtstagen und Ehrungen für Freiwillige Feuerwehren.

## Hauptfunktionen

| Modul | Beschreibung |
|---|---|
| **Dashboard** | Überblick über Mitglieder, Termine, Einsätze, Geburtstage |
| **Mitglieder** | Vollständige Stammdatenverwaltung |
| **Ereignisse** | Sitzungen, Übungen, Einsätze, Beerdigungen etc. |
| **Anwesenheit** | Schnelle mobile Erfassung per Smartphone |
| **Einsätze** | Einsatzdokumentation mit Teilnehmerverwaltung |
| **Geburtstage** | Übersicht und Filterfunktionen |
| **Ehrungen** | Verwaltung aller Auszeichnungen |
| **Berichte** | CSV-Export für Mitglieder, Anwesenheiten, Ehrungen |

## Technologie-Stack

**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · React Router  
**Backend:** Node.js · Express · TypeScript · Prisma ORM  
**Datenbank:** PostgreSQL  
**Auth:** JWT · bcrypt  
**Deployment:** Ubuntu/Debian · Nginx · systemd

---

## Projektstruktur

```
feuerwehr-app/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/          # DB, ENV-Konfiguration
│   │   ├── middleware/       # Auth, Fehlerbehandlung
│   │   └── routes/          # API-Routen
│   ├── prisma/
│   │   ├── schema.prisma    # Datenbankschema
│   │   └── seed.ts          # Seed-Daten
│   └── .env.example
├── frontend/                # React-App
│   └── src/
│       ├── api/             # Axios-Clients
│       ├── pages/           # Seitenkomponenten
│       ├── layouts/         # AppLayout, Navigation
│       ├── types/           # TypeScript-Typen
│       └── utils/           # AuthContext etc.
├── deploy/
│   ├── nginx/               # Nginx-Konfiguration (Port 39615)
│   ├── systemd/             # systemd-Service
│   └── scripts/             # Installations- und Update-Skripte
└── README.md
```

---

## Lokale Entwicklung

### Voraussetzungen

- Node.js 18+ (empfohlen: 20 LTS)
- PostgreSQL 14+
- npm oder yarn

### Backend starten

```bash
cd backend
cp .env.example .env
# .env anpassen (DATABASE_URL, JWT_SECRET)

npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Backend läuft unter: http://localhost:3001

### Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft unter: http://localhost:5173

---

## Installation auf Ubuntu/Debian

### Schnellinstallation (Ein Befehl)

```bash
curl -fsSL https://raw.githubusercontent.com/hwutti/ff-goertschach/main/deploy/scripts/install-ubuntu-debian.sh | sudo bash -s -- https://github.com/hwutti/ff-goertschach.git
```

Oder manuell:

```bash
# Repository klonen
git clone https://github.com/hwutti/ff-goertschach.git /opt/feuerwehr-app

# Installation starten (als root)
sudo bash /opt/feuerwehr-app/deploy/scripts/install-ubuntu-debian.sh
```

### Zugriff nach Installation

```
http://IHRE-SERVER-IP:39615
Login:    admin@feuerwehr.local
Passwort: admin123  ← SOFORT ÄNDERN!
```

### Update

```bash
sudo bash /opt/feuerwehr-app/deploy/scripts/update-from-git.sh
```

---

## Seed-Benutzer

| E-Mail | Passwort | Rolle |
|---|---|---|
| admin@feuerwehr.local | admin123 | Administrator |
| anna.schmidt@feuerwehr.local | test123 | Mitglied |

⚠️ **Standard-Passwörter nach der Installation sofort ändern!**

---

## Rollen und Rechte

| Rolle | Rechte |
|---|---|
| **Administrator** | Vollzugriff, Benutzerverwaltung |
| **Kommandant** | Mitglieder, Einsätze, Übungen, Anwesenheiten |
| **Stellvertreter** | Wie Kommandant |
| **Schriftführer** | Sitzungen, Anwesenheiten, Berichte |
| **Gruppenkommandant** | Anwesenheiten, eigene Gruppe |
| **Mitglied** | Eigene Daten lesen |

---

## API-Endpunkte

```
POST   /api/auth/login
GET    /api/auth/me
GET    /api/dashboard
GET    /api/members
POST   /api/members
GET    /api/members/:id
PUT    /api/members/:id
DELETE /api/members/:id
GET    /api/events
POST   /api/events
GET    /api/events/:id/attendance
POST   /api/events/:id/attendance
GET    /api/incidents
POST   /api/incidents
GET    /api/birthdays/upcoming
GET    /api/honors
GET    /api/reports/members         (CSV)
GET    /api/reports/attendance      (CSV)
GET    /api/reports/birthdays       (CSV)
GET    /api/reports/honors          (CSV)
```

---

## Wichtige Befehle

```bash
# Backend-Service
sudo systemctl status feuerwehr-app-backend
sudo systemctl restart feuerwehr-app-backend
sudo journalctl -u feuerwehr-app-backend -f

# Nginx
sudo nginx -t && sudo systemctl reload nginx

# Backup
sudo bash /var/www/feuerwehr-app/deploy/scripts/backup-database.sh

# Update
sudo bash /var/www/feuerwehr-app/deploy/scripts/update-app.sh

# Prisma Studio (Datenbankübersicht, nur Entwicklung)
cd backend && npx prisma studio
```

---

## Backup

Tägliches automatisches Backup einrichten:

```bash
sudo crontab -e
# Hinzufügen:
0 2 * * * /bin/bash /var/www/feuerwehr-app/deploy/scripts/backup-database.sh >> /var/log/feuerwehr-backup.log 2>&1
```

Backups werden gespeichert unter: `/var/backups/feuerwehr-app/`

---

## Fehlerbehebung

**Backend antwortet nicht:**
```bash
sudo systemctl status feuerwehr-app-backend
sudo journalctl -u feuerwehr-app-backend -n 50
```

**Datenbankfehler:**
```bash
cd /var/www/feuerwehr-app/backend
sudo -u feuerwehrapp npx prisma migrate deploy
```

**Frontend zeigt alte Version:**
```bash
sudo bash /var/www/feuerwehr-app/deploy/scripts/update-app.sh
```

---

## Sicherheit

- Passwörter werden mit **bcrypt** gehasht (12 Runden)
- **JWT-Token** mit konfigurierbarer Gültigkeit
- **Rollen-basierte Zugriffskontrolle** (RBAC)
- **Audit-Log** für Änderungen an Mitgliederdaten
- Backend läuft nur auf **127.0.0.1:3001** (nicht öffentlich)
- **Nginx** als einziger öffentlicher Endpunkt auf Port 39615
- App läuft als **eingeschränkter Systembenutzer** (nicht root)
- DSGVO-konforme Datenhaltung vorbereitet

---

## HTTPS (optional, mit Domain)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ihre-domain.de
```

---

## Lizenz

Zur internen Verwendung für Freiwillige Feuerwehren.


---

## ⚠️ Nginx Proxy Manager — Pflichteinstellung (einmalig, gilt für alle API-Endpunkte)

Wenn die App hinter einem **Nginx Proxy Manager (NPM)** betrieben wird, muss folgende Custom-Konfiguration **einmalig** im Proxy Host eingetragen werden. Ohne diese Einstellung puffert NPM API-Antworten und bricht Verbindungen ab — betrifft File-Uploads, KI-Streaming, und alle anderen API-Calls.

**NPM → Proxy Host bearbeiten → Advanced → Custom Nginx Configuration:**

```nginx
location /api/ {
    proxy_pass http://SERVER-IP:PORT/api/;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/ai/ {
    proxy_pass http://SERVER-IP:PORT/api/ai/;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **Warum zwei Blöcke:** Der erste Block gilt für alle API-Endpunkte (kein Puffern, Standard-Timeout 300s). Der zweite Block überschreibt nur `/api/ai/` mit einem längeren Timeout (1800s) für die KI-Textgenerierung, die bis zu mehrere Minuten dauern kann.

> **Einmalig:** Nach dieser Einstellung müssen bei neuen Features **keine weiteren NPM-Änderungen** vorgenommen werden.

> **IP und Port anpassen:** `SERVER-IP:PORT` durch die eigene Server-IP und den internen Backend-Port ersetzen (z.B. `192.168.0.78:39615`).

