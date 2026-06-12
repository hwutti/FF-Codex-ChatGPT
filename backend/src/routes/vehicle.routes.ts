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
    const dir = path.join(env.UPLOAD_DIR, 'vehicles');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `vehicle-${Date.now()}${ext}`);
  },
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Nur Bilder')); }
});

// ── TRIPS (vor /:id!) ─────────────────────────────────────────────────────────

router.get('/trips', requirePermission('vehicles','VIEW'), async (req: Request, res: Response) => {
  const { vehicleId, from, to, page = '1', limit = '50' } = req.query;
  const where: any = {};
  if (vehicleId) where.vehicleId = vehicleId as string;
  if (from || to) where.date = {};
  if (from) where.date.gte = new Date(from as string);
  if (to) where.date.lte = new Date(to as string);
  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where, orderBy: [{ date: 'desc' }, { startKm: 'desc' }] as any,
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      include: {
        vehicle: { select: { name: true, licensePlate: true } },
        driver: { select: { firstName: true, lastName: true, rank: true, user: { select: { avatarUrl: true } } } },
        fuelEntries: { select: { id: true, liters: true, costTotal: true, kmStand: true, notes: true } },
      }
    }),
    prisma.trip.count({ where })
  ]);
  res.json({ trips, total });
});

router.post('/trips', requirePermission('vehicles','CREATE'), async (req: Request, res: Response) => {
  const { vehicleId, driverId, date, startKm, endKm, startLocation, endLocation, purpose, notes } = req.body;
  if (!vehicleId || !date || startKm === undefined || endKm === undefined) {
    res.status(400).json({ error: 'Pflichtfelder fehlen' }); return;
  }
  if (parseInt(endKm) < parseInt(startKm)) {
    res.status(400).json({ error: 'End-km muss größer als Start-km sein' }); return;
  }
  const trip = await prisma.trip.create({
    data: { vehicleId, driverId: driverId || null, date: new Date(date),
      startKm: parseInt(startKm), endKm: parseInt(endKm),
      startLocation, endLocation, purpose, notes,
      createdById: req.user!.userId },
    include: {
      vehicle: { select: { name: true, licensePlate: true } },
      driver: { select: { firstName: true, lastName: true, rank: true, user: { select: { avatarUrl: true } } } },
    }
  });
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { currentKm: parseInt(endKm) } });
  res.status(201).json(trip);
});

router.put('/trips/:id', requirePermission('vehicles','EDIT'), async (req: Request, res: Response) => {
  const { vehicleId, driverId, date, startKm, endKm, startLocation, endLocation, purpose, notes } = req.body;
  const trip = await prisma.trip.update({
    where: { id: req.params.id },
    data: { vehicleId, driverId: driverId || null, date: new Date(date),
      startKm: parseInt(startKm), endKm: parseInt(endKm),
      startLocation, endLocation, purpose, notes },
    include: {
      vehicle: { select: { name: true, licensePlate: true } },
      driver: { select: { firstName: true, lastName: true, rank: true, user: { select: { avatarUrl: true } } } },
    }
  });
  res.json(trip);
});

router.delete('/trips/:id', requirePermission('vehicles','DELETE'), async (req: Request, res: Response) => {
  await prisma.trip.delete({ where: { id: req.params.id } });
  res.json({ message: 'Fahrt gelöscht' });
});

// ── FUEL (vor /:id!) ──────────────────────────────────────────────────────────

router.get('/fuel', requirePermission('vehicles','VIEW'), async (req: Request, res: Response) => {
  const { vehicleId } = req.query;
  const where: any = {};
  if (vehicleId) where.vehicleId = vehicleId as string;
  const entries = await prisma.fuelEntry.findMany({
    where, orderBy: { date: 'desc' },
    include: { vehicle: { select: { name: true, licensePlate: true } } }
  });
  res.json(entries);
});

router.post('/fuel', requirePermission('vehicles','CREATE'), async (req: Request, res: Response) => {
  const { vehicleId, tripId, date, liters, costTotal, kmStand, notes } = req.body;
  if (!vehicleId || !date || !liters || !kmStand) {
    res.status(400).json({ error: 'Pflichtfelder fehlen' }); return;
  }
  const entry = await prisma.fuelEntry.create({
    data: { vehicleId, tripId: tripId || null, date: new Date(date), liters: parseFloat(liters),
      costTotal: costTotal ? parseFloat(costTotal) : null, kmStand: parseInt(kmStand), notes },
    include: { vehicle: { select: { name: true, licensePlate: true } } }
  });
  res.status(201).json(entry);
});

router.put('/fuel/:id', requirePermission('vehicles','EDIT'), async (req: Request, res: Response) => {
  const { tripId, date, liters, costTotal, kmStand, notes } = req.body;
  const entry = await prisma.fuelEntry.update({
    where: { id: req.params.id },
    data: { tripId: tripId || null, date: new Date(date), liters: parseFloat(liters),
      costTotal: costTotal ? parseFloat(costTotal) : null, kmStand: parseInt(kmStand), notes }
  });
  res.json(entry);
});

router.delete('/fuel/:id', requirePermission('vehicles','DELETE'), async (req: Request, res: Response) => {
  await prisma.fuelEntry.delete({ where: { id: req.params.id } });
  res.json({ message: 'Tankeintrag gelöscht' });
});

// ── MAINTENANCE (vor /:id!) ───────────────────────────────────────────────────

router.get('/maintenance', requirePermission('vehicles','VIEW'), async (req: Request, res: Response) => {
  const { vehicleId } = req.query;
  const where: any = {};
  if (vehicleId) where.vehicleId = vehicleId as string;
  const entries = await prisma.maintenance.findMany({
    where, orderBy: { date: 'desc' },
    include: { vehicle: { select: { name: true, licensePlate: true } } }
  });
  res.json(entries);
});

router.post('/maintenance', requirePermission('vehicles','CREATE'), async (req: Request, res: Response) => {
  const { vehicleId, type, date, kmStand, cost, nextDueDate, nextDueKm, performedBy, notes } = req.body;
  if (!vehicleId || !type || !date) {
    res.status(400).json({ error: 'Pflichtfelder fehlen' }); return;
  }
  const entry = await prisma.maintenance.create({
    data: { vehicleId, type, date: new Date(date),
      kmStand: kmStand ? parseInt(kmStand) : null,
      cost: cost ? parseFloat(cost) : null,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      nextDueKm: nextDueKm ? parseInt(nextDueKm) : null,
      performedBy, notes },
    include: { vehicle: { select: { name: true, licensePlate: true } } }
  });
  res.status(201).json(entry);
});

router.put('/maintenance/:id', requirePermission('vehicles','EDIT'), async (req: Request, res: Response) => {
  const { type, date, kmStand, cost, nextDueDate, nextDueKm, performedBy, notes } = req.body;
  const entry = await prisma.maintenance.update({
    where: { id: req.params.id },
    data: { type, date: new Date(date),
      kmStand: kmStand ? parseInt(kmStand) : null,
      cost: cost ? parseFloat(cost) : null,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      nextDueKm: nextDueKm ? parseInt(nextDueKm) : null,
      performedBy, notes }
  });
  res.json(entry);
});

router.delete('/maintenance/:id', requirePermission('vehicles','DELETE'), async (req: Request, res: Response) => {
  await prisma.maintenance.delete({ where: { id: req.params.id } });
  res.json({ message: 'Wartungseintrag gelöscht' });
});

// ── STATS (vor /:id!) ─────────────────────────────────────────────────────────

router.get('/stats', requirePermission('vehicles','VIEW'), async (_req, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true } });
  const stats = await Promise.all(vehicles.map(async v => {
    const [totalTrips, totalKm, totalFuel, totalFuelCost, upcomingMaintenance] = await Promise.all([
      prisma.trip.count({ where: { vehicleId: v.id } }),
      prisma.trip.aggregate({ where: { vehicleId: v.id }, _sum: { endKm: true, startKm: true } }),
      prisma.fuelEntry.aggregate({ where: { vehicleId: v.id }, _sum: { liters: true, costTotal: true } }),
      prisma.fuelEntry.aggregate({ where: { vehicleId: v.id }, _sum: { costTotal: true } }),
      prisma.maintenance.findFirst({
        where: { vehicleId: v.id, nextDueDate: { gte: new Date() } },
        orderBy: { nextDueDate: 'asc' }
      }),
    ]);
    const drivenKm = (totalKm._sum.endKm || 0) - (totalKm._sum.startKm || 0);
    const liters = totalFuel._sum.liters || 0;
    const consumption = drivenKm > 0 && liters > 0 ? (liters / drivenKm * 100).toFixed(1) : null;
    return { vehicle: v, totalTrips, drivenKm, totalLiters: liters,
      totalFuelCost: totalFuelCost._sum.costTotal || 0, consumption, upcomingMaintenance };
  }));
  res.json(stats);
});

// ── VEHICLES /:id (NACH allen spezifischen Routen!) ───────────────────────────

router.get('/', requirePermission('vehicles','VIEW'), async (_req, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { trips: true, fuelEntries: true, maintenances: true } },
      maintenances: { orderBy: { nextDueDate: 'asc' }, take: 1, where: { nextDueDate: { gte: new Date() } } },
    }
  });
  res.json(vehicles);
});

router.post('/', requirePermission('vehicles','CREATE'), async (req: Request, res: Response) => {
  const { name, licensePlate, type, brand, model, year, currentKm, notes } = req.body;
  if (!name) { res.status(400).json({ error: 'Name erforderlich' }); return; }
  const vehicle = await prisma.vehicle.create({
    data: { name, licensePlate, type, brand, model, year: year ? parseInt(year) : null,
      currentKm: parseInt(currentKm) || 0, notes }
  });
  res.status(201).json(vehicle);
});

router.post('/:id/photo', requirePermission('vehicles','EDIT'), uploadPhoto.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
  const photoUrl = `/uploads/vehicles/${req.file.filename}`;
  const vehicle = await prisma.vehicle.update({ where: { id: req.params.id }, data: { photoUrl } });
  res.json({ photoUrl, vehicle });
});

router.delete('/:id/photo', requirePermission('vehicles','DELETE'), async (req: Request, res: Response) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (vehicle?.photoUrl) {
    const p = path.join(env.UPLOAD_DIR, vehicle.photoUrl.replace('/uploads/', ''));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  await prisma.vehicle.update({ where: { id: req.params.id }, data: { photoUrl: null } });
  res.json({ message: 'Foto entfernt' });
});

router.get('/:id', requirePermission('vehicles','VIEW'), async (req, res: Response) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: req.params.id },
    include: {
      trips: { orderBy: [{ date: 'desc' }, { startKm: 'desc' }], take: 10,
        include: { driver: { select: { firstName: true, lastName: true, rank: true, user: { select: { avatarUrl: true } } } } } },
      fuelEntries: { orderBy: { date: 'desc' }, take: 10 },
      maintenances: { orderBy: { date: 'desc' }, take: 10 },
    }
  });
  if (!vehicle) { res.status(404).json({ error: 'Fahrzeug nicht gefunden' }); return; }
  res.json(vehicle);
});

router.put('/:id', requirePermission('vehicles','EDIT'), async (req: Request, res: Response) => {
  const { name, licensePlate, type, brand, model, year, currentKm, notes, isActive } = req.body;
  const vehicle = await prisma.vehicle.update({
    where: { id: req.params.id },
    data: { name, licensePlate, type, brand, model, year: year ? parseInt(year) : null,
      currentKm: parseInt(currentKm) || 0, notes, isActive }
  });
  res.json(vehicle);
});

router.delete('/:id', requirePermission('vehicles','DELETE'), async (req: Request, res: Response) => {
  await prisma.vehicle.delete({ where: { id: req.params.id } });
  res.json({ message: 'Fahrzeug gelöscht' });
});

export default router;
