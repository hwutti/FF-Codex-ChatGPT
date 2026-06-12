import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import multer from 'multer';

const execAsync = promisify(exec);
const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN'));

const BACKUP_DIR = '/var/backups/feuerwehr';
const BACKUP_VERSION = '1.0';

// Ensure backup dir exists (only if writable)
try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch { /* created by install script */ }

// Multer for restore upload
const upload = multer({
  dest: '/tmp/',
  limits: { fileSize: 500 * 1024 * 1024 },
});

// Parse DB connection string
function parseDbUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: u.username,
      password: u.password,
      database: u.pathname.replace('/', ''),
    };
  } catch { return null; }
}

// Add directory to zip recursively
function addDirToZip(zip: AdmZip, dirPath: string, zipPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryZipPath = path.join(zipPath, entry.name);
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, entryZipPath);
    } else {
      zip.addLocalFile(fullPath, zipPath);
    }
  }
}

// ── Backup-Dateiname aus Branding-Name ────────────────────────────────────────
async function getBackupBaseName(): Promise<string> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const name = settings?.name || 'feuerwehr';
    // Sonderzeichen entfernen, Leerzeichen → Bindestrich, Kleinbuchstaben
    return name.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  } catch {
    return 'feuerwehr';
  }
}

// ── CREATE BACKUP ─────────────────────────────────────────────────────────────
router.get('/create', async (req: Request, res: Response) => {
  const tmpDir = `/tmp/fw-backup-${Date.now()}`;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // 1. PostgreSQL dump
    const db = parseDbUrl(env.DATABASE_URL);
    if (!db) throw new Error('Ungültige DATABASE_URL');

    const sqlFile = path.join(tmpDir, 'database.sql');
    // execFile vermeidet Shell-Injection — kein String-Interpolation in Shell
    await new Promise<void>((resolve, reject) => {
      const pg = require('child_process').execFile(
        'pg_dump',
        ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '--no-password', '-F', 'p', '--clean', '--if-exists', '-f', sqlFile],
        { env: { ...process.env, PGPASSWORD: db.password } },
        (err: any) => { if (err) reject(err); else resolve(); }
      );
    });

    // 2. .env file
    const backendDir = path.dirname(path.dirname(__dirname));
    const envPath = path.join(backendDir, '.env');
    const envFile = path.join(tmpDir, 'app.env');
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, envFile);
    } else {
      const envContent = Object.entries(process.env)
        .filter(([k]) => ['DATABASE_URL','PORT','JWT_SECRET','NODE_ENV','FRONTEND_URL','UPLOAD_DIR'].includes(k))
        .map(([k, v]) => `${k}=${v}`).join('\n');
      fs.writeFileSync(envFile, envContent);
    }

    // 3. Metadata
    const meta = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      hostname: process.env.HOSTNAME || 'unknown',
      appVersion: '2.2.0',
    };
    fs.writeFileSync(path.join(tmpDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));

    // 4. Create ZIP
    const zip = new AdmZip();
    zip.addLocalFile(sqlFile, '');
    zip.addLocalFile(envFile, '');
    zip.addLocalFile(path.join(tmpDir, 'backup-meta.json'), '');

    // Add uploads directory
    if (fs.existsSync(env.UPLOAD_DIR)) {
      addDirToZip(zip, env.UPLOAD_DIR, 'uploads');
    }

    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    const fwName = await getBackupBaseName();
    const filename = `${fwName}-backup-${ts}.zip`;
    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);

    fs.rmSync(tmpDir, { recursive: true, force: true });

  } catch (err: any) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error('Backup error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Backup fehlgeschlagen: ${err.message}` });
    }
  }
});

// ── CREATE ENCRYPTED BACKUP ───────────────────────────────────────────────────
router.post('/create-encrypted', async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 1) {
    res.status(400).json({ error: 'Kein Passwort angegeben' });
    return;
  }

  const tmpDir = `/tmp/fw-backup-enc-${Date.now()}`;
  const zipPath = `${tmpDir}.zip`;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // 1. PostgreSQL dump
    const db = parseDbUrl(env.DATABASE_URL);
    if (!db) throw new Error('Ungültige DATABASE_URL');

    const sqlFile = path.join(tmpDir, 'database.sql');
    await new Promise<void>((resolve, reject) => {
      require('child_process').execFile(
        'pg_dump',
        ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '--no-password', '-F', 'p', '--clean', '--if-exists', '-f', sqlFile],
        { env: { ...process.env, PGPASSWORD: db.password } },
        (err: any) => { if (err) reject(err); else resolve(); }
      );
    });

    // 2. .env
    const backendDir = path.dirname(path.dirname(__dirname));
    const envPath = path.join(backendDir, '.env');
    const envFile = path.join(tmpDir, 'app.env');
    if (fs.existsSync(envPath)) fs.copyFileSync(envPath, envFile);

    // 3. Metadata
    const meta = { version: BACKUP_VERSION, createdAt: new Date().toISOString(), encrypted: true };
    fs.writeFileSync(path.join(tmpDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));

    // 4. Uploads kopieren
    if (fs.existsSync(env.UPLOAD_DIR)) {
      const { execSync } = require('child_process');
      execSync(`cp -r "${env.UPLOAD_DIR}" "${path.join(tmpDir, 'uploads')}"`);
    }

    // 5. AES-256 verschlüsseltes ZIP via zip CLI
    const { execSync } = require('child_process');
    execSync(`zip -r -e -P "${password.replace(/"/g, '\\"')}" "${zipPath}" .`, { cwd: tmpDir });

    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    const fwName = await getBackupBaseName();
    const filename = `${fwName}-backup-verschluesselt-${ts}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(zipPath, {}, () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    });

  } catch (err: any) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.error('Encrypted backup error:', err);
    if (!res.headersSent) res.status(500).json({ error: `Backup fehlgeschlagen: ${err.message}` });
  }
});

// ── RESTORE BACKUP ────────────────────────────────────────────────────────────
router.post('/restore', upload.single('backup'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Keine Backup-Datei' }); return; }

  const zipPath = req.file.path;
  const password = req.body?.password || '';

  try {
    // Bei verschlüsseltem ZIP: zuerst entschlüsseln via unzip CLI
    let workingZipPath = zipPath;
    if (password) {
      const decryptedDir = `/tmp/fw-restore-dec-${Date.now()}`;
      fs.mkdirSync(decryptedDir, { recursive: true });
      try {
        const { execSync } = require('child_process');
        execSync(`unzip -P "${password.replace(/"/g, '\\"')}" "${zipPath}" -d "${decryptedDir}"`, { stdio: 'pipe' });
        // Neu als ZIP packen (unverschlüsselt) für den weiteren Prozess
        const repackedZip = `${decryptedDir}-repacked.zip`;
        execSync(`zip -r "${repackedZip}" .`, { cwd: decryptedDir });
        workingZipPath = repackedZip;
      } catch {
        fs.rmSync(decryptedDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
        res.status(400).json({ error: 'Falsches Passwort oder beschädigte Backup-Datei' });
        return;
      }
      fs.rmSync(decryptedDir, { recursive: true, force: true });
    }

    // Verify ZIP is valid
    const zip = new AdmZip(workingZipPath);
    const entries = zip.getEntries().map(e => e.entryName);
    if (!entries.some(e => e.includes('backup-meta.json'))) {
      fs.unlinkSync(zipPath);
      res.status(400).json({ error: 'Ungültige Backup-Datei — backup-meta.json fehlt' });
      return;
    }
    if (!entries.some(e => e.includes('database.sql'))) {
      fs.unlinkSync(zipPath);
      res.status(400).json({ error: 'Ungültige Backup-Datei — database.sql fehlt' });
      return;
    }
    if (!entries.some(e => e.includes('app.env'))) {
      fs.unlinkSync(zipPath);
      res.status(400).json({ error: 'Ungültige Backup-Datei — app.env fehlt' });
      return;
    }

    // Read metadata
    const metaEntry = zip.getEntry('backup-meta.json');
    const meta = JSON.parse(metaEntry!.getData().toString('utf8'));

    // Call the restore shell script as root (via sudoers - no password needed)
    console.log('🔄 Starte Restore via Shell-Script...');
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile('sudo', ['/usr/local/bin/fw-restore-backup', workingZipPath], (err, out, stderr) => {
        if (err) {
          const detail = stderr?.trim() || out?.trim() || err.message;
          reject(new Error(detail));
        } else resolve(out);
      });
    });
    console.log('Restore output:', stdout);

    res.json({
      message: 'Backup erfolgreich wiederhergestellt',
      meta,
      note: 'Bitte melde dich mit deinen alten Zugangsdaten an.',
    });

    // Erst nach vollständigem Senden der Response neu starten
    res.on('finish', () => {
      setTimeout(() => { console.log('🔄 Neustart nach Restore...'); process.exit(0); }, 500);
    });

  } catch (err: any) {
    if (fs.existsSync(zipPath)) { try { fs.unlinkSync(zipPath); } catch {} }
    console.error('Restore error:', err);
    res.status(500).json({ error: `Restore fehlgeschlagen: ${err.message}` });
  }
});

// ── LIST SERVER BACKUPS ───────────────────────────────────────────────────────
router.get('/list', (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size: stat.size, createdAt: stat.mtime };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(files);
  } catch { res.json([]); }
});

// ── SERVER BACKUP TRIGGERN ────────────────────────────────────────────────────
router.post('/server-create', async (req: Request, res: Response) => {
  try {
    const db = parseDbUrl(env.DATABASE_URL);
    if (!db) throw new Error('Ungültige DATABASE_URL');

    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    const fwName = await getBackupBaseName();
    const filename = `${fwName}-backup-${ts}.zip`;
    const zipPath = path.join(BACKUP_DIR, filename);
    const tmpDir = `/tmp/fw-server-backup-${Date.now()}`;

    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // DB dump — execFile vermeidet Shell-Injection
    await new Promise<void>((resolve, reject) => {
      const sqlFile = path.join(tmpDir, 'database.sql');
      require('child_process').execFile(
        'pg_dump',
        ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '--no-password', '-F', 'p', '--clean', '--if-exists', '-f', sqlFile],
        { env: { ...process.env, PGPASSWORD: db.password } },
        (err: any) => { if (err) reject(err); else resolve(); }
      );
    });

    // .env
    const backendDir = path.dirname(path.dirname(__dirname));
    const envPath = path.join(backendDir, '.env');
    if (fs.existsSync(envPath)) fs.copyFileSync(envPath, path.join(tmpDir, 'app.env'));

    // Metadata
    fs.writeFileSync(path.join(tmpDir, 'backup-meta.json'), JSON.stringify({
      version: '1.0',
      createdAt: now.toISOString(),
      type: 'manual-server',
      hostname: process.env.HOSTNAME || 'unknown',
      appVersion: '2.2.0',
    }, null, 2));

    // ZIP erstellen
    const zip = new AdmZip();
    zip.addLocalFile(path.join(tmpDir, 'database.sql'), '');
    if (fs.existsSync(path.join(tmpDir, 'app.env'))) zip.addLocalFile(path.join(tmpDir, 'app.env'), '');
    zip.addLocalFile(path.join(tmpDir, 'backup-meta.json'), '');
    if (fs.existsSync(env.UPLOAD_DIR)) addDirToZip(zip, env.UPLOAD_DIR, 'uploads');
    zip.writeZip(zipPath);

    fs.rmSync(tmpDir, { recursive: true, force: true });

    const stat = fs.statSync(zipPath);
    res.json({ name: filename, size: stat.size, createdAt: stat.mtime });
  } catch (err: any) {
    console.error('Server backup error:', err);
    res.status(500).json({ error: `Server-Backup fehlgeschlagen: ${err.message}` });
  }
});

// ── SERVER BACKUP HERUNTERLADEN ───────────────────────────────────────────────
router.get('/server-download/:filename', (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename); // Sicherheit: kein path traversal
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Datei nicht gefunden' }); return; }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── SERVER BACKUP WIEDERHERSTELLEN ────────────────────────────────────────────
router.post('/server-restore/:filename', async (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    const zipPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(zipPath)) { res.status(404).json({ error: 'Datei nicht gefunden' }); return; }

    // Verify
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries().map(e => e.entryName);
    if (!entries.some(e => e.includes('backup-meta.json'))) {
      res.status(400).json({ error: 'Ungültige Backup-Datei' }); return;
    }
    const metaEntry = zip.getEntry('backup-meta.json');
    const meta = JSON.parse(metaEntry!.getData().toString('utf8'));

    // Shell-Script aufrufen (läuft als root)
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile('sudo', ['/usr/local/bin/fw-restore-backup', zipPath], (err, out, stderr) => {
        if (err) {
          const detail = stderr?.trim() || out?.trim() || err.message;
          reject(new Error(detail));
        } else resolve(out);
      });
    });
    console.log('Server-Restore output:', stdout);

    res.json({ message: 'Backup erfolgreich wiederhergestellt', meta });

    res.on('finish', () => {
      setTimeout(() => { console.log('🔄 Neustart nach Server-Restore...'); process.exit(0); }, 500);
    });
  } catch (err: any) {
    console.error('Server restore error:', err);
    res.status(500).json({ error: `Restore fehlgeschlagen: ${err.message}` });
  }
});

// ── SERVER BACKUP LÖSCHEN ─────────────────────────────────────────────────────
router.delete('/server-delete/:filename', (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Datei nicht gefunden' }); return; }
    fs.unlinkSync(filePath);
    res.json({ message: 'Gelöscht' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
