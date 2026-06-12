import { prisma } from '../config/database';
import { sendPushToUser } from '../routes/push.routes';

// Typ-Labels
const EVENT_LABELS: Record<string, string> = {
  EXERCISE: 'Übung', INCIDENT: 'Einsatz', MEETING: 'Sitzung',
  FUNERAL: 'Begräbnis', OTHER: 'Ereignis',
};
const EXERCISE_LABELS: Record<string, string> = {
  DRILL: 'Übung', COURSE: 'Kurs', MEETING: 'Besprechung', OTHER: 'Übung',
};
const KOMMANDO_LABELS: Record<string, string> = {
  MEETING: 'Kommandositzung', TRAINING: 'Schulung', OTHER: 'Termin',
};

function formatTime(start?: string | null, end?: string | null): string {
  if (!start) return '';
  return end ? `${start} – ${end} Uhr` : `${start} Uhr`;
}

function formatDate(date: Date, daysAway: number): string {
  const d = new Date(date);
  const formatted = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  if (daysAway === 1) return `morgen, ${formatted}`;
  if (daysAway === 3) return `in 3 Tagen, ${formatted}`;
  return `in 7 Tagen, ${formatted}`;
}

function buildBody(fields: {
  typeLabel: string;
  date: Date;
  daysAway: number;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  notes?: string | null;
  responsible?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(formatDate(fields.date, fields.daysAway));
  if (fields.startTime) parts.push(`🕐 ${formatTime(fields.startTime, fields.endTime)}`);
  if (fields.location)  parts.push(`📍 ${fields.location}`);
  if (fields.description) parts.push(fields.description);
  if (fields.responsible) parts.push(`👤 ${fields.responsible}`);
  if (fields.notes)     parts.push(`📝 ${fields.notes}`);
  return parts.join('\n');
}

async function getEventsInDays(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + days);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const results: {
    title: string; emoji: string; body: string; id: string; source: string;
  }[] = [];

  // Events
  const events = await prisma.event.findMany({
    where: { date: { gte: start, lte: end } },
    include: { responsiblePerson: true },
  });
  for (const e of events) {
    const typeLabel = EVENT_LABELS[e.type] || e.type;
    results.push({
      id: e.id,
      source: 'events',
      emoji: e.type === 'INCIDENT' ? '🚨' : e.type === 'EXERCISE' ? '🧯' : '📅',
      title: `${typeLabel}: ${e.title || typeLabel}`,
      body: buildBody({
        typeLabel,
        date: e.date,
        daysAway: days,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        description: e.description,
        notes: e.notes,
        responsible: e.responsiblePerson
          ? `${e.responsiblePerson.firstName} ${e.responsiblePerson.lastName}`
          : null,
      }),
    });
  }

  // Exercises
  const exercises = await (prisma as any).exercise.findMany({
    where: { date: { gte: start, lte: end } },
    include: { responsiblePerson: true },
  });
  for (const e of exercises) {
    const typeLabel = EXERCISE_LABELS[e.type] || e.type;
    results.push({
      id: e.id,
      source: 'exercises',
      emoji: '🧯',
      title: `${typeLabel}: ${e.title || typeLabel}`,
      body: buildBody({
        typeLabel,
        date: e.date,
        daysAway: days,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        description: e.description,
        notes: e.notes,
        responsible: e.responsiblePerson
          ? `${e.responsiblePerson.firstName} ${e.responsiblePerson.lastName}`
          : null,
      }),
    });
  }

  // OrgEvents
  const orgEvents = await (prisma as any).orgEvent.findMany({
    where: { date: { gte: start, lte: end } },
  });
  for (const e of orgEvents) {
    results.push({
      id: e.id,
      source: 'org-events',
      emoji: '📅',
      title: `${e.title || e.type}`,
      body: buildBody({
        typeLabel: e.type,
        date: e.date,
        daysAway: days,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        description: e.description,
        notes: e.notes,
      }),
    });
  }

  // KommandoTermine
  const kommandoTermine = await (prisma as any).kommandoTermin.findMany({
    where: { date: { gte: start, lte: end } },
  });
  for (const e of kommandoTermine) {
    const typeLabel = KOMMANDO_LABELS[e.type] || e.type;
    results.push({
      id: e.id,
      source: 'kommando-termine',
      emoji: '🛡️',
      title: `${typeLabel}: ${e.title || typeLabel}`,
      body: buildBody({
        typeLabel,
        date: e.date,
        daysAway: days,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        description: e.description,
        notes: e.notes,
      }),
    });
  }

  return results;
}

const REMINDER_FIELD: Record<number, 'pushReminder7' | 'pushReminder3' | 'pushReminder1'> = {
  7: 'pushReminder7',
  3: 'pushReminder3',
  1: 'pushReminder1',
};

export async function runPushReminders() {
  console.log('🔔 Push-Erinnerungen prüfen...');

  for (const days of [7, 3, 1]) {
    const events = await getEventsInDays(days);
    if (events.length === 0) continue;

    const field = REMINDER_FIELD[days];

    const users = await (prisma as any).user.findMany({
      where: {
        [field]: true,
        pushSubscriptions: { some: {} },
        member: { status: { in: ['ACTIVE', 'YOUTH'] } },
      },
      include: { pushSubscriptions: true },
    });

    for (const event of events) {
      for (const user of users) {
        await sendPushToUser(user, {
          title: `${event.emoji} Erinnerung ${days === 1 ? 'morgen' : `in ${days} Tagen`}: ${event.title}`,
          body: event.body,
          url: `/${event.source}/${event.id}`,
        });
      }
    }

    if (events.length > 0) {
      console.log(`✅ ${events.length} Termin(e) in ${days} Tag(en) → ${users.length} User benachrichtigt`);
    }
  }
}

export function startReminderScheduler() {
  const checkAndRun = async () => {
    const settings = await (prisma as any).appSettings.findUnique({
      where: { id: 'singleton' },
      select: { pushReminderHour: true, pushReminderMinute: true },
    });
    const hour   = settings?.pushReminderHour   ?? 19;
    const minute = settings?.pushReminderMinute ?? 0;

    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      await runPushReminders();
    }
  };

  setInterval(() => { checkAndRun().catch(console.error); }, 60 * 1000);
  console.log('🔔 Push-Reminder Scheduler gestartet (prüft jede Minute)');
}
