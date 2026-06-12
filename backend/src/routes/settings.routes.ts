import { Router, Request, Response } from 'express';
import { encrypt, decrypt, maskToken, maskSecret, prepareSecretForStorage, decryptSecret } from '../utils/crypto';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import { resetAiCache } from './ai.routes';
import fs from 'fs';
import { env } from '../config/env';
import { spawn } from 'child_process';


// ── System-Metrics (CPU + RAM) — in DB gespeichert ────────────────────────────
function sampleCpu(): void {
  const os = require('os');
  const start = os.cpus().map((c: any) => ({ ...c.times }));
  setTimeout(async () => {
    try {
      // CPU-Auslastung messen
      const end = os.cpus();
      let totalIdle = 0, totalTick = 0;
      end.forEach((cpu: any, i: number) => {
        const s = start[i];
        const idle = cpu.times.idle - s.idle;
        const total = Object.values(cpu.times).reduce((a: number, b) => a + (b as number), 0)
                    - Object.values(s).reduce((a: number, b) => a + (b as number), 0);
        totalIdle += idle;
        totalTick += total;
      });
      const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

      // RAM-Auslastung
      const ramTotal = os.totalmem();
      const ramFree  = os.freemem();
      const ramUsage = Math.round((1 - ramFree / ramTotal) * 100);

      // System-Metriken in DB speichern
      await (prisma as any).systemMetric.create({
        data: { cpuUsage, ramUsage, ramTotal: BigInt(ramTotal), ramFree: BigInt(ramFree) },
      });

      // Festplatten-Daten via df sammeln
      try {
        const { execSync: execSyncDf } = require('child_process');
        const dfOutput = execSyncDf('df -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay -x aufs 2>/dev/null || df -B1', { timeout: 5000 }).toString();
        const dfLines = dfOutput.trim().split('\n').slice(1);
        const diskData: { partition: string; total: bigint; free: bigint; used: bigint }[] = [];
        for (const dfLine of dfLines) {
          const p = dfLine.trim().split(' ').filter((x: string) => x.length > 0);
          // df format: Filesystem Size Used Avail Use% Mounted
          // df -B1 format: Filesystem 1B-blocks Used Available Use% Mounted
          if (p.length >= 6) {
            const partition = p[5]; // Mount point
            const total = BigInt(p[1] || '0');
            const used  = BigInt(p[2] || '0');
            const free  = BigInt(p[3] || '0');
            // tmpfs/run/snap Partitionen ausfiltern
            const isRealDisk = total > 1024n * 1024n * 1024n && // mind. 1 GB
              !partition.startsWith('/run') &&
              !partition.startsWith('/snap') &&
              !partition.startsWith('/sys') &&
              !partition.startsWith('/proc') &&
              !partition.startsWith('/dev/shm');
            if (isRealDisk) {
              diskData.push({ partition, total, free, used });
            }
          }
        }
        if (diskData.length > 0) {
          await (prisma as any).diskMetric.createMany({ data: diskData });
        }
      } catch (diskErr) {
        console.error('[Metrics] Festplatten-Fehler:', diskErr);
      }

      // Alte Einträge löschen (älter als 3 Jahre)
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      await (prisma as any).systemMetric.deleteMany({
        where: { timestamp: { lt: threeYearsAgo } },
      });
      await (prisma as any).diskMetric.deleteMany({
        where: { timestamp: { lt: threeYearsAgo } },
      });
    } catch (e) {
      console.error('[Metrics] Fehler beim Speichern:', e);
    }
  }, 500);
}
sampleCpu();
setInterval(sampleCpu, 60000);

const router = Router();

function publicSettings(settings: any) {
  const safe = { ...settings };
  delete safe.githubToken;
  delete safe.smtpPass;
  return {
    ...safe,
    geminiApiKey: maskSecret(settings?.geminiApiKey),
    groqApiKey: maskSecret(settings?.groqApiKey),
    openaiApiKey: maskSecret(settings?.openaiApiKey),
    hasGeminiApiKey: !!decryptSecret(settings?.geminiApiKey),
    hasGroqApiKey: !!decryptSecret(settings?.groqApiKey),
    hasOpenaiApiKey: !!decryptSecret(settings?.openaiApiKey),
  };
}

// Logo upload storage
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, 'branding');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt'));
  },
});

// GET /api/settings - public (no auth needed for login page)
router.get('/', async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: 'singleton' } });
    }
    res.json(publicSettings(settings));
  } catch (err) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// PUT /api/settings - admin only
router.put('/', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, subtitle, foundedYear, primaryColor, loginTitle, loginSubtitle, loginColor, loginBadge, loginWelcomeTitle, loginWelcomeSubtitle, loginBgColor,
            fontGeneral, fontHeadings, fontLogin, fontSidebar, fontDashboard, fontPrivacy } = req.body;
    const settings = await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { name, subtitle, foundedYear, primaryColor, loginTitle, loginSubtitle, loginColor, loginBadge, loginWelcomeTitle, loginWelcomeSubtitle, loginBgColor,
                fontGeneral, fontHeadings, fontLogin, fontSidebar, fontDashboard, fontPrivacy } as any,
      create: { id: 'singleton', name, subtitle, foundedYear, primaryColor, loginTitle, loginSubtitle, loginColor, loginBadge, loginWelcomeTitle, loginWelcomeSubtitle, loginBgColor,
                fontGeneral, fontHeadings, fontLogin, fontSidebar, fontDashboard, fontPrivacy } as any,
    });
    res.json(publicSettings(settings));
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── Favicon-Hilfsfunktion ─────────────────────────────────────────────────────
export { updateFavicons } from '../utils/updateFavicons';
import { updateFavicons } from '../utils/updateFavicons';


router.post('/logo', authenticate, authorize('ADMIN'), uploadLogo.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }

    // Delete old logo
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (existing?.logoUrl) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.logoUrl.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const logoUrl = `/uploads/branding/${req.file.filename}`;
    const settings = await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { logoUrl },
      create: { id: 'singleton', logoUrl },
    });
    // Favicons asynchron aktualisieren
    const logoPath = path.join(env.UPLOAD_DIR, 'branding', req.file.filename);
    updateFavicons(logoPath).catch(() => {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Upload' });
  }
});

// DELETE /api/settings/logo - remove logo (revert to default)
router.delete('/logo', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (existing?.logoUrl) {
      const p = path.join(env.UPLOAD_DIR, existing.logoUrl.replace('/uploads/', ''));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const settings = await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { logoUrl: null },
      create: { id: 'singleton', logoUrl: null },
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /api/settings/login-bg - upload login background image
router.post('/login-bg', authenticate, authorize('ADMIN'), uploadLogo.single('image'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild hochgeladen' }); return; }
  try {
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (existing?.loginBgImage) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.loginBgImage.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const imageUrl = `/uploads/branding/${req.file.filename}`;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { loginBgImage: imageUrl },
      create: { id: 'singleton', loginBgImage: imageUrl },
    });
    res.json({ loginBgImage: imageUrl });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/login-bg
router.delete('/login-bg', authenticate, authorize('ADMIN'), async (_req, res: Response) => {
  try {
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (existing?.loginBgImage) {
      const p = path.join(env.UPLOAD_DIR, existing.loginBgImage.replace('/uploads/', ''));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { loginBgImage: null },
      create: { id: 'singleton' },
    });
    res.json({ message: 'Hintergrundbild entfernt' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/gemini-key — Gemini API-Key speichern
router.post('/gemini-key', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { geminiApiKey } = req.body;
    const current = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const storedKey = prepareSecretForStorage(geminiApiKey, current?.geminiApiKey);
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { geminiApiKey: storedKey },
      create: { id: 'singleton', geminiApiKey: storedKey },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// GET /api/settings/manifest.json — dynamisches PWA-Manifest
router.get('/manifest.json', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    const manifest = {
      // id muss stabil bleiben – verhindert dass Chrome Android die PWA bei
      // jedem Manifest-Fetch als neue App betrachtet und neu startet
      id: '/',
      name: (settings as any)?.pwaName || settings?.name || 'Feuerwehr Verwaltung',
      short_name: (settings as any)?.pwaShortName || (settings?.name || 'Feuerwehr').substring(0, 12),
      description: `Verwaltungssystem der ${settings?.name || 'Freiwilligen Feuerwehr'}`,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: settings?.primaryColor || '#a82828',
      orientation: 'portrait-primary',
      lang: 'de-AT',
      icons: [
        { src: (settings as any)?.pwaIcon || settings?.logoUrl || '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: (settings as any)?.pwaIcon || settings?.logoUrl || '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: (settings as any)?.pwaIcon || settings?.logoUrl || '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: (settings as any)?.pwaIcon || settings?.logoUrl || '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: (settings as any)?.pwaIcon || settings?.logoUrl || '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      ],
    };
    // Cache-Control: 1 Stunde cachen – verhindert dass Chrome das Manifest
    // bei jedem Seitenaufruf neu lädt und die PWA dadurch neu startet
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(manifest);
  } catch {
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /api/settings/pwa — PWA Name + Short Name speichern
router.post('/pwa', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { pwaName, pwaShortName } = req.body;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { pwaName: pwaName || null, pwaShortName: pwaShortName || null },
      create: { id: 'singleton', pwaName: pwaName || null, pwaShortName: pwaShortName || null },
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Fehler' }); }
});

// POST /api/settings/pwa-icon — PWA Icon hochladen
const pwaIconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(env.UPLOAD_DIR, 'branding')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `pwa-icon-${Date.now()}${ext}`);
  },
});
const uploadPwaIcon = multer({
  storage: pwaIconStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilddateien erlaubt'));
  },
});

router.post('/pwa-icon', authenticate, authorize('ADMIN'), uploadPwaIcon.single('icon'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    // Altes Icon löschen
    if (existing?.pwaIcon) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.pwaIcon.replace('/uploads/', ''));
      try { require('fs').unlinkSync(oldPath); } catch {}
    }
    // Icon automatisch auf 512x512 skalieren
    const filePath = req.file.path;
    try {
      const { execSync } = require('child_process');
      execSync(`convert "${filePath}" -resize 512x512! "${filePath}"`, { timeout: 10000 });
    } catch (e) {
      console.log('[PWA-Icon] ImageMagick nicht verfügbar, Icon wird ohne Skalierung gespeichert');
    }
    const iconUrl = `/uploads/branding/${req.file.filename}`;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { pwaIcon: iconUrl },
      create: { id: 'singleton', pwaIcon: iconUrl },
    });
    res.json({ success: true, iconUrl });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/settings/pwa-icon
router.delete('/pwa-icon', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (existing?.pwaIcon) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.pwaIcon.replace('/uploads/', ''));
      try { require('fs').unlinkSync(oldPath); } catch {}
    }
    await prisma.appSettings.update({ where: { id: 'singleton' }, data: { pwaIcon: null } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/splash — Splash-Screen Einstellungen speichern
router.post('/splash', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { splashBgColor, splashTextColor } = req.body;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { splashBgColor: splashBgColor || null, splashTextColor: splashTextColor || '#333333' } as any,
      create: { id: 'singleton', splashBgColor: splashBgColor || null, splashTextColor: splashTextColor || '#333333' } as any,
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Fehler beim Speichern' }); }
});

// POST /api/settings/splash-bg — Splash Hintergrundbild hochladen
const splashBgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(env.UPLOAD_DIR, 'branding')),
  filename: (_req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `splash-bg-${Date.now()}${ext}`); },
});
const uploadSplashBg = multer({ storage: splashBgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/splash-bg', authenticate, authorize('ADMIN'), uploadSplashBg.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (existing?.splashBgImage) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.splashBgImage.replace('/uploads/', ''));
      try { require('fs').unlinkSync(oldPath); } catch {}
    }
    const imageUrl = `/uploads/branding/${req.file.filename}`;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { splashBgImage: imageUrl } as any,
      create: { id: 'singleton', splashBgImage: imageUrl } as any,
    });
    res.json({ success: true, splashBgImage: imageUrl });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/settings/splash-bg — Hintergrundbild entfernen
router.delete('/splash-bg', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (existing?.splashBgImage) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.splashBgImage.replace('/uploads/', ''));
      try { require('fs').unlinkSync(oldPath); } catch {}
    }
    await (prisma.appSettings as any).update({ where: { id: 'singleton' }, data: { splashBgImage: null } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/dashboard — Dashboard Header Einstellungen
router.post('/dashboard', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { dashboardBgColor, dashboardTextColor } = req.body;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { dashboardBgColor: dashboardBgColor || null, dashboardTextColor: dashboardTextColor || '#ffffff' } as any,
      create: { id: 'singleton', dashboardBgColor: dashboardBgColor || null, dashboardTextColor: dashboardTextColor || '#ffffff' } as any,
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Fehler beim Speichern' }); }
});

// POST /api/settings/dashboard-bg — Dashboard Hintergrundbild
const dashboardBgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(env.UPLOAD_DIR, 'branding')),
  filename: (_req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `dashboard-bg-${Date.now()}${ext}`); },
});
const uploadDashboardBg = multer({ storage: dashboardBgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/dashboard-bg', authenticate, authorize('ADMIN'), uploadDashboardBg.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (existing?.dashboardBgImage) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.dashboardBgImage.replace('/uploads/', ''));
      try { require('fs').unlinkSync(oldPath); } catch {}
    }
    const imageUrl = `/uploads/branding/${req.file.filename}`;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { dashboardBgImage: imageUrl } as any,
      create: { id: 'singleton', dashboardBgImage: imageUrl } as any,
    });
    res.json({ success: true, dashboardBgImage: imageUrl });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/dashboard-bg', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (existing?.dashboardBgImage) {
      const oldPath = path.join(env.UPLOAD_DIR, existing.dashboardBgImage.replace('/uploads/', ''));
      try { require('fs').unlinkSync(oldPath); } catch {}
    }
    await (prisma.appSettings as any).update({ where: { id: 'singleton' }, data: { dashboardBgImage: null } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/radar — Radar-Einstellungen
router.post('/radar', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { radarLat, radarLng, radarZoom, radarLayer, radarOpacity, radarSpeed, radarHeight, radarLabels, radarDarkMap, radarTitle } = req.body;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: {
        radarLat: radarLat ? parseFloat(radarLat) : 46.62,
        radarLng: radarLng ? parseFloat(radarLng) : 13.22,
        radarZoom: radarZoom ? parseInt(radarZoom) : 9,
        radarLayer: radarLayer || 'radar',
        radarOpacity: radarOpacity ? parseInt(radarOpacity) : 83,
        radarSpeed: radarSpeed ? parseInt(radarSpeed) : 4,
        radarHeight: radarHeight ? parseInt(radarHeight) : 220,
        radarLabels: !!radarLabels,
        radarDarkMap: !!radarDarkMap,
        radarTitle: radarTitle || 'Regenradar — Görtschach',
      } as any,
      create: {
        id: 'singleton',
        radarLat: 46.62, radarLng: 13.22, radarZoom: 9,
        radarLayer: 'radar', radarOpacity: 83, radarSpeed: 4,
        radarHeight: 220, radarLabels: false, radarDarkMap: false,
      } as any,
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/groq-key — Groq API-Key speichern
router.post('/groq-key', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { groqApiKey } = req.body;
    const current = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const storedKey = prepareSecretForStorage(groqApiKey, current?.groqApiKey);
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { groqApiKey: storedKey },
      create: { id: 'singleton', groqApiKey: storedKey },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// POST /api/settings/openai-key — OpenAI API-Key speichern
router.post('/openai-key', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { openaiApiKey } = req.body;
    const current = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const storedKey = prepareSecretForStorage(openaiApiKey, current?.openaiApiKey);
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { openaiApiKey: storedKey } as any,
      create: { id: 'singleton', openaiApiKey: storedKey } as any,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── GET /api/settings/github-config ──────────────────────────────────
router.get('/github-config', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const s = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    const repo = s?.githubRepo || '';
    let maskedToken = '';
    if (s?.githubToken) {
      try {
        const plain = decrypt(s.githubToken);
        maskedToken = maskToken(plain);
      } catch { maskedToken = '(Entschlüsselung fehlgeschlagen)'; }
    }
    res.json({ repo, maskedToken, hasToken: !!s?.githubToken });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/settings/github-config ──────────────────────────────────
router.put('/github-config', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { token, repo } = req.body;
    if (!token || !repo) return res.status(400).json({ error: 'Token und Repo sind erforderlich' });

    // Repo-Format validieren: "owner/repo"
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      return res.status(400).json({ error: 'Repo-Format ungültig (erwartet: owner/repo)' });
    }

    const encryptedToken = encrypt(token.trim());
    await (prisma as any).appSettings.upsert({
      where: { id: 'singleton' },
      update: { githubToken: encryptedToken, githubRepo: repo.trim() },
      create: { id: 'singleton', githubToken: encryptedToken, githubRepo: repo.trim() },
    });

    res.json({ ok: true, maskedToken: maskToken(token.trim()), repo: repo.trim() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/settings/github-test ───────────────────────────────────
router.post('/github-test', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const s = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    if (!s?.githubToken || !s?.githubRepo) {
      return res.status(400).json({ error: 'Kein Token oder Repo konfiguriert' });
    }

    let plainToken: string;
    try {
      plainToken = decrypt(s.githubToken);
    } catch {
      return res.status(500).json({ error: 'Token konnte nicht entschlüsselt werden' });
    }

    const repo = s.githubRepo;

    // GitHub API: Repo-Info
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${plainToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!repoRes.ok) {
      const err = await repoRes.json().catch(() => ({})) as any;
      return res.status(400).json({ error: err.message || `GitHub API: HTTP ${repoRes.status}` });
    }

    const repoData = await repoRes.json() as any;

    // Letzten Commit holen
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
      headers: {
        Authorization: `Bearer ${plainToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(8000),
    });

    let lastCommit: any = null;
    if (commitsRes.ok) {
      const commits = await commitsRes.json() as any[];
      if (commits.length > 0) {
        lastCommit = {
          sha: commits[0].sha?.substring(0, 7),
          message: commits[0].commit?.message?.split('\n')[0],
          date: commits[0].commit?.committer?.date,
          author: commits[0].commit?.author?.name,
        };
      }
    }

    // Lokalen HEAD-Commit ermitteln
    let localSha: string | null = null;
    try {
      // .git/HEAD direkt lesen — kein git-Befehl nötig, kein Berechtigungsproblem
      const repoDir = process.env.REPO_DIR || '/opt/feuerwehr-app';
      const headContent = fs.readFileSync(`${repoDir}/.git/HEAD`, 'utf8').trim();
      let fullSha: string;
      if (headContent.startsWith('ref: ')) {
        // z.B. "ref: refs/heads/main" → Datei lesen
        const refPath = headContent.slice(5).trim();
        fullSha = fs.readFileSync(`${repoDir}/.git/${refPath}`, 'utf8').trim();
      } else {
        fullSha = headContent; // detached HEAD
      }
      localSha = fullSha.substring(0, 7);
    } catch {}

    const upToDate = localSha && lastCommit ? localSha === lastCommit.sha : null;

    res.json({
      ok: true,
      repoName: repoData.full_name,
      isPrivate: repoData.private,
      description: repoData.description,
      lastCommit,
      localSha,
      upToDate,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/ollama-url — Ollama URL + Modell speichern
router.post('/ollama-url', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { ollamaUrl, ollamaModel } = req.body;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { ollamaUrl: ollamaUrl || null, ollamaModel: ollamaModel || 'gemma2:2b' } as any,
      create: { id: 'singleton', ollamaUrl: ollamaUrl || null, ollamaModel: ollamaModel || 'gemma2:2b' } as any,
    });
    resetAiCache();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── GET /api/settings/email-branding ─────────────────────────────────────────
router.get('/email-branding', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: { emailHeaderBg: true, emailButtonBg: true, emailFooterText: true,
                emailSubject: true, emailHeadline: true, emailBodyText: true,
                emailButtonText: true, emailHeaderImage: true, emailFont: true,
                name: true, primaryColor: true } as any,
    }) as any;
    const primaryColor = settings?.primaryColor || '#a82828';
    const name = settings?.name || 'Feuerwehr Verwaltung';
    const DEFAULT_BODY = `Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button um ein neues Passwort zu vergeben.\n\nAnleitung:\n1. Klicke auf den Button "Passwort zurücksetzen"\n2. Du wirst zur App weitergeleitet\n3. Gib dein neues Passwort zweimal ein\n4. Bestätige — du wirst danach automatisch zur Anmeldung weitergeleitet\n\nFalls du keine Anfrage gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.`;
    res.json({
      emailHeaderBg: settings?.emailHeaderBg || primaryColor,
      emailButtonBg: settings?.emailButtonBg || primaryColor,
      emailFooterText: settings?.emailFooterText || `${name} — Internes Verwaltungssystem`,
      emailSubject: settings?.emailSubject || `Passwort zurücksetzen — {{name}}`,
      emailHeadline: settings?.emailHeadline || 'Passwort zurücksetzen',
      emailBodyText: settings?.emailBodyText || DEFAULT_BODY,
      emailButtonText: settings?.emailButtonText || 'Passwort zurücksetzen →',
      emailHeaderImage: settings?.emailHeaderImage || null,
      emailFont: settings?.emailFont || 'Arial',
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/settings/email-branding ─────────────────────────────────────────
router.put('/email-branding', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { emailHeaderBg, emailButtonBg, emailFooterText,
            emailSubject, emailHeadline, emailBodyText, emailButtonText, emailFont } = req.body;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { emailHeaderBg, emailButtonBg, emailFooterText,
                emailSubject, emailHeadline, emailBodyText, emailButtonText, emailFont } as any,
      create: { id: 'singleton', emailHeaderBg, emailButtonBg, emailFooterText,
                emailSubject, emailHeadline, emailBodyText, emailButtonText, emailFont } as any,
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/settings/email-header-image ────────────────────────────────────
router.post('/email-header-image', authenticate, authorize('ADMIN'), multer({ dest: path.join(env.UPLOAD_DIR, 'branding'), limits: { fileSize: 5 * 1024 * 1024 } }).single('image'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
  try {
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `email-header-${Date.now()}.${ext}`;
    const newPath = path.join(env.UPLOAD_DIR, 'branding', filename);
    fs.renameSync(req.file.path, newPath);
    const imageUrl = `/uploads/branding/${filename}`;
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { emailHeaderImage: imageUrl } as any,
      create: { id: 'singleton', emailHeaderImage: imageUrl } as any,
    });
    res.json({ ok: true, imageUrl });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/settings/email-preview ──────────────────────────────────────────
router.get('/email-preview', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { getEmailBranding, buildPasswordResetEmailPreview } = await import('../utils/emailTemplate');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const appUrl = `${proto}://${host}`;
    const branding = await getEmailBranding(appUrl);
    const html = buildPasswordResetEmailPreview(branding);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/settings/ai-usage ───────────────────────────────────────────────
router.get('/ai-usage', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const usage = await (prisma as any).aiUsage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Gesamt pro Anbieter
    const byProvider: Record<string, { requests: number; inputTokens: number; outputTokens: number; totalTokens: number }> = {};
    // Aufschlüsselung pro Funktion + Anbieter
    const byFunction: Record<string, Record<string, { requests: number; totalTokens: number }>> = {};

    for (const u of usage) {
      // Per Provider
      if (!byProvider[u.provider]) byProvider[u.provider] = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      byProvider[u.provider].requests++;
      byProvider[u.provider].inputTokens += u.inputTokens;
      byProvider[u.provider].outputTokens += u.outputTokens;
      byProvider[u.provider].totalTokens += u.totalTokens;

      // Per Function
      const fn = u.function.replace('_section', '');
      if (!byFunction[fn]) byFunction[fn] = {};
      if (!byFunction[fn][u.provider]) byFunction[fn][u.provider] = { requests: 0, totalTokens: 0 };
      byFunction[fn][u.provider].requests++;
      byFunction[fn][u.provider].totalTokens += u.totalTokens;
    }

    res.json({ byProvider, byFunction, totalRequests: usage.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/settings/smtp ────────────────────────────────────────────────────
router.get('/smtp', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpSecure: true } as any,
    }) as any;
    res.json({
      smtpHost: settings?.smtpHost || '',
      smtpPort: settings?.smtpPort || 587,
      smtpUser: settings?.smtpUser || '',
      smtpPass: maskSecret(settings?.smtpPass),
      smtpFrom: settings?.smtpFrom || '',
      smtpSecure: settings?.smtpSecure || false,
      configured: !!(settings?.smtpHost && settings?.smtpUser && settings?.smtpPass),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/settings/smtp ────────────────────────────────────────────────────
router.put('/smtp', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, smtpSecure } = req.body;
    // Passwort nur updaten wenn nicht Placeholder
    const current = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const pass = prepareSecretForStorage(smtpPass, current?.smtpPass);

    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { smtpHost, smtpPort: parseInt(smtpPort), smtpUser, smtpPass: pass, smtpFrom, smtpSecure } as any,
      create: { id: 'singleton', smtpHost, smtpPort: parseInt(smtpPort), smtpUser, smtpPass: pass, smtpFrom, smtpSecure } as any,
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/settings/smtp-test ─────────────────────────────────────────────
router.post('/smtp-test', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  const { smtpHost, smtpPort, smtpUser, smtpFrom, smtpSecure, testEmail } = req.body;
  let { smtpPass } = req.body;

  // Wenn Frontend die maskierten Punkte schickt → echtes Passwort aus DB laden
  if (!smtpPass || String(smtpPass).includes('****') || String(smtpPass).includes('•')) {
    const current = await (prisma.appSettings as any).findUnique({ where: { id: 'singleton' } });
    smtpPass = decryptSecret(current?.smtpPass);
  } else {
    smtpPass = decryptSecret(smtpPass);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const log = (msg: string, type: 'info' | 'ok' | 'error' = 'info') => {
    res.write(`data: ${JSON.stringify({ msg, type, ts: new Date().toLocaleTimeString('de-AT') })}\n\n`);
  };

  try {
    log(`Verbinde mit ${smtpHost}:${smtpPort} (${smtpSecure ? 'SSL/TLS' : 'STARTTLS'})...`);
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      debug: false,
      logger: false,
    });

    log('TCP-Verbindung aufbauen...');
    await transporter.verify();
    log('Verbindung erfolgreich!', 'ok');
    log(`Authentifizierung als ${smtpUser} erfolgreich`, 'ok');

    if (testEmail) {
      log(`Sende Test-E-Mail an ${testEmail}...`);
      await transporter.sendMail({
        from: smtpFrom || smtpUser,
        to: testEmail,
        subject: 'SMTP Test — Feuerwehr Verwaltung',
        html: '<p>Die SMTP-Konfiguration funktioniert korrekt.</p>',
      });
      log(`E-Mail erfolgreich gesendet an ${testEmail}`, 'ok');
    }

    log('Test abgeschlossen — SMTP funktioniert', 'ok');
  } catch (e: any) {
    const msg = e.message || 'Unbekannter Fehler';
    if (msg.includes('ECONNREFUSED')) log(`Verbindung abgelehnt — Port ${smtpPort} nicht erreichbar (Firewall?)`, 'error');
    else if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) log(`Zeitüberschreitung — Server antwortet nicht (Firewall oder falscher Host?)`, 'error');
    else if (msg.includes('ENOTFOUND')) log(`Host nicht gefunden: ${smtpHost}`, 'error');
    else if (msg.includes('535') || msg.includes('Authentication')) log(`Authentifizierung fehlgeschlagen — Benutzername oder Passwort falsch`, 'error');
    else if (msg.includes('534') || msg.includes('application-specific')) log(`App-Passwort erforderlich — normales Passwort nicht erlaubt (z.B. Gmail)`, 'error');
    else log(`Fehler: ${msg}`, 'error');
  }

  res.end();
});
router.get('/ollama-ps', authenticate, async (_req: Request, res: Response) => {
  try {
    const r = await fetch('http://localhost:11434/api/ps');
    const data = await r.json();
    res.json(data);
  } catch {
    res.json({ models: [] });
  }
});

// POST /api/settings/ollama-journal-start — Ollama Status via WebSocket streamen
router.post('/ollama-journal-start', authenticate, (_req: Request, res: Response) => {
  try {
    const { broadcast } = require('../utils/websocket');
    let lastStatus = '';

    const interval = setInterval(async () => {
      try {
        const r = await fetch('http://localhost:11434/api/ps');
        const data = await r.json() as any;
        const models = data.models || [];
        if (models.length > 0) {
          const m = models[0];
          const status = `Modell: ${m.name} | RAM: ${Math.round((m.size_vram || m.size || 0) / 1024 / 1024 / 1024 * 10) / 10} GB | Status: verarbeite Anfrage...`;
          if (status !== lastStatus) {
            broadcast({ type: 'OLLAMA_LOG', line: status });
            lastStatus = status;
          }
        } else {
          const msg = 'Ollama bereit — warte auf Anfrage...';
          if (msg !== lastStatus) {
            broadcast({ type: 'OLLAMA_LOG', line: msg });
            lastStatus = msg;
          }
        }
      } catch {
        broadcast({ type: 'OLLAMA_LOG', line: 'Verbinde mit Ollama...' });
      }
    }, 2000);

    // Nach 10 Minuten stoppen
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);

    res.json({ started: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
// ── GET /api/settings/resource-limits ───────────────────────────────────────
router.get('/resource-limits', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const s = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    res.json({
      ollamaCpuLimit:   s?.ollamaCpuLimit  ?? 80,
      ollamaRamLimit:   s?.ollamaRamLimit  ?? 4,
      whisperCpuLimit:  s?.whisperCpuLimit ?? 80,
      whisperRamLimit:  s?.whisperRamLimit ?? 4,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/settings/resource-limits ───────────────────────────────────────
router.put('/resource-limits', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { ollamaCpuLimit, ollamaRamLimit, whisperCpuLimit, whisperRamLimit } = req.body;

    await (prisma as any).appSettings.upsert({
      where: { id: 'singleton' },
      update: { ollamaCpuLimit, ollamaRamLimit, whisperCpuLimit, whisperRamLimit },
      create: { id: 'singleton', ollamaCpuLimit, ollamaRamLimit, whisperCpuLimit, whisperRamLimit },
    });

    // Ollama systemd-Override aktualisieren
    const os = require('os');
    const fs = require('fs');
    const coreCount = os.cpus().length;
    // CPUQuota: Prozentsatz × Kernanzahl (z.B. 80% × 24 Kerne = 1920%)
    const cpuQuota = Math.round((ollamaCpuLimit / 100) * coreCount * 100);
    // CPUQuotaPeriod: 100ms — ohne Period greift CPUQuota nicht zuverlässig
    const ramMB = ollamaRamLimit * 1024;
    const overrideLines = [
      '[Service]',
      `CPUQuota=${cpuQuota}%`,
      'CPUQuotaPeriodSec=0.1',
      `MemoryMax=${ramMB}M`,
      `MemorySwapMax=0`,
      'Environment="OLLAMA_KEEP_ALIVE=-1"',
      '',
    ].join('\n');
    const { execSync } = require('child_process');
    const overridePath = '/etc/systemd/system/ollama.service.d/override.conf';
    const tmpPath = '/tmp/ollama-override.conf';

    try {
      // Datei zuerst in /tmp schreiben (kein sudo nötig), dann mit sudo verschieben
      fs.writeFileSync(tmpPath, overrideLines, 'utf8');
      execSync('sudo mkdir -p /etc/systemd/system/ollama.service.d', { timeout: 5000 });
      execSync(`sudo cp ${tmpPath} ${overridePath}`, { timeout: 5000 });
      execSync('sudo systemctl daemon-reload', { timeout: 10000 });
      execSync('sudo systemctl restart ollama', { timeout: 15000 });
      console.log('[ResourceLimits] Ollama systemd-Override aktualisiert:', overrideLines.replace(/\n/g, ' | '));
    } catch (ollamaErr) {
      console.error('[ResourceLimits] Ollama-Limit Fehler:', ollamaErr);
    }

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/settings/active-ai-provider ─────────────────────────────────────
router.get('/active-ai-provider', authenticate, async (_req: Request, res: Response) => {
  try {
    const settings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    res.json({ provider: settings?.activeAiProvider || 'ollama' });
  } catch { res.json({ provider: 'ollama' }); }
});

router.post('/active-ai-provider', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    const allowed = ['gemini', 'groq', 'openai', 'ollama'];
    if (!allowed.includes(provider)) {
      res.status(400).json({ error: 'Ungültiger Provider' });
      return;
    }

    const settings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    const ollamaUrl   = settings?.ollamaUrl   || 'http://localhost:11434';
    const ollamaModel = settings?.ollamaModel || 'gemma2:2b';

    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { activeAiProvider: provider } as any,
      create: { id: 'singleton', activeAiProvider: provider } as any,
    });
    resetAiCache();

    // Ollama sofort vorladen wenn als Provider gewählt
    if (provider === 'ollama') {
      res.json({ success: true });
      // Im Hintergrund vorladen
      (async () => {
        try {
          console.log(`🤖 Ollama wird aktiviert — lade Modell "${ollamaModel}"...`);
          const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: ollamaModel, prompt: 'Hi', stream: false, keep_alive: -1 }),
            signal: AbortSignal.timeout(120000),
          });
          if (response.ok) console.log(`✅ Ollama Modell "${ollamaModel}" vorgeladen!`);
        } catch (e: any) {
          console.log(`ℹ️ Ollama Vorladen fehlgeschlagen: ${e.message}`);
        }
      })();
      return;
    }

    // Ollama entladen wenn anderer Provider gewählt wird
    if (settings?.activeAiProvider === 'ollama' && provider !== 'ollama') {
      res.json({ success: true });
      // Im Hintergrund entladen — keep_alive=0 entlädt das Modell sofort
      (async () => {
        try {
          console.log(`🤖 Ollama wird deaktiviert — entlade Modell "${ollamaModel}"...`);
          await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: ollamaModel, prompt: '', keep_alive: 0 }),
            signal: AbortSignal.timeout(10000),
          });
          console.log(`✅ Ollama Modell "${ollamaModel}" entladen!`);
        } catch (e: any) {
          console.log(`ℹ️ Ollama Entladen fehlgeschlagen: ${e.message}`);
        }
      })();
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

const OLLAMA_LOG = '/tmp/ollama-install.log';
const OLLAMA_STATUS = '/tmp/ollama-install-status.json';

// GET /api/settings/ollama-status — Installationsstatus abfragen
router.get('/ollama-status', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  try {
    // Prüfen ob Ollama bereits installiert ist
    const isInstalled = fs.existsSync('/usr/local/bin/ollama') || fs.existsSync('/usr/bin/ollama');
    const status = fs.existsSync(OLLAMA_STATUS)
      ? JSON.parse(fs.readFileSync(OLLAMA_STATUS, 'utf8'))
      : { running: false, done: false };
    const log = fs.existsSync(OLLAMA_LOG) ? fs.readFileSync(OLLAMA_LOG, 'utf8') : '';
    res.json({ ...status, isInstalled, log });
  } catch {
    res.json({ running: false, done: false, isInstalled: false, log: '' });
  }
});


// GET /api/settings/ollama-live-status — Live-Status von Ollama abfragen
router.get('/ollama-live-status', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const isInstalled = fs.existsSync('/usr/local/bin/ollama') || fs.existsSync('/usr/bin/ollama');
    if (!isInstalled) return res.json({ isInstalled: false, isRunning: false });

    // Ollama API direkt abfragen
    const ollamaUrl = 'http://localhost:11434';
    
    // Läuft Ollama?
    let isRunning = false;
    let models: string[] = [];
    let runningModel: string | null = null;
    let runningModelSize: number | null = null;

    try {
      const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (tagsRes.ok) {
        isRunning = true;
        const data = await tagsRes.json() as any;
        models = (data.models || []).map((m: any) => m.name);
      }
    } catch { isRunning = false; }

    // Welches Modell läuft gerade im RAM?
    if (isRunning) {
      try {
        const psRes = await fetch(`${ollamaUrl}/api/ps`, { signal: AbortSignal.timeout(3000) });
        if (psRes.ok) {
          const data = await psRes.json() as any;
          if (data.models?.length > 0) {
            runningModel = data.models[0].name;
            runningModelSize = data.models[0].size_vram || data.models[0].size || null;
          }
        }
      } catch {}
    }

    res.json({ isInstalled, isRunning, models, runningModel, runningModelSize });
  } catch (e: any) {
    res.json({ isInstalled: false, isRunning: false, models: [], error: e.message });
  }
});


// ── GET /api/settings/system-status ──────────────────────────────────
router.get('/system-status', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  const results: Record<string, any> = {};

  // Backend — immer OK wenn wir hier sind
  results.backend = { ok: true, label: 'Backend', detail: 'Läuft' };

  // PostgreSQL
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    results.database = { ok: true, label: 'PostgreSQL', detail: 'Verbunden' };
  } catch (e: any) {
    results.database = { ok: false, label: 'PostgreSQL', detail: e.message };
  }

  // Ollama
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json() as any;
      const models = (data.models || []).map((m: any) => m.name);
      results.ollama = { ok: true, label: 'Ollama', detail: models.length > 0 ? `Modelle: ${models.join(', ')}` : 'Läuft (keine Modelle)' };
    } else {
      results.ollama = { ok: false, label: 'Ollama', detail: `HTTP ${ollamaRes.status}` };
    }
  } catch {
    results.ollama = { ok: false, label: 'Ollama', detail: 'Nicht erreichbar' };
  }

  // Whisper — Status-Datei prüfen + pip-Installation (kein sudo nötig)
  try {
    const { execSync } = require('child_process');
    const WHISPER_STATUS = '/tmp/whisper-service-status.json';

    let serviceReady = false;
    try {
      const statusRaw = fs.readFileSync(WHISPER_STATUS, 'utf8');
      const statusJson = JSON.parse(statusRaw);
      serviceReady = statusJson.ready === true;
    } catch {}

    if (serviceReady) {
      const settings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      const model = settings?.whisperModel || 'medium';
      results.whisper = { ok: true, label: 'Whisper', detail: `Bereit · Modell: ${model}` };
    } else {
      try {
        const pipOut = execSync('pip3 list 2>/dev/null | grep -i faster-whisper', { timeout: 5000 }).toString().trim();
        if (pipOut) {
          const version = pipOut.split(/\s+/)[1] || '';
          results.whisper = { ok: true, label: 'Whisper', detail: `Installiert${version ? ' v' + version : ''} · Service gestoppt` };
        } else {
          results.whisper = { ok: false, label: 'Whisper', detail: 'Nicht installiert' };
        }
      } catch {
        results.whisper = { ok: false, label: 'Whisper', detail: 'Nicht installiert' };
      }
    }
  } catch {
    results.whisper = { ok: false, label: 'Whisper', detail: 'Fehler' };
  }

  // Nginx

  // Nginx — check via systemctl or port
  try {
    const { execSync } = require('child_process');
    // Try systemctl first
    try {
      const systemctlOut = execSync('systemctl is-active nginx 2>/dev/null || systemctl is-active nginx.service 2>/dev/null', { timeout: 3000 }).toString().trim();
      if (systemctlOut === 'active') {
        results.nginx = { ok: true, label: 'Nginx', detail: 'Dienst aktiv' };
      } else {
        throw new Error('not active');
      }
    } catch {
      // Fallback: check port without -p flag
      const portOut = execSync('ss -tln 2>/dev/null | grep -E " :80 | :443 | :80$| :443$" | head -1', { timeout: 3000 }).toString();
      if (portOut.trim()) {
        results.nginx = { ok: true, label: 'Nginx', detail: 'Port 80/443 aktiv' };
      } else {
        // Try nginx -t
        try {
          execSync('nginx -t 2>/dev/null', { timeout: 3000 });
          results.nginx = { ok: true, label: 'Nginx', detail: 'Konfiguration OK' };
        } catch {
          results.nginx = { ok: false, label: 'Nginx', detail: 'Nicht erreichbar' };
        }
      }
    }
  } catch {
    results.nginx = { ok: false, label: 'Nginx', detail: 'Nicht prüfbar' };
  }

  // CPU — Kerne + Modell + Auslastung
  try {
    const os = require('os');
    const cpus = os.cpus();
    const model = cpus[0]?.model?.trim() || 'Unbekannt';
    const cores = cpus.length;

    // CPU-Auslastung: zwei Messungen mit 200ms Abstand
    const cpuUsage = await new Promise<number>((resolve) => {
      const start = os.cpus().map((c: any) => ({ ...c.times }));
      setTimeout(() => {
        const end = os.cpus();
        let totalIdle = 0, totalTick = 0;
        end.forEach((cpu: any, i: number) => {
          const s = start[i];
          const idle = cpu.times.idle - s.idle;
          const total = Object.values(cpu.times).reduce((a: number, b) => a + (b as number), 0)
                      - Object.values(s).reduce((a: number, b) => a + (b as number), 0);
          totalIdle += idle;
          totalTick += total;
        });
        resolve(Math.round((1 - totalIdle / totalTick) * 100));
      }, 200);
    });

    results.cpu = {
      ok: true,
      label: 'Prozessor',
      detail: `${cores} Kerne · ${model} · Auslastung: ${cpuUsage}%`,
      cores, model, usage: cpuUsage,
    };
  } catch (e: any) {
    results.cpu = { ok: true, label: 'Prozessor', detail: 'Keine Daten' };
  }

  // HDD-Speicher — /var/www Partition
  try {
    const { execSync } = require('child_process');
    const dfOut = execSync("df -B1 /var/www/feuerwehr-app 2>/dev/null || df -B1 / 2>/dev/null", { timeout: 3000 }).toString();
    const lines = dfOut.trim().split('\n');
    const parts = lines[1]?.trim().split(/\s+/);
    if (parts && parts.length >= 4) {
      const total = parseInt(parts[1]);
      const used  = parseInt(parts[2]);
      const free  = parseInt(parts[3]);
      const pct   = Math.round((used / total) * 100);
      const gb    = (b: number) => (b / 1024 / 1024 / 1024).toFixed(1) + ' GB';
      results.disk = {
        ok: pct < 95,
        label: 'Festplatte',
        detail: `Gesamt: ${gb(total)} · Belegt: ${gb(used)} (${pct}%) · Frei: ${gb(free)}`,
        total, used, free, percent: pct,
        warning: pct >= 85 && pct < 95,
      };
    } else {
      results.disk = { ok: true, label: 'Festplatte', detail: 'Keine Daten' };
    }
  } catch {
    results.disk = { ok: true, label: 'Festplatte', detail: 'Nicht prüfbar' };
  }

  // ── RAM ──────────────────────────────────────────────────────────────
  try {
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;
    const pct      = Math.round((usedMem / totalMem) * 100);
    const gb       = (b: number) => (b / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    results.ram = {
      ok: pct < 90,
      label: 'RAM',
      detail: `Gesamt: ${gb(totalMem)} · Belegt: ${gb(usedMem)} (${pct}%) · Frei: ${gb(freeMem)}`,
      total: totalMem, used: usedMem, free: freeMem, percent: pct,
    };
  } catch {
    results.ram = { ok: true, label: 'RAM', detail: 'Keine Daten' };
  }

  // ── Uptime ────────────────────────────────────────────────────────────
  try {
    const os = require('os');
    const uptimeSec = os.uptime();
    const days    = Math.floor(uptimeSec / 86400);
    const hours   = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const parts   = [];
    if (days > 0)    parts.push(`${days} Tag${days !== 1 ? 'e' : ''}`);
    if (hours > 0)   parts.push(`${hours} Std`);
    if (minutes > 0) parts.push(`${minutes} Min`);
    results.uptime = { ok: true, label: 'Laufzeit', detail: parts.join(', ') || 'Gerade gestartet', seconds: uptimeSec };
  } catch {
    results.uptime = { ok: true, label: 'Laufzeit', detail: 'Keine Daten' };
  }

  // ── Datenbankgröße ───────────────────────────────────────────────────
  try {
    const dbSize = await (prisma as any).$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes`;
    const size = (dbSize as any)[0];
    results.dbsize = { ok: true, label: 'Datenbankgröße', detail: size.size, bytes: Number(size.bytes) };
  } catch {
    results.dbsize = { ok: true, label: 'Datenbankgröße', detail: 'Keine Daten' };
  }

  // ── Aktive User (Sessions in letzten 24h) ────────────────────────────
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeCount = await (prisma as any).user.count({
      where: { lastLogin: { gte: since } },
    }).catch(() => 0);
    results.activeUsers = { ok: true, label: 'Aktive User', detail: `${activeCount} User in den letzten 24h`, count: activeCount };
  } catch {
    results.activeUsers = { ok: true, label: 'Aktive User', detail: 'Keine Daten' };
  }

  // ── Letztes Backup ───────────────────────────────────────────────────
  try {
    const { execSync } = require('child_process');
    const backupDir = process.env.BACKUP_DIR || '/var/backups/feuerwehr';
    const lsOut = execSync(`ls -t "${backupDir}"/*.zip 2>/dev/null | head -1`, { timeout: 3000 }).toString().trim();
    if (lsOut) {
      const statOut = execSync(`stat -c %Y "${lsOut}" 2>/dev/null`, { timeout: 3000 }).toString().trim();
      const backupTime = new Date(parseInt(statOut) * 1000);
      const diffH = Math.round((Date.now() - backupTime.getTime()) / 3600000);
      results.lastBackup = {
        ok: diffH < 48,
        label: 'Letztes Backup',
        detail: backupTime.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        hoursAgo: diffH,
      };
    } else {
      results.lastBackup = { ok: false, label: 'Letztes Backup', detail: 'Kein Backup gefunden' };
    }
  } catch {
    results.lastBackup = { ok: true, label: 'Letztes Backup', detail: 'Nicht prüfbar' };
  }

  // ── Netzwerk-Traffic ─────────────────────────────────────────────────
  try {
    const fs2 = require('fs');
    const netRaw = fs2.readFileSync('/proc/net/dev', 'utf8');
    const lines = netRaw.split('\n').filter((l: string) => l.includes(':') && !l.includes('lo:'));
    let rxTotal = 0, txTotal = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      rxTotal += parseInt(parts[1]) || 0;
      txTotal += parseInt(parts[9]) || 0;
    }
    const fmt = (b: number) => b > 1073741824 ? (b/1073741824).toFixed(1)+' GB' : b > 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';
    results.network = { ok: true, label: 'Netzwerk', detail: `↓ ${fmt(rxTotal)} · ↑ ${fmt(txTotal)}`, rx: rxTotal, tx: txTotal };
  } catch {
    results.network = { ok: true, label: 'Netzwerk', detail: 'Keine Daten' };
  }

  // ── Offene Verbindungen ──────────────────────────────────────────────
  try {
    const { execSync } = require('child_process');
    const ssOut = execSync('ss -tn state established 2>/dev/null | tail -n +2 | wc -l', { timeout: 3000 }).toString().trim();
    const count = parseInt(ssOut) || 0;
    results.connections = { ok: true, label: 'Verbindungen', detail: `${count} aktive TCP-Verbindungen`, count };
  } catch {
    results.connections = { ok: true, label: 'Verbindungen', detail: 'Keine Daten' };
  }

  // ── Metrics History wird per separatem Endpoint abgefragt ──────────
  res.json(results);
});

// ── GET /api/settings/metrics — CPU+RAM History aus DB ───────────────────────
router.get('/metrics', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || '1h';

    // Zeitraum berechnen
    const now = new Date();
    let since: Date | null = null;
    switch (range) {
      case '1h':  since = new Date(now.getTime() - 60 * 60 * 1000); break;
      case '24h': since = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7d':  since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '1y':  since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      case '2y':  since = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000); break;
      case '3y':  since = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000); break;
      case 'all': since = null; break;
    }

    const where = since ? { timestamp: { gte: since } } : {};

    // Datenpunkte laden
    let rows = await (prisma as any).systemMetric.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, cpuUsage: true, ramUsage: true, ramTotal: true },
    });

    // Aggregieren wenn zu viele Datenpunkte (max 500 für den Graph)
    const MAX_POINTS = 500;
    if (rows.length > MAX_POINTS) {
      const step = Math.ceil(rows.length / MAX_POINTS);
      rows = rows.filter((_: any, i: number) => i % step === 0);
    }

    // BigInt → Number konvertieren
    const data = rows.map((r: any) => ({
      timestamp: r.timestamp.toISOString(),
      cpuUsage: r.cpuUsage,
      ramUsage: r.ramUsage,
      ramTotal: Number(r.ramTotal),
    }));

    // Ältesten und neuesten Timestamp für "Gesamt" Info
    const oldest = await (prisma as any).systemMetric.findFirst({ orderBy: { timestamp: 'asc' }, select: { timestamp: true } });
    const newest = await (prisma as any).systemMetric.findFirst({ orderBy: { timestamp: 'desc' }, select: { timestamp: true } });

    res.json({
      data,
      range,
      total: data.length,
      oldest: oldest?.timestamp?.toISOString() || null,
      newest: newest?.timestamp?.toISOString() || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/settings/disk-metrics — Festplatten-Verlauf ─────────────────────
router.get('/disk-metrics', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const range     = (req.query.range as string) || '1h';
    const partition = req.query.partition as string | undefined;

    const now = new Date();
    let since: Date | null = null;
    switch (range) {
      case '1h':  since = new Date(now.getTime() - 60 * 60 * 1000); break;
      case '24h': since = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7d':  since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '1y':  since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      case '2y':  since = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000); break;
      case '3y':  since = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000); break;
      case 'all': since = null; break;
    }

    const where: any = since ? { timestamp: { gte: since } } : {};
    if (partition) where.partition = partition;

    // Alle verfügbaren Partitionen
    const partitions = await (prisma as any).diskMetric.findMany({
      where: since ? { timestamp: { gte: since } } : {},
      select: { partition: true },
      distinct: ['partition'],
      orderBy: { partition: 'asc' },
    });
    const partitionList = partitions.map((p: any) => p.partition);

    // Pro Partition Datenpunkte laden
    const result: Record<string, any[]> = {};
    const MAX_POINTS = 300;

    for (const part of partitionList) {
      let rows = await (prisma as any).diskMetric.findMany({
        where: { ...where, partition: part },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true, total: true, free: true, used: true },
      });
      if (rows.length > MAX_POINTS) {
        const step = Math.ceil(rows.length / MAX_POINTS);
        rows = rows.filter((_: any, i: number) => i % step === 0);
      }
      result[part] = rows.map((r: any) => ({
        timestamp: r.timestamp.toISOString(),
        total: Number(r.total),
        free:  Number(r.free),
        used:  Number(r.used),
      }));
    }

    // Aktueller Zustand (neuester Eintrag pro Partition)
    const current: Record<string, any> = {};
    for (const part of partitionList) {
      const latest = await (prisma as any).diskMetric.findFirst({
        where: { partition: part },
        orderBy: { timestamp: 'desc' },
        select: { total: true, free: true, used: true, timestamp: true },
      });
      if (latest) current[part] = {
        total: Number(latest.total),
        free:  Number(latest.free),
        used:  Number(latest.used),
        timestamp: latest.timestamp.toISOString(),
      };
    }

    const oldest = await (prisma as any).diskMetric.findFirst({ orderBy: { timestamp: 'asc' }, select: { timestamp: true } });
    const newest = await (prisma as any).diskMetric.findFirst({ orderBy: { timestamp: 'desc' }, select: { timestamp: true } });

    res.json({
      partitions: partitionList,
      data: result,
      current,
      range,
      oldest: oldest?.timestamp?.toISOString() || null,
      newest: newest?.timestamp?.toISOString() || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/ollama-install — Ollama installieren
router.post('/ollama-install', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  try {
    const existing = fs.existsSync(OLLAMA_STATUS)
      ? JSON.parse(fs.readFileSync(OLLAMA_STATUS, 'utf8'))
      : {};
    if (existing.running) {
      res.json({ started: false, message: 'Installation läuft bereits' });
      return;
    }

    // Alte Dateien löschen damit root sie neu anlegen kann
    try { fs.unlinkSync(OLLAMA_STATUS); } catch {}
    try { fs.unlinkSync(OLLAMA_LOG); } catch {}
    fs.writeFileSync(OLLAMA_STATUS, JSON.stringify({ running: true, done: false, error: null, startedAt: new Date().toISOString() }));
    fs.chmodSync(OLLAMA_STATUS, 0o666);
    fs.writeFileSync(OLLAMA_LOG, '');
    fs.chmodSync(OLLAMA_LOG, 0o666);

    const child = spawn('sudo', ['/usr/local/bin/fw-ollama-install'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logStream = fs.createWriteStream(OLLAMA_LOG, { flags: 'a' });
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    child.on('exit', (code) => {
      const log = fs.existsSync(OLLAMA_LOG) ? fs.readFileSync(OLLAMA_LOG, 'utf8') : '';
      const success = code === 0 && log.includes('erfolgreich installiert');
      fs.writeFileSync(OLLAMA_STATUS, JSON.stringify({
        running: false,
        done: true,
        success,
        exitCode: code,
        error: success ? null : `Exit code: ${code}`,
        finishedAt: new Date().toISOString(),
      }));
    });

    child.unref();
    res.json({ started: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/ollama-pull — Modell herunterladen
router.post('/ollama-pull', authenticate, authorize('ADMIN'), (req: Request, res: Response) => {
  try {
    const { model } = req.body;
    if (!model) { res.status(400).json({ error: 'Kein Modell angegeben' }); return; }

    const PULL_LOG = `/tmp/ollama-pull-${model.replace(/[^a-z0-9]/gi, '_')}.log`;
    const PULL_STATUS = `/tmp/ollama-pull-status.json`;

    const existing = fs.existsSync(PULL_STATUS)
      ? JSON.parse(fs.readFileSync(PULL_STATUS, 'utf8'))
      : {};
    if (existing.running) {
      res.json({ started: false, message: 'Download läuft bereits' });
      return;
    }

    // Alte Log- und Status-Datei zuerst löschen, dann neu anlegen
    try { fs.unlinkSync(PULL_LOG); } catch {}
    try { fs.unlinkSync(PULL_STATUS); } catch {}
    fs.writeFileSync(PULL_STATUS, JSON.stringify({ running: true, done: false, model, startedAt: new Date().toISOString() }));
    fs.writeFileSync(PULL_LOG, '');
    fs.chmodSync(PULL_LOG, 0o666);

    const child = spawn('sudo', ['/usr/local/bin/fw-ollama-pull', model], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // \r-basierten Fortschritt sauber verarbeiten: nur letzte Zeile pro \r-Block behalten
    const processChunk = (data: Buffer) => {
      const text = data.toString();
      // Zeilen an \r und \n splitten, letzte nicht-leere Zeile pro Block nehmen
      const lines = text.split(/\r?\n|\r/);
      const meaningful = lines.filter(l => l.trim().length > 0);
      if (meaningful.length > 0) {
        fs.appendFileSync(PULL_LOG, meaningful[meaningful.length - 1] + '\n');
      }
    };
    child.stdout?.on('data', processChunk);
    child.stderr?.on('data', processChunk);

    child.on('exit', (code) => {
      fs.writeFileSync(PULL_STATUS, JSON.stringify({
        running: false, done: true, model,
        success: code === 0,
        exitCode: code,
        finishedAt: new Date().toISOString(),
      }));
    });

    child.unref();
    res.json({ started: true, logFile: PULL_LOG });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/ollama-pull-status — Pull-Status abfragen
router.get('/ollama-pull-status', authenticate, authorize('ADMIN'), (req: Request, res: Response) => {
  try {
    const { model } = req.query as { model: string };
    const PULL_LOG = `/tmp/ollama-pull-${(model || '').replace(/[^a-z0-9]/gi, '_')}.log`;
    const PULL_STATUS = '/tmp/ollama-pull-status.json';
    const status = fs.existsSync(PULL_STATUS) ? JSON.parse(fs.readFileSync(PULL_STATUS, 'utf8')) : { running: false, done: false };
    const rawLog = fs.existsSync(PULL_LOG) ? fs.readFileSync(PULL_LOG, 'utf8') : '';
    // Letzten Fortschritt-Prozentsatz extrahieren (z.B. " 45% ▕███...")
    const lines = rawLog.split('\n').filter(l => l.trim());
    const log = lines.slice(-20).join('\n');
    const lastLine = lines[lines.length - 1] || '';
    const pctMatch = lastLine.match(/(\d+)%/);
    const percent = pctMatch ? parseInt(pctMatch[1]) : null;
    res.json({ ...status, log, percent });
  } catch {
    res.json({ running: false, done: false, log: '', percent: null });
  }
});

// GET /api/settings/ollama-pull-stream — Live SSE Stream für Ollama Pull
router.get('/ollama-pull-stream', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  const model = req.query.model as string;
  if (!model) { res.status(400).json({ error: 'Kein Modell angegeben' }); return; }

  const ollamaUrl = 'http://localhost:11434';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const response = await fetch(`${ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
    });

    if (!response.ok || !response.body) {
      send({ error: `Ollama API Fehler: HTTP ${response.status}`, done: true });
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          // Prozentsatz berechnen
          let percent: number | null = null;
          if (json.total && json.completed) {
            percent = Math.round((json.completed / json.total) * 100);
          }
          send({ status: json.status, percent, completed: json.completed, total: json.total });
        } catch {}
      }
    }

    send({ status: 'success', done: true, percent: 100 });
  } catch (e: any) {
    send({ error: e.message, done: true });
  }

  res.end();
});

// ── Einsatz-Navigation Schnellwahl ───────────────────────────────────────────
router.get('/nav-quick-places', authenticate, async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    const raw = (settings as any)?.navQuickPlaces;
    let places = [];
    try { places = JSON.parse(raw || '[]'); } catch {}
    res.json(places);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/nav-quick-places', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { places } = req.body;
    if (!Array.isArray(places)) { res.status(400).json({ error: 'places muss ein Array sein' }); return; }
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { navQuickPlaces: JSON.stringify(places) } as any,
      create: { id: 'singleton', navQuickPlaces: JSON.stringify(places) } as any,
    });
    res.json({ ok: true, places });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


export default router;


