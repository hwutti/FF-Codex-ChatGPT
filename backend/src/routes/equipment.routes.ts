import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

// Foto-Upload
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, 'equipment');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `equipment-${Date.now()}${ext}`);
  },
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Nur Bilder')); }
});

// Helper: Ersteller-Name aus User holen
async function getCreatorName(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { firstName: true, lastName: true } } }
    });
    if (user?.member) return `${user.member.firstName} ${user.member.lastName}`;
    return user?.email || 'Unbekannt';
  } catch { return 'Unbekannt'; }
}

// ── EQUIPMENT LIST/STATS (vor /:id!) ─────────────────────────────────────────

router.get('/stats', requirePermission('equipment','VIEW'), async (_req, res: Response) => {
  const [total, active, dueChecks, openDefects, activeLoans] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { isActive: true } }),
    prisma.equipment.count({ where: { nextCheckDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, isActive: true } }),
    prisma.equipmentDefect.count({ where: { status: { not: 'Behoben' } } }),
    prisma.equipmentLoan.count({ where: { returnedAt: null } }),
  ]);
  res.json({ total, active, dueChecks, openDefects, activeLoans });
});

// ── CHECKS (vor /:id!) ────────────────────────────────────────────────────────

router.get('/checks', requirePermission('equipment','VIEW'), async (req: Request, res: Response) => {
  const { equipmentId } = req.query;
  const where: any = {};
  if (equipmentId) where.equipmentId = equipmentId as string;
  const checks = await prisma.equipmentCheck.findMany({
    where, orderBy: { date: 'desc' },
    include: { equipment: { select: { name: true } } }
  });
  res.json(checks);
});

router.post('/checks', requirePermission('equipment','CREATE'), async (req: Request, res: Response) => {
  const { equipmentId, date, result, checkedByName, nextCheckDate, notes } = req.body;
  if (!equipmentId || !date || !result) { res.status(400).json({ error: 'Pflichtfelder fehlen' }); return; }
  const createdByName = await getCreatorName(req.user!.userId);
  const check = await prisma.equipmentCheck.create({
    data: { equipmentId, date: new Date(date), result, checkedByName,
      nextCheckDate: nextCheckDate ? new Date(nextCheckDate) : null, notes,
      createdById: req.user!.userId, createdByName }
  });
  // nextCheckDate am Gerät aktualisieren
  if (nextCheckDate) {
    await prisma.equipment.update({ where: { id: equipmentId }, data: { nextCheckDate: new Date(nextCheckDate) } });
  }
  res.status(201).json(check);
});

router.put('/checks/:id', requirePermission('equipment','EDIT'), async (req: Request, res: Response) => {
  const { date, result, checkedByName, nextCheckDate, notes } = req.body;
  const check = await prisma.equipmentCheck.update({
    where: { id: req.params.id },
    data: { date: new Date(date), result, checkedByName,
      nextCheckDate: nextCheckDate ? new Date(nextCheckDate) : null, notes }
  });
  res.json(check);
});

router.delete('/checks/:id', requirePermission('equipment','DELETE'), async (req: Request, res: Response) => {
  await prisma.equipmentCheck.delete({ where: { id: req.params.id } });
  res.json({ message: 'Prüfung gelöscht' });
});

// ── REPAIRS (vor /:id!) ───────────────────────────────────────────────────────

router.get('/repairs', requirePermission('equipment','VIEW'), async (req: Request, res: Response) => {
  const { equipmentId } = req.query;
  const where: any = {};
  if (equipmentId) where.equipmentId = equipmentId as string;
  const repairs = await prisma.equipmentRepair.findMany({
    where, orderBy: { date: 'desc' },
    include: { equipment: { select: { name: true } } }
  });
  res.json(repairs);
});

router.post('/repairs', requirePermission('equipment','CREATE'), async (req: Request, res: Response) => {
  const { equipmentId, date, description, performedBy, cost, status, notes } = req.body;
  if (!equipmentId || !date || !description) { res.status(400).json({ error: 'Pflichtfelder fehlen' }); return; }
  const createdByName = await getCreatorName(req.user!.userId);
  const repair = await prisma.equipmentRepair.create({
    data: { equipmentId, date: new Date(date), description, performedBy,
      cost: cost ? parseFloat(cost) : null, status: status || 'Abgeschlossen', notes,
      createdById: req.user!.userId, createdByName }
  });
  res.status(201).json(repair);
});

router.put('/repairs/:id', requirePermission('equipment','EDIT'), async (req: Request, res: Response) => {
  const { date, description, performedBy, cost, status, notes } = req.body;
  const repair = await prisma.equipmentRepair.update({
    where: { id: req.params.id },
    data: { date: new Date(date), description, performedBy,
      cost: cost ? parseFloat(cost) : null, status, notes }
  });
  res.json(repair);
});

router.delete('/repairs/:id', requirePermission('equipment','DELETE'), async (req: Request, res: Response) => {
  await prisma.equipmentRepair.delete({ where: { id: req.params.id } });
  res.json({ message: 'Reparatur gelöscht' });
});

// ── DEFECTS (vor /:id!) ───────────────────────────────────────────────────────

router.get('/defects', requirePermission('equipment','VIEW'), async (req: Request, res: Response) => {
  const { equipmentId, status } = req.query;
  const where: any = {};
  if (equipmentId) where.equipmentId = equipmentId as string;
  if (status) where.status = status as string;
  const defects = await prisma.equipmentDefect.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { equipment: { select: { name: true } } }
  });
  res.json(defects);
});

router.post('/defects', requirePermission('equipment','CREATE'), async (req: Request, res: Response) => {
  const { equipmentId, description, notes } = req.body;
  if (!equipmentId || !description) { res.status(400).json({ error: 'Pflichtfelder fehlen' }); return; }
  const reportedByName = await getCreatorName(req.user!.userId);
  const defect = await prisma.equipmentDefect.create({
    data: { equipmentId, description, notes,
      reportedById: req.user!.userId, reportedByName }
  });
  res.status(201).json(defect);
});

router.put('/defects/:id', requirePermission('equipment','EDIT'), async (req: Request, res: Response) => {
  const { status, notes } = req.body;
  const data: any = { status, notes };
  if (status === 'Behoben') data.resolvedAt = new Date();
  const defect = await prisma.equipmentDefect.update({ where: { id: req.params.id }, data });
  res.json(defect);
});

router.delete('/defects/:id', requirePermission('equipment','DELETE'), async (req: Request, res: Response) => {
  await prisma.equipmentDefect.delete({ where: { id: req.params.id } });
  res.json({ message: 'Defekt gelöscht' });
});

// ── LOANS (vor /:id!) ─────────────────────────────────────────────────────────

router.get('/loans', requirePermission('equipment','VIEW'), async (req: Request, res: Response) => {
  const { equipmentId, active } = req.query;
  const where: any = {};
  if (equipmentId) where.equipmentId = equipmentId as string;
  if (active === 'true') where.returnedAt = null;
  const loans = await prisma.equipmentLoan.findMany({
    where, orderBy: { borrowedAt: 'desc' },
    include: { equipment: { select: { name: true } } }
  });
  res.json(loans);
});

router.post('/loans', requirePermission('equipment','CREATE'), async (req: Request, res: Response) => {
  const { equipmentId, borrowedByName, expectedReturn, notes } = req.body;
  if (!equipmentId || !borrowedByName) { res.status(400).json({ error: 'Pflichtfelder fehlen' }); return; }
  const createdByName = await getCreatorName(req.user!.userId);
  const loan = await prisma.equipmentLoan.create({
    data: { equipmentId, borrowedByName, borrowedById: req.user!.userId,
      expectedReturn: expectedReturn ? new Date(expectedReturn) : null, notes,
      createdById: req.user!.userId, createdByName }
  });
  res.status(201).json(loan);
});

router.put('/loans/:id/return', requirePermission('equipment','EDIT'), async (req: Request, res: Response) => {
  const loan = await prisma.equipmentLoan.update({
    where: { id: req.params.id },
    data: { returnedAt: new Date() }
  });
  res.json(loan);
});

router.delete('/loans/:id', requirePermission('equipment','DELETE'), async (req: Request, res: Response) => {
  await prisma.equipmentLoan.delete({ where: { id: req.params.id } });
  res.json({ message: 'Ausgabe gelöscht' });
});

// ── EQUIPMENT CRUD (/:id NACH allen spezifischen Routen!) ─────────────────────

router.get('/', requirePermission('equipment','VIEW'), async (_req, res: Response) => {
  const equipment = await prisma.equipment.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { checks: true, repairs: true, defects: true, loans: true } },
      defects: { where: { status: { not: 'Behoben' } }, select: { id: true, status: true } },
      loans: { where: { returnedAt: null }, select: { id: true, borrowedByName: true } },
    }
  });
  res.json(equipment);
});

router.post('/', requirePermission('equipment','CREATE'), async (req: Request, res: Response) => {
  const { name, category, customCategory, serialNumber, manufacturer, purchaseDate,
    purchasePrice, location, notes, checkInterval, nextCheckDate } = req.body;
  if (!name) { res.status(400).json({ error: 'Name erforderlich' }); return; }
  const createdByName = await getCreatorName(req.user!.userId);
  const equipment = await prisma.equipment.create({
    data: { name, category, customCategory, serialNumber, manufacturer,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      location, notes, checkInterval,
      nextCheckDate: nextCheckDate ? new Date(nextCheckDate) : null,
      createdById: req.user!.userId }
  });
  res.status(201).json(equipment);
});

router.post('/:id/photo', requirePermission('equipment','EDIT'), uploadPhoto.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
  const photoUrl = `/uploads/equipment/${req.file.filename}`;
  const equipment = await prisma.equipment.update({ where: { id: req.params.id }, data: { photoUrl } });
  res.json({ photoUrl, equipment });
});

router.delete('/:id/photo', requirePermission('equipment','DELETE'), async (req: Request, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (equipment?.photoUrl) {
    const p = path.join(env.UPLOAD_DIR, equipment.photoUrl.replace('/uploads/', ''));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  await prisma.equipment.update({ where: { id: req.params.id }, data: { photoUrl: null } });
  res.json({ message: 'Foto entfernt' });
});

router.get('/:id', requirePermission('equipment','VIEW'), async (req, res: Response) => {
  const equipment = await prisma.equipment.findUnique({
    where: { id: req.params.id },
    include: {
      checks: { orderBy: { date: 'desc' } },
      repairs: { orderBy: { date: 'desc' } },
      defects: { orderBy: { createdAt: 'desc' } },
      loans: { orderBy: { borrowedAt: 'desc' } },
    }
  });
  if (!equipment) { res.status(404).json({ error: 'Gerät nicht gefunden' }); return; }
  res.json(equipment);
});

router.put('/:id', requirePermission('equipment','EDIT'), async (req: Request, res: Response) => {
  const { name, category, customCategory, serialNumber, manufacturer, purchaseDate,
    purchasePrice, location, notes, isActive, checkInterval, nextCheckDate } = req.body;
  const equipment = await prisma.equipment.update({
    where: { id: req.params.id },
    data: { name, category, customCategory, serialNumber, manufacturer,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      location, notes, isActive, checkInterval,
      nextCheckDate: nextCheckDate ? new Date(nextCheckDate) : null }
  });
  res.json(equipment);
});

router.delete('/:id', requirePermission('equipment','DELETE'), async (req: Request, res: Response) => {
  await prisma.equipment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Gerät gelöscht' });
});

// GET /api/equipment/:id/usage — Einsatz-Verwendungshistorie
router.get('/:id/usage', requirePermission('equipment','VIEW'), async (req: Request, res: Response) => {
  try {
    const usage = await (prisma as any).incidentEquipment.findMany({
      where: { equipmentId: req.params.id },
      include: { incident: { select: { id: true, type: true, location: true, alarmTime: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(usage);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/equipment/:id/events — Übungs-Verwendungshistorie
router.get('/:id/events', requirePermission('equipment','VIEW'), async (req: Request, res: Response) => {
  try {
    const usage = await prisma.eventEquipment.findMany({
      where: { equipmentId: req.params.id },
      include: { event: { select: { id: true, title: true, type: true, date: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(usage);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
