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
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { syncExerciseToCalendar, deleteLinkedCalendarEvent } from '../utils/calendarSync';

const router = Router();
router.use(authenticate);

// GET /api/exercises
router.get('/', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    const exercises = await (prisma as any).exercise.findMany({
      where,
      include: {
        responsiblePerson: { select: { firstName: true, lastName: true, rank: true } },
        attendances: { include: { member: { select: { id: true, firstName: true, lastName: true, rank: true } } } },
        equipment: { include: { equipment: { select: { id: true, name: true, category: true, photoUrl: true } } } },
      },
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ exercises });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/exercises/:id
router.get('/:id', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const exercise = await (prisma as any).exercise.findUnique({
      where: { id: req.params.id },
      include: {
        responsiblePerson: { select: { id: true, firstName: true, lastName: true, rank: true } },
        attendances: { include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, profileImage: true } } } },
        equipment: { include: { equipment: { select: { id: true, name: true, category: true, photoUrl: true } } } },
      },
    });
    if (!exercise) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    res.json(exercise);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/exercises
router.post('/', requirePermission('exercises', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { type, title, date, startTime, endTime, location, description, responsiblePersonId, notes, memberIds } = req.body;
    const exercise = await (prisma as any).exercise.create({
      data: {
        type, title, date: new Date(date),
        startTime: startTime || null, endTime: endTime || null,
        location: location || null, description: description || null,
        responsiblePersonId: responsiblePersonId || null,
        notes: notes || null,
        attendances: memberIds?.length ? {
          create: memberIds.map((memberId: string) => ({ memberId, status: 'PRESENT' })),
        } : undefined,
      },
    });
    // Sync zu Kalender Allgemein
    await syncExerciseToCalendar(exercise);
    res.status(201).json(exercise);
    const typeLabel: Record<string, string> = {
      DRILL: 'Übung', COURSE: 'Kurs', MEETING: 'Besprechung', OTHER: 'Übung',
    };
    sendPushToAll('pushNewExercise', {
      title: `🧯 Neue ${typeLabel[exercise.type] || 'Übung'}: ${exercise.title || typeLabel[exercise.type] || 'Übung'}`,
      body: formatPushBody(exercise),
      url: `/exercises/${exercise.id}`,
    }).catch(() => {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/exercises/:id
router.put('/:id', requirePermission('exercises', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { type, title, date, startTime, endTime, location, description, responsiblePersonId, notes } = req.body;
    const exercise = await (prisma as any).exercise.update({
      where: { id: req.params.id },
      data: {
        type, title, date: new Date(date),
        startTime: startTime || null, endTime: endTime || null,
        location: location || null, description: description || null,
        responsiblePersonId: responsiblePersonId || null,
        notes: notes || null,
      },
    });
    // Sync zu Kalender Allgemein
    const existing = await (prisma as any).exercise.findUnique({ where: { id: req.params.id } });
    await syncExerciseToCalendar({ ...exercise, calendarEventId: existing?.calendarEventId });
    res.json(exercise);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/exercises/:id
router.delete('/:id', requirePermission('exercises', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const ex = await (prisma as any).exercise.findUnique({ where: { id: req.params.id } });
    await (prisma as any).exercise.delete({ where: { id: req.params.id } });
    await deleteLinkedCalendarEvent(ex?.calendarEventId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/exercises/:id/attendance
router.get('/:id/attendance', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const att = await (prisma as any).exerciseAttendance.findMany({
      where: { exerciseId: req.params.id },
      include: { member: { select: { id: true, firstName: true, lastName: true, rank: true } } },
    });
    res.json(att);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/exercises/:id/attendance
router.put('/:id/attendance', requirePermission('exercises', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { memberId, status } = req.body;
    const att = await (prisma as any).exerciseAttendance.upsert({
      where: { exerciseId_memberId: { exerciseId: req.params.id, memberId } },
      update: { status },
      create: { exerciseId: req.params.id, memberId, status },
    });
    res.json(att);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/exercises/:id/equipment
router.get('/:id/equipment', requirePermission('exercises', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const eq = await (prisma as any).exerciseEquipment.findMany({
      where: { exerciseId: req.params.id },
      include: { equipment: { select: { id: true, name: true, category: true, photoUrl: true } } },
    });
    res.json(eq);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/exercises/:id/equipment
router.post('/:id/equipment', requirePermission('exercises', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { equipmentId, durationMin, notes } = req.body;
    const eq = await (prisma as any).exerciseEquipment.upsert({
      where: { exerciseId_equipmentId: { exerciseId: req.params.id, equipmentId } },
      update: { durationMin: durationMin ? parseInt(durationMin) : null, notes },
      create: { exerciseId: req.params.id, equipmentId, durationMin: durationMin ? parseInt(durationMin) : null, notes },
    });
    res.json(eq);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/exercises/:id/equipment/:equipmentId
router.delete('/:id/equipment/:equipmentId', requirePermission('exercises', 'EDIT'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).exerciseEquipment.deleteMany({
      where: { exerciseId: req.params.id, equipmentId: req.params.equipmentId },
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// DELETE /api/exercises/:id/attendance/:memberId
router.delete('/:id/attendance/:memberId', requirePermission('exercises', 'EDIT'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).exerciseAttendance.deleteMany({
      where: { exerciseId: req.params.id, memberId: req.params.memberId },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
