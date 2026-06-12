-- Migration: drafts Tabelle erstellen
CREATE TABLE IF NOT EXISTS "drafts" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "type"            TEXT NOT NULL DEFAULT 'letter',
  "title"           TEXT NOT NULL DEFAULT '',
  "createdBy"       TEXT NOT NULL,
  "createdByName"   TEXT NOT NULL,
  "closing"         TEXT NOT NULL DEFAULT '',
  "signerUserIds"   TEXT NOT NULL DEFAULT '[]',
  "designId"        TEXT,
  "designSnapshot"  TEXT,
  "sendCount"       INTEGER NOT NULL DEFAULT 0,
  "lastSentAt"      TIMESTAMP(3),
  "subject"         TEXT NOT NULL DEFAULT '',
  "salutation"      TEXT NOT NULL DEFAULT '',
  "body"            TEXT NOT NULL DEFAULT '',
  "recipientName"   TEXT NOT NULL DEFAULT '',
  "recipientAddress" TEXT NOT NULL DEFAULT '',
  "date"            TEXT NOT NULL DEFAULT '',
  "eventName"       TEXT NOT NULL DEFAULT '',
  "eventDate"       TEXT NOT NULL DEFAULT '',
  "eventTime"       TEXT NOT NULL DEFAULT '',
  "eventLocation"   TEXT NOT NULL DEFAULT '',
  "eventProgram"    TEXT NOT NULL DEFAULT '',
  "rsvpDeadline"    TEXT NOT NULL DEFAULT '',
  "directions"      TEXT NOT NULL DEFAULT '',
  "introText"       TEXT NOT NULL DEFAULT '',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "drafts_createdBy_idx" ON "drafts"("createdBy");
CREATE INDEX IF NOT EXISTS "drafts_type_idx" ON "drafts"("type");
CREATE INDEX IF NOT EXISTS "drafts_updatedAt_idx" ON "drafts"("updatedAt");
