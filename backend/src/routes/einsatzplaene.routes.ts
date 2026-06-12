import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { prisma } from '../config/database';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), '..', 'uploads', 'einsatzplaene');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `plan-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ── FOLDERS ───────────────────────────────────────────────────────────

// GET /api/einsatzplaene/folders
router.get('/folders', requirePermission('einsatzplaene','VIEW'), async (_req: Request, res: Response) => {
  try {
    const folders = await (prisma as any).einsatzplanFolder.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: {
                  include: { _count: { select: { plans: true } } },
                  orderBy: { name: 'asc' },
                },
                _count: { select: { plans: true } },
              },
              orderBy: { name: 'asc' },
            },
            _count: { select: { plans: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { plans: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(folders);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// GET /api/einsatzplaene/folders/:id — single folder with children
router.get('/folders/:id', requirePermission('einsatzplaene','VIEW'), async (req: Request, res: Response) => {
  try {
    const folder = await (prisma as any).einsatzplanFolder.findUnique({
      where: { id: req.params.id },
      include: {
        children: {
          include: {
            children: {
              include: { _count: { select: { plans: true } } },
              orderBy: { name: 'asc' },
            },
            _count: { select: { plans: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { plans: true } },
      },
    });
    res.json(folder);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/einsatzplaene/folders
router.post('/folders', requirePermission('einsatzplaene','CREATE'), async (req: Request, res: Response) => {
  try {
    const { name, color, parentId } = req.body;
    const folder = await (prisma as any).einsatzplanFolder.create({
      data: { name, color: color || '#16a34a', parentId: parentId || null },
    });
    res.json(folder);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/einsatzplaene/folders/:id
router.put('/folders/:id', requirePermission('einsatzplaene','EDIT'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    const folder = await (prisma as any).einsatzplanFolder.update({
      where: { id: req.params.id },
      data: { name, color },
    });
    res.json(folder);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/einsatzplaene/folders/:id
router.delete('/folders/:id', requirePermission('einsatzplaene','DELETE'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).einsatzplanFolder.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PLANS ─────────────────────────────────────────────────────────────

// GET /api/einsatzplaene?folderId=&search=
router.get('/', requirePermission('einsatzplaene','VIEW'), async (req: Request, res: Response) => {
  try {
    const { folderId, search, all } = req.query as { folderId?: string; search?: string; all?: string };
    const where: any = {};
    if (folderId) where.folderId = folderId;
    if (search) where.title = { contains: search, mode: 'insensitive' };
    const plans = await (prisma as any).einsatzplan.findMany({
      where,
      include: all === '1' ? false : { folder: true },
      orderBy: { createdAt: 'desc' },
      ...(all === '1' ? { select: { id: true, fileUrl: true, fileName: true, fileSize: true, mimeType: true, title: true, description: true, folderId: true } } : {}),
    });
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/einsatzplaene (upload)
router.post('/', requirePermission('einsatzplaene','CREATE'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Keine Datei' });
    const { title, description, folderId } = req.body;
    const user = (req as any).user;
    const fileUrl = `/uploads/einsatzplaene/${file.filename}`;
    const plan = await (prisma as any).einsatzplan.create({
      data: {
        title: title || file.originalname,
        description: description || null,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        folderId: folderId || null,
        uploadedBy: user?.userId,
      },
      include: { folder: true },
    });
    res.json(plan);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/einsatzplaene/:id
router.put('/:id', requirePermission('einsatzplaene','EDIT'), async (req: Request, res: Response) => {
  try {
    const { title, description, folderId } = req.body;
    const plan = await (prisma as any).einsatzplan.update({
      where: { id: req.params.id },
      data: { title, description, folderId: folderId || null },
      include: { folder: true },
    });
    res.json(plan);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/einsatzplaene/:id — move to papierkorb
router.delete('/:id', requirePermission('einsatzplaene','DELETE'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const plan = await (prisma as any).einsatzplan.findUnique({
      where: { id: req.params.id },
      include: { folder: true },
    });
    if (!plan) return res.status(404).json({ error: 'Nicht gefunden' });

    // Move to papierkorb
    await (prisma as any).einsatzplanPapierkorb.create({
      data: {
        title: plan.title,
        description: plan.description,
        fileUrl: plan.fileUrl,
        fileName: plan.fileName,
        fileSize: plan.fileSize,
        mimeType: plan.mimeType,
        folderId: plan.folderId,
        folderName: plan.folder?.name || null,
        deletedBy: user?.userId || null,
      },
    });

    await (prisma as any).einsatzplan.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PAPIERKORB ────────────────────────────────────────────────────────────────

// GET /api/einsatzplaene/papierkorb
router.get('/papierkorb', requirePermission('einsatzplaene','VIEW'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    const items = await (prisma as any).einsatzplanPapierkorb.findMany({
      orderBy: { deletedAt: 'desc' },
    });
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/einsatzplaene/papierkorb/:id/restore
router.post('/papierkorb/:id/restore', requirePermission('einsatzplaene','CREATE'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    const item = await (prisma as any).einsatzplanPapierkorb.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' });

    await (prisma as any).einsatzplan.create({
      data: {
        title: item.title,
        description: item.description,
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        folderId: item.folderId,
      },
    });
    await (prisma as any).einsatzplanPapierkorb.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/einsatzplaene/papierkorb/:id — endgültig löschen
router.delete('/papierkorb/:id', requirePermission('einsatzplaene','DELETE'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    const item = await (prisma as any).einsatzplanPapierkorb.findUnique({ where: { id: req.params.id } });
    if (item?.fileUrl) {
      try { fs.unlinkSync(path.join(process.cwd(), '..', item.fileUrl)); } catch {}
    }
    await (prisma as any).einsatzplanPapierkorb.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/einsatzplaene/papierkorb — alles endgültig löschen
router.delete('/papierkorb', requirePermission('einsatzplaene','DELETE'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Nur für Administratoren' });
    const items = await (prisma as any).einsatzplanPapierkorb.findMany();
    for (const item of items) {
      if (item.fileUrl) {
        try { fs.unlinkSync(path.join(process.cwd(), '..', item.fileUrl)); } catch {}
      }
    }
    await (prisma as any).einsatzplanPapierkorb.deleteMany();
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
