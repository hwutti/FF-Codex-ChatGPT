import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

// Helper: avatar upload storage factory
function makeAvatarStorage(getFilename: (req: Request) => string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(env.UPLOAD_DIR, 'avatars');
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, getFilename(_req) + ext);
    },
  });
}

function makeUpload(storage: multer.StorageEngine) {
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Nur Bilder erlaubt (JPEG, PNG, GIF, WebP)'));
    },
  });
}

function deleteOldAvatar(avatarUrl: string | null) {
  if (!avatarUrl) return;
  try {
    const p = path.join(env.UPLOAD_DIR, avatarUrl.replace('/uploads/', ''));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function safeUser(u: any) {
  const { passwordHash, twoFactorSecret, ...rest } = u;
  return rest;
}

// ─── /me routes MUST come before /:id ────────────────────────────────────────

// POST /api/users/me/avatar
router.post('/me/avatar',
  makeUpload(makeAvatarStorage(req => `avatar-${req.user!.userId}-${Date.now()}`)).single('avatar'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Kein Bild hochgeladen. Bitte eine Bilddatei wählen.' });
        return;
      }
      const existing = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      deleteOldAvatar(existing?.avatarUrl || null);
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const user = await prisma.user.update({
        where: { id: req.user!.userId }, data: { avatarUrl },
        include: { member: { select: { firstName: true, lastName: true, rank: true } } },
      });
      res.json({ avatarUrl, user: safeUser(user) });
    } catch (err: any) {
      console.error('[Avatar Upload] Error:', err);
      res.status(500).json({ error: 'Fehler beim Upload: ' + (err.message || '') });
    }
  }
);

// DELETE /api/users/me/avatar
router.delete('/me/avatar', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    deleteOldAvatar(user?.avatarUrl || null);
    const updated = await prisma.user.update({
      where: { id: req.user!.userId }, data: { avatarUrl: null },
      include: { member: { select: { firstName: true, lastName: true, rank: true } } },
    });
    res.json({ message: 'Profilbild entfernt', user: safeUser(updated) });
  } catch (err: any) {
    console.error('[Avatar Delete] Error:', err);
    res.status(500).json({ error: 'Fehler beim Entfernen' });
  }
});

// ─── Admin: manage other users ───────────────────────────────────────────────

// GET /api/users
router.get('/', authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, memberNumber: true, functionTitle: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users.map(safeUser));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/users
router.post('/', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { email, password, role, memberId } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'E-Mail und Passwort erforderlich' }); return; }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: 'E-Mail bereits vergeben' }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: role || 'MEMBER', memberId: memberId || null },
      include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, memberNumber: true } } },
    });
    res.status(201).json(safeUser(user));
  } catch (err: any) { res.status(500).json({ error: err.message || 'Fehler beim Erstellen' }); }
});

// PUT /api/users/:id
router.put('/:id', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { email, role, isActive, memberId, password } = req.body;
    // Admin kann eigene Rolle und isActive nicht ändern
    const isSelf = req.params.id === req.user!.userId;
    const data: any = { email, memberId: memberId || null };
    if (!isSelf) {
      data.role = role;
      data.isActive = isActive;
    }
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id: req.params.id }, data,
      include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, memberNumber: true } } },
    });
    res.json(safeUser(user));
  } catch (err: any) { res.status(500).json({ error: err.message || 'Fehler beim Aktualisieren' }); }
});

// DELETE /api/users/:id
router.delete('/:id', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    if (req.params.id === req.user!.userId) { res.status(400).json({ error: 'Eigenen Account nicht löschbar' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    deleteOldAvatar(user?.avatarUrl || null);
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Benutzer gelöscht' });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Fehler beim Löschen' }); }
});

// POST /api/users/:id/avatar  (Admin uploads avatar for another user)
router.post('/:id/avatar',
  authorize('ADMIN'),
  makeUpload(makeAvatarStorage(req => `avatar-${req.params.id}-${Date.now()}`)).single('avatar'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) { res.status(400).json({ error: 'Kein Bild hochgeladen' }); return; }
      const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!existing) { res.status(404).json({ error: 'Benutzer nicht gefunden' }); return; }
      deleteOldAvatar(existing.avatarUrl);
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const user = await prisma.user.update({
        where: { id: req.params.id }, data: { avatarUrl },
        include: { member: { select: { firstName: true, lastName: true, rank: true } } },
      });
      res.json({ avatarUrl, user: safeUser(user) });
    } catch (err: any) {
      console.error('[Admin Avatar Upload] Error:', err);
      res.status(500).json({ error: 'Fehler beim Upload: ' + (err.message || '') });
    }
  }
);

// DELETE /api/users/:id/avatar
router.delete('/:id/avatar', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden' }); return; }
    deleteOldAvatar(user.avatarUrl);
    const updated = await prisma.user.update({
      where: { id: req.params.id }, data: { avatarUrl: null },
      include: { member: { select: { firstName: true, lastName: true, rank: true } } },
    });
    res.json({ message: 'Profilbild entfernt', user: safeUser(updated) });
  } catch (err: any) { res.status(500).json({ error: 'Fehler beim Entfernen' }); }
});

// POST /api/users/:id/2fa/disable  (Admin disables 2FA for another user)
router.post('/:id/2fa/disable', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    // Alle vertrauten Geräte widerrufen da 2FA deaktiviert
    await prisma.trustedDevice.deleteMany({ where: { userId: req.params.id } });
    res.json({ message: '2FA deaktiviert — alle vertrauten Geräte wurden widerrufen' });
  } catch (err: any) { res.status(500).json({ error: 'Fehler' }); }
});

export default router;
