import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';

const router = Router();

// GET /api/protocols/:id/signatures
router.get('/:id/signatures', authenticate, async (req: Request, res: Response) => {
  try {
    const signatures = await prisma.protocolSignature.findMany({
      where: { protocolId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, signerName: true, signerRole: true, signatureData: true, createdAt: true },
    });
    res.json(signatures);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/protocols/:id/signatures
router.post('/:id/signatures', authenticate, async (req: Request, res: Response) => {
  try {
    const { signerName, signerRole, signatureData } = req.body;
    if (!signerName || !signatureData) {
      res.status(400).json({ error: 'Name und Unterschrift erforderlich' });
      return;
    }
    // Prüfen ob Protokoll existiert
    const protocol = await prisma.protocol.findUnique({ where: { id: req.params.id } });
    if (!protocol) { res.status(404).json({ error: 'Protokoll nicht gefunden' }); return; }

    // Größe der Unterschrift prüfen (max 50KB)
    const sizeKB = Buffer.byteLength(signatureData, 'utf8') / 1024;
    if (sizeKB > 50) { res.status(400).json({ error: 'Unterschrift zu groß (max 50KB)' }); return; }

    const signature = await prisma.protocolSignature.create({
      data: { protocolId: req.params.id, signerName, signerRole: signerRole || null, signatureData },
    });
    res.json(signature);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/protocols/:id/signatures/:sigId
router.delete('/:id/signatures/:sigId', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.protocolSignature.delete({ where: { id: req.params.sigId } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// GET /api/protocols/:id/export-signed — PDF mit Unterschriften als neue Seite
router.get('/:id/export-signed', authenticate, async (req: Request, res: Response) => {
  try {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const fs = await import('fs');
    const path = await import('path');
    const { env } = await import('../config/env');

    const protocol = await prisma.protocol.findUnique({
      where: { id: req.params.id },
      include: { signatures: { orderBy: { createdAt: 'asc' } } },
    });
    if (!protocol) { res.status(404).json({ error: 'Protokoll nicht gefunden' }); return; }
    if (!protocol.signatures.length) { res.status(400).json({ error: 'Keine Unterschriften vorhanden' }); return; }

    // Original-PDF laden
    const pdfPath = path.join(env.UPLOAD_DIR, protocol.fileUrl.replace('/uploads/', ''));
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Neue Seite für Unterschriften
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 60;

    // Titel
    page.drawText('Unterschriften', { x: 50, y, font: fontBold, size: 18, color: rgb(0.1, 0.1, 0.1) });
    y -= 15;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 30;

    // Protokoll-Info
    page.drawText(`Protokoll: ${protocol.title}`, { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    y -= 15;
    const dateStr = new Date(protocol.date).toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' });
    page.drawText(`Datum: ${dateStr}`, { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    y -= 40;

    // Unterschriften — 2 pro Reihe
    const sigWidth = 220;
    const sigHeight = 80;
    const cols = 2;
    const colWidth = (width - 100) / cols;

    for (let i = 0; i < protocol.signatures.length; i++) {
      const sig = protocol.signatures[i];
      const col = i % cols;
      const x = 50 + col * colWidth;

      if (col === 0 && i > 0) y -= sigHeight + 80;
      if (y < 100) break; // Seitenende

      // Unterschriftsbild einbetten
      try {
        const base64Data = sig.signatureData.replace(/^data:image\/\w+;base64,/, '');
        const imgBytes = Buffer.from(base64Data, 'base64');
        const img = sig.signatureData.includes('image/png')
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        page.drawImage(img, { x, y: y - sigHeight, width: sigWidth, height: sigHeight });
      } catch {}

      // Linie unter Unterschrift
      page.drawLine({ start: { x, y: y - sigHeight - 5 }, end: { x: x + sigWidth, y: y - sigHeight - 5 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });

      // Name und Funktion
      page.drawText(sig.signerName, { x, y: y - sigHeight - 20, font: fontBold, size: 10, color: rgb(0.1, 0.1, 0.1) });
      if (sig.signerRole) {
        page.drawText(sig.signerRole, { x, y: y - sigHeight - 33, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
      }
      const sigDate = new Date(sig.createdAt).toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' });
      page.drawText(sigDate, { x, y: y - sigHeight - 46, font, size: 8, color: rgb(0.6, 0.6, 0.6) });
    }

    const signedPdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${protocol.fileName.replace('.pdf','')}_unterschrieben.pdf"`);
    res.send(Buffer.from(signedPdfBytes));
  } catch (e: any) {
    console.error('PDF Export Fehler:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/protocols/:id/save-signed — Signiertes PDF als neues Protokoll speichern
router.post('/:id/save-signed', authenticate, async (req: Request, res: Response) => {
  try {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const fs = await import('fs');
    const path = await import('path');
    const { env } = await import('../config/env');

    const protocol = await prisma.protocol.findUnique({
      where: { id: req.params.id },
      include: { signatures: { orderBy: { createdAt: 'asc' } } },
    });
    if (!protocol) { res.status(404).json({ error: 'Protokoll nicht gefunden' }); return; }
    if (!protocol.signatures.length) { res.status(400).json({ error: 'Keine Unterschriften vorhanden' }); return; }

    // Original-PDF laden
    const pdfPath = path.join(env.UPLOAD_DIR, protocol.fileUrl.replace('/uploads/', ''));
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Neue Seite für Unterschriften
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    let y = height - 60;

    page.drawText('Digitale Unterschriften', { x: 50, y, font: fontBold, size: 18, color: rgb(0.1, 0.1, 0.1) });
    y -= 15;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 25;

    const dateStr = new Date(protocol.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    page.drawText(`Protokoll: ${protocol.title}`, { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    y -= 15;
    page.drawText(`Datum: ${dateStr}`, { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    y -= 40;

    const sigWidth = 220;
    const sigHeight = 80;
    const cols = 2;
    const colWidth = (width - 100) / cols;

    for (let i = 0; i < protocol.signatures.length; i++) {
      const sig = protocol.signatures[i];
      const col = i % cols;
      const x = 50 + col * colWidth;
      if (col === 0 && i > 0) y -= sigHeight + 90;
      if (y < 120) break;

      try {
        const base64Data = sig.signatureData.replace(/^data:image\/\w+;base64,/, '');
        const imgBytes = Buffer.from(base64Data, 'base64');
        const img = sig.signatureData.includes('image/png')
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        page.drawImage(img, { x, y: y - sigHeight, width: sigWidth, height: sigHeight });
      } catch {}

      page.drawLine({ start: { x, y: y - sigHeight - 5 }, end: { x: x + sigWidth, y: y - sigHeight - 5 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(sig.signerName, { x, y: y - sigHeight - 18, font: fontBold, size: 10, color: rgb(0.1, 0.1, 0.1) });
      if (sig.signerRole) page.drawText(sig.signerRole, { x, y: y - sigHeight - 30, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
      const sigDateStr = new Date(sig.createdAt).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const sigTimeStr = new Date(sig.createdAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
      page.drawText(`Unterschrift vom: ${sigDateStr} um ${sigTimeStr} Uhr`, { x, y: y - sigHeight - 44, font, size: 8, color: rgb(0.5, 0.5, 0.5) });
    }

    const signedPdfBytes = await pdfDoc.save();

    // Als neue Datei speichern
    const signedFileName = `${protocol.fileName.replace('.pdf', '')}_signiert.pdf`;
    const signedFilePath = path.join(env.UPLOAD_DIR, 'protocols', signedFileName);
    fs.mkdirSync(path.dirname(signedFilePath), { recursive: true });
    fs.writeFileSync(signedFilePath, Buffer.from(signedPdfBytes));

    const signedFileUrl = `/uploads/protocols/${signedFileName}`;
    const signedTitle = `${protocol.title} (signiert)`;

    // Als neues Protokoll in DB speichern — mit parentId verknüpft
    const newProtocol = await prisma.protocol.create({
      data: {
        title: signedTitle,
        date: protocol.date,
        eventId: protocol.eventId,
        author: protocol.author,
        notes: `Signierte Version von: ${protocol.title}`,
        fileUrl: signedFileUrl,
        fileName: signedFileName,
        fileSize: signedPdfBytes.length,
        mimeType: 'application/pdf',
        parentId: req.params.id,
      } as any,
    });

    res.json({ success: true, newProtocolId: newProtocol.id });
  } catch (e: any) {
    console.error('Save-signed Fehler:', e);
    res.status(500).json({ error: e.message });
  }
});
