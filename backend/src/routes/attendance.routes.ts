import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, canManageContent } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const router = Router();
router.use(authenticate);

// PUT /api/attendance/:id
router.put('/:id', requirePermission('events', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const attendance = await prisma.attendance.update({
      where: { id: req.params.id },
      data: { status, notes },
    });
    res.json(attendance);
  } catch {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
