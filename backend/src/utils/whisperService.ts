import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';

const WHISPER_PORT     = 8765;
const WHISPER_CPP_PORT = 8766;
const WHISPER_STATUS   = '/tmp/whisper-service-status.json';
const WHISPER_CPP_STATUS = '/tmp/whisper-cpp-service-status.json';

let whisperProcess:    ChildProcess | null = null;
let whisperCppProcess: ChildProcess | null = null;

// ── Aktive Engine aus DB laden ────────────────────────────────────────
async function getActiveEngine(): Promise<string> {
  const s = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  return s?.whisperEngine || 'faster-whisper';
}

// ── faster-whisper starten ────────────────────────────────────────────
export async function startWhisperService(): Promise<void> {
  try {
    const engine = await getActiveEngine();
    if (engine === 'whisper-cpp') {
      await startWhisperCppService();
      return;
    }

    const settings = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
    const model    = settings?.whisperModel    || 'medium';
    const language = settings?.whisperLanguage || 'de';

    const installed = await checkFasterWhisperInstalled();
    if (!installed) { console.log('ℹ️ faster-whisper nicht installiert'); return; }

    stopWhisperService();
    try { fs.unlinkSync(WHISPER_STATUS); } catch {}

    const scriptPath = path.join(__dirname, '../../whisper_service.py');
    if (!fs.existsSync(scriptPath)) { console.log('ℹ️ whisper_service.py nicht gefunden'); return; }

    console.log(`🎙️ Starte faster-whisper (Modell: ${model}, Sprache: ${language})...`);

    whisperProcess = spawn('sudo', ['python3', scriptPath, model, language, String(WHISPER_PORT)], {
      detached: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    whisperProcess.stdout?.on('data', (d: Buffer) => console.log('[Whisper]', d.toString().trim()));
    whisperProcess.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg && !msg.includes('UserWarning') && !msg.includes('unauthenticated')) console.log('[Whisper stderr]', msg);
    });
    whisperProcess.on('exit', (code) => { console.log(`[Whisper] beendet (${code})`); whisperProcess = null; });
  } catch (e: any) { console.log(`ℹ️ Whisper Start übersprungen: ${e.message}`); }
}

// ── whisper.cpp starten ───────────────────────────────────────────────
export async function startWhisperCppService(): Promise<void> {
  try {
    const settings  = await (prisma as any).appSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
    const model     = settings?.whisperModel    || 'medium';
    const language  = settings?.whisperLanguage || 'de';
    const gpuMode   = settings?.whisperGpuMode  || 'auto';
    const modelPath = `/opt/whisper-cpp/models/ggml-${model}.bin`;
    const binary    = '/opt/whisper-cpp/build/bin/whisper-cli';

    if (!fs.existsSync(binary))    { console.log('ℹ️ whisper.cpp Binary nicht gefunden'); return; }
    if (!fs.existsSync(modelPath)) { console.log(`ℹ️ whisper.cpp Modell nicht gefunden: ${modelPath}`); return; }

    stopWhisperCppService();
    try { fs.unlinkSync(WHISPER_CPP_STATUS); } catch {}

    const scriptPath = path.join(__dirname, '../../whisper_cpp_service.py');
    console.log(`🎙️ Starte whisper.cpp (Modell: ${model}, Sprache: ${language}, GPU: ${gpuMode})...`);

    whisperCppProcess = spawn('sudo', ['python3', scriptPath, modelPath, language, String(WHISPER_CPP_PORT), gpuMode], {
      detached: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    whisperCppProcess.stdout?.on('data', (d: Buffer) => console.log('[Whisper.cpp]', d.toString().trim()));
    whisperCppProcess.stderr?.on('data', (d: Buffer) => console.log('[Whisper.cpp stderr]', d.toString().trim()));
    whisperCppProcess.on('exit', (code) => { console.log(`[Whisper.cpp] beendet (${code})`); whisperCppProcess = null; });
  } catch (e: any) { console.log(`ℹ️ Whisper.cpp Start übersprungen: ${e.message}`); }
}

// ── Stopp-Funktionen ──────────────────────────────────────────────────
export function stopWhisperService(): void {
  if (whisperProcess) { try { whisperProcess.kill(); } catch {} whisperProcess = null; }
}
export function stopWhisperCppService(): void {
  if (whisperCppProcess) { try { whisperCppProcess.kill(); } catch {} whisperCppProcess = null; }
}
export function stopAllWhisperServices(): void {
  stopWhisperService();
  stopWhisperCppService();
}

// ── Neustart ──────────────────────────────────────────────────────────
export async function restartWhisperService(): Promise<void> {
  stopAllWhisperServices();
  await new Promise(r => setTimeout(r, 1000));
  await startWhisperService();
}

// ── Status-Checks ─────────────────────────────────────────────────────
export function isWhisperServiceReady(): boolean {
  try { return JSON.parse(fs.readFileSync(WHISPER_STATUS, 'utf8')).ready === true; } catch { return false; }
}
export function isWhisperCppServiceReady(): boolean {
  try { return JSON.parse(fs.readFileSync(WHISPER_CPP_STATUS, 'utf8')).ready === true; } catch { return false; }
}
export function isAnyWhisperReady(): boolean {
  return isWhisperServiceReady() || isWhisperCppServiceReady();
}

export { WHISPER_PORT, WHISPER_CPP_PORT };

// ── Installations-Checks ──────────────────────────────────────────────
export async function checkFasterWhisperInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('sudo', ['python3', '-c', 'from faster_whisper import WhisperModel; print("ok")'], { timeout: 10000 });
    let output = '';
    check.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
    check.on('close', () => resolve(output.includes('ok')));
    check.on('error', () => resolve(false));
  });
}

export async function checkWhisperCppInstalled(): Promise<boolean> {
  return fs.existsSync('/opt/whisper-cpp/build/bin/whisper-cli');
}

export async function checkWhisperCppModelInstalled(model: string): Promise<boolean> {
  return fs.existsSync(`/opt/whisper-cpp/models/ggml-${model}.bin`);
}
