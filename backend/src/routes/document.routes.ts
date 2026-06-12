import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, canManageContent } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, 'documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|odt|ods|odp|odf|ppt|pptx|xls|xlsx)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Dateityp nicht erlaubt'));
  },
});

// GET /api/documents?category=&isPublic=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, isPublic } = req.query;
    const where: any = {};
    if (category) where.category = category as string;
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';
    const docs = await prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// POST /api/documents - upload
router.post('/', requirePermission('documents_public', 'CREATE'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
    const { title, category, isPublic, author, notes, date } = req.body;
    if (!title || !category) { res.status(400).json({ error: 'Titel und Kategorie erforderlich' }); return; }
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const doc = await prisma.document.create({
      data: {
        title,
        category,
        isPublic: isPublic === 'true',
        fileUrl: `/uploads/documents/${req.file.filename}`,
        fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        author: author || null,
        notes: notes || null,
        date: date || null,
        uploadedBy: req.user?.userId,
      },
    });
    res.status(201).json(doc);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/documents/:id
router.delete('/:id', requirePermission('documents_public', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const filePath = path.join(env.UPLOAD_DIR, doc.fileUrl.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const filePath = path.join(env.UPLOAD_DIR, doc.fileUrl.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Datei nicht gefunden' }); return; }
    const encodedName = encodeURIComponent(doc.fileName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// GET /api/documents/:id/view - inline für Browser-Vorschau
router.get('/:id/view', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const filePath = path.join(env.UPLOAD_DIR, doc.fileUrl.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Datei nicht gefunden' }); return; }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

export default router;
