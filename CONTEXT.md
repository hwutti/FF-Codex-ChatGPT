# FF Görtschach — Projekt Kontext

## Wichtig für neuen Chat

```
Weiter mit FF Görtschach Projekt.
GitHub: https://github.com/hwutti/ff-goertschach
Token: TOKEN_HIER_EINFÜGEN
Stack: Node.js/Express/Prisma/PostgreSQL + React/TypeScript/Vite
Server: Ubuntu, Nginx Port 39615, Domain: verwaltung.ff-görtschach.at
Lokales Verzeichnis: /home/claude/feuerwehr-app-clean
Lies CONTEXT.md aus dem Repo für vollständigen Kontext.
```

---

## Server

| Parameter | Wert                                   |
| --------- | -------------------------------------- |
| Host      | `hwutti@ff-goertschach` (192.168.0.78) |
| Domain    | `verwaltung.ff-görtschach.at`          |
| Port      | `39615`                                |
| App-User  | `feuerwehrapp`                         |
| App-Dir   | `/var/www/feuerwehr-app`               |
| Repo-Dir  | `/opt/feuerwehr-app`                   |
| Service   | `feuerwehr-app-backend`                |

## Deployment

### Normaler Weg
**Administration → Update** im Webinterface — das ist der bevorzugte Weg.

### Notfall: Webinterface nicht erreichbar

```bash
# Schritt 1: Update einspielen (fw-update vorhanden)
sudo bash /usr/local/bin/fw-update

# Schritt 2: Falls fw-update nicht existiert
sudo bash /opt/feuerwehr-app/deploy/scripts/update-from-git.sh

# Schritt 3: Falls Repo noch gar nicht existiert (Neuinstallation)
curl -fsSL https://raw.githubusercontent.com/hwutti/ff-goertschach/main/deploy/scripts/install-ubuntu-debian.sh -o /tmp/install.sh
sudo bash /tmp/install.sh https://github.com/hwutti/ff-goertschach.git
```

> **Hinweis:** `sudo bash <(curl ...)` funktioniert nicht mit sudo — immer erst downloaden, dann ausführen!

## GitHub Push (aus Claude-Umgebung)

```bash
cd /home/claude/feuerwehr-app-clean
git remote set-url origin https://hwutti:TOKEN_HIER_EINFÜGEN@github.com/hwutti/ff-goertschach.git
git add -A
git commit -m "Beschreibung"
git push origin main
```

## Sudoers (einmalig manuell gesetzt)

```
/etc/sudoers.d/feuerwehr-backup  → fw-restore-backup NOPASSWD
/etc/sudoers.d/feuerwehr-update  → fw-update + git NOPASSWD
```

---

## Tech Stack

- **Backend:** Node.js, Express, Prisma, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Infra:** Ubuntu Server, Nginx (Reverse Proxy), systemd, PWA

---

## Bereits gebaute Module (detailliert)

### Authentifizierung & Sicherheit
- JWT Login, bcrypt Passwort-Hashing
- TOTP Zwei-Faktor-Authentifizierung
- Rate Limiting (10 Versuche → 3min Sperre)
- Admin sieht gesperrte IPs + Entsperr-Funktion
- Rollenbasierte Zugriffskontrolle (ADMIN, COMMANDER, DEPUTY_COMMANDER, SECRETARY, MEMBER)
- Rang-basierte Einschränkungen (PFM/FM/OFM/HFM = kein Zugriff auf Kommando-Bereiche)

### Kamerad:innen
- Vollständiges CRUD mit allen Stammdaten
- Gendering (männlich/weiblich) bei allen Bezeichnungen
- 14 Qualifikations-Checkboxen (Funktionen)
- Ausbildungen/Lehrgänge Multiselect mit 62 Lehrgängen + Suchfunktion
- Felder: Sterbedatum, Feuerwehrpass-Nummer, Profilbild-Upload
- Rang-basierte Anzeige

### Anwesenheit & Ereignisse
- Ereignisse erstellen/bearbeiten/löschen
- Anwesenheitslisten pro Ereignis
- Automatische Anwesenheitsliste bei Kalender-Sync

### Einsätze
- Einsatz-Verwaltung mit Mitglieder-Zuordnung

### Kalender Allgemein
- Monats-, Wochen-, Jahres- und Listenansicht
- Österreichische Feiertage (rot, kein echter Termin)
- Wochenende blau hervorgehoben, Navigation ±100 Jahre
- Kategorien mit Farben
- Sync zu Ereignissen → Termin erstellen = automatisch Ereignis + leere Anwesenheitsliste
- iCal-Feed öffentlich abrufbar

### Kalender Kommando
- Identisch mit Kalender Allgemein aber getrennt
- Nur für Kommandanten/Admin/Sekretär sichtbar
- Anwesenheitsliste nur ab LM aufwärts
- Eigener iCal-Feed, strikt getrennt

### Dokumente Allgemein
- Kategorien mit Icons und Farben
- Datei-Upload (PDF, DOC, ODS etc.), Download, PDF-Vorschau
- Professionelle Datei-Icons mit Eselsohr

### Dokumente Kommando
- Identisch aber rankRestricted — nur für höhere Ränge

### Protokolle
- Upload, Download, PDF-Vorschau
- Nur für ADMIN/COMMANDER/DEPUTY/SECRETARY

### Berichte
- PDF-Export: Kamerad:innenliste, Anwesenheitslisten, Geburtstage, Ehrungen
- rankRestricted

### Backup-System
- Manuelles Backup — ZIP herunterladen (DB + alle Dateien + .env)
- Server-Backup — manuell triggern, Liste, herunterladen, wiederherstellen, löschen
- Automatisch — täglich 02:00 Uhr, 14 Tage Retention
- Restore — ZIP hochladen → alles wird wiederhergestellt inkl. PostgreSQL-Passwort
- Bestätigungs-Modal vor Restore

### Update-System
- Installierte Version anzeigen (v2.2.0 + Commit-Hash)
- "Auf Update prüfen" — vergleicht mit GitHub, zeigt Changelog
- "Update installieren" — Modal mit 2 Optionen:
  * **In 5 Minuten starten** — alle User bekommen WebSocket Countdown-Banner, danach automatisch
  * **Sofort starten (Notfall)** — ohne Vorwarnung
- Während Countdown: Abbrechen-Button oder Sofort-starten möglich
- Live-Log im Terminal-Stil
- Update-Status wird VOR systemctl restart geschrieben
- **UpdateBanner** (floating Popup oben rechts) für ALLE User inkl. Admin:
  * Reagiert auf WebSocket-Events (UPDATE_ANNOUNCED, UPDATE_CANCELLED)
  * Polling alle 5 Sekunden als Fallback (wichtig für Admin der announce auslöst)
  * HTTP-Fetch beim Mount für bereits laufende Announces
  * `activeRef` verhindert doppeltes Starten des Countdowns

### Branding
- App-Name, Untertitel, Gründungsjahr, Primärfarbe, Logo
- Login-Seite vollständig brandbar: Badge, Hauptüberschrift + Farbe, Beschreibung, Willkommenstitel, Hintergrundfarbe, Hintergrundbild
- Reset auf Standard pro Bereich (Allgemein, Linke Seite, Login-Box, Hintergrund)

### PWA
- Installierbar auf Android (Chrome) und iPhone (Safari)
- Service Worker, manifest.json, Icons

### Mobile-Optimierung
- Responsive Grids
- Einstellungen horizontal scrollbar auf Mobile
- PDF-Vorschau auf Mobile: Button statt iframe
- Dokumente-Kategorien zweizeilig auf Mobile

---

## Wichtige Hinweise / bekannte Fallstricke

### Farbgebung
- **Branding-Seite hat hellen Hintergrund** → immer `text-gray-*`, `border-gray-*` verwenden
- **Login-Seite + Sidebar haben dunklen Hintergrund** → dort `text-white/*` OK
- Nie `text-white/*` auf der Einstellungsseite verwenden!

### Update-System
- `fw-update` = `/usr/local/bin/fw-update` (Root-Wrapper, NOPASSWD)
- Nach Code-Änderungen am Update-Script: `sudo cp /opt/feuerwehr-app/deploy/scripts/update-from-git.sh /usr/local/bin/fw-update`
- Frontend-Build immer mit `--emptyOutDir` sonst alter Cache
- Update-Status wird **vor** `systemctl restart` geschrieben (sonst wird Prozess gekillt)
- UpdateBanner verwendet Polling (5s) + WebSocket + Mount-Fetch als dreifache Absicherung

### BrandingContext
- Alle Login-Branding Felder müssen im Interface + `load()` in `BrandingContext.tsx` definiert sein
- Kein `(branding as any)` verwenden — alles typisiert

### Nginx
- Config: `/etc/nginx/sites-available/feuerwehr-app.conf`
- `/ws` Location muss **außerhalb** von `location /api/` sein
- Bei Updates wird Config aus Repo kopiert: `deploy/nginx/feuerwehr-app.conf`

### Git auf Server
- Repo liegt in `/opt/feuerwehr-app` (root-owned)
- `sudo /usr/bin/git -C /opt/feuerwehr-app ...` für git-Befehle

---

## Datenbankmodelle (Prisma)

`User`, `Member`, `Event`, `Attendance`, `Incident`, `IncidentMember`, `Honor`, `Document`, `Protocol`, `AppSettings`, `AuditLog`, `CalendarCategory`, `CalendarEvent`

---

## Version

Aktuelle Version: **v2.2.0** (wird in `backend/package.json` gepflegt)

---

## Offene Punkte / Zuletzt bearbeitet

- **UpdateBanner Fix (25.05.2026):** Polling (5s Intervall) + WebSocket + HTTP-Mount-Fetch eingebaut damit der Admin das floating Banner genauso sieht wie alle anderen User. Vorher: Admin sah nur den eingebetteten Countdown in der SettingsPage, nicht das floating Popup oben rechts.
