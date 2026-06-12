#!/bin/bash
# Läuft als root via cron – prüft auf Reboot-Trigger
TRIGGER="/tmp/fw-reboot-trigger"
if [ -f "$TRIGGER" ]; then
  # Sicherheits-Check: Datei muss feuerwehrapp gehören
  OWNER=$(stat -c '%U' "$TRIGGER" 2>/dev/null)
  if [ "$OWNER" = "feuerwehrapp" ]; then
    rm -f "$TRIGGER"
    logger "Feuerwehr App: Reboot-Trigger von feuerwehrapp – starte Neustart"
    /sbin/reboot -f
  else
    logger "Feuerwehr App: Reboot-Trigger IGNORIERT – falscher Owner: $OWNER"
    rm -f "$TRIGGER"
  fi
fi
