import { Router, Request, Response } from 'express';
import webpush from 'web-push';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
const requireAuth = authenticate;

const router = Router();

// VAPID Keys aus ENV
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL        || 'admin@feuerwehr.local';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ── GET /api/push/vapid-public-key ────────────────────────────────────
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// ── POST /api/push/subscribe ──────────────────────────────────────────
router.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Ungültige Subscription' });
    }
    await (prisma as any).pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId, userAgent: req.headers['user-agent'] },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers['user-agent'] },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/push/subscribe ────────────────────────────────────────
router.delete('/subscribe', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { endpoint } = req.body || {};
    if (endpoint) {
      // Nur dieses spezifische Gerät löschen
      await (prisma as any).pushSubscription.deleteMany({ where: { endpoint } });
    }
    // Kein Fallback mehr – ohne Endpoint passiert nichts (verhindert versehentliches Löschen aller Geräte)
    // pushSubscription am User-Objekt leeren
    await (prisma as any).user.update({
      where: { id: userId },
      data: { pushSubscription: null },
    }).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/push/settings ────────────────────────────────────────────
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { pushNewEvent: true, pushNewExercise: true, pushNewIncident: true, pushBirthday: true, pushUpdate: true, pushReminder7: true, pushReminder3: true, pushReminder1: true },
    });
    // Check if user has an active subscription
    const sub = await (prisma as any).pushSubscription.findFirst({ where: { userId } });
    res.json({ ...user, hasSubscription: !!sub });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/push/settings ────────────────────────────────────────────
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { pushNewEvent, pushNewExercise, pushNewIncident, pushBirthday, pushUpdate, pushReminder7, pushReminder3, pushReminder1 } = req.body;
    await (prisma as any).user.update({
      where: { id: userId },
      data: { pushNewEvent, pushNewExercise, pushNewIncident, pushBirthday, pushUpdate, pushReminder7, pushReminder3, pushReminder1 },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Hilfsfunktion: Push an alle Subscriber mit bestimmter Einstellung ─
export async function sendPushToAll(
  setting: 'pushNewEvent' | 'pushNewExercise' | 'pushNewIncident' | 'pushBirthday' | 'pushUpdate',
  payload: { title: string; body: string; icon?: string; url?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    const users = await (prisma as any).user.findMany({
      where: { [setting]: true },
      include: { pushSubscriptions: true },
    });
    for (const user of users) {
      await sendPushToUser(user, payload);
    }
  } catch (e) {
    console.error('Push-Fehler:', e);
  }
}

export default router;

// ── Hilfsfunktion: Push an einen einzelnen User ───────────────────────
export async function sendPushToUser(
  user: { id?: string; pushSubscriptions: { endpoint: string; p256dh: string; auth: string }[] },
  payload: { title: string; body: string; icon?: string; url?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    url: payload.url || '/',
  });

  // In DB speichern für Posteingang
  if (user.id) {
    try {
      await (prisma as any).pushNotification.create({
        data: {
          userId: user.id,
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
        },
      });
    } catch {}
  }

  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      );
    } catch (err: any) {
      // 410 Gone + 404 Not Found = Subscription ungültig → aus DB löschen
      if (err.statusCode === 410 || err.statusCode === 404) {
        await (prisma as any).pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
        console.log('[Push] Ungültige Subscription entfernt:', sub.endpoint.slice(0, 50));
      }
    }
  }
}

// ── POST /api/push/test (nur Admin) ──────────────────────────────────
router.post('/test', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });

    const fullUser = await (prisma as any).user.findUnique({
      where: { id: user.userId },
      include: { pushSubscriptions: true },
    });

    if (!fullUser?.pushSubscriptions?.length) {
      return res.status(400).json({ error: 'Keine aktive Push-Subscription für diesen Account' });
    }

    await sendPushToUser(fullUser, {
      title: '🧪 Test-Benachrichtigung',
      body: 'Push-Benachrichtigungen funktionieren korrekt!',
      url: '/notifications',
    });

    res.json({ ok: true, sent: fullUser.pushSubscriptions.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ── GET /api/push/members — Mitglieder mit aktiver Push-Subscription ─
router.get('/members', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });

    const users = await (prisma as any).user.findMany({
      where: { pushSubscriptions: { some: {} } },
      include: {
        member: { select: { firstName: true, lastName: true, rank: true, status: true } },
      },
    });

    const result = users
      .filter((u: any) => u.member)
      .map((u: any) => ({
        userId: u.id,
        firstName: u.member.firstName,
        lastName: u.member.lastName,
        rank: u.member.rank,
        status: u.member.status,
      }));

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/push/broadcast (nur Admin) ─────────────────────────────
router.post('/broadcast', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });

    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Titel und Text erforderlich' });

    const { mode, userIds } = req.body;

    let where: any = { pushSubscriptions: { some: {} } };
    if (mode === 'select' && Array.isArray(userIds) && userIds.length > 0) {
      where.id = { in: userIds };
    } else {
      // Alle aktiven Mitglieder
      where.member = { status: { in: ['ACTIVE', 'YOUTH'] } };
    }

    const users = await (prisma as any).user.findMany({
      where,
      include: { pushSubscriptions: true },
    });

    let sent = 0;
    for (const u of users) {
      await sendPushToUser(u, { title, body, url: '/' });
      sent += u.pushSubscriptions.length;
    }

    res.json({ ok: true, users: users.length, sent });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET/PUT /api/push/admin-settings (nur Admin) ─────────────────────
router.get('/admin-settings', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    const settings = await (prisma as any).appSettings.findUnique({
      where: { id: 'singleton' },
      select: { pushReminderHour: true, pushReminderMinute: true },
    });
    res.json(settings || { pushReminderHour: 19, pushReminderMinute: 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/admin-settings', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    const { pushReminderHour, pushReminderMinute } = req.body;
    await (prisma as any).appSettings.upsert({
      where: { id: 'singleton' },
      update: { pushReminderHour, pushReminderMinute },
      create: { id: 'singleton', pushReminderHour, pushReminderMinute },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ── GET /api/push/subscriptions — Alle Subscriptions (Admin) ─────────
router.get('/subscriptions', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });

    const subs = await (prisma as any).pushSubscription.findMany({
      include: {
        user: {
          include: {
            member: { select: { firstName: true, lastName: true, rank: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = subs.map((sub: any) => ({
      id: sub.id,
      endpoint: sub.endpoint,
      userAgent: sub.userAgent || '',
      createdAt: sub.createdAt,
      userId: sub.userId,
      userName: sub.user?.member
        ? `${sub.user.member.firstName} ${sub.user.member.lastName}`
        : sub.user?.email || sub.userId,
      rank: sub.user?.member?.rank || '',
      settings: {
        pushNewEvent:    sub.user?.pushNewEvent ?? true,
        pushNewExercise: sub.user?.pushNewExercise ?? true,
        pushNewIncident: sub.user?.pushNewIncident ?? true,
        pushBirthday:    sub.user?.pushBirthday ?? true,
        pushUpdate:      sub.user?.pushUpdate ?? true,
        pushReminder7:   sub.user?.pushReminder7 ?? false,
        pushReminder3:   sub.user?.pushReminder3 ?? false,
        pushReminder1:   sub.user?.pushReminder1 ?? false,
      },
    }));

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/push/subscriptions/:id — Einzelne Subscription löschen ─
router.delete('/subscriptions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    await (prisma as any).pushSubscription.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/push/subscriptions/:id/test — Test-Push an eine Subscription ─
router.post('/subscriptions/:id/test', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });

    const sub = await (prisma as any).pushSubscription.findUnique({ where: { id: req.params.id } });
    if (!sub) return res.status(404).json({ error: 'Subscription nicht gefunden' });

    await sendPushToUser(
      { id: sub.userId, pushSubscriptions: [sub] },
      { title: '🔔 Test-Benachrichtigung', body: 'Diese Benachrichtigung wurde vom Administrator gesendet.', url: '/' }
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/push/inbox — Posteingang des Users ───────────────────────
router.get('/inbox', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, role } = (req as any).user;
    let notifications;
    if (role === 'ADMIN') {
      // Admin sieht alle
      notifications = await (prisma as any).pushNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          user: { select: { member: { select: { firstName: true, lastName: true } } } },
        },
      });
    } else {
      notifications = await (prisma as any).pushNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }
    res.json(notifications);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/push/inbox/unread-count ─────────────────────────────────
router.get('/inbox/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const count = await (prisma as any).pushNotification.count({
      where: { userId, read: false },
    });
    res.json({ count });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/push/inbox/read-all ─────────────────────────────────────
router.put('/inbox/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    await (prisma as any).pushNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/push/inbox/:id ────────────────────────────────────────
router.delete('/inbox/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, role } = (req as any).user;
    const where = role === 'ADMIN'
      ? { id: req.params.id }
      : { id: req.params.id, userId };
    await (prisma as any).pushNotification.deleteMany({ where });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/push/inbox — Alle löschen ────────────────────────────
router.delete('/inbox', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, role } = (req as any).user;
    const where = role === 'ADMIN' ? {} : { userId };
    await (prisma as any).pushNotification.deleteMany({ where });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
