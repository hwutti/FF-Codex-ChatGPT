import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { syncExerciseToCalendar, syncOrgEventToCalendar, syncKommandoTerminToCalendar } from '../utils/calendarSync';

const router = Router();
router.use(authenticate);

const ADMIN_ROLES = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER'];

// Map Kalender-Kategorie-Name zu EventType
const CATEGORY_TO_EVENT_TYPE: Record<string, string> = {
  'übung': 'EXERCISE',
  'exercise': 'EXERCISE',
  'versammlung': 'MEETING',
  'meeting': 'MEETING',
  'ausbildung': 'TRAINING',
  'training': 'TRAINING',
  'veranstaltung': 'EVENT',
  'event': 'EVENT',
  'begräbnis': 'FUNERAL',
  'funeral': 'FUNERAL',
  'brandeinsatz': 'FIRE_INCIDENT',
  'techn. einsatz': 'TECHNICAL_INCIDENT',
  'einsatz': 'INCIDENT',
};

function mapCategoryToEventType(categoryName: string | null): string {
  if (!categoryName) return 'OTHER';
  const normalized = categoryName.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_TO_EVENT_TYPE)) {
    if (normalized.includes(key)) return val;
  }
  return 'OTHER';
}

// Ereignis + Anwesenheiten anlegen
async function createEventFromCalendar(calEvent: any, category: any) {
  const eventType = mapCategoryToEventType(category?.name || null);

  // Ereignis erstellen
  // Uhrzeiten aus Datum extrahieren
  const startTime = calEvent.allDay ? null : 
    calEvent.startDate.toISOString().slice(11, 16);
  const endTime = calEvent.allDay ? null :
    calEvent.endDate.toISOString().slice(11, 16);

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

  // Leere Anwesenheitsliste für alle aktiven Kamerad:innen
  const activeMembers = await prisma.member.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  if (activeMembers.length > 0) {
    await prisma.attendance.createMany({
      data: activeMembers.map(m => ({
        eventId: event.id,
        memberId: m.id,
        status: 'ABSENT' as any,
      })),
    });
  }

  return event;
}

// Ereignis aktualisieren
async function updateEventFromCalendar(eventId: string, calEvent: any, category: any) {
  const eventType = mapCategoryToEventType(category?.name || null);
  const startTime = calEvent.allDay ? null :
    calEvent.startDate.toISOString().slice(11, 16);
  const endTime = calEvent.allDay ? null :
    calEvent.endDate.toISOString().slice(11, 16);

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

// Ereignis + Anwesenheiten löschen
async function deleteEventFromCalendar(eventId: string) {
  await prisma.attendance.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get('/categories', authenticate, async (_req, res: Response) => {
  try {
    const cats = await prisma.calendarCategory.findMany({
      where: { isCommand: false },
      orderBy: { name: 'asc' },
    });
    res.json(cats);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.post('/categories', requirePermission('calendar', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name) { res.status(400).json({ error: 'Name erforderlich' }); return; }
    const cat = await prisma.calendarCategory.create({ data: { name, color: color || '#a82828', isCommand: false } });
    res.status(201).json(cat);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.put('/categories/:id', requirePermission('calendar', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    const cat = await prisma.calendarCategory.update({ where: { id: req.params.id }, data: { name, color } });
    res.json(cat);
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

router.delete('/categories/:id', requirePermission('calendar', 'CREATE'), async (req: Request, res: Response) => {
  try {
    await prisma.calendarCategory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// ── EVENTS ────────────────────────────────────────────────────────────────────
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const where: any = { isCommand: false }; // Nur normale Termine
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

router.post('/events', requirePermission('calendar', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { title, description, location, trainingLocation, commanderId, status, allDay, startDate, endDate, categoryId } = req.body;
    if (!title || !startDate || !endDate) {
      res.status(400).json({ error: 'Titel, Start und Ende erforderlich' }); return;
    }

    // Kategorie laden
    const category = categoryId
      ? await prisma.calendarCategory.findUnique({ where: { id: categoryId } })
      : null;

    // Kalender-Termin erstellen
    const calEvent = await prisma.calendarEvent.create({
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
        isCommand: false,
        createdBy: req.user?.userId,
      },
      include: { category: true },
    });

    // Ereignis + Anwesenheiten anlegen
    const event = await createEventFromCalendar(calEvent, category);

    // eventId in CalendarEvent speichern
    await prisma.calendarEvent.update({
      where: { id: calEvent.id },
      data: { eventId: event.id },
    });

    res.status(201).json({ ...calEvent, eventId: event.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/events/:id', requirePermission('calendar', 'CREATE'), async (req: Request, res: Response) => {
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

    // Verknüpftes Ereignis aktualisieren
    if (calEvent.eventId) {
      await updateEventFromCalendar(calEvent.eventId, calEvent, category);
    }

    res.json(calEvent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:id', requirePermission('calendar', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const calEvent = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!calEvent) { res.status(404).json({ error: 'Nicht gefunden' }); return; }

    // Verknüpftes Ereignis + Anwesenheiten löschen
    if (calEvent.eventId) {
      await deleteEventFromCalendar(calEvent.eventId);
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
      where: { isCommand: false },
      include: { category: true },
      orderBy: { startDate: 'asc' },
    });

    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    const calName = settings?.name || 'Feuerwehr Verwaltung';

    const formatDate = (d: Date, allDay: boolean) => {
      if (allDay) return d.toISOString().slice(0, 10).replace(/-/g, '');
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escape = (s: string) => s?.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n') || '';

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//FF Görtschach//Feuerwehr Verwaltung//DE`,
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
      lines.push(`UID:${ev.id}@ff-goertschach`);
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
    res.setHeader('Content-Disposition', 'attachment; filename="feuerwehr.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(lines.join('\r\n'));
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

export default router;
