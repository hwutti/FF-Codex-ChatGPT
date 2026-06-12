import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// ── GET /api/privacy ─────────────────────────────────────────────────────────
// Öffentlich — gibt aktuellen Datenschutztext + Version zurück
// Wird vor dem Login geladen um zu prüfen ob Bestätigung nötig
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        privacyText: true, privacyVersion: true, privacyVersionNote: true,
        privacyHeaderBg: true, privacyHeaderText: true, privacyPageBg: true,
        privacyButtonBg: true, privacyContentText: true,
        logoUrl: true, name: true,
      },
    }) as any;
    res.json({
      privacyText: settings?.privacyText || null,
      privacyVersion: settings?.privacyVersion || 0,
      privacyVersionNote: settings?.privacyVersionNote || null,
      hasPrivacy: !!(settings?.privacyText && settings.privacyVersion > 0),
      privacyHeaderBg: settings?.privacyHeaderBg || '#1e293b',
      privacyHeaderText: settings?.privacyHeaderText || '#ffffff',
      privacyPageBg: settings?.privacyPageBg || '#f1f5f9',
      privacyButtonBg: settings?.privacyButtonBg || '#16a34a',
      privacyContentText: settings?.privacyContentText || '#374151',
      logoUrl: settings?.logoUrl || null,
      name: settings?.name || '',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/privacy/status ───────────────────────────────────────────────────
// Auth — prüft ob der eingeloggte User die aktuelle Version bestätigt hat
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [settings, user] = await Promise.all([
      prisma.appSettings.findUnique({
        where: { id: 'singleton' },
        select: {
          privacyVersion: true, privacyVersionNote: true, privacyText: true,
          privacyHeaderBg: true, privacyHeaderText: true, privacyPageBg: true,
          privacyButtonBg: true, privacyContentText: true,
          logoUrl: true, name: true,
        },
      }) as any,
      prisma.user.findUnique({
        where: { id: userId },
        select: { privacyAcceptedVersion: true, privacyAcceptedAt: true } as any,
      }) as any,
    ]);

    const currentVersion = settings?.privacyVersion || 0;
    const acceptedVersion = user?.privacyAcceptedVersion || 0;
    const hasPrivacy = !!(settings?.privacyText && currentVersion > 0);

    // Kein Datenschutztext hinterlegt → kein Zwang
    if (!hasPrivacy) {
      res.json({ required: false, accepted: true, currentVersion, acceptedVersion });
      return;
    }

    const accepted = acceptedVersion >= currentVersion;
    res.json({
      required: !accepted,
      accepted,
      currentVersion,
      acceptedVersion,
      privacyVersionNote: accepted ? null : (settings?.privacyVersionNote || null),
      privacyText: settings?.privacyText || null,
      privacyHeaderBg: settings?.privacyHeaderBg || '#1e293b',
      privacyHeaderText: settings?.privacyHeaderText || '#ffffff',
      privacyPageBg: settings?.privacyPageBg || '#f1f5f9',
      privacyButtonBg: settings?.privacyButtonBg || '#16a34a',
      privacyContentText: settings?.privacyContentText || '#374151',
      logoUrl: settings?.logoUrl || null,
      name: settings?.name || '',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/privacy/accept ─────────────────────────────────────────────────
// Auth — User bestätigt die aktuelle Datenschutzversion
router.post('/accept', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: { privacyVersion: true },
    }) as any;

    const currentVersion = settings?.privacyVersion || 0;
    if (currentVersion === 0) {
      res.json({ ok: true, message: 'Kein Datenschutztext hinterlegt' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        privacyAcceptedVersion: currentVersion,
        privacyAcceptedAt: new Date(),
      } as any,
    });

    res.json({ ok: true, acceptedVersion: currentVersion });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/privacy ─────────────────────────────────────────────────────────
// Admin — Datenschutztext bearbeiten
// Wenn Text geändert wird UND versionNote gesetzt → Version wird erhöht → alle müssen neu bestätigen
router.put('/', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { privacyText, privacyVersionNote, bumpVersion,
            privacyHeaderBg, privacyHeaderText, privacyPageBg,
            privacyButtonBg, privacyContentText } = req.body;

    const current = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: { privacyVersion: true },
    }) as any;

    const currentVersion = current?.privacyVersion || 0;
    // Version erhöhen wenn Admin das explizit will (bumpVersion=true)
    const newVersion = bumpVersion ? currentVersion + 1 : currentVersion;

    const brandingFields = {
      privacyHeaderBg: privacyHeaderBg || '#1e293b',
      privacyHeaderText: privacyHeaderText || '#ffffff',
      privacyPageBg: privacyPageBg || '#f1f5f9',
      privacyButtonBg: privacyButtonBg || '#16a34a',
      privacyContentText: privacyContentText || '#374151',
    };

    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: {
        privacyText,
        privacyVersion: newVersion,
        privacyVersionNote: bumpVersion ? privacyVersionNote : undefined,
        ...brandingFields,
      } as any,
      create: {
        id: 'singleton',
        privacyText,
        privacyVersion: newVersion,
        privacyVersionNote: bumpVersion ? privacyVersionNote : null,
        ...brandingFields,
      } as any,
    });

    res.json({ ok: true, newVersion, bumpedVersion: bumpVersion });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/privacy/acceptances ─────────────────────────────────────────────
// Admin — Liste aller User mit Bestätigungsstatus
router.get('/acceptances', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const [settings, users] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { privacyVersion: true } }) as any,
      prisma.user.findMany({
        select: {
          id: true, email: true,
          privacyAcceptedVersion: true,
          privacyAcceptedAt: true,
          member: { select: { firstName: true, lastName: true } },
        } as any,
        orderBy: { email: 'asc' },
      }) as any,
    ]);

    const currentVersion = settings?.privacyVersion || 0;
    const result = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.member ? `${u.member.firstName} ${u.member.lastName}` : u.email,
      acceptedVersion: u.privacyAcceptedVersion || 0,
      acceptedAt: u.privacyAcceptedAt || null,
      upToDate: (u.privacyAcceptedVersion || 0) >= currentVersion,
    }));

    res.json({ currentVersion, users: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
