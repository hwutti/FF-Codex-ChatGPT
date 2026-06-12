import { Router, Request, Response } from 'express';
import http from 'http';
import {
  WHISPER_PORT, WHISPER_CPP_PORT,
  isWhisperServiceReady, isWhisperCppServiceReady,
  restartWhisperService, startWhisperCppService, stopWhisperCppService,
  checkFasterWhisperInstalled, checkWhisperCppInstalled, checkWhisperCppModelInstalled,
} from '../utils/whisperService';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth.middleware';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

// Audio upload in temp dir
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── GET /api/whisper/status ───────────────────────────────────────────
router.get('/status', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    // Einstellungen aus DB laden
    const wsSettings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
    const configuredModel = wsSettings?.whisperModel || 'medium';
    const configuredLanguage = wsSettings?.whisperLanguage || 'de';

    // Use sudo to check as root since model is installed as root
    const result = await new Promise<{ installed: boolean; model: boolean; configuredModel: string; configuredLanguage: string }>((resolve) => {
      const check = spawn('sudo', ['python3', '-c', [
        'import sys',
        'try:',
        '    from faster_whisper import WhisperModel',
        '    print("installed")',
        'except ImportError:',
        '    print("not_installed")',
        '    sys.exit(1)',
        'import os',
        'cache_dirs = [',
        '    "/root/.cache/huggingface/hub",',
        '    "/home/feuerwehrapp/.cache/huggingface/hub",',
        '    os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub"),',
        ']',
        'model_found = False',
        'for d in cache_dirs:',
        '    if not os.path.exists(d): continue',
        '    for e in os.listdir(d):',
        '        if "whisper" in e.lower() and "' + configuredModel + '" in e.lower():',
        '            model_found = True',
        '            break',
        'print("model_ok" if model_found else "no_model")',
      ].join('\n')], { timeout: 15000 });
      let output = '';
      let errout = '';
      check.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      check.stderr.on('data', (d: Buffer) => { errout += d.toString(); });
      check.on('close', (code: number | null) => {
        const installed = output.includes('installed');
        const hasModel = output.includes('model_ok');
        resolve({ installed, model: hasModel, configuredModel, configuredLanguage });
      });
      check.on('error', () => resolve({ installed: false, model: false, configuredModel, configuredLanguage }));
    });
    // Whisper.cpp Status
    const cppInstalled  = await checkWhisperCppInstalled();
    const cppModelReady = cppInstalled ? await checkWhisperCppModelInstalled(configuredModel) : false;
    const engine  = wsSettings?.whisperEngine  || 'faster-whisper';
    const gpuMode = wsSettings?.whisperGpuMode || 'auto';

    // GPU-Status aus laufendem Service lesen
    let gpuActive = false;
    try {
      const http = require('http');
      const healthData = await new Promise<any>((resolve) => {
        const req = http.get({ hostname: '127.0.0.1', port: 8766, path: '/health', timeout: 2000 }, (res: any) => {
          let d = ''; res.on('data', (c: any) => { d += c; }); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); }});
        });
        req.on('error', () => resolve({}));
      });
      gpuActive = healthData.gpu === true;
    } catch {}

    res.json({
      ...result,
      engine,
      gpuMode,
      gpuActive,
      cppInstalled,
      cppModelReady,
      configuredModel,
      configuredLanguage,
    });
  } catch (e: any) {
    res.json({ installed: false, model: false, error: e.message });
  }
});

const WHISPER_LOG    = '/tmp/whisper-install.log';
const WHISPER_STATUS = '/tmp/whisper-install-status.json';

// ── GET /api/whisper/install-status ──────────────────────────────────
router.get('/install-status', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  try {
    const status = fs.existsSync(WHISPER_STATUS)
      ? JSON.parse(fs.readFileSync(WHISPER_STATUS, 'utf8'))
      : { running: false, done: false };
    const log = fs.existsSync(WHISPER_LOG)
      ? fs.readFileSync(WHISPER_LOG, 'utf8')
      : '';
    res.json({ ...status, log });
  } catch { res.json({ running: false, done: false, log: '' }); }
});

// ── POST /api/whisper/install ─────────────────────────────────────────
router.post('/install', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  // Einstellungen aus DB laden
  const wsSettingsInst = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  const installModel = wsSettingsInst?.whisperModel || 'medium';
  // Status setzen — Log wird vom Shell-Script als root angelegt
  try { fs.unlinkSync(WHISPER_STATUS); } catch {}
  fs.writeFileSync(WHISPER_STATUS, JSON.stringify({ running: true, done: false }));
  try { fs.chmodSync(WHISPER_STATUS, 0o666); } catch {}

  res.json({ started: true });

  const tmpScript = path.join(os.tmpdir(), 'fw_whisper_install.sh');
  const shellScript = [
    '#!/bin/bash',
    'LOG=/tmp/whisper-install.log',
    'STATUS=/tmp/whisper-install-status.json',
    'rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"',
    'log() { echo "$1" >> "$LOG"; }',
    "on_error() { echo '{\"running\":false,\"done\":true,\"success\":false}' > \"$STATUS\"; chmod 666 \"$STATUS\"; }",
    'trap on_error ERR',
    '',
    'log ">>> Installiere python3-pip..."',
    'apt-get install -y python3-pip python3-dev >> "$LOG" 2>&1 || true',
    'log ">>> python3-pip installiert!"',
    '',
    'log ">>> Installiere faster-whisper..."',
    'pip3 install faster-whisper --break-system-packages --ignore-installed >> "$LOG" 2>&1 || true',
    'log ">>> faster-whisper installiert!"',
    '',
    `log ">>> Lade Whisper Modell ${installModel} herunter..."`,
    `python3 -W ignore -c "from faster_whisper import WhisperModel; m=WhisperModel('${installModel}', device='cpu', compute_type='int8'); print('loaded')" >> "$LOG" 2>&1`,
    'log ">>> Modell erfolgreich geladen!"',
    'log ">>> Installation abgeschlossen!"',
    "printf '{\"running\":false,\"done\":true,\"success\":true}\n' > \"$STATUS\" || true",
    "chmod 666 \"$STATUS\" 2>/dev/null || true",
  ].join('\n');

  fs.writeFileSync(tmpScript, shellScript);
  fs.chmodSync(tmpScript, 0o755);

  const proc = spawn('sudo', ['bash', tmpScript], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logStream = fs.createWriteStream('/tmp/whisper-install.log', { flags: 'a' });
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);

  proc.on('close', (code: number | null) => {
    const statusPath = '/tmp/whisper-install-status.json';
    try {
      const current = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      if (current.running) throw new Error('still running');
    } catch {
      fs.writeFileSync(statusPath, JSON.stringify({
        running: false, done: true,
        success: code === 0,
        error: code !== 0 ? `Exit code ${code}` : undefined,
      }));
      fs.chmodSync(statusPath, 0o666);
    }
  });

  proc.unref();
});

// ── POST /api/whisper/restart-service — Service neu starten ─────────
router.post('/restart-service', authenticate, authorize('ADMIN'), async (_req: Request, res: Response) => {
  try {
    await restartWhisperService();
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/whisper/settings ────────────────────────────────────────
router.get('/settings', authenticate, authorize('ADMIN'), async (_req, res: Response) => {
  try {
    const settings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } });
    res.json({
      model: settings?.whisperModel || 'medium',
      language: settings?.whisperLanguage || 'de',
      engine: settings?.whisperEngine || 'faster-whisper',
      gpuMode: settings?.whisperGpuMode || 'auto',
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/whisper/settings ─────────────────────────────────────────
router.put('/settings', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { model, language, engine, gpuMode } = req.body;
    const validModels = ['tiny', 'base', 'small', 'medium', 'large'];
    const validLanguages = ['de', 'en', 'it', 'sl', 'hr', null];
    const validEngines = ['faster-whisper', 'whisper-cpp'];
    const validGpuModes = ['auto', 'gpu', 'cpu'];
    if (model && !validModels.includes(model)) return res.status(400).json({ error: 'Ungültiges Modell' });
    if (language !== undefined && !validLanguages.includes(language)) return res.status(400).json({ error: 'Ungültige Sprache' });
    if (engine && !validEngines.includes(engine)) return res.status(400).json({ error: 'Ungültige Engine' });
    if (gpuMode && !validGpuModes.includes(gpuMode)) return res.status(400).json({ error: 'Ungültiger GPU-Modus' });

    const updateData: any = {};
    if (model)              updateData.whisperModel    = model;
    if (language !== undefined) updateData.whisperLanguage = language || null;
    if (engine)             updateData.whisperEngine   = engine;
    if (gpuMode)            updateData.whisperGpuMode  = gpuMode;

    await (prisma as any).appSettings.upsert({
      where: { id: 'singleton' },
      update: updateData,
      create: { id: 'singleton', ...updateData },
    });

    // Wenn Engine gewechselt → Service automatisch neu starten
    if (engine) {
      setTimeout(async () => {
        await restartWhisperService();
      }, 500);
    }

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/whisper/transcribe ──────────────────────────────────────
router.post('/transcribe', authenticate, upload.single('audio'), async (req: Request, res: Response) => {
  const audioFile = req.file;
  if (!audioFile) return res.status(400).json({ error: 'Keine Audio-Datei' });

  const audioPath = audioFile.path;

  // Versuche zuerst den dauerhaften Whisper-Service
  // Aktive Engine bestimmen
  const wsSettingsTr = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  const activeEngine = wsSettingsTr?.whisperEngine || 'faster-whisper';
  const usePort = activeEngine === 'whisper-cpp' ? WHISPER_CPP_PORT : WHISPER_PORT;
  const serviceReady = activeEngine === 'whisper-cpp' ? isWhisperCppServiceReady() : isWhisperServiceReady();

  if (serviceReady) {
    try {
      const audioBuffer = fs.readFileSync(audioPath);
      const text = await new Promise<string>((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: usePort,
          path: '/transcribe',
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': audioBuffer.length },
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) reject(new Error(json.error));
              else resolve(json.text || '');
            } catch { reject(new Error('Ungültige Antwort vom Whisper-Service')); }
          });
        });
        req.on('error', reject);
        req.write(audioBuffer);
        req.end();
      });
      fs.unlinkSync(audioPath);
      return res.json({ text: text.trim() });
    } catch (serviceErr: any) {
      console.log('[Whisper] Service-Fehler, Fallback auf Skript:', serviceErr.message);
    }
  }

  // Fallback: Modell per Skript laden (langsamer)
  const wsSettings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  const whisperModel = wsSettings?.whisperModel || 'medium';
  const whisperLang = wsSettings?.whisperLanguage || 'de';
  const langArg = whisperLang ? `'${whisperLang}'` : 'None';

  const script = `
import sys
from faster_whisper import WhisperModel

model = WhisperModel('${whisperModel}', device='cpu', compute_type='int8')
segments, info = model.transcribe('${audioPath}', language=${langArg}, task='transcribe')

text = ' '.join([seg.text.strip() for seg in segments])
print(text)
`;

  const tmpScript = path.join(os.tmpdir(), `transcribe_${Date.now()}.py`);
  fs.writeFileSync(tmpScript, script);

  try {
    const text = await new Promise<string>((resolve, reject) => {
      const proc = spawn('python3', [tmpScript], { timeout: 120000 });
      let output = '';
      let error = '';
      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { error += d.toString(); });
      proc.on('close', (code: number | null) => {
        fs.unlinkSync(audioPath);
        fs.unlinkSync(tmpScript);
        if (code === 0) resolve(output.trim());
        else reject(new Error(error || `Exit code ${code}`));
      });
      proc.on('error', (err: Error) => {
        try { fs.unlinkSync(audioPath); fs.unlinkSync(tmpScript); } catch {}
        reject(err);
      });
    });
    res.json({ text, language: 'auto' });
  } catch (e: any) {
    try { fs.unlinkSync(audioPath); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/whisper/install-cpp ────────────────────────────────────
router.post('/install-cpp', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  const wsSettingsInst = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  const installModel = wsSettingsInst?.whisperModel || 'medium';

  const CPP_LOG    = '/tmp/whisper-cpp-install.log';
  const CPP_STATUS = '/tmp/whisper-cpp-install-status.json';

  try { fs.unlinkSync(CPP_STATUS); } catch {}
  fs.writeFileSync(CPP_STATUS, JSON.stringify({ running: true, done: false }));
  try { fs.chmodSync(CPP_STATUS, 0o666); } catch {}

  res.json({ started: true });

  const tmpScript = path.join(os.tmpdir(), 'fw_whisper_cpp_install.sh');
  const scriptContent = [
    '#!/bin/bash',
    'LOG=/tmp/whisper-cpp-install.log',
    'STATUS=/tmp/whisper-cpp-install-status.json',
    'rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"',
    'log() { echo "$1" | tee -a "$LOG"; }',
    '# Fehler manuell behandelt',
    "on_err() { echo '{\"running\":false,\"done\":true,\"success\":false}' > \"$STATUS\"; chmod 666 \"$STATUS\"; }",
    'trap on_err ERR',
    '',
    'log ">>> Installiere Build-Tools..."',
    'apt-get install -y cmake build-essential ffmpeg >> "$LOG" 2>&1',
    'log ">>> Build-Tools installiert!"',
    '',
    'log ">>> Klone whisper.cpp..."',
    'rm -rf /opt/whisper-cpp',
    'git clone --depth 1 https://github.com/ggerganov/whisper.cpp /opt/whisper-cpp >> "$LOG" 2>&1',
    'log ">>> Geklont!"',
    '',
    'log ">>> Prüfe GPU-Verfügbarkeit..."',
    '# NVIDIA GPU erkennen',
    'if nvidia-smi --query-gpu=name --format=csv,noheader >> "$LOG" 2>&1; then',
    '  log ">>> NVIDIA GPU erkannt — kompiliere mit CUDA-Support"',
    '  # CUDA Toolkit installieren falls nicht vorhanden',
    '  if ! command -v nvcc &>/dev/null; then',
    '    log ">>> Installiere CUDA Toolkit..."',
    '    apt-get install -y nvidia-cuda-toolkit >> "$LOG" 2>&1 || log ">>> WARNUNG: CUDA Toolkit Installation fehlgeschlagen"',
    '  fi',
    '  CMAKE_GPU_FLAGS="-DGGML_CUDA=ON"',
    'else',
    '  log ">>> Kein GPU erkannt — kompiliere für CPU"',
    '  CMAKE_GPU_FLAGS="-DGGML_NATIVE=OFF"',
    'fi',
    'log ">>> Kompiliere whisper.cpp..."',
    'cd /opt/whisper-cpp',
    'cmake -B build $CMAKE_GPU_FLAGS >> "$LOG" 2>&1',
    'cmake --build build --config Release -j$(nproc) >> "$LOG" 2>&1',
    'log ">>> Kompiliert!"',
    '',
    'log ">>> Erstelle Modell-Verzeichnis..."',
    'mkdir -p /opt/whisper-cpp/models',
    '',
    `log ">>> Lade Modell ${installModel}..."`,
    `# Korrekter Dateiname: large → ggml-large-v3.bin`,
     `wget -q --no-check-certificate -O /opt/whisper-cpp/models/ggml-${installModel}.bin "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${installModel === 'large' ? 'ggml-large-v3' : ('ggml-' + installModel)}.bin" >> "$LOG" 2>&1`,
    'log ">>> Modell heruntergeladen!"',
    '',
    'log ">>> Installation abgeschlossen!"',
    "echo '{\"running\":false,\"done\":true,\"success\":true}' > \"$STATUS\"",
    'chmod 666 "$STATUS" 2>/dev/null || true',
  ].join('\n');
  fs.writeFileSync(tmpScript, scriptContent);
  fs.chmodSync(tmpScript, 0o755);

  const proc = spawn('sudo', ['bash', tmpScript], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logStream = fs.createWriteStream(CPP_LOG, { flags: 'a' });
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);

  proc.on('close', (code: number | null) => {
    try {
      const current = JSON.parse(fs.readFileSync(CPP_STATUS, 'utf8'));
      if (current.running) throw new Error('still running');
    } catch {
      fs.writeFileSync(CPP_STATUS, JSON.stringify({ running: false, done: true, success: code === 0 }));
      try { fs.chmodSync(CPP_STATUS, 0o666); } catch {}
    }
  });
  proc.unref();
});

// ── GET /api/whisper/install-cpp-status ──────────────────────────────
router.get('/install-cpp-status', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  const CPP_LOG    = '/tmp/whisper-cpp-install.log';
  const CPP_STATUS = '/tmp/whisper-cpp-install-status.json';
  try {
    const status = fs.existsSync(CPP_STATUS)
      ? JSON.parse(fs.readFileSync(CPP_STATUS, 'utf8'))
      : { running: false, done: false };
    const log = fs.existsSync(CPP_LOG) ? fs.readFileSync(CPP_LOG, 'utf8') : '';
    res.json({ ...status, log });
  } catch { res.json({ running: false, done: false, log: '' }); }
});

// ── POST /api/whisper/download-model ─────────────────────────────────────────
router.post('/download-model', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  const { model, engine } = req.body;
  const validModels = ['tiny', 'base', 'small', 'medium', 'large'];
  if (!model || !validModels.includes(model)) return res.status(400).json({ error: 'Ungültiges Modell' });

  const DL_LOG    = '/tmp/whisper-model-download.log';
  const DL_STATUS = '/tmp/whisper-model-download-status.json';

  try { fs.unlinkSync(DL_STATUS); } catch {}
  fs.writeFileSync(DL_STATUS, JSON.stringify({ running: true, done: false }));
  try { fs.chmodSync(DL_STATUS, 0o666); } catch {}

  res.json({ started: true });

  // Download-Script je nach Engine
  const tmpScript = path.join(os.tmpdir(), 'fw_model_download.sh');
  let scriptLines: string[];

  if (engine === 'whisper-cpp') {
    scriptLines = [
      '#!/bin/bash',
      `LOG=${DL_LOG}`,
      `STATUS=${DL_STATUS}`,
      'rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"',
      'log() { echo "$1" | tee -a "$LOG"; }',
      'on_err() { echo "{\"running\":false,\"done\":true,\"success\":false}" > "$STATUS"; chmod 666 "$STATUS"; }',
      'trap on_err ERR',
      'mkdir -p /opt/whisper-cpp/models',
      `log ">>> Lade whisper.cpp Modell '${model}' herunter..."`,
       `wget -q -O /opt/whisper-cpp/models/ggml-${model}.bin "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${model === 'large' ? 'ggml-large-v3' : ('ggml-' + model)}.bin" 2>&1 | tee -a "$LOG"`,
      'log ">>> Modell heruntergeladen!"',
      'echo "{\"running\":false,\"done\":true,\"success\":true}" > "$STATUS"',
      'chmod 666 "$STATUS" 2>/dev/null || true',
    ];
  } else {
    // faster-whisper
    scriptLines = [
      '#!/bin/bash',
      `LOG=${DL_LOG}`,
      `STATUS=${DL_STATUS}`,
      'rm -f "$LOG"; touch "$LOG" && chmod 666 "$LOG"',
      'log() { echo "$1" | tee -a "$LOG"; }',
      'on_err() { echo "{\"running\":false,\"done\":true,\"success\":false}" > "$STATUS"; chmod 666 "$STATUS"; }',
      'trap on_err ERR',
      `log ">>> Lade faster-whisper Modell '${model}' herunter..."`,
      `python3 -W ignore -c "from faster_whisper import WhisperModel; m=WhisperModel('${model}', device='cpu', compute_type='int8'); print('>>> Modell geladen!')" 2>&1 | tee -a "$LOG"`,
      'log ">>> Modell heruntergeladen!"',
      'echo "{\"running\":false,\"done\":true,\"success\":true}" > "$STATUS"',
      'chmod 666 "$STATUS" 2>/dev/null || true',
    ];
  }

  fs.writeFileSync(tmpScript, scriptLines.join('\n'));
  fs.chmodSync(tmpScript, 0o755);

  const proc = spawn('sudo', ['bash', tmpScript], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logStream = fs.createWriteStream(DL_LOG, { flags: 'a' });
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);

  proc.on('close', (code: number | null) => {
    try {
      const current = JSON.parse(fs.readFileSync(DL_STATUS, 'utf8'));
      if (current.running) throw new Error('still running');
    } catch {
      fs.writeFileSync(DL_STATUS, JSON.stringify({ running: false, done: true, success: code === 0 }));
      try { fs.chmodSync(DL_STATUS, 0o666); } catch {}
    }
  });
  proc.unref();
});

// ── GET /api/whisper/download-model-status ────────────────────────────────────
router.get('/download-model-status', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  const DL_LOG    = '/tmp/whisper-model-download.log';
  const DL_STATUS = '/tmp/whisper-model-download-status.json';
  try {
    const status = fs.existsSync(DL_STATUS)
      ? JSON.parse(fs.readFileSync(DL_STATUS, 'utf8'))
      : { running: false, done: false };
    const log = fs.existsSync(DL_LOG) ? fs.readFileSync(DL_LOG, 'utf8') : '';
    res.json({ ...status, log });
  } catch { res.json({ running: false, done: false, log: '' }); }
});

export default router;
