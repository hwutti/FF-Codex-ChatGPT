import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { authenticate, AuthPayload } from '../middleware/auth.middleware';

const router = Router();

// ── Rate Limiting (PostgreSQL-backed — überlebt Neustarts) ──────────────────
const MAX_ATTEMPTS = 10;
const BLOCK_DURATION_MS = 3 * 60 * 1000;

// Bereinigt alte Einträge täglich
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - BLOCK_DURATION_MS * 48);
    await prisma.loginAttempt.deleteMany({ where: { firstAttempt: { lt: cutoff } } });
  } catch {}
}, 24 * 60 * 60 * 1000);

function getClientIp(req: Request): string {
  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) {
    const ips = forwarded.split(',').map((ip: string) => ip.trim());
    const publicIp = [...ips].reverse().find((ip: string) => !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('172.') && ip !== '127.0.0.1');
    if (publicIp) return publicIp;
    return ips[0];
  }
  return req.socket.remoteAddress || 'unknown';
}

async function checkRateLimit(ip: string): Promise<{ blocked: boolean; remainingMs: number }> {
  try {
    const record = await prisma.loginAttempt.findUnique({ where: { ip } });
    if (!record?.blockedAt) return { blocked: false, remainingMs: 0 };
    const remaining = BLOCK_DURATION_MS - (Date.now() - record.blockedAt.getTime());
    if (remaining > 0) return { blocked: true, remainingMs: remaining };
    // Sperre abgelaufen — Eintrag löschen
    await prisma.loginAttempt.delete({ where: { ip } }).catch(() => {});
    return { blocked: false, remainingMs: 0 };
  } catch { return { blocked: false, remainingMs: 0 }; }
}

async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  try {
    const now = new Date();
    const existing = await prisma.loginAttempt.findUnique({ where: { ip } });
    if (!existing) {
      await prisma.loginAttempt.create({ data: { ip, email, count: 1 } });
      return;
    }
    // Fenster abgelaufen → zurücksetzen
    if (now.getTime() - existing.firstAttempt.getTime() > BLOCK_DURATION_MS) {
      await prisma.loginAttempt.update({ where: { ip }, data: { count: 1, email, blockedAt: null, firstAttempt: now } });
      return;
    }
    const newCount = existing.count + 1;
    const blockedAt = newCount >= MAX_ATTEMPTS ? now : null;
    await prisma.loginAttempt.update({ where: { ip }, data: { count: newCount, email, blockedAt } });
    if (blockedAt) {
      prisma.auditLog.create({
        data: { action: 'LOGIN_BLOCKED', entity: 'Auth', entityId: ip, userId: 'system',
          details: JSON.stringify({ ip, email, attempts: newCount, blockedAt: now.toISOString() }) },
      }).catch(() => {});
    }
  } catch {}
}

async function clearAttempts(ip: string): Promise<void> {
  try { await prisma.loginAttempt.delete({ where: { ip } }); } catch {}
}

// ── Trusted Device Helpers ────────────────────────────────────────────────────
function getDeviceName(userAgent: string): string {
  const isEdge = /Edg\//.test(userAgent);
  const isChrome = /Chrome\//.test(userAgent) && !isEdge && !/OPR\//.test(userAgent);
  const isFirefox = /Firefox\//.test(userAgent);
  const isSafari = /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent);
  const isOpera = /OPR\//.test(userAgent);

  // Browser-Version extrahieren
  let browserVersion = '';
  if (isEdge) { const m = userAgent.match(/Edg\/(\d+)/); browserVersion = m ? ` ${m[1]}` : ''; }
  else if (isChrome) { const m = userAgent.match(/Chrome\/(\d+)/); browserVersion = m ? ` ${m[1]}` : ''; }
  else if (isFirefox) { const m = userAgent.match(/Firefox\/(\d+)/); browserVersion = m ? ` ${m[1]}` : ''; }
  else if (isSafari) { const m = userAgent.match(/Version\/(\d+)/); browserVersion = m ? ` ${m[1]}` : ''; }

  const browser = isEdge ? `Edge${browserVersion}` : isChrome ? `Chrome${browserVersion}` : isFirefox ? `Firefox${browserVersion}` : isSafari ? `Safari${browserVersion}` : isOpera ? 'Opera' : 'Browser';

  if (/iPhone/.test(userAgent)) return `iPhone (${browser})`;
  if (/iPad/.test(userAgent)) return `iPad (${browser})`;
  if (/Android.*Mobile/.test(userAgent)) return `Android Phone (${browser})`;
  if (/Android/.test(userAgent)) return `Android Tablet (${browser})`;
  if (/Macintosh/.test(userAgent)) return `Mac (${browser})`;
  if (/Windows NT 10/.test(userAgent)) return `Windows 10/11 (${browser})`;
  if (/Windows NT 6/.test(userAgent)) return `Windows (${browser})`;
  if (/Linux/.test(userAgent)) return `Linux (${browser})`;
  return `Gerät (${browser})`;
}

async function checkTrustedDevice(req: Request, userId: string): Promise<boolean> {
  const token = req.cookies?.deviceToken;
  if (!token) return false;
  const device = await prisma.trustedDevice.findFirst({
    where: { userId, token, expiresAt: { gt: new Date() } },
  });
  return !!device;
}

async function createTrustedDevice(req: Request, userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex');
  const ua = req.headers['user-agent'] || '';
  await prisma.trustedDevice.create({
    data: {
      userId,
      token,
      deviceName: getDeviceName(ua),
      userAgent: ua.slice(0, 500),
      ipAddress: getClientIp(req),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Tage
    },
  });
  return token;
}

// ── Blocked IPs ───────────────────────────────────────────────────────────────
router.get('/blocked', authenticate, async (req: Request, res: Response) => {
  if ((req as any).user?.role !== 'ADMIN') { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
  const now = new Date();
  const [attempts, recentBlocks] = await Promise.all([
    prisma.loginAttempt.findMany({ where: { blockedAt: { not: null } } }),
    prisma.auditLog.findMany({ where: { action: 'LOGIN_BLOCKED' }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const blocked = attempts
    .filter(r => r.blockedAt && (now.getTime() - r.blockedAt.getTime()) < BLOCK_DURATION_MS)
    .map(r => ({ ip: r.ip, email: r.email, attempts: r.count,
      blockedAt: r.blockedAt!.toISOString(),
      remainingMs: BLOCK_DURATION_MS - (now.getTime() - r.blockedAt!.getTime()) }));
  res.json({ currentlyBlocked: blocked, recentBlocks });
});

router.post('/unblock', authenticate, async (req: Request, res: Response) => {
  if ((req as any).user?.role !== 'ADMIN') { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
  const { ip } = req.body;
  await clearAttempts(ip);
  res.json({ message: `IP ${ip} entsperrt` });
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, totpCode, trustDevice } = req.body;
    const ip = getClientIp(req);

    const { blocked, remainingMs } = await checkRateLimit(ip);
    if (blocked) {
      res.status(429).json({ error: `Zu viele Versuche. Bitte ${Math.ceil(remainingMs / 1000)} Sekunden warten.`, remainingSeconds: Math.ceil(remainingMs / 1000) });
      return;
    }

    if (!email || !password) { res.status(400).json({ error: 'E-Mail und Passwort erforderlich' }); return; }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { member: { select: { firstName: true, lastName: true, rank: true, gender: true } } },
    });

    if (!user || !user.isActive) { await recordFailedAttempt(ip, email); res.status(401).json({ error: 'Ungültige Anmeldedaten' }); return; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { await recordFailedAttempt(ip, email); res.status(401).json({ error: 'Ungültige Anmeldedaten' }); return; }

    // 2FA check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // Gerät vertraut?
      const deviceTokenCookie = req.cookies?.deviceToken;
      console.log('[Login] deviceToken cookie:', deviceTokenCookie ? 'vorhanden' : 'FEHLT', '| alle cookies:', Object.keys(req.cookies || {}));
      const trusted = await checkTrustedDevice(req, user.id);
      if (!trusted) {
        if (!totpCode) { res.status(200).json({ requiresTwoFactor: true }); return; }
        const isValid = authenticator.verify({ token: totpCode, secret: user.twoFactorSecret }) ||
          authenticator.verify({ token: totpCode, secret: user.twoFactorSecret, window: 1 } as any);
        if (!isValid) { await recordFailedAttempt(ip, email); res.status(401).json({ error: 'Ungültiger 2FA-Code' }); return; }

        // Gerät vertrauen wenn gewünscht
        if (trustDevice) {
          const deviceToken = await createTrustedDevice(req, user.id);
          res.cookie('deviceToken', deviceToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/',
          });
        }
      }
    }

    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role, memberId: user.memberId || undefined };
    await clearAttempts(ip);
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' as any });

    // JWT als httpOnly Cookie setzen (sicher gegen XSS)
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 Stunden
      path: '/',
    });

    res.json({
      token, // Auch im Body für Rückwärtskompatibilität
      user: { id: user.id, email: user.email, role: user.role, memberId: user.memberId, member: user.member, twoFactorEnabled: user.twoFactorEnabled, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ── TRUSTED DEVICES ───────────────────────────────────────────────────────────

// GET /api/auth/trusted-devices - Eigene vertraute Geräte anzeigen
router.get('/trusted-devices', authenticate, async (req: Request, res: Response) => {
  const devices = await prisma.trustedDevice.findMany({
    where: { userId: req.user!.userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(devices);
});

// GET /api/auth/trusted-devices/:userId - Admin: Geräte eines Users
router.get('/trusted-devices/:userId', authenticate, async (req: Request, res: Response) => {
  if ((req as any).user?.role !== 'ADMIN') { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
  const devices = await prisma.trustedDevice.findMany({
    where: { userId: req.params.userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(devices);
});

// DELETE /api/auth/trusted-devices/:id - Gerät widerrufen
router.delete('/trusted-devices/:id', authenticate, async (req: Request, res: Response) => {
  const device = await prisma.trustedDevice.findUnique({ where: { id: req.params.id } });
  if (!device) { res.status(404).json({ error: 'Gerät nicht gefunden' }); return; }
  // Eigenes Gerät oder Admin
  if (device.userId !== req.user!.userId && (req as any).user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Keine Berechtigung' }); return;
  }
  await prisma.trustedDevice.delete({ where: { id: req.params.id } });
  res.json({ message: 'Gerät widerrufen' });
});

// DELETE /api/auth/trusted-devices - Alle Geräte widerrufen (eigene oder Admin für anderen User)
router.delete('/trusted-devices', authenticate, async (req: Request, res: Response) => {
  const userId = (req.body.userId as string) || req.user!.userId;
  if (userId !== req.user!.userId && (req as any).user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Keine Berechtigung' }); return;
  }
  await prisma.trustedDevice.deleteMany({ where: { userId } });
  res.json({ message: 'Alle Geräte widerrufen' });
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // Token auf Blacklist setzen
    const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      await prisma.blacklistedToken.create({
        data: { token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }).catch(() => {}); // Ignorieren wenn bereits blacklisted
    }
    res.clearCookie('authToken', { path: '/' });
    // deviceToken NICHT löschen — Gerätevertrauen bleibt 30 Tage erhalten
    res.json({ message: 'Erfolgreich abgemeldet' });
  } catch {
    res.clearCookie('authToken', { path: '/' });
    // deviceToken NICHT löschen — Gerätevertrauen bleibt 30 Tage erhalten
    res.json({ message: 'Erfolgreich abgemeldet' });
  }
});

// ── ME ────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { member: { select: { firstName: true, lastName: true, rank: true, gender: true } } },
    });
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden' }); return; }
    res.json({ id: user.id, email: user.email, role: user.role, memberId: user.memberId, member: user.member, twoFactorEnabled: user.twoFactorEnabled, avatarUrl: user.avatarUrl });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden' }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Aktuelles Passwort ist falsch' }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    // Alle vertrauten Geräte widerrufen
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    res.clearCookie('deviceToken', { path: '/' });
    res.json({ message: 'Passwort erfolgreich geändert — alle vertrauten Geräte wurden zurückgesetzt' });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ── 2FA ───────────────────────────────────────────────────────────────────────
router.post('/2fa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden' }); return; }
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Feuerwehr Verwaltung', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
    res.json({ secret, qrCode: qrCodeDataUrl });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

router.post('/2fa/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: 'Code erforderlich' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.twoFactorSecret) { res.status(400).json({ error: '2FA nicht eingerichtet' }); return; }
    // window: 1 = aktueller + vorheriger + nächster Code (±30 Sek Toleranz)
    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret }) ||
      authenticator.verify({ token: code, secret: user.twoFactorSecret, window: 1 } as any);
    if (!isValid) { res.status(400).json({ error: 'Ungültiger Code' }); return; }
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    res.json({ message: '2FA erfolgreich aktiviert' });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

router.post('/2fa/disable', authenticate, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: 'Code erforderlich' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.twoFactorSecret) { res.status(400).json({ error: '2FA nicht aktiv' }); return; }
    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret }) ||
      authenticator.verify({ token: code, secret: user.twoFactorSecret, window: 1 } as any);
    if (!isValid) { res.status(400).json({ error: 'Ungültiger Code' }); return; }
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    // Alle vertrauten Geräte widerrufen
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    res.json({ message: '2FA erfolgreich deaktiviert' });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
