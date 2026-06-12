import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { syncOrgEventToCalendar, deleteLinkedCalendarEvent } from '../utils/calendarSync';
import { sendPushToAll } from './push.routes';

const router = Router();
router.use(authenticate);

// GET /api/org-events
router.get('/', requirePermission('org_events', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    const events = await (prisma as any).orgEvent.findMany({
      where,
      include: {
        responsiblePerson: { select: { firstName: true, lastName: true, rank: true } },
        attendances: { include: { member: { select: { id: true, firstName: true, lastName: true, rank: true } } } },
      },
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ orgEvents: events });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/org-events/:id
router.get('/:id', requirePermission('org_events', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const event = await (prisma as any).orgEvent.findUnique({
      where: { id: req.params.id },
      include: {
        responsiblePerson: { select: { id: true, firstName: true, lastName: true, rank: true } },
        attendances: { include: { member: { select: { id: true, firstName: true, lastName: true, rank: true, profileImage: true } } } },
      },
    });
    if (!event) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    res.json(event);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/org-events
router.post('/', requirePermission('org_events', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { type, title, date, startTime, endTime, location, description, responsiblePersonId, notes, memberIds } = req.body;
    const event = await (prisma as any).orgEvent.create({
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
    await syncOrgEventToCalendar(event);
    const dateStr = new Date(date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const bodyParts = [dateStr];
    if (startTime) bodyParts.push(startTime + ' Uhr');
    if (location) bodyParts.push(location);
    await sendPushToAll('pushNewEvent', {
      title: `📅 ${title}`,
      body: bodyParts.join(' · '),
      url: '/calendar',
    });
    res.status(201).json(event);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/org-events/:id
router.put('/:id', requirePermission('org_events', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { type, title, date, startTime, endTime, location, description, responsiblePersonId, notes } = req.body;
    const event = await (prisma as any).orgEvent.update({
      where: { id: req.params.id },
      data: {
        type, title, date: new Date(date),
        startTime: startTime || null, endTime: endTime || null,
        location: location || null, description: description || null,
        responsiblePersonId: responsiblePersonId || null,
        notes: notes || null,
      },
    });
    const existing = await (prisma as any).orgEvent.findUnique({ where: { id: req.params.id } });
    await syncOrgEventToCalendar({ ...event, calendarEventId: existing?.calendarEventId });
    res.json(event);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/org-events/:id
router.delete('/:id', requirePermission('org_events', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const ev = await (prisma as any).orgEvent.findUnique({ where: { id: req.params.id } });
    await (prisma as any).orgEvent.delete({ where: { id: req.params.id } });
    await deleteLinkedCalendarEvent(ev?.calendarEventId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/org-events/:id/attendance
router.put('/:id/attendance', requirePermission('org_events', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { memberId, status } = req.body;
    const att = await (prisma as any).orgEventAttendance.upsert({
      where: { orgEventId_memberId: { orgEventId: req.params.id, memberId } },
      update: { status },
      create: { orgEventId: req.params.id, memberId, status },
    });
    res.json(att);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// DELETE /api/org-events/:id/attendance/:memberId
router.delete('/:id/attendance/:memberId', requirePermission('org_events', 'EDIT'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).orgEventAttendance.deleteMany({
      where: { orgEventId: req.params.id, memberId: req.params.memberId },
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
