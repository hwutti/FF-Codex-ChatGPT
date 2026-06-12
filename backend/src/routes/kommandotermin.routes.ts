import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { syncKommandoTerminToCalendar, deleteLinkedCalendarEvent } from '../utils/calendarSync';

const router = Router();
router.use(authenticate);

// GET /api/kommando-termine
router.get('/', requirePermission('kommando_termine', 'VIEW'), async (_req: Request, res: Response) => {
  try {
    const termine = await (prisma as any).kommandoTermin.findMany({
      include: {
        attendances: { include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, profileImage: true } } } },
      },
      orderBy: { date: 'desc' },
    });
    res.json({ termine });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/kommando-termine/:id
router.get('/:id', requirePermission('kommando_termine', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const termin = await (prisma as any).kommandoTermin.findUnique({
      where: { id: req.params.id },
      include: {
        attendances: { include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, profileImage: true } } } },
      },
    });
    if (!termin) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    res.json(termin);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/kommando-termine
router.post('/', requirePermission('kommando_termine', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { type, title, date, startTime, endTime, location, description, notes, memberIds } = req.body;
    const termin = await (prisma as any).kommandoTermin.create({
      data: {
        type, title, date: new Date(date),
        startTime: startTime || null, endTime: endTime || null,
        location: location || null, description: description || null,
        notes: notes || null,
        attendances: memberIds?.length ? {
          create: memberIds.map((memberId: string) => ({ memberId, status: 'PRESENT' })),
        } : undefined,
      },
    });
    // Sync zu Kalender Kommando
    await syncKommandoTerminToCalendar(termin);
    res.status(201).json(termin);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/kommando-termine/:id
router.put('/:id', requirePermission('kommando_termine', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { type, title, date, startTime, endTime, location, description, notes } = req.body;
    const existing = await (prisma as any).kommandoTermin.findUnique({ where: { id: req.params.id } });
    const termin = await (prisma as any).kommandoTermin.update({
      where: { id: req.params.id },
      data: {
        type, title, date: new Date(date),
        startTime: startTime || null, endTime: endTime || null,
        location: location || null, description: description || null,
        notes: notes || null,
      },
    });
    // Sync zu Kalender
    await syncKommandoTerminToCalendar({ ...termin, calendarEventId: existing?.calendarEventId });
    res.json(termin);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/kommando-termine/:id
router.delete('/:id', requirePermission('kommando_termine', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const termin = await (prisma as any).kommandoTermin.findUnique({ where: { id: req.params.id } });
    await (prisma as any).kommandoTermin.delete({ where: { id: req.params.id } });
    await deleteLinkedCalendarEvent(termin?.calendarEventId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/kommando-termine/:id/attendance
router.put('/:id/attendance', requirePermission('kommando_termine', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { memberId, status } = req.body;
    const att = await (prisma as any).kommandoTerminAttendance.upsert({
      where: { kommandoTerminId_memberId: { kommandoTerminId: req.params.id, memberId } },
      update: { status },
      create: { kommandoTerminId: req.params.id, memberId, status },
    });
    res.json(att);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// DELETE /api/kommando-termine/:id/attendance/:memberId
router.delete('/:id/attendance/:memberId', requirePermission('kommando_termine', 'EDIT'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).kommandoTerminAttendance.deleteMany({
      where: { kommandoTerminId: req.params.id, memberId: req.params.memberId },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
