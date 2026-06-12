import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const RANK_ORDER = ['LBD','LBDSTV','BR','OBR','ABI','HBI','OBI','BI','HV','OV','V','HBM','OBM','BM','HLM','OLM','LM','HFM','OFM','FM','PFM'];
function getRankIndex(rank?: string | null) {
  if (!rank) return 999;
  const code = rank.split(':')[0].trim().toUpperCase();
  const i = RANK_ORDER.indexOf(code);
  return i === -1 ? 998 : i;
}

const router = Router();
router.use(authenticate);

// GET /api/birthdays/upcoming
router.get('/upcoming', requirePermission('birthdays','VIEW'), async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const members = await prisma.member.findMany({
      where: { status: { in: ['ACTIVE', 'YOUTH', 'RESERVE'] }, birthDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, birthDate: true, rank: true, status: true },
    });

    const today = new Date();
    const upcoming = members
      .map(m => {
        const bd = new Date(m.birthDate!);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
        const diffDays = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const age = today.getFullYear() - bd.getFullYear() - (thisYear.getFullYear() > today.getFullYear() ? 0 : 0);
        const nextAge = today.getFullYear() + (thisYear.getFullYear() > today.getFullYear() ? 1 : 0) - bd.getFullYear();
        return { ...m, daysUntil: diffDays, nextAge, isRound: nextAge % 5 === 0 };
      })
      .filter(m => m.daysUntil <= days)
      .sort((a, b) => a.daysUntil !== b.daysUntil ? a.daysUntil - b.daysUntil : getRankIndex(a.rank) - getRankIndex(b.rank));

    res.json(upcoming);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/birthdays?month=3
router.get('/', requirePermission('birthdays','VIEW'), async (req: Request, res: Response) => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : null;
    const members = await prisma.member.findMany({
      where: { status: { in: ['ACTIVE', 'YOUTH', 'RESERVE', 'HONORARY'] }, birthDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, birthDate: true, rank: true, status: true, entryDate: true },
    });

    const today = new Date();
    const result = members
      .map(m => {
        const bd = new Date(m.birthDate!);
        const age = today.getFullYear() - bd.getFullYear();
        const yearsOfService = m.entryDate
          ? today.getFullYear() - new Date(m.entryDate).getFullYear()
          : null;
        return { ...m, age, yearsOfService, birthdayMonth: bd.getMonth() + 1, birthdayDay: bd.getDate() };
      })
      .filter(m => !month || m.birthdayMonth === month)
      .sort((a, b) => {
        if (a.birthdayMonth !== b.birthdayMonth) return a.birthdayMonth - b.birthdayMonth;
        if (a.birthdayDay !== b.birthdayDay) return a.birthdayDay - b.birthdayDay;
        return getRankIndex(a.rank) - getRankIndex(b.rank);
      });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
