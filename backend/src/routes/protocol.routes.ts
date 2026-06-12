import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize, canManageContent } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { UserRole } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

// Neues Permission-System — prüft DB-Berechtigungen statt nur UserRole
const canAccessProtocols = requirePermission('protocols', 'VIEW');

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.libreoffice.impress',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, 'protocols');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `protocol-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx|odt|ods|odp|odf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF, Word und OpenDocument Dateien erlaubt'));
    }
  },
});

// GET /api/protocols
router.get('/', async (req: Request, res: Response) => {
  // Protokolle VIEW oder Berichte-Bereiche erlaubt
  const user = (req as any).user;
  const { checkUserPermission } = await import('./permissions.routes');
  const canView = await checkUserPermission(user.userId, user.role, 'protocols', 'VIEW')
    || await checkUserPermission(user.userId, user.role, 'berichte_kameradschaft', 'VIEW')
    || await checkUserPermission(user.userId, user.role, 'berichte_kassier', 'VIEW');
  if (!canView) { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
  try {
    const protocols = await prisma.protocol.findMany({
      where: { parentId: null }, // Nur Hauptprotokolle, keine signierten Versionen
      include: {
        event: { select: { id: true, title: true, date: true, type: true } },
        signatures: { select: { id: true } },
        signedVersions: {
          select: { id: true, title: true, createdAt: true, fileSize: true, fileName: true },
          orderBy: { createdAt: 'asc' },
        },
      } as any,
      orderBy: { date: 'desc' },
    });
    res.json(protocols);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// GET /api/protocols/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { checkUserPermission } = await import('./permissions.routes');
  const canView = await checkUserPermission(user.userId, user.role, 'protocols', 'VIEW')
    || await checkUserPermission(user.userId, user.role, 'berichte_kameradschaft', 'VIEW')
    || await checkUserPermission(user.userId, user.role, 'berichte_kassier', 'VIEW');
  if (!canView) { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
  try {
    const p = await prisma.protocol.findUnique({
      where: { id: req.params.id },
      include: { event: { select: { id: true, title: true, date: true, type: true } } },
    });
    if (!p) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    res.json(p);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// POST /api/protocols - upload file + create record
router.post('/', canAccessProtocols, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei hochgeladen' }); return; }
    const { title, date, eventId, author, notes } = req.body;
    if (!title || !date) { res.status(400).json({ error: 'Titel und Datum erforderlich' }); return; }

    // Fix: Multer liefert originalname als Latin-1 kodiert - in UTF-8 konvertieren
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const protocol = await prisma.protocol.create({
      data: {
        title,
        date: new Date(date),
        eventId: eventId || null,
        author: author || null,
        notes: notes || null,
        fileUrl: `/uploads/protocols/${req.file.filename}`,
        fileName: fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
      include: { event: { select: { id: true, title: true, date: true, type: true } } },
    });
    res.status(201).json(protocol);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/protocols/:id - update metadata (not file)
router.put('/:id', canAccessProtocols, async (req: Request, res: Response) => {
  try {
    const { title, date, eventId, author, notes } = req.body;
    const protocol = await prisma.protocol.update({
      where: { id: req.params.id },
      data: {
        title,
        date: date ? new Date(date) : undefined,
        eventId: eventId || null,
        author: author || null,
        notes: notes || null,
      },
      include: { event: { select: { id: true, title: true, date: true, type: true } } },
    });
    res.json(protocol);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/protocols/:id
router.delete('/:id', requirePermission('protocols', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const protocol = await prisma.protocol.findUnique({ where: { id: req.params.id } });
    if (!protocol) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    // Datei löschen
    const filePath = path.join(env.UPLOAD_DIR, protocol.fileUrl.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.protocol.delete({ where: { id: req.params.id } });
    res.json({ message: 'Protokoll gelöscht' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/protocols/:id/download - serve file
// Unterstützt auch ?token= für iframe-Einbettung (kein Auth-Header möglich)
router.get('/:id/download', async (req: Request, res: Response) => {
  // Token aus Query-Parameter falls kein Auth-Header (z.B. iframe)
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  // Auth manuell prüfen
  if (!req.headers.authorization && !req.cookies?.authToken) {
    res.status(401).json({ error: 'Nicht authentifiziert' }); return;
  }
  try {
    const jwt = require('jsonwebtoken');
    const token = req.cookies?.authToken || req.headers.authorization?.replace('Bearer ', '');
    const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
    (req as any).user = payload;
  } catch {
    res.status(401).json({ error: 'Nicht authentifiziert' }); return;
  }
  const user = (req as any).user;
  const { checkUserPermission } = await import('./permissions.routes');
  const canView = await checkUserPermission(user.userId, user.role, 'protocols', 'VIEW')
    || await checkUserPermission(user.userId, user.role, 'berichte_kameradschaft', 'VIEW')
    || await checkUserPermission(user.userId, user.role, 'berichte_kassier', 'VIEW');
  if (!canView) { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
  try {
    const protocol = await prisma.protocol.findUnique({ where: { id: req.params.id } });
    if (!protocol) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const filePath = path.join(env.UPLOAD_DIR, protocol.fileUrl.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Datei nicht gefunden' }); return; }
    // RFC 5987: UTF-8 kodierter Dateiname für korrekte Umlaut-Darstellung
    const encodedName = encodeURIComponent(protocol.fileName);
    // inline für iframe-Vorschau, attachment für direkten Download
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedName}; filename="${protocol.fileName.replace(/[^\x00-\x7F]/g, '_')}"`);
    res.setHeader('Content-Type', protocol.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
