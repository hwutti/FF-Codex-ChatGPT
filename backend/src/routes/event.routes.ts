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
import { EventType } from '@prisma/client';

const router = Router();
router.use(authenticate);

// GET /api/events
router.get('/', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const { type, from, to, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Prüfen ob User Kommando-Zugang hat
    const RESTRICTED_RANK_CODES = ['PFM', 'FM', 'OFM', 'HFM'];
    const COMMAND_ROLES = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER', 'SECRETARY'];
    const userRole = (req as any).user?.role || '';
    const hasCommandAccess = COMMAND_ROLES.includes(userRole);

    const where: any = {};
    if (type) where.type = type as EventType;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }

    // Kommando-Ereignisse nur für Berechtigte anzeigen
    if (!hasCommandAccess) {
      // Ereignisse ausschließen die aus dem Kommando-Kalender stammen
      const commandEventIds = await prisma.calendarEvent.findMany({
        where: { isCommand: true, eventId: { not: null } },
        select: { eventId: true },
      });
      const excludeIds = commandEventIds.map(e => e.eventId).filter(Boolean) as string[];
      if (excludeIds.length > 0) {
        where.id = { notIn: excludeIds };
      }
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { date: 'desc' },
        include: {
          responsiblePerson: { select: { firstName: true, lastName: true } },
          _count: { select: { attendances: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    res.json({ events, total });
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/events/:id
router.get('/:id', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        responsiblePerson: { select: { id: true, firstName: true, lastName: true } },
        attendances: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true, rank: true, groupName: true } },
          },
          orderBy: { member: { lastName: 'asc' } },
        },
      },
    });

    if (!event) { res.status(404).json({ error: 'Ereignis nicht gefunden' }); return; }
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/events
router.post('/', requirePermission('exercises', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const event = await prisma.event.create({
      data: {
        type: data.type,
        title: data.title,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        description: data.description,
        responsiblePersonId: data.responsiblePersonId || null,
        notes: data.notes,
      },
    });

    // Auto-create attendance entries for all active members
    if (data.createAttendanceForAll) {
      const activeMembers = await prisma.member.findMany({
        where: { status: { in: ['ACTIVE', 'YOUTH'] } },
        select: { id: true },
      });
      await prisma.attendance.createMany({
        data: activeMembers.map(m => ({ eventId: event.id, memberId: m.id, status: 'ABSENT' })),
        skipDuplicates: true,
      });
    }

    res.status(201).json(event);
    // Push-Benachrichtigung
    const typeLabel: Record<string, string> = {
      EXERCISE: 'Übung', INCIDENT: 'Einsatz', MEETING: 'Sitzung',
      FUNERAL: 'Begräbnis', OTHER: 'Ereignis',
    };
    sendPushToAll('pushNewEvent', {
      title: `📅 Neues Ereignis: ${event.title || typeLabel[event.type] || event.type}`,
      body: formatPushBody(event),
      url: `/events/${event.id}`,
    }).catch(() => {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /api/events/:id
router.put('/:id', requirePermission('exercises', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        type: data.type,
        title: data.title,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        description: data.description,
        responsiblePersonId: data.responsiblePersonId || null,
        notes: data.notes,
      },
    });
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/events/:id
router.delete('/:id', requirePermission('exercises', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ereignis gelöscht' });
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/events/:id/attendance
router.get('/:id/attendance', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const attendances = await prisma.attendance.findMany({
      where: { eventId: req.params.id },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, rank: true, groupName: true, memberNumber: true } },
      },
      orderBy: { member: { lastName: 'asc' } },
    });
    res.json(attendances);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/events/:id/attendance
router.post('/:id/attendance', requirePermission('exercises', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { attendances } = req.body; // [{memberId, status, notes}]
    const eventId = req.params.id;

    const results = await Promise.all(
      attendances.map((a: { memberId: string; status: string; notes?: string }) =>
        prisma.attendance.upsert({
          where: { eventId_memberId: { eventId, memberId: a.memberId } },
          update: { status: a.status as any, notes: a.notes },
          create: { eventId, memberId: a.memberId, status: a.status as any, notes: a.notes },
        })
      )
    );

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;

// ── Equipment für Ereignis ────────────────────────────────────────────────────

// GET /api/events/:id/equipment
router.get('/:id/equipment', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const items = await prisma.eventEquipment.findMany({
      where: { eventId: req.params.id },
      include: { equipment: { select: { id: true, name: true, category: true, location: true, photoUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(items);
  } catch { res.status(500).json({ error: 'Interner Serverfehler' }); }
});

// POST /api/events/:id/equipment
router.post('/:id/equipment', requirePermission('exercises', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { equipmentId, durationMin, notes } = req.body;
    const totalMin = durationMin ? parseInt(durationMin) : null;
    const hoursUsed = totalMin ? Math.floor(totalMin / 60) : null;
    const minutesUsed = totalMin ? totalMin % 60 : null;
    const item = await prisma.eventEquipment.upsert({
      where: { eventId_equipmentId: { eventId: req.params.id, equipmentId } },
      update: { hoursUsed, minutesUsed, notes: notes ?? null },
      create: { eventId: req.params.id, equipmentId, hoursUsed, minutesUsed, notes: notes ?? null },
      include: { equipment: { select: { id: true, name: true, category: true } } },
    });
    res.status(201).json(item);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Interner Serverfehler' }); }
});

// DELETE /api/events/:id/equipment/:equipmentId
router.delete('/:id/equipment/:equipmentId', requirePermission('exercises', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await prisma.eventEquipment.delete({
      where: { eventId_equipmentId: { eventId: req.params.id, equipmentId: req.params.equipmentId } },
    });
    res.json({ message: 'Gerät entfernt' });
  } catch { res.status(500).json({ error: 'Interner Serverfehler' }); }
});
