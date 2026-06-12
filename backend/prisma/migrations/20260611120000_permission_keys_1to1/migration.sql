-- Migration: Berechtigungs-Keys 1:1 auf Sidebar-Einträge mappen
-- Datum: 2026-06-11
-- 
-- Änderungen:
--   events          → exercises + org_events
--   calendar_command (nur Kommandotermine-Kontext) → bleibt UND kommando_termine wird hinzugefügt  
--   reports         → bleibt UND jahresbericht wird hinzugefügt
--
-- Strategie: Bestehende Rechte werden ERWEITERT, nie gelöscht.
-- Wer 'events' hatte, bekommt jetzt 'exercises' UND 'org_events'.
-- Wer 'calendar_command' hatte, bekommt zusätzlich 'kommando_termine'.
-- Wer 'reports' hatte, bekommt zusätzlich 'jahresbericht'.

-- ─── 1. user_direct_permissions ───────────────────────────────────────────────

-- events → exercises (INSERT wo noch nicht vorhanden)
INSERT INTO user_direct_permissions (id, "userId", area, action)
SELECT gen_random_uuid(), "userId", 'exercises', action
FROM user_direct_permissions
WHERE area = 'events'
ON CONFLICT ("userId", area, action) DO NOTHING;

-- events → org_events
INSERT INTO user_direct_permissions (id, "userId", area, action)
SELECT gen_random_uuid(), "userId", 'org_events', action
FROM user_direct_permissions
WHERE area = 'events'
ON CONFLICT ("userId", area, action) DO NOTHING;

-- Alte 'events' Einträge entfernen
DELETE FROM user_direct_permissions WHERE area = 'events';

-- calendar_command → kommando_termine (zusätzlich, calendar_command bleibt für Kalender Kommando)
INSERT INTO user_direct_permissions (id, "userId", area, action)
SELECT gen_random_uuid(), "userId", 'kommando_termine', action
FROM user_direct_permissions
WHERE area = 'calendar_command'
ON CONFLICT ("userId", area, action) DO NOTHING;

-- reports → jahresbericht (zusätzlich, reports bleibt für Berichte)
INSERT INTO user_direct_permissions (id, "userId", area, action)
SELECT gen_random_uuid(), "userId", 'jahresbericht', action
FROM user_direct_permissions
WHERE area = 'reports'
ON CONFLICT ("userId", area, action) DO NOTHING;

-- ─── 2. permission_groups (JSON-Array in permissions-Spalte) ─────────────────

-- Für jede Gruppe: events-Einträge durch exercises + org_events ersetzen
-- PostgreSQL: JSON-Array manipulieren via jsonb

-- Schritt A: Gruppen die 'events' in permissions haben identifizieren und erweitern
-- Wir bauen ein neues JSON-Array: entferne 'events', füge 'exercises' und 'org_events' hinzu
UPDATE permission_groups
SET permissions = (
  -- Bestehende ohne 'events' + neue exercises-Einträge + neue org_events-Einträge
  SELECT jsonb_agg(entry)
  FROM (
    -- Alle bestehenden Einträge außer 'events'
    SELECT entry FROM jsonb_array_elements(permissions::jsonb) AS entry
    WHERE entry->>'area' != 'events'
    
    UNION ALL
    
    -- Für jeden 'events'-Eintrag: exercises-Version hinzufügen
    SELECT jsonb_build_object('area', 'exercises', 'action', entry->>'action')
    FROM jsonb_array_elements(permissions::jsonb) AS entry
    WHERE entry->>'area' = 'events'
    
    UNION ALL
    
    -- Für jeden 'events'-Eintrag: org_events-Version hinzufügen
    SELECT jsonb_build_object('area', 'org_events', 'action', entry->>'action')
    FROM jsonb_array_elements(permissions::jsonb) AS entry
    WHERE entry->>'area' = 'events'
  ) AS combined(entry)
)::json
WHERE permissions::jsonb @> '[{"area": "events"}]'::jsonb;

-- Schritt B: calendar_command → kommando_termine zusätzlich hinzufügen
UPDATE permission_groups
SET permissions = (
  SELECT jsonb_agg(entry)
  FROM (
    SELECT entry FROM jsonb_array_elements(permissions::jsonb) AS entry
    
    UNION ALL
    
    SELECT jsonb_build_object('area', 'kommando_termine', 'action', entry->>'action')
    FROM jsonb_array_elements(permissions::jsonb) AS entry
    WHERE entry->>'area' = 'calendar_command'
    -- Nur wenn kommando_termine noch nicht vorhanden
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(permissions::jsonb) AS e2
      WHERE e2->>'area' = 'kommando_termine' AND e2->>'action' = entry->>'action'
    )
  ) AS combined(entry)
)::json
WHERE permissions::jsonb @> '[{"area": "calendar_command"}]'::jsonb;

-- Schritt C: reports → jahresbericht zusätzlich hinzufügen
UPDATE permission_groups
SET permissions = (
  SELECT jsonb_agg(entry)
  FROM (
    SELECT entry FROM jsonb_array_elements(permissions::jsonb) AS entry
    
    UNION ALL
    
    SELECT jsonb_build_object('area', 'jahresbericht', 'action', entry->>'action')
    FROM jsonb_array_elements(permissions::jsonb) AS entry
    WHERE entry->>'area' = 'reports'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(permissions::jsonb) AS e2
      WHERE e2->>'area' = 'jahresbericht' AND e2->>'action' = entry->>'action'
    )
  ) AS combined(entry)
)::json
WHERE permissions::jsonb @> '[{"area": "reports"}]'::jsonb;
