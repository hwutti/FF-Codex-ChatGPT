#!/bin/bash
# Wird von Backup-Restore aufgerufen um PostgreSQL-Passwort zu setzen
# Läuft als root via sudo
DB_USER="$1"
DB_PASS="$2"
sudo -u postgres psql -c "ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';"
