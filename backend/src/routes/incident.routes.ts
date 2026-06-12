import { Router, Request, Response } from 'express';
import { sendPushToAll } from './push.routes';

function formatPushBody(record: {
  date?: Date | string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
}): string {
  const parts: string[] = [];
  if (record.date) {
    const d = new Date(record.date);
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    parts.push(`${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`);
  }
  if (record.startTime) {
    const t = record.endTime ? `🕐 ${record.startTime}–${record.endTime} Uhr` : `🕐 ${record.startTime} Uhr`;
    parts.push(t);
  }
  if (record.location) parts.push(`📍 ${record.location}`);
  if (record.description) parts.push(record.description);
  return parts.join(' · ');
}

import { prisma } from '../config/database';
import { authenticate, canManageContent } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const router = Router();
router.use(authenticate);

// GET /api/incidents
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (type) where.type = type;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { alarmTime: 'desc' },
        include: {
          _count: { select: { members: true } },
        },
      }),
      prisma.incident.count({ where }),
    ]);

    res.json({ incidents, total });
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/incidents/with-members - alle Einsätze mit Einsatzkräften für Berichte
router.get('/with-members', async (_req: Request, res: Response) => {
  try {
    const incidents = await prisma.incident.findMany({
      orderBy: { alarmTime: 'asc' },
      include: {
        members: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true, rank: true } },
          },
        },
      },
    });
    res.json(incidents);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// GET /api/incidents/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true, rank: true } },
          },
        },
      },
    });
    if (!incident) { res.status(404).json({ error: 'Einsatz nicht gefunden' }); return; }
    res.json(incident);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/incidents
router.post('/', requirePermission('incidents', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Auto-generate incident number
    const count = await prisma.incident.count();
    const year = new Date().getFullYear();
    const incidentNumber = data.incidentNumber || `E-${year}-${String(count + 1).padStart(3, '0')}`;

    const incident = await prisma.incident.create({
      data: {
        incidentNumber,
        title: data.title || '',
        type: data.type,
        alarmTime: data.alarmTime ? new Date(data.alarmTime) : null,
        departureTime: data.departureTime ? new Date(data.departureTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        location: data.location,
        commanderId: data.commanderId || null,
        shortReport: data.shortReport,
        actions: data.actions,
        specialOccurrences: data.specialOccurrences,
        members: data.memberIds ? {
          create: data.memberIds.map((memberId: string) => ({ memberId })),
        } : undefined,
      },
    });
    res.status(201).json(incident);
    sendPushToAll('pushNewIncident', {
      title: `🚨 Einsatz: ${incident.title || incident.type}`,
      body: formatPushBody({
        date: incident.alarmTime || incident.createdAt,
        location: incident.location,
        description: incident.shortReport,
      }),
      url: `/incidents/${incident.id}`,
    }).catch(() => {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /api/incidents/:id
router.put('/:id', requirePermission('incidents', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const incident = await prisma.incident.update({
      where: { id: req.params.id },
      data: {
        title: data.title || '',
        type: data.type,
        alarmTime: data.alarmTime ? new Date(data.alarmTime) : null,
        departureTime: data.departureTime ? new Date(data.departureTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        location: data.location,
        commanderId: data.commanderId || null,
        shortReport: data.shortReport,
        actions: data.actions,
        specialOccurrences: data.specialOccurrences,
      },
    });
    res.json(incident);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/incidents/:id
router.delete('/:id', requirePermission('incidents', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await prisma.incident.delete({ where: { id: req.params.id } });
    res.json({ message: 'Einsatz gelöscht' });
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/incidents/:id/equipment
router.get('/:id/equipment', requirePermission('incidents', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const equipment = await (prisma as any).incidentEquipment.findMany({
      where: { incidentId: req.params.id },
      include: { equipment: { select: { id: true, name: true, category: true, serialNumber: true, photoUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(equipment);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/incidents/:id/equipment
router.post('/:id/equipment', requirePermission('incidents', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { equipmentId, durationMin, notes } = req.body;
    const entry = await (prisma as any).incidentEquipment.upsert({
      where: { incidentId_equipmentId: { incidentId: req.params.id, equipmentId } },
      update: { durationMin: durationMin ? parseInt(durationMin) : null, notes },
      create: { incidentId: req.params.id, equipmentId, durationMin: durationMin ? parseInt(durationMin) : null, notes },
    });
    res.json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/incidents/:id/equipment/:equipmentId
router.delete('/:id/equipment/:equipmentId', requirePermission('incidents', 'EDIT'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).incidentEquipment.deleteMany({
      where: { incidentId: req.params.id, equipmentId: req.params.equipmentId },
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
