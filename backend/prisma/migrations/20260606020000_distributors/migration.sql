-- Migration: distributors Tabelle erstellen
CREATE TABLE IF NOT EXISTS "distributors" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "memberIds" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
