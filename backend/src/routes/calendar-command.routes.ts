import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { syncExerciseToCalendar, syncOrgEventToCalendar, syncKommandoTerminToCalendar } from '../utils/calendarSync';

const router = Router();
router.use(authenticate);

const COMMAND_ROLES = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER', 'SECRETARY'];

// Ränge die NICHT in der Kommando-Anwesenheitsliste erscheinen
const RESTRICTED_RANK_CODES = ['PFM', 'FM', 'OFM', 'HFM'];

function mapCategoryToEventType(categoryName: string | null): string {
  if (!categoryName) return 'OTHER';
  const n = categoryName.toLowerCase().trim();
  if (n.includes('übung') || n.includes('exercise')) return 'EXERCISE';
  if (n.includes('versammlung') || n.includes('meeting')) return 'MEETING';
  if (n.includes('ausbildung') || n.includes('training')) return 'TRAINING';
  if (n.includes('veranstaltung') || n.includes('event')) return 'EVENT';
  if (n.includes('begräbnis') || n.includes('funeral')) return 'FUNERAL';
  if (n.includes('einsatz') || n.includes('incident')) return 'INCIDENT';
  return 'OTHER';
}

async function createCommandEvent(calEvent: any, category: any) {
  const eventType = mapCategoryToEventType(category?.name || null);
  const startTime = calEvent.allDay ? null : calEvent.startDate.toISOString().slice(11, 16);
  const endTime = calEvent.allDay ? null : calEvent.endDate.toISOString().slice(11, 16);

  const event = await prisma.event.create({
    data: {
      title: calEvent.title,
      type: eventType as any,
      date: calEvent.startDate,
      startTime,
      endTime,
      location: calEvent.location || null,
      notes: calEvent.description || null,
      calendarCategory: category?.name || null,
      calendarCategoryColor: category?.color || null,
    },
  });

  // Anwesenheitsliste nur für höhere Ränge (ab LM aufwärts)
  const commandMembers = await prisma.member.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, rank: true },
  });

  const eligibleMembers = commandMembers.filter(m => {
    if (!m.rank) return true; // Kein Rang = Zugriff
    const rankCode = m.rank.split(':')[0].trim();
    return !RESTRICTED_RANK_CODES.includes(rankCode);
  });

  if (eligibleMembers.length > 0) {
    await prisma.attendance.createMany({
      data: eligibleMembers.map(m => ({
        eventId: event.id,
        memberId: m.id,
        status: 'ABSENT' as any,
      })),
    });
  }

  return event;
}

async function updateCommandEvent(eventId: string, calEvent: any, category: any) {
  const eventType = mapCategoryToEventType(category?.name || null);
  const startTime = calEvent.allDay ? null : calEvent.startDate.toISOString().slice(11, 16);
  const endTime = calEvent.allDay ? null : calEvent.endDate.toISOString().slice(11, 16);

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: calEvent.title,
      type: eventType as any,
      date: calEvent.startDate,
      startTime,
      endTime,
      location: calEvent.location || null,
      notes: calEvent.description || null,
      calendarCategory: category?.name || null,
      calendarCategoryColor: category?.color || null,
    },
  });
}

async function deleteCommandEvent(eventId: string) {
  await prisma.attendance.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get('/categories', requirePermission('calendar_command', 'VIEW'), async (_req, res: Response) => {
  try {
    const cats = await prisma.calendarCategory.findMany({
      where: { isCommand: true },
      orderBy: { name: 'asc' },
    });
    res.json(cats);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.post('/categories', requirePermission('calendar_command', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name) { res.status(400).json({ error: 'Name erforderlich' }); return; }
    const cat = await prisma.calendarCategory.create({
      data: { name, color: color || '#1e40af', isCommand: true },
    });
    res.status(201).json(cat);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.put('/categories/:id', requirePermission('calendar_command', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    const cat = await prisma.calendarCategory.update({
      where: { id: req.params.id },
      data: { name, color },
    });
    res.json(cat);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.delete('/categories/:id', requirePermission('calendar_command', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await prisma.calendarCategory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// ── EVENTS ────────────────────────────────────────────────────────────────────
router.get('/events', requirePermission('calendar_command', 'VIEW'), async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const where: any = { isCommand: true };
    if (from) where.startDate = { gte: new Date(from as string) };
    if (to) where.endDate = { ...where.endDate, lte: new Date(to as string) };
    const events = await prisma.calendarEvent.findMany({
      where, include: { category: true }, orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.get('/events/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: req.params.id },
      include: { category: true },
    });
    if (!event) { res.status(404).json({ error: 'Termin nicht gefunden' }); return; }
    res.json(event);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/events', requirePermission('calendar_command', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { title, description, location, allDay, startDate, endDate, categoryId } = req.body;
    if (!title || !startDate || !endDate) {
      res.status(400).json({ error: 'Titel, Start und Ende erforderlich' }); return;
    }

    const category = categoryId
      ? await prisma.calendarCategory.findUnique({ where: { id: categoryId } })
      : null;

    const calEvent = await prisma.calendarEvent.create({
      data: {
        title, description, location,
        allDay: allDay || false,
        startDate: new Date(startDate),
        endDate: (() => {
          const s = new Date(startDate);
          const e = new Date(endDate);
          // Wenn endDate durch UTC-Konvertierung auf nächsten Tag fällt aber
          // ursprünglich am gleichen Tag war, auf 23:59 des Starttages setzen
          if (!allDay && s.toDateString() !== e.toDateString() &&
              e.getHours() < 3 && e.getMinutes() < 30) {
            const fixed = new Date(s);
            fixed.setHours(23, 59, 0, 0);
            return fixed;
          }
          return e;
        })(),
        categoryId: categoryId || null,
        isCommand: true,
        createdBy: req.user?.userId,
      },
      include: { category: true },
    });

    const event = await createCommandEvent(calEvent, category);

    await prisma.calendarEvent.update({
      where: { id: calEvent.id },
      data: { eventId: event.id },
    });

    res.status(201).json({ ...calEvent, eventId: event.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/events/:id', requirePermission('calendar_command', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { title, description, location, trainingLocation, commanderId, status, allDay, startDate, endDate, categoryId } = req.body;

    const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Nicht gefunden' }); return; }

    const category = categoryId
      ? await prisma.calendarCategory.findUnique({ where: { id: categoryId } })
      : null;

    const calEvent = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        title, description, location,
        trainingLocation: trainingLocation || null,
        commanderId: commanderId || null,
        status: status || 'PLANNED',
        allDay: allDay || false,
        startDate: new Date(startDate),
        endDate: (() => {
          const s = new Date(startDate);
          const e = new Date(endDate);
          // Wenn endDate durch UTC-Konvertierung auf nächsten Tag fällt aber
          // ursprünglich am gleichen Tag war, auf 23:59 des Starttages setzen
          if (!allDay && s.toDateString() !== e.toDateString() &&
              e.getHours() < 3 && e.getMinutes() < 30) {
            const fixed = new Date(s);
            fixed.setHours(23, 59, 0, 0);
            return fixed;
          }
          return e;
        })(),
        categoryId: categoryId || null,
      },
      include: { category: true },
    });

    if (calEvent.eventId) {
      await updateCommandEvent(calEvent.eventId, calEvent, category);
    }

    res.json(calEvent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:id', requirePermission('calendar_command', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const calEvent = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!calEvent) { res.status(404).json({ error: 'Nicht gefunden' }); return; }

    if (calEvent.eventId) {
      await deleteCommandEvent(calEvent.eventId);
    }

    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── iCALENDAR FEED (PUBLIC) ───────────────────────────────────────────────────
router.get('/feed.ics', async (_req, res: Response) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      where: { isCommand: true },
      include: { category: true },
      orderBy: { startDate: 'asc' },
    });

    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    const calName = `${settings?.name || 'Feuerwehr'} – Kommando`;

    const formatDate = (d: Date, allDay: boolean) => {
      if (allDay) return d.toISOString().slice(0, 10).replace(/-/g, '');
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    const escape = (s: string) => s?.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n') || '';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//FF Görtschach//Kommando//DE`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escape(calName)}`,
      'X-WR-TIMEZONE:Europe/Vienna',
    ];

    for (const ev of events) {
      const dtstart = ev.allDay
        ? `DTSTART;VALUE=DATE:${formatDate(ev.startDate, true)}`
        : `DTSTART:${formatDate(ev.startDate, false)}`;
      const dtend = ev.allDay
        ? `DTEND;VALUE=DATE:${formatDate(ev.endDate, true)}`
        : `DTEND:${formatDate(ev.endDate, false)}`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:cmd-${ev.id}@ff-goertschach`);
      lines.push(`DTSTAMP:${formatDate(new Date(), false)}`);
      lines.push(dtstart);
      lines.push(dtend);
      lines.push(`SUMMARY:${escape(ev.title)}`);
      if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
      if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);
      if (ev.category) lines.push(`CATEGORIES:${escape(ev.category.name)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="feuerwehr-kommando.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(lines.join('\r\n'));
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

export default router;
