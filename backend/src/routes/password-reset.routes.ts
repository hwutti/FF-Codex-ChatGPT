import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { sendEmail } from '../utils/email';
import { getEmailBranding, buildPasswordResetEmail } from '../utils/emailTemplate';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const router = Router();

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Public — sendet Reset-Link per E-Mail
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'E-Mail erforderlich' }); return; }

  // Immer OK antworten (kein User-Enumeration)
  res.json({ ok: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.' });

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) return;

    // Alte Tokens ungültig machen
    await (prisma as any).passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Neuen Token erstellen (1 Stunde gültig)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await (prisma as any).passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    // App-URL aus Request-Header ermitteln (funktioniert hinter Reverse Proxy)
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const appUrl = process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes(':39615')
      ? process.env.FRONTEND_URL
      : `${proto}://${host}`;

    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const appName = settings?.name || 'Feuerwehr Verwaltung';

    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const branding = await getEmailBranding(appUrl);
    const html = buildPasswordResetEmail(branding, resetUrl);
    await sendEmail(user.email, `Passwort zurücksetzen — ${branding.name}`, html);
  } catch (e) {
    console.error('[PasswordReset] Fehler:', e);
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Public — setzt neues Passwort mit Token
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) { res.status(400).json({ error: 'Token und Passwort erforderlich' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' }); return; }

  try {
    const resetToken = await (prisma as any).passwordResetToken.findUnique({ where: { token } });

    if (!resetToken) { res.status(400).json({ error: 'Ungültiger oder abgelaufener Link' }); return; }
    if (resetToken.usedAt) { res.status(400).json({ error: 'Dieser Link wurde bereits verwendet' }); return; }
    if (new Date() > new Date(resetToken.expiresAt)) { res.status(400).json({ error: 'Dieser Link ist abgelaufen' }); return; }

    const passwordHash = await bcrypt.hash(password, 12);

    await Promise.all([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      (prisma as any).passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
      // Alle vertrauenswürdigen Geräte nach Reset ungültig machen
      (prisma as any).trustedDevice.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    res.json({ ok: true, message: 'Passwort erfolgreich geändert' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/auth/verify-reset-token ─────────────────────────────────────────
// Public — prüft ob Token noch gültig ist (für Frontend-Validierung)
router.get('/verify-reset-token', async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };
  if (!token) { res.status(400).json({ valid: false }); return; }

  try {
    const resetToken = await (prisma as any).passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { email: true } } },
    });

    if (!resetToken || resetToken.usedAt || new Date() > new Date(resetToken.expiresAt)) {
      res.json({ valid: false });
      return;
    }

    res.json({ valid: true, email: resetToken.user.email });
  } catch {
    res.json({ valid: false });
  }
});

// ── POST /api/auth/admin-generate-reset-link ─────────────────────────────────
// Admin only — generiert Reset-Link für User ohne E-Mail
router.post('/admin-generate-reset-link', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ error: 'userId erforderlich' }); return; }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isActive: true } });
    if (!user) { res.status(404).json({ error: 'User nicht gefunden' }); return; }

    await (prisma as any).passwordResetToken.deleteMany({ where: { userId } });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h für Admin-Links

    await (prisma as any).passwordResetToken.create({ data: { token, userId, expiresAt } });

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const appUrl = process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes(':39615')
      ? process.env.FRONTEND_URL
      : `${proto}://${host}`;
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    res.json({ ok: true, resetUrl, expiresAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
