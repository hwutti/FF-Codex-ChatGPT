import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { initWebSocket } from './utils/websocket';
import { startReminderScheduler } from './utils/pushReminder';
import { startWhisperService } from './utils/whisperService';
import { updateFavicons } from './utils/updateFavicons';
import * as path from 'path';
import * as fs from 'fs';

async function warmupOllama() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const db = new PrismaClient();
    const settings = await db.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    await db.$disconnect();

    // Nur vorladen wenn Ollama der aktive Provider ist
    if (settings?.activeAiProvider !== 'ollama') return;

    const ollamaUrl = settings?.ollamaUrl || 'http://localhost:11434';
    const ollamaModel = settings?.ollamaModel || 'gemma2:2b';

    console.log(`🤖 Ollama Warm-up: Lade Modell "${ollamaModel}" in den RAM...`);
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt: 'Hi', stream: false, keep_alive: -1 }),
      signal: AbortSignal.timeout(120 * 1000),
    });
    if (response.ok) {
      console.log(`✅ Ollama Modell "${ollamaModel}" ist bereit!`);
    }
  } catch (e: any) {
    console.log(`ℹ️ Ollama Warm-up übersprungen: ${e.message}`);
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Datenbankverbindung hergestellt');

    const server = app.listen(env.PORT, '127.0.0.1', () => {
      console.log(`🚀 Backend läuft auf http://127.0.0.1:${env.PORT}`);
      console.log(`   Umgebung: ${env.NODE_ENV}`);
    });

    initWebSocket(server);

    // Ollama im Hintergrund aufwärmen (blockiert den Start nicht)
    setTimeout(() => warmupOllama(), 10000);

    // Whisper Service starten (Modell dauerhaft im RAM)
    setTimeout(() => startWhisperService(), 5000);
    startReminderScheduler();

    // Favicons beim Start aktualisieren falls Branding-Logo vorhanden
    setTimeout(async () => {
      try {
        const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
        if (settings?.logoUrl) {
          const logoPath = path.join(env.UPLOAD_DIR, settings.logoUrl.replace('/uploads/', ''));
          if (fs.existsSync(logoPath)) {
            await updateFavicons(logoPath);
          }
        }
      } catch (e) { console.error('Favicon-Start-Update fehlgeschlagen:', e); }
    }, 3000);

    process.on('SIGTERM', async () => {
      console.log('SIGTERM erhalten, Server wird beendet...');
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Fehler beim Serverstart:', error);
    process.exit(1);
  }
}

startServer();
