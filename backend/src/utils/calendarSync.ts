import { prisma } from '../config/database';

// Erstellt oder aktualisiert einen Kalender-Eintrag für eine Übung
export async function syncExerciseToCalendar(exercise: any): Promise<string | null> {
  try {
    const startDate = new Date(exercise.date);
    const endDate = new Date(exercise.date);
    if (exercise.startTime) {
      const [h, m] = exercise.startTime.split(':');
      startDate.setHours(parseInt(h), parseInt(m));
    }
    if (exercise.endTime) {
      const [h, m] = exercise.endTime.split(':');
      endDate.setHours(parseInt(h), parseInt(m));
    } else {
      endDate.setHours(startDate.getHours() + 2);
    }

    const data = {
      title: exercise.title,
      description: exercise.description || null,
      location: exercise.location || null,
      startDate,
      endDate,
      isCommand: false,
      sourceType: 'EXERCISE',
      sourceId: exercise.id,
    };

    if (exercise.calendarEventId) {
      // Bestehenden Eintrag aktualisieren
      await (prisma as any).calendarEvent.update({
        where: { id: exercise.calendarEventId },
        data,
      });
      return exercise.calendarEventId;
    } else {
      // Neuen Eintrag erstellen
      const cal = await (prisma as any).calendarEvent.create({ data });
      await (prisma as any).exercise.update({
        where: { id: exercise.id },
        data: { calendarEventId: cal.id },
      });
      return cal.id;
    }
  } catch (e) {
    console.error('syncExerciseToCalendar error:', e);
    return null;
  }
}

// Erstellt oder aktualisiert einen Kalender-Eintrag für ein Org-Ereignis
export async function syncOrgEventToCalendar(orgEvent: any): Promise<string | null> {
  try {
    const startDate = new Date(orgEvent.date);
    const endDate = new Date(orgEvent.date);
    if (orgEvent.startTime) {
      const [h, m] = orgEvent.startTime.split(':');
      startDate.setHours(parseInt(h), parseInt(m));
    }
    if (orgEvent.endTime) {
      const [h, m] = orgEvent.endTime.split(':');
      endDate.setHours(parseInt(h), parseInt(m));
    } else {
      endDate.setHours(startDate.getHours() + 2);
    }

    const data = {
      title: orgEvent.title,
      description: orgEvent.description || null,
      location: orgEvent.location || null,
      startDate,
      endDate,
      isCommand: false,
      sourceType: 'ORG_EVENT',
      sourceId: orgEvent.id,
    };

    if (orgEvent.calendarEventId) {
      await (prisma as any).calendarEvent.update({
        where: { id: orgEvent.calendarEventId },
        data,
      });
      return orgEvent.calendarEventId;
    } else {
      const cal = await (prisma as any).calendarEvent.create({ data });
      await (prisma as any).orgEvent.update({
        where: { id: orgEvent.id },
        data: { calendarEventId: cal.id },
      });
      return cal.id;
    }
  } catch (e) {
    console.error('syncOrgEventToCalendar error:', e);
    return null;
  }
}

// Erstellt oder aktualisiert einen Kalender-Kommando-Eintrag für einen Kommandotermin
export async function syncKommandoTerminToCalendar(termin: any): Promise<string | null> {
  try {
    const startDate = new Date(termin.date);
    const endDate = new Date(termin.date);
    if (termin.startTime) {
      const [h, m] = termin.startTime.split(':');
      startDate.setHours(parseInt(h), parseInt(m));
    }
    if (termin.endTime) {
      const [h, m] = termin.endTime.split(':');
      endDate.setHours(parseInt(h), parseInt(m));
    } else {
      endDate.setHours(startDate.getHours() + 2);
    }

    const typeLabels: Record<string, string> = {
      AUSSCHUSS: 'Ausschusssitzung',
      KOMMANDO: 'Kommandositzung',
    };

    const data = {
      title: termin.title,
      description: termin.description || typeLabels[termin.type] || null,
      location: termin.location || null,
      startDate,
      endDate,
      isCommand: true,
      sourceType: 'KOMMANDO_TERMIN',
      sourceId: termin.id,
    };

    if (termin.calendarEventId) {
      await (prisma as any).calendarEvent.update({
        where: { id: termin.calendarEventId },
        data,
      });
      return termin.calendarEventId;
    } else {
      const cal = await (prisma as any).calendarEvent.create({ data });
      await (prisma as any).kommandoTermin.update({
        where: { id: termin.id },
        data: { calendarEventId: cal.id },
      });
      return cal.id;
    }
  } catch (e) {
    console.error('syncKommandoTerminToCalendar error:', e);
    return null;
  }
}

// Löscht den verknüpften Kalender-Eintrag
export async function deleteLinkedCalendarEvent(calendarEventId: string | null) {
  if (!calendarEventId) return;
  try {
    await (prisma as any).calendarEvent.delete({ where: { id: calendarEventId } });
  } catch {}
}
