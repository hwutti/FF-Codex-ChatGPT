import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const router = Router();

// GET /api/trips/:id/signatures
router.get('/:id/signatures', authenticate, async (req: Request, res: Response) => {
  try {
    const signatures = await prisma.tripSignature.findMany({
      where: { tripId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, signerName: true, signerRole: true, signatureData: true, createdAt: true },
    });
    res.json(signatures);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/trips/:id/signatures
router.post('/:id/signatures', authenticate, async (req: Request, res: Response) => {
  try {
    const { signerName, signerRole, signatureData } = req.body;
    if (!signerName || !signatureData) {
      res.status(400).json({ error: 'Name und Unterschrift erforderlich' });
      return;
    }
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) { res.status(404).json({ error: 'Fahrt nicht gefunden' }); return; }

    // Komprimiert speichern — max 50KB
    const sizeKB = Buffer.byteLength(signatureData, 'utf8') / 1024;
    if (sizeKB > 100) { res.status(400).json({ error: 'Unterschrift zu groß' }); return; }

    const signature = await prisma.tripSignature.create({
      data: { tripId: req.params.id, signerName, signerRole: signerRole || null, signatureData },
    });
    res.json(signature);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/trips/:id/signatures/:sigId — nur Admin
router.delete('/:id/signatures/:sigId', requirePermission('vehicles', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await prisma.tripSignature.delete({ where: { id: req.params.sigId } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
