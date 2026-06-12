-- Migration: invitation_sent Tabelle erstellen
CREATE TABLE IF NOT EXISTS "invitation_sent" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "sentBy"         TEXT NOT NULL,
  "sentByName"     TEXT NOT NULL,
  "recipients"     TEXT NOT NULL,
  "eventName"      TEXT NOT NULL,
  "eventDate"      TEXT NOT NULL DEFAULT '',
  "eventTime"      TEXT NOT NULL DEFAULT '',
  "eventLocation"  TEXT NOT NULL DEFAULT '',
  "eventProgram"   TEXT NOT NULL DEFAULT '',
  "rsvpDeadline"   TEXT NOT NULL DEFAULT '',
  "directions"     TEXT NOT NULL DEFAULT '',
  "introText"      TEXT NOT NULL DEFAULT '',
  "closing"        TEXT NOT NULL DEFAULT '',
  "signers"        TEXT NOT NULL DEFAULT '[]',
  "sendMode"       TEXT NOT NULL DEFAULT 'html_pdf',
  "designSnapshot" TEXT,
  "status"         TEXT NOT NULL DEFAULT 'sent',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "invitation_sent_sentBy_idx" ON "invitation_sent"("sentBy");
CREATE INDEX IF NOT EXISTS "invitation_sent_createdAt_idx" ON "invitation_sent"("createdAt");
