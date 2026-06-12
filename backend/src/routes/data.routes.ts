import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN'));

const BACKUP_VERSION = '4.0';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function readImageAsBase64(url: string | null): { base64: string; mime: string } | null {
  if (!url) return null;
  try {
    const filePath = path.join(env.UPLOAD_DIR, url.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) return null;
    const base64 = fs.readFileSync(filePath).toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' :
      ext === '.gif' ? 'image/gif' :
      ext === '.webp' ? 'image/webp' :
      ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
    return { base64, mime };
  } catch { return null; }
}

function writeImageFromBase64(base64: string, mime: string, subdir: string, filename: string): string | null {
  try {
    const ext =
      mime === 'image/png' ? '.png' :
      mime === 'image/gif' ? '.gif' :
      mime === 'image/webp' ? '.webp' :
      mime === 'image/svg+xml' ? '.svg' : '.jpg';
    const dir = path.join(env.UPLOAD_DIR, subdir);
    fs.mkdirSync(dir, { recursive: true });
    const fname = `${filename}${ext}`;
    fs.writeFileSync(path.join(dir, fname), Buffer.from(base64, 'base64'));
    return `/uploads/${subdir}/${fname}`;
  } catch { return null; }
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
router.get('/export', async (_req: Request, res: Response) => {
  try {
    const [members, events, attendance, incidents, incidentMembers, honors, users, settings] = await Promise.all([
      prisma.member.findMany({ orderBy: { memberNumber: 'asc' } }),
      prisma.event.findMany({ orderBy: { date: 'asc' } }),
      prisma.attendance.findMany(),
      prisma.incident.findMany({ orderBy: { alarmTime: 'desc' } }),
      prisma.incidentMember.findMany(),
      prisma.honor.findMany({ orderBy: { honorDate: 'desc' } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, email: true, passwordHash: true, role: true,
          isActive: true, memberId: true, avatarUrl: true,
          twoFactorEnabled: true, twoFactorSecret: true, createdAt: true,
        },
      }),
      prisma.appSettings.findUnique({ where: { id: 'singleton' } }),
    ]);

    // Avatare als Base64 einbetten
    const usersWithImages = users.map(u => ({
      ...u,
      avatar: readImageAsBase64(u.avatarUrl),
    }));

    const brandingLogo = settings?.logoUrl ? readImageAsBase64(settings.logoUrl) : null;

    const exportData = {
      exportVersion: BACKUP_VERSION,
      exportDate: new Date().toISOString(),
      appName: 'Feuerwehr Verwaltung',
      data: {
        members, events, attendance, incidents,
        incidentMembers, honors,
        users: usersWithImages,
        settings: settings ? { ...settings, brandingLogo } : null,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ff-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('[Export]', err);
    res.status(500).json({ error: 'Fehler beim Export' });
  }
});

// ── IMPORT ────────────────────────────────────────────────────────────────────
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data?.members || !data?.users) {
      res.status(400).json({ error: 'Ungültiges Backup-Format.' });
      return;
    }

    const results = { members: 0, events: 0, attendance: 0, incidents: 0, honors: 0, users: 0, errors: [] as string[] };

    // ════════════════════════════════════════════════════════════════════
    // STRATEGIE: Kompletter Reset dann Restore mit Original-IDs
    // So bleiben alle Referenzen (memberId, eventId etc.) korrekt
    // ════════════════════════════════════════════════════════════════════

    // Schritt 1: Alle abhängigen Daten löschen (Reihenfolge wegen FK-Constraints)
    console.log('[Import] Lösche bestehende Daten...');
    await prisma.auditLog.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.incidentMember.deleteMany({});
    await prisma.honor.deleteMany({});
    await prisma.incident.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.user.deleteMany({}); // Erst User löschen wegen memberId-FK
    await prisma.member.deleteMany({});
    console.log('[Import] Bestehende Daten gelöscht.');

    // Schritt 2: Mitglieder mit Original-IDs einfügen
    for (const m of (data.members || [])) {
      try {
        const { createdAt, updatedAt, user, attendances, honors: mH, incidents: mI, responsibleEvents, ...rest } = m;
        await prisma.member.create({ data: { ...rest } });
        results.members++;
      } catch (e: any) { results.errors.push(`Mitglied ${m.memberNumber}: ${e.message}`); }
    }

    // Schritt 3: Ereignisse
    for (const ev of (data.events || [])) {
      try {
        const { createdAt, updatedAt, attendances, responsiblePerson, ...rest } = ev;
        await prisma.event.create({ data: { ...rest } });
        results.events++;
      } catch (e: any) { results.errors.push(`Ereignis ${ev.id}: ${e.message}`); }
    }

    // Schritt 4: Anwesenheiten
    for (const att of (data.attendance || [])) {
      try {
        const { createdAt, updatedAt, event, member, ...rest } = att;
        await prisma.attendance.create({ data: { ...rest } });
        results.attendance++;
      } catch { /* ignorieren wenn Referenz fehlt */ }
    }

    // Schritt 5: Einsätze
    for (const inc of (data.incidents || [])) {
      try {
        const { createdAt, updatedAt, members: incMem, ...rest } = inc;
        await prisma.incident.create({ data: { ...rest } });
        results.incidents++;
      } catch (e: any) { results.errors.push(`Einsatz ${inc.id}: ${e.message}`); }
    }

    // Schritt 5b: Einsatz-Mitglieder
    for (const im of (data.incidentMembers || [])) {
      try {
        await prisma.incidentMember.create({
          data: { id: im.id, incidentId: im.incidentId, memberId: im.memberId }
        });
      } catch {}
    }

    // Schritt 6: Ehrungen
    for (const h of (data.honors || [])) {
      try {
        const { createdAt, updatedAt, member, ...rest } = h;
        await prisma.honor.create({ data: { ...rest } });
        results.honors++;
      } catch (e: any) { results.errors.push(`Ehrung ${h.id}: ${e.message}`); }
    }

    // Schritt 7: User mit Original-IDs, Passwort-Hashes und Avataren
    for (const u of (data.users || [])) {
      try {
        // Avatar-Bild wiederherstellen
        let avatarUrl = u.avatarUrl;
        if (u.avatar?.base64 && u.avatar?.mime) {
          const restored = writeImageFromBase64(
            u.avatar.base64, u.avatar.mime,
            'avatars', `avatar-${u.id}`
          );
          if (restored) avatarUrl = restored;
        }

        await prisma.user.create({
          data: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,  // Original-Passwort!
            role: u.role,
            isActive: u.isActive,
            avatarUrl,
            memberId: u.memberId || null,
            twoFactorEnabled: u.twoFactorEnabled || false,
            twoFactorSecret: u.twoFactorSecret || null,
          },
        });
        results.users++;
      } catch (e: any) { results.errors.push(`Benutzer ${u.email}: ${e.message}`); }
    }

    // Schritt 8: Branding & App-Einstellungen
    if (data.settings) {
      try {
        const s = data.settings;
        let logoUrl = s.logoUrl;
        if (s.brandingLogo?.base64 && s.brandingLogo?.mime) {
          const restored = writeImageFromBase64(
            s.brandingLogo.base64, s.brandingLogo.mime,
            'branding', 'logo'
          );
          if (restored) logoUrl = restored;
        }
        await prisma.appSettings.upsert({
          where: { id: 'singleton' },
          update: { name: s.name, subtitle: s.subtitle, foundedYear: s.foundedYear, primaryColor: s.primaryColor, logoUrl },
          create: { id: 'singleton', name: s.name, subtitle: s.subtitle, foundedYear: s.foundedYear, primaryColor: s.primaryColor, logoUrl },
        });
      } catch (e: any) { results.errors.push(`Branding: ${e.message}`); }
    }

    console.log('[Import] Abgeschlossen:', results);
    res.json({
      message: 'Backup vollständig wiederhergestellt.',
      results,
      hasErrors: results.errors.length > 0,
    });
  } catch (err) {
    console.error('[Import] Fatal:', err);
    res.status(500).json({ error: 'Fehler beim Import: ' + (err as any).message });
  }
});

export default router;
