-- AlterTable: AppSettings — E-Mail Template Texte
ALTER TABLE "app_settings" ADD COLUMN "emailSubject"     TEXT DEFAULT 'Passwort zurücksetzen — {{name}}';
ALTER TABLE "app_settings" ADD COLUMN "emailHeadline"    TEXT DEFAULT 'Passwort zurücksetzen';
ALTER TABLE "app_settings" ADD COLUMN "emailBodyText"    TEXT DEFAULT 'Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button um ein neues Passwort zu vergeben.

Anleitung:
1. Klicke auf den Button "Passwort zurücksetzen"
2. Du wirst zur App weitergeleitet
3. Gib dein neues Passwort zweimal ein
4. Bestätige — du wirst danach automatisch zur Anmeldung weitergeleitet

Falls du keine Anfrage gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.';
ALTER TABLE "app_settings" ADD COLUMN "emailButtonText"  TEXT DEFAULT 'Passwort zurücksetzen →';
ALTER TABLE "app_settings" ADD COLUMN "emailHeaderImage" TEXT;
