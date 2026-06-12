import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    const [
      activeCount,
      reserveCount,
      youthCount,
      honoraryCount,
      upcomingEvents,
      recentIncidents,
      memberBirthdays,
      recentHonors,
      totalEvents,
      presentCount,
    ] = await Promise.all([
      prisma.member.count({ where: { status: 'ACTIVE' } }),
      prisma.member.count({ where: { status: 'RESERVE' } }),
      prisma.member.count({ where: { status: 'YOUTH' } }),
      prisma.member.count({ where: { status: 'HONORARY' } }),
      prisma.event.findMany({
        where: { date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 5,
        select: { id: true, title: true, type: true, date: true, startTime: true, location: true },
      }),
      prisma.incident.findMany({
        orderBy: { alarmTime: 'desc' },
        take: 5,
        select: { id: true, incidentNumber: true, type: true, alarmTime: true, location: true },
      }),
      prisma.member.findMany({
        where: { status: { in: ['ACTIVE', 'YOUTH'] }, birthDate: { not: null } },
        select: { id: true, firstName: true, lastName: true, birthDate: true },
      }),
      prisma.honor.findMany({
        orderBy: { honorDate: 'desc' },
        take: 5,
        include: { member: { select: { firstName: true, lastName: true } } },
      }),
      prisma.event.count(),
      prisma.attendance.count({ where: { status: 'PRESENT' } }),
    ]);

    // Berechne kommende Geburtstage (6 Monate = 180 Tage)
    const upcomingBirthdays = memberBirthdays
      .map(m => {
        const bd = new Date(m.birthDate!);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
        const diffDays = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isToday = diffDays === 0 || (thisYear.getDate() === today.getDate() && thisYear.getMonth() === today.getMonth());
        const nextAge = thisYear.getFullYear() - bd.getFullYear();
        return { ...m, daysUntil: diffDays, isToday, nextAge, age: nextAge };
      })
      .filter(m => m.daysUntil <= 180)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 8);

    // Einsätze pro Jahr (letzte 5 Jahre)
    const currentYear = today.getFullYear();
    const incidentsByYear = await Promise.all(
      Array.from({ length: 5 }, (_, i) => currentYear - 4 + i).map(async year => {
        const count = await prisma.incident.count({
          where: {
            alarmTime: {
              gte: new Date(`${year}-01-01`),
              lt:  new Date(`${year + 1}-01-01`),
            },
          },
        });
        return { year: String(year), count };
      })
    );

    // Anwesenheitsquote letzte 10 Ereignisse
    const recentEvents = await prisma.event.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      include: { _count: { select: { attendances: true } } },
    });
    const attendanceStats = await Promise.all(
      recentEvents.map(async ev => {
        const present = await prisma.attendance.count({ where: { eventId: ev.id, status: 'PRESENT' } });
        const total = ev._count.attendances;
        return {
          name: ev.title.substring(0, 15) + (ev.title.length > 15 ? '…' : ''),
          quote: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      })
    );

    // Mitglieder nach Dienstgrad (Top 10)
    const RANK_ORDER = ['LBD','LBDSTV','BR','OBR','ABI','HBI','OBI','BI','HV','OV','V','HBM','OBM','BM','HLM','OLM','LM','HFM','OFM','FM','PFM'];
    const allMembers = await prisma.member.findMany({
      where: { status: { in: ['ACTIVE', 'RESERVE', 'YOUTH'] } },
      select: { rank: true },
    });
    const rankCounts: Record<string, number> = {};
    allMembers.forEach(m => {
      if (m.rank) {
        const code = m.rank.split(':')[0].trim();
        rankCounts[code] = (rankCounts[code] || 0) + 1;
      }
    });
    const rankData = Object.entries(rankCounts)
      .sort(([a], [b]) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b))
      .map(([rank, count]) => ({ rank, count }));

    res.json({
      memberStats: { active: activeCount, reserve: reserveCount, youth: youthCount, honorary: honoraryCount },
      totalIncidents: await prisma.incident.count(),
      totalHonors: await prisma.honor.count(),
      totalEvents,
      stats: { activeMembers: activeCount, reserveMembers: reserveCount, youthMembers: youthCount, honoraryMembers: honoraryCount, totalEvents, totalPresences: presentCount },
      upcomingEvents,
      recentIncidents,
      upcomingBirthdays,
      recentHonors,
      // Chart-Daten
      charts: {
        incidentsByYear,
        attendanceStats: attendanceStats.reverse(),
        rankData,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
