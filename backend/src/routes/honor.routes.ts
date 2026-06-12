import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, canManageContent } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const honors = await prisma.honor.findMany({
      include: { member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } },
      orderBy: { honorDate: 'desc' },
    });
    res.json(honors);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

router.post('/', requirePermission('honors', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const honor = await prisma.honor.create({
      data: {
        memberId: data.memberId,
        title: data.title,
        honorDate: new Date(data.honorDate),
        reason: data.reason,
        awardedBy: data.awardedBy,
        notes: data.notes,
      },
      include: { member: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(honor);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

router.put('/:id', requirePermission('honors', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const honor = await prisma.honor.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        honorDate: new Date(data.honorDate),
        reason: data.reason,
        awardedBy: data.awardedBy,
        notes: data.notes,
      },
    });
    res.json(honor);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

router.delete('/:id', requirePermission('honors', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await prisma.honor.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ehrung gelöscht' });
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
