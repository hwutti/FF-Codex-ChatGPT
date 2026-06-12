import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const router = Router();
router.use(authenticate);

// GET /api/reports/members - CSV Export
router.get('/members', requirePermission('reports','VIEW'), async (_req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const header = 'Nr;Vorname;Nachname;Geburtsdatum;Status;Dienstgrad;Funktion;Gruppe;Eintrittsdatum;Atemschutz;Maschinist\n';
    const rows = members.map(m =>
      `${m.memberNumber};${m.firstName};${m.lastName};${m.birthDate ? new Date(m.birthDate).toLocaleDateString('de-AT') : ''};${m.status};${m.rank || ''};${m.functionTitle || ''};${m.groupName || ''};${m.entryDate ? new Date(m.entryDate).toLocaleDateString('de-AT') : ''};${m.isBreathingApparatus ? 'Ja' : 'Nein'};${m.isMachinist ? 'Ja' : 'Nein'}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mitglieder.csv"');
    res.send('\uFEFF' + header + rows); // BOM für Excel
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/reports/attendance?eventId=...
router.get('/attendance', requirePermission('reports','VIEW'), async (req: Request, res: Response) => {
  try {
    const { eventId } = req.query;
    const where = eventId ? { eventId: eventId as string } : {};

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        member: { select: { firstName: true, lastName: true, memberNumber: true } },
        event: { select: { title: true, type: true, date: true } },
      },
      orderBy: { event: { date: 'desc' } },
    });

    const header = 'Mitgliedsnr;Name;Ereignis;Datum;Status\n';
    const rows = attendances.map(a =>
      `${a.member.memberNumber};${a.member.lastName} ${a.member.firstName};${a.event.title};${new Date(a.event.date).toLocaleDateString('de-AT')};${a.status}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="anwesenheiten.csv"');
    res.send('\uFEFF' + header + rows);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/reports/birthdays
router.get('/birthdays', requirePermission('birthdays','VIEW'), async (_req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      where: { status: { in: ['ACTIVE', 'YOUTH', 'RESERVE'] }, birthDate: { not: null } },
      orderBy: [{ birthDate: 'asc' }],
      select: { memberNumber: true, firstName: true, lastName: true, birthDate: true, rank: true },
    });

    const today = new Date();
    const header = 'Nr;Vorname;Nachname;Geburtsdatum;Alter;Dienstgrad\n';
    const rows = members.map(m => {
      const bd = new Date(m.birthDate!);
      const age = today.getFullYear() - bd.getFullYear();
      return `${m.memberNumber};${m.firstName};${m.lastName};${bd.toLocaleDateString('de-AT')};${age};${m.rank || ''}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="geburtstage.csv"');
    res.send('\uFEFF' + header + rows);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/reports/honors
router.get('/honors', requirePermission('honors','VIEW'), async (_req: Request, res: Response) => {
  try {
    const honors = await prisma.honor.findMany({
      include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
      orderBy: { honorDate: 'desc' },
    });

    const header = 'Mitgliedsnr;Name;Ehrung;Datum;Verliehen durch;Anlass\n';
    const rows = honors.map(h =>
      `${h.member.memberNumber};${h.member.lastName} ${h.member.firstName};${h.title};${new Date(h.honorDate).toLocaleDateString('de-AT')};${h.awardedBy || ''};${h.reason || ''}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ehrungen.csv"');
    res.send('\uFEFF' + header + rows);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
