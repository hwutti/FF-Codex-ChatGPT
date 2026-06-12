import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { broadcast } from '../utils/websocket';
import { sendPushToUser, sendPushToAll } from './push.routes';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/crypto';

const prisma = new PrismaClient();

const execAsync = promisify(exec);
const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN'));

const REPO_DIR = '/opt/feuerwehr-app';
const UPDATE_LOG = '/tmp/feuerwehr-update.log';
const UPDATE_STATUS = '/tmp/feuerwehr-update-status.json';

// ── Authenticated Git URL aus DB ──────────────────────────────────────────────
async function getAuthenticatedGitUrl(): Promise<string | null> {
  try {
    const s = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    if (!s?.githubToken || !s?.githubRepo) return null;
    const token = decrypt(s.githubToken);
    return `https://${token}@github.com/${s.githubRepo}.git`;
  } catch { return null; }
}

// Git-Fetch mit Token (setzt Remote temporär, fetcht, stellt zurück)
async function gitFetchWithToken(): Promise<void> {
  const authUrl = await getAuthenticatedGitUrl();
  if (authUrl) {
    // Token direkt in der fetch-URL — keine Config-Änderung nötig, kein set-url
    await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" fetch "${authUrl}" main:refs/remotes/origin/main`);
  } else {
    // Kein Token — normaler fetch
    await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" fetch origin main`);
  }
}
const ANNOUNCE_STATUS = '/tmp/feuerwehr-announce-status.json';

let announceTimer: NodeJS.Timeout | null = null;

// ── Timer-Wiederherstellung beim Start ────────────────────────────────────────
// Falls der Prozess während einer laufenden Ankündigung neu gestartet wurde,
// den Timer anhand der gespeicherten startedAt-Zeit wiederherstellen
function restoreAnnounceTimer() {
  try {
    if (!fs.existsSync(ANNOUNCE_STATUS)) return;
    const status = JSON.parse(fs.readFileSync(ANNOUNCE_STATUS, 'utf8'));
    if (!status.announced || !status.startedAt) return;
    const elapsed = Math.floor((Date.now() - new Date(status.startedAt).getTime()) / 1000);
    const remaining = (status.countdown || 300) - elapsed;
    if (remaining <= 0) {
      // Zeit bereits abgelaufen → sofort starten
      console.log('⚡ Ankündigung abgelaufen — Update wird sofort gestartet');
      fs.unlinkSync(ANNOUNCE_STATUS);
      runUpdate();
    } else {
      // Timer neu setzen für verbleibende Zeit
      console.log(`⏰ Ankündigung wiederhergestellt — Update in ${remaining}s`);
      announceTimer = setTimeout(() => { runUpdate(); }, remaining * 1000);
    }
  } catch (e) {
    console.error('Fehler beim Wiederherstellen des Announce-Timers:', e);
  }
}
restoreAnnounceTimer();

// ── VERSION INFO ──────────────────────────────────────────────────────────────
router.get('/version', async (_req, res: Response) => {
  try {
    let currentCommit = 'unknown';
    let currentDate = 'unknown';
    try {
      const { stdout } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse --short HEAD`);
      currentCommit = stdout.trim();
      const { stdout: dateOut } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" log -1 --format=%ci HEAD`);
      currentDate = dateOut.trim();
    } catch {}
    res.json({ currentCommit, currentDate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CHECK FOR UPDATES ─────────────────────────────────────────────────────────
router.get('/check', async (_req, res: Response) => {
  try {
    await gitFetchWithToken();
    const { stdout: currentHash } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse HEAD`);
    const { stdout: remoteHash } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse origin/main`);
    const { stdout: remoteShort } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse --short origin/main`);
    const { stdout: currentShort } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse --short HEAD`);

    const upToDate = currentHash.trim() === remoteHash.trim();
    let remoteVersion = '2.2.0';
    try {
      const { stdout: remotePkg } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" show origin/main:backend/package.json`);
      remoteVersion = JSON.parse(remotePkg).version || remoteVersion;
    } catch {}

    let changelog: string[] = [];
    if (!upToDate) {
      try {
        const { stdout: log } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" log --oneline HEAD..origin/main --no-merges`);
        changelog = log.trim().split('\n').filter(Boolean).slice(0, 10);
      } catch {}
    }

    res.json({ upToDate, currentCommit: currentShort.trim(), remoteCommit: remoteShort.trim(), remoteVersion, changelog });
  } catch (err: any) {
    res.status(500).json({ error: `Prüfung fehlgeschlagen: ${err.message}` });
  }
});

// ── ANNOUNCE UPDATE (5 Min Countdown) ────────────────────────────────────────
router.post('/announce', async (_req, res: Response) => {
  try {
    // Check if update already running
    if (fs.existsSync(UPDATE_STATUS)) {
      const status = JSON.parse(fs.readFileSync(UPDATE_STATUS, 'utf8'));
      if (status.running) { res.status(409).json({ error: 'Update läuft bereits' }); return; }
    }

    const countdown = 5 * 60; // 5 Minuten
    const startedAt = new Date().toISOString();

    // Speichere Announce-Status
    fs.writeFileSync(ANNOUNCE_STATUS, JSON.stringify({ announced: true, countdown, startedAt }));

    // Broadcast an alle User via WebSocket
    broadcast({
      type: 'UPDATE_ANNOUNCED',
      countdown,
      message: 'Ein System-Update wird in 5 Minuten eingespielt. Bitte alle offenen Punkte speichern!',
      startedAt,
    });

    // Push-Benachrichtigung an alle User mit pushUpdate=true
    try {
      const subscribers = await (prisma as any).user.findMany({
        where: { pushSubscriptions: { some: {} } },
        include: { pushSettings: true, pushSubscriptions: true },
      });
      for (const user of subscribers) {
        if (user.pushSettings?.pushUpdate) {
          await sendPushToUser(user, {
            title: '🔄 App-Update in 5 Minuten',
            body: 'Bitte alle offenen Eingaben speichern. Die App wird kurz nicht erreichbar sein.',
            url: '/',
          }).catch(() => {});
        }
      }
    } catch (pushErr: any) { console.log('[REBOOT] Push-Query Fehler:', pushErr.message); }

    // Timer: nach 5 Min automatisch starten
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      runUpdate();
    }, countdown * 1000);

    res.json({ message: 'Update angekündigt', countdown, startedAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CANCEL ANNOUNCED UPDATE ───────────────────────────────────────────────────
router.post('/cancel', async (_req, res: Response) => {
  try {
    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = null;
    }
    if (fs.existsSync(ANNOUNCE_STATUS)) fs.unlinkSync(ANNOUNCE_STATUS);

    broadcast({
      type: 'UPDATE_CANCELLED',
      message: 'Das angekündigte Update wurde abgebrochen.',
    });

    res.json({ message: 'Update abgebrochen' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── START UPDATE SOFORT ───────────────────────────────────────────────────────
router.post('/start', async (_req, res: Response) => {
  try {
    if (fs.existsSync(UPDATE_STATUS)) {
      const status = JSON.parse(fs.readFileSync(UPDATE_STATUS, 'utf8'));
      if (status.running) { res.status(409).json({ error: 'Update läuft bereits' }); return; }
    }
    // Cancel announce timer if running
    if (announceTimer) { clearTimeout(announceTimer); announceTimer = null; }
    if (fs.existsSync(ANNOUNCE_STATUS)) fs.unlinkSync(ANNOUNCE_STATUS);

    runUpdate();
    res.json({ message: 'Update gestartet' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ANNOUNCE STATUS ───────────────────────────────────────────────────────────
router.get('/announce-status', (_req, res: Response) => {
  try {
    if (!fs.existsSync(ANNOUNCE_STATUS)) { res.json({ announced: false }); return; }
    const status = JSON.parse(fs.readFileSync(ANNOUNCE_STATUS, 'utf8'));
    res.json(status);
  } catch {
    res.json({ announced: false });
  }
});

// ── UPDATE STATUS + LOG ───────────────────────────────────────────────────────
router.get('/status', (_req, res: Response) => {
  try {
    const status = fs.existsSync(UPDATE_STATUS)
      ? JSON.parse(fs.readFileSync(UPDATE_STATUS, 'utf8'))
      : { running: false, done: false };
    const log = fs.existsSync(UPDATE_LOG) ? fs.readFileSync(UPDATE_LOG, 'utf8') : '';
    res.json({ ...status, log });
  } catch {
    res.json({ running: false, done: false, log: '' });
  }
});

// ── HELPER: Update tatsächlich ausführen ──────────────────────────────────────
function runUpdate() {
  broadcast({
    type: 'UPDATE_STARTING',
    message: 'Update wird jetzt eingespielt...',
  });

  fs.writeFileSync(UPDATE_STATUS, JSON.stringify({ running: true, startedAt: new Date().toISOString(), done: false, error: null }));
  fs.writeFileSync(UPDATE_LOG, '');

  const child = spawn('sudo', ['/usr/local/bin/fw-update'], {
    detached: true,
    stdio: ['ignore', fs.openSync(UPDATE_LOG, 'w'), fs.openSync(UPDATE_LOG, 'a')],
  });

  child.on('exit', (code) => {
    const log = fs.existsSync(UPDATE_LOG) ? fs.readFileSync(UPDATE_LOG, 'utf8') : '';
    const hasSuccess = log.includes('Update erfolgreich abgeschlossen');
    // Nur explizite Script-Fehler zählen, nicht npm warnings oder nginx-Meldungen
    const hasError = log.includes('✗ FEHLER:') || log.includes('Update abgebrochen');
    // code=null bedeutet der Prozess wurde durch Signal beendet (Backend-Neustart killt spawn)
    // → hasSuccess im Log ist die zuverlässigste Quelle
    const success = hasSuccess && !hasError;
    fs.writeFileSync(UPDATE_STATUS, JSON.stringify({
      running: false,
      done: true,
      exitCode: success ? 0 : (code ?? -1),
      error: success ? null : `Exit code: ${code} — siehe Log`,
      finishedAt: new Date().toISOString(),
    }));
  });

  child.unref();
}

// ── GET /api/update/os-check — Betriebssystem-Updates prüfen ────────────────
router.get('/os-check', async (_req: Request, res: Response) => {
  const sudoPrefix = 'sudo -n';
  try {
    // apt-get update (nur Paketliste, kein Install)
    await execAsync(`${sudoPrefix} /usr/bin/apt-get update -qq 2>/dev/null`).catch(() => {});

    // Alle verfügbaren Updates
    const { stdout: allOut } = await execAsync(
      `${sudoPrefix} /usr/bin/apt list --upgradable 2>/dev/null | grep -v "Listing..." | wc -l`
    ).catch(() => ({ stdout: '0' }));

    // Sicherheits-Updates separat
    const { stdout: secOut } = await execAsync(
      `${sudoPrefix} /usr/bin/apt list --upgradable 2>/dev/null | grep -i "security" | wc -l`
    ).catch(() => ({ stdout: '0' }));

    // Liste der Pakete (max 20)
    const { stdout: listOut } = await execAsync(
      `${sudoPrefix} /usr/bin/apt list --upgradable 2>/dev/null | grep -v "Listing..." | head -20`
    ).catch(() => ({ stdout: '' }));

    const total    = parseInt(allOut.trim()) || 0;
    const security = parseInt(secOut.trim()) || 0;
    const packages = listOut.trim().split("\n").filter(Boolean).map((line: string) => {
      const parts = line.split('/');
      return parts[0] || line;
    });

    // Zurückgehaltene Pakete (brauchen dist-upgrade)
    const { stdout: heldOut } = await execAsync(
      'sudo -n /usr/bin/apt-get dist-upgrade --simulate 2>/dev/null | grep "^Inst" | wc -l'
    ).catch(() => ({ stdout: '0' }));
    const held = parseInt(heldOut.trim()) || 0;

    res.json({ total, security, packages, upToDate: total === 0 && held === 0, held });
  } catch (e: any) {
    res.json({ total: 0, security: 0, packages: [], upToDate: true, error: e.message });
  }
});

// ── GET /api/update/os-log — SSE Stream für OS-Update Live-Log ──────────────
let osUpdateLog: string[] = [];
let osUpdateRunning = false;
let osUpdateDone = false;
let osUpdateSuccess = false;
let osUpdateClients: Response[] = [];

router.get('/os-log', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Bereits vorhandene Logs senden
  for (const line of osUpdateLog) {
    res.write(`data: ${JSON.stringify({ line })}

`);
  }
  if (osUpdateDone) {
    res.write(`data: ${JSON.stringify({ done: true, success: osUpdateSuccess })}

`);
    res.end();
    return;
  }

  osUpdateClients.push(res);
  req.on('close', () => {
    osUpdateClients = osUpdateClients.filter(c => c !== res);
  });
});

// ── POST /api/update/os-install — Betriebssystem updaten mit Live-Log ────────
router.post('/os-install', async (_req: Request, res: Response) => {
  if (osUpdateRunning) { res.json({ started: false, message: 'Update läuft bereits' }); return; }

  osUpdateLog = [];
  osUpdateRunning = true;
  osUpdateDone = false;
  osUpdateSuccess = false;
  res.json({ started: true });

  const broadcastLine = (line: string) => {
    osUpdateLog.push(line);
    for (const client of osUpdateClients) {
      client.write(`data: ${JSON.stringify({ line })}

`);
    }
  };

  const { spawn } = require('child_process');
  // sudoers must allow this command without an interactive password prompt.
  const child = spawn('sudo', ['-n',
    '/usr/bin/apt-get', 'upgrade', '-y',
    '-o', 'Dpkg::Options::=--force-confdef',
    '-o', 'Dpkg::Options::=--force-confold',
    '-o', 'APT::Color=0',
  ], { env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }, stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (data: Buffer) => {
    data.toString().split("\n").filter((l: string) => l.trim()).forEach(broadcastLine);
  });
  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes('[sudo]') && !line.includes('password')) broadcastLine(line);
  });
  child.on('close', (code: number) => {
    osUpdateRunning = false;
    osUpdateDone = true;
    osUpdateSuccess = code === 0;
    broadcastLine(code === 0 ? '✓ Update erfolgreich abgeschlossen!' : `✗ Update fehlgeschlagen (Exit ${code})`);
    for (const client of osUpdateClients) {
      client.write(`data: ${JSON.stringify({ done: true, success: osUpdateSuccess })}

`);
      client.end();
    }
    osUpdateClients = [];
    broadcast({ type: osUpdateSuccess ? 'OS_UPDATE_DONE' : 'OS_UPDATE_ERROR' });
  });
});

// ── POST /api/update/reboot — Server neu starten mit Countdown ───────────────
let rebootTimer: NodeJS.Timeout | null = null;

router.post('/reboot', async (req: Request, res: Response) => {
  try {
    const countdown = req.body?.countdown !== undefined ? parseInt(req.body.countdown) : 60;

    // Push-Warnungen (optional, Fehler ignorieren)
    let warned = 0;
    try {
      // Alle User mit Push-Subscription direkt benachrichtigen
      const subscribers = await (prisma as any).pushSubscription.findMany({
        include: { user: true },
      });
      warned = subscribers.length;
      console.log('[REBOOT] Push-Subscribers:', warned);
      for (const sub of subscribers) {
        await sendPushToUser(
          { id: sub.userId, pushSubscriptions: [sub] },
          {
            title: '⚠️ Server-Neustart in ' + countdown + ' Sekunden',
            body: 'Der Server wird gleich neu gestartet. Bitte alle offenen Eingaben speichern!',
            url: '/',
          }
        ).catch((e: any) => console.log('[REBOOT] Push-Fehler:', e.message));
      }
    } catch (pushErr: any) { console.log('[REBOOT] Push-Query Fehler:', pushErr.message); }

    broadcast({ type: 'SERVER_REBOOT', countdown, message: `Server wird neu gestartet!` });
    res.json({ started: true, countdown, warned });

    // Nach Countdown rebooten
    if (rebootTimer) clearTimeout(rebootTimer);
    const doReboot = async () => {
      broadcast({ type: 'SERVER_REBOOTING', message: 'Server startet jetzt neu...' });
      await new Promise(r => setTimeout(r, 1500));
      // Reboot direkt ausführen – kein sudo nötig da feuerwehrapp die Rechte hat
      const { execSync } = require('child_process');
      console.log('[REBOOT] Starte Neustart...');
      try {
        // Versuche 1: direkt
        execSync('/sbin/reboot -f', { shell: '/bin/bash', timeout: 5000 });
      } catch {
        try {
          // Versuche 2: über sudo ohne Passwort
          execSync('sudo -n /usr/local/bin/fw-reboot', { shell: '/bin/bash', timeout: 5000 });
        } catch (err: any) {
          console.log('[REBOOT] Fehler:', err.message);
        }
      }
    };
    if (countdown === 0) {
      await doReboot();
    } else {
      rebootTimer = setTimeout(doReboot, countdown * 1000);
    }

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/update/os-dist-upgrade — Kernel-Updates (dist-upgrade) ────────
let distUpgradeLog: string[] = [];
let distUpgradeRunning = false;
let distUpgradeDone = false;
let distUpgradeSuccess = false;
let distUpgradeClients: Response[] = [];

router.get('/os-dist-log', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for (const line of distUpgradeLog) {
    res.write(`data: ${JSON.stringify({ line })}

`);
  }
  if (distUpgradeDone) {
    res.write(`data: ${JSON.stringify({ done: true, success: distUpgradeSuccess })}

`);
    res.end();
    return;
  }
  distUpgradeClients.push(res);
  req.on('close', () => { distUpgradeClients = distUpgradeClients.filter(c => c !== res); });
});

router.post('/os-dist-upgrade', async (_req: Request, res: Response) => {
  if (distUpgradeRunning) { res.json({ started: false, message: 'Läuft bereits' }); return; }

  distUpgradeLog = [];
  distUpgradeRunning = true;
  distUpgradeDone = false;
  distUpgradeSuccess = false;
  res.json({ started: true });

  const broadcastLine = (line: string) => {
    distUpgradeLog.push(line);
    for (const client of distUpgradeClients) {
      client.write(`data: ${JSON.stringify({ line })}

`);
    }
  };

  const { spawn } = require('child_process');
  const child = spawn('sudo', ['-n',
    '/usr/bin/apt-get', 'dist-upgrade', '-y',
    '-o', 'Dpkg::Options::=--force-confdef',
    '-o', 'Dpkg::Options::=--force-confold',
    '-o', 'APT::Color=0',
  ], { env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }, stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (data: Buffer) => {
    data.toString().split("\n").filter((l: string) => l.trim()).forEach(broadcastLine);
  });
  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes('[sudo]') && !line.includes('password')) broadcastLine(line);
  });
  child.on('close', (code: number) => {
    distUpgradeRunning = false;
    distUpgradeDone = true;
    distUpgradeSuccess = code === 0;
    broadcastLine(code === 0 ? '✓ Kernel-Update abgeschlossen! Server-Neustart empfohlen.' : `✗ Fehlgeschlagen (Exit ${code})`);
    for (const client of distUpgradeClients) {
      client.write(`data: ${JSON.stringify({ done: true, success: distUpgradeSuccess })}

`);
      client.end();
    }
    distUpgradeClients = [];
    broadcast({ type: distUpgradeSuccess ? 'DIST_UPGRADE_DONE' : 'DIST_UPGRADE_ERROR' });
  });
});

// Also add dist-upgrade to os-check response (held back packages)
// ── DELETE /api/update/reboot — Reboot abbrechen ─────────────────────────────
router.delete('/reboot', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  if (rebootTimer) {
    clearTimeout(rebootTimer);
    rebootTimer = null;
    broadcast({ type: 'SERVER_REBOOT_CANCELLED', message: 'Server-Neustart wurde abgebrochen' });
    res.json({ cancelled: true });
  } else {
    res.json({ cancelled: false, message: 'Kein Neustart geplant' });
  }
});

// ── AUTOMATISCHER UPDATE-CHECK (alle 60 Minuten) ──────────────────────────────
let lastKnownRemoteHash: string | null = null;

async function autoCheckForUpdates() {
  try {
    await gitFetchWithToken();
    const { stdout: currentHash } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse HEAD`);
    const { stdout: remoteHash }  = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" rev-parse origin/main`);

    const current = currentHash.trim();
    const remote  = remoteHash.trim();

    // Kein Update verfügbar
    if (current === remote) { lastKnownRemoteHash = remote; return; }

    // Neuer Remote-Commit seit letztem Check → Benachrichtigung senden
    if (lastKnownRemoteHash === remote) { return; } // schon gemeldet
    lastKnownRemoteHash = remote;

    // Changelog ermitteln
    let changes = '';
    try {
      const { stdout: log } = await execAsync(`sudo /usr/bin/git -C "${REPO_DIR}" log --oneline HEAD..origin/main --no-merges`);
      const lines = log.trim().split('\n').filter(Boolean).slice(0, 5);
      changes = lines.length > 0 ? '\n' + lines.map(l => '• ' + l.substring(8)).join('\n') : '';
    } catch {}

    // WebSocket-Broadcast
    broadcast({ type: 'UPDATE_AVAILABLE', remoteCommit: remote.substring(0, 7) });

    // Push-Notification an alle mit pushUpdate=true
    const subscribers = await (prisma as any).user.findMany({
      where: { pushSubscriptions: { some: {} } },
      include: { pushSettings: true, pushSubscriptions: true },
    });

    for (const user of subscribers) {
      if (user.pushSettings?.pushUpdate) {
        await sendPushToUser(user, {
          title: '🔄 App-Update verfügbar',
          body: `Eine neue Version ist bereit.${changes ? changes.substring(0, 100) : ''} Admin kann das Update in den Einstellungen einspielen.`,
          url: '/settings',
        }).catch(() => {});
      }
    }

    console.log(`[AutoUpdate] Neuer Commit gefunden: ${remote.substring(0, 7)} — Push gesendet`);
  } catch (err) {
    // Netzwerkfehler etc. → still ignorieren
  }
}

// Beim Server-Start und dann alle 60 Minuten prüfen
setTimeout(autoCheckForUpdates, 2 * 60 * 1000);
setInterval(autoCheckForUpdates, 60 * 60 * 1000);

// ── APP NEUSTART ──────────────────────────────────────────────────────────────
const RESTART_ANNOUNCE_STATUS = '/tmp/feuerwehr-restart-announce.json';
let restartAnnounceTimer: NodeJS.Timeout | null = null;

// POST /api/update/restart-announce — Neustart in 5 Min ankündigen
router.post('/restart-announce', authorize('ADMIN'), async (_req, res: Response) => {
  try {
    const countdown = 5 * 60;
    const startedAt = new Date().toISOString();
    fs.writeFileSync(RESTART_ANNOUNCE_STATUS, JSON.stringify({ announced: true, countdown, startedAt }));

    broadcast({
      type: 'RESTART_ANNOUNCED',
      countdown,
      message: 'Die App wird in 5 Minuten neu gestartet. Bitte alle offenen Punkte speichern!',
      startedAt,
    });

    // Push an alle mit pushUpdate=true
    try {
      const subscribers = await (prisma as any).user.findMany({
        where: { pushSubscriptions: { some: {} } },
        include: { pushSettings: true, pushSubscriptions: true },
      });
      for (const user of subscribers) {
        if (user.pushSettings?.pushUpdate) {
          await sendPushToUser(user, {
            title: '🔄 App-Neustart in 5 Minuten',
            body: 'Bitte alle offenen Eingaben speichern. Die App startet kurz neu.',
            url: '/',
          }).catch(() => {});
        }
      }
    } catch {}

    if (restartAnnounceTimer) clearTimeout(restartAnnounceTimer);
    restartAnnounceTimer = setTimeout(() => {
      if (fs.existsSync(RESTART_ANNOUNCE_STATUS)) fs.unlinkSync(RESTART_ANNOUNCE_STATUS);
      broadcast({ type: 'RESTART_STARTING', message: 'App wird jetzt neu gestartet...' });
      setTimeout(() => process.exit(0), 1000);
    }, countdown * 1000);

    res.json({ message: 'Neustart angekündigt', countdown, startedAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/update/restart-now — Sofort neu starten
router.post('/restart-now', authorize('ADMIN'), async (_req, res: Response) => {
  try {
    if (restartAnnounceTimer) { clearTimeout(restartAnnounceTimer); restartAnnounceTimer = null; }
    if (fs.existsSync(RESTART_ANNOUNCE_STATUS)) fs.unlinkSync(RESTART_ANNOUNCE_STATUS);

    broadcast({ type: 'RESTART_STARTING', message: 'App wird jetzt neu gestartet...' });
    res.json({ message: 'Neustart wird durchgeführt' });

    res.on('finish', () => {
      setTimeout(() => process.exit(0), 500);
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/update/restart-cancel — Angekündigten Neustart abbrechen
router.post('/restart-cancel', authorize('ADMIN'), (_req, res: Response) => {
  if (restartAnnounceTimer) { clearTimeout(restartAnnounceTimer); restartAnnounceTimer = null; }
  if (fs.existsSync(RESTART_ANNOUNCE_STATUS)) fs.unlinkSync(RESTART_ANNOUNCE_STATUS);
  broadcast({ type: 'RESTART_CANCELLED', message: 'Der angekündigte Neustart wurde abgebrochen.' });
  res.json({ message: 'Neustart abgebrochen' });
});

// GET /api/update/restart-announce-status
router.get('/restart-announce-status', (_req, res: Response) => {
  try {
    if (!fs.existsSync(RESTART_ANNOUNCE_STATUS)) { res.json({ announced: false }); return; }
    res.json(JSON.parse(fs.readFileSync(RESTART_ANNOUNCE_STATUS, 'utf8')));
  } catch { res.json({ announced: false }); }
});

export default router;
