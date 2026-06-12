import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { env } from '../config/env';
import { trackAiUsage } from '../utils/aiUsage';
import { decryptSecret } from '../utils/crypto';

const router = Router();
router.use(authenticate);

const SECTION_NAMES: Record<string,string> = {
  vorwort: 'Vorwort',
  mitglieder: 'Mitgliederstand',
  einsaetze: 'Einsatzgeschehen',
  uebungen: 'Ausbildung und Uebungen',
  fahrzeuge: 'Fahrzeuge und Geraet',
  schlusswort: 'Schlusswort',
};

let cachedApiKey: string | null = null;
let cachedProvider: string = 'gemini';
let cachedOllamaUrl: string = '';
let cachedOllamaModel: string = 'gemma2:2b';
let cacheTime = 0;

export function resetAiCache() {
  cacheTime = 0;
  cachedApiKey = null;
}

async function getProviderConfig(): Promise<{ key: string; provider: string; ollamaUrl: string; ollamaModel: string }> {
  if (cachedApiKey && Date.now() - cacheTime < 10000) {
    return { key: cachedApiKey, provider: cachedProvider, ollamaUrl: cachedOllamaUrl, ollamaModel: cachedOllamaModel };
  }
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    await prisma.$disconnect();

    const activeProvider = settings?.activeAiProvider || 'gemini';
    const geminiKey   = decryptSecret(settings?.geminiApiKey) || env.GEMINI_API_KEY || '';
    const groqKey     = decryptSecret(settings?.groqApiKey)   || env.GROQ_API_KEY   || '';
    const openaiKey   = decryptSecret(settings?.openaiApiKey) || '';
    const ollamaUrl   = settings?.ollamaUrl     || 'http://localhost:11434';
    const ollamaModel = settings?.ollamaModel   || 'gemma2:2b';

    const keyMap: Record<string, string> = {
      gemini: geminiKey,
      groq:   groqKey,
      openai: openaiKey,
      ollama: ollamaUrl,
    };

    const key = keyMap[activeProvider] || '';
    cachedApiKey    = key;
    cachedProvider  = activeProvider;
    cachedOllamaUrl = ollamaUrl;
    cachedOllamaModel = ollamaModel;
    cacheTime = Date.now();

    console.log(`[AI] Provider: ${activeProvider}, Key/URL vorhanden: ${!!key}`);
    return { key, provider: activeProvider, ollamaUrl, ollamaModel };
  } catch (e) {
    console.error('[AI] getProviderConfig Fehler:', e);
    return { key: env.GEMINI_API_KEY || '', provider: 'gemini', ollamaUrl: 'http://localhost:11434', ollamaModel: 'gemma2:2b' };
  }
}

// ── SSE Helper ────────────────────────────────────────────────────────────────

function sseSetup(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: kein Puffern
  res.flushHeaders();
}

function sseSend(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Sofort flushen — verhindert dass Express/Node Chunks puffert
  (res as any).flush?.();
}

function sseEnd(res: Response) {
  res.write('event: done\ndata: {}\n\n');
  (res as any).flush?.();
  res.end();
}

// ── Prompt Builder ────────────────────────────────────────────────────────────

function buildPrompts(params: {
  year: string; stats: any; sectionKey?: string;
  currentText?: string; instruction?: string;
  provider: string; ollamaModel: string;
}): { systemPrompt: string; userPrompt: string; isPartial: boolean } {
  const { year, stats, sectionKey, currentText, instruction, provider, ollamaModel } = params;
  const nextYear = String(parseInt(year) + 1);
  const isPartial = !!(sectionKey && instruction);

  const systemPrompt =
    'Du bist ein erfahrener österreichischer Feuerwehr-Schriftführer. ' +
    'Schreibe offizielle Jahresberichte für Freiwillige Feuerwehren in Österreich. ' +
    'Deine Texte klingen authentisch, menschlich und professionell. ' +
    'Schreibe immer mit korrekten deutschen Umlauten (ä, ö, ü, Ä, Ö, Ü, ß). ' +
    'NIEMALS Markdown-Sternchen oder Listen — nur reinen Fließtext.';

  let userPrompt: string;

  if (isPartial) {
    const sectionName = SECTION_NAMES[sectionKey!] || sectionKey!;
    userPrompt =
      'Überarbeite den Abschnitt "' + sectionName + '" des Feuerwehr-Jahresberichts ' + year + '. ' +
      'ANWEISUNG: ' + instruction + '. ' +
      'AKTUELLER TEXT: ' + (currentText || '') + '. ' +
      'Antworte NUR mit dem überarbeiteten Text als reinen Fließtext, ohne Überschrift, mit korrekten Umlauten.';
  } else {
    const statLine = [
      'Mitglieder: ' + stats.activeMembers + ' aktiv, ' + stats.youthMembers + ' Jugend, ' + stats.reserveMembers + ' Reservisten',
      'Einsätze: ' + stats.totalIncidents + ' gesamt (' + stats.fireIncidents + ' Brand, ' + stats.technicalIncidents + ' Technisch, ' + stats.waterIncidents + ' Wasser)',
      'Übungen: ' + stats.totalEvents + ' Veranstaltungen, ' + stats.avgAttendance + ' Teilnehmer',
      'Fahrzeuge: ' + stats.totalTrips + ' Fahrten, ' + stats.totalKm + ' km' + (stats.fuelCost !== 'keine Daten' ? ', ' + stats.fuelCost : ''),
      stats.totalHonors > 0 ? 'Ehrungen: ' + stats.totalHonors : null,
    ].filter(Boolean).join('; ');

    const isSmallModel = provider === 'ollama' && (ollamaModel.includes('gemma') || ollamaModel.includes('phi') || ollamaModel.includes('2b') || ollamaModel.includes('3b'));
    const isCloudProvider = provider === 'groq' || provider === 'gemini' || provider === 'openai';
    const sentMain   = isSmallModel ? '3-4'  : isCloudProvider ? '18-20' : '10-12';
    const sentSecond = isSmallModel ? '3-4'  : isCloudProvider ? '18-20' : '10-12';
    const sentSmall  = isSmallModel ? '2-3'  : isCloudProvider ? '15-18' : '8-10';

    // Alle Ollama-Modelle ignorieren ###ABSCHNITT### zuverlässig —
    // stattdessen ## Überschriften als natürliche Trenner nutzen
    const isSmallOllama = provider === 'ollama';
    userPrompt = isSmallOllama
      ? 'Schreibe den Jahresbericht ' + year + ' der Freiwilligen Feuerwehr Görtschach im Gailtal. ' +
        'Statistiken: ' + statLine + '. ' +
        'Schreibe genau 6 Abschnitte mit diesen EXAKTEN Überschriften (mit ## davor), danach sofort der Text:\n' +
        '## Vorwort\n## Mitgliederstand\n## Einsatzgeschehen\n## Ausbildung und Übungen\n## Fahrzeuge und Gerät\n## Schlusswort\n' +
        'Pro Abschnitt ' + sentMain + ' Sätze reiner Fließtext. ' +
        'Vorwort beginnt mit: Das Jahr ' + year + ' war für unsere Feuerwehr. ' +
        'Schlusswort: Dank an Mitglieder und Gemeinde, Ausblick ' + nextYear + '. ' +
        'Korrekte deutsche Umlaute (ä, ö, ü, ß). KEINE Sternchen, KEINE Listen.'
      : 'Schreibe den Jahresbericht ' + year + ' der Freiwilligen Feuerwehr Görtschach im Gailtal. ' +
        'Statistiken: ' + statLine + '. ' +
        'WICHTIG: Schreibe genau 6 Abschnitte. Trenne jeden Abschnitt EXAKT mit ###ABSCHNITT###. ' +
        'Format: [Text 1]###ABSCHNITT###[Text 2]###ABSCHNITT###[Text 3]###ABSCHNITT###[Text 4]###ABSCHNITT###[Text 5]###ABSCHNITT###[Text 6] ' +
        '1. VORWORT (' + sentMain + ' Sätze, persönlich und warm, beginne mit: Das Jahr ' + year + ' war für unsere Feuerwehr) ' +
        '2. MITGLIEDERSTAND (' + sentMain + ' Sätze, Personalstand ausführlich mit genauen Zahlen) ' +
        '3. EINSATZGESCHEHEN (' + sentMain + ' Sätze, Einsätze lebendig beschreiben mit genauen Zahlen) ' +
        '4. AUSBILDUNG UND ÜBUNGEN (' + sentSecond + ' Sätze, Aktivitäten, Kurse und Kameradschaft) ' +
        '5. FAHRZEUGE UND GERÄT (' + sentSmall + ' Sätze, km-Zahlen, Wartung und Ausrüstung) ' +
        '6. SCHLUSSWORT (' + sentSmall + ' Sätze, Dank an Mitglieder und Gemeinde, Ausblick ' + nextYear + ') ' +
        'Nur reinen Fließtext, KEINE Listen, KEINE Sternchen, NUR ###ABSCHNITT### als Trenner.';
  }

  return { systemPrompt, userPrompt, isPartial };
}

// ── Text → Sections splitter ──────────────────────────────────────────────────

// Überschriften die gemma2:2b typischerweise schreibt
const HEADING_KEYWORDS: Record<string, string> = {
  'vorwort':      'vorwort',
  'mitgliederstand': 'mitglieder',
  'mitglied':     'mitglieder',
  'einsatzgeschehen': 'einsaetze',
  'einsatz':      'einsaetze',
  'ausbildung':   'uebungen',
  'übungen':      'uebungen',
  'uebungen':     'uebungen',
  'fahrzeuge':    'fahrzeuge',
  'gerät':        'fahrzeuge',
  'geraet':       'fahrzeuge',
  'schlusswort':  'schlusswort',
};

function cleanSectionText(text: string): string {
  return text
    // ## Überschriften entfernen
    .replace(/^#{1,3}\s*[^\n]+\n?/gm, '')
    // Prompt-Anweisungen in Klammern am Zeilenanfang
    .replace(/^\s*\([^)]{10,200}\)\s*\n?/gm, '')
    // Nummerierte Überschriften
    .replace(/^\d+\.\s+(VORWORT|MITGLIEDERSTAND|EINSATZGESCHEHEN|AUSBILDUNG|FAHRZEUGE|SCHLUSSWORT|Vorwort|Mitgliederstand|Einsatzgeschehen|Ausbildung|Fahrzeuge|Schlusswort)[^\n]*\n?/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoSections(text: string): Record<string, string> {
  const result: Record<string, string> = {
    vorwort: '', mitglieder: '', einsaetze: '', uebungen: '', fahrzeuge: '', schlusswort: '',
  };

  // Strategie 1: ###ABSCHNITT### (Cloud-Provider)
  if (text.includes('###ABSCHNITT###')) {
    const parts = text.split('###ABSCHNITT###').map((s: string) => cleanSectionText(s));
    const keys = ['vorwort','mitglieder','einsaetze','uebungen','fahrzeuge','schlusswort'];
    keys.forEach((k, i) => { result[k] = parts[i] || ''; });
    console.log('[AI] Split via ###ABSCHNITT###, parts:', parts.length);
    return result;
  }

  // Strategie 2: ## Überschriften (gemma2:2b Standardverhalten)
  const headingRegex = /^#{1,3}\s*(.+)$/gm;
  const headings: { idx: number; key: string }[] = [];
  let m;
  while ((m = headingRegex.exec(text)) !== null) {
    const headingLower = m[1].toLowerCase().trim();
    for (const [keyword, sectionKey] of Object.entries(HEADING_KEYWORDS)) {
      if (headingLower.includes(keyword)) {
        headings.push({ idx: m.index, key: sectionKey });
        break;
      }
    }
  }

  if (headings.length >= 4) {
    console.log('[AI] Split via ## Überschriften, gefunden:', headings.length);
    headings.forEach((h, i) => {
      const start = text.indexOf('\n', h.idx) + 1;
      const end   = i + 1 < headings.length ? headings[i + 1].idx : text.length;
      result[h.key] = cleanSectionText(text.slice(start, end));
    });
    return result;
  }

  // Strategie 3: Nummerierte Abschnitte
  const numbered = text.split(/\n(?=\d+\.\s+[A-ZÄÖÜ])/);
  if (numbered.length >= 5) {
    const keys = ['vorwort','mitglieder','einsaetze','uebungen','fahrzeuge','schlusswort'];
    numbered.forEach((part, i) => {
      if (keys[i]) result[keys[i]] = cleanSectionText(part.replace(/^\d+\.\s+[^\n]+\n/, ''));
    });
    console.log('[AI] Split via nummerierte Abschnitte, parts:', numbered.length);
    return result;
  }

  // Strategie 4: Fallback — alles ins Vorwort
  console.log('[AI] Fallback: gesamter Text ins Vorwort');
  result['vorwort'] = cleanSectionText(text);
  return result;
}

// ── SSE Streaming Route (POST — Auth-Header funktioniert) ─────────────────────

router.post('/jahresbericht/stream', requirePermission('reports', 'CREATE'), async (req: Request, res: Response) => {
  const { key: apiKey, provider, ollamaUrl, ollamaModel } = await getProviderConfig();

  if (provider !== 'ollama' && !apiKey) {
    res.status(503).json({ error: 'Kein API-Key konfiguriert. Bitte unter Administration → KI & Integrationen eintragen.' });
    return;
  }

  const { year, stats, sectionKey, currentText, instruction } = req.body;

  const { systemPrompt, userPrompt, isPartial } = buildPrompts({
    year: String(year), stats, sectionKey, currentText, instruction, provider, ollamaModel,
  });

  sseSetup(res);

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    if (provider === 'ollama') {
      // ── Ollama streaming (via nativen http/https — kein Node fetch-Buffer) ──
      const baseUrl = (ollamaUrl || apiKey).replace(/\/$/, '');
      const isSmallOllamaModel = ollamaModel.includes('2b') || ollamaModel.includes('3b') || ollamaModel.includes('phi');
      const numPredict = isPartial ? 400 : (isSmallOllamaModel ? 1200 : 2000);

      const ollamaPayload = JSON.stringify({
        model: ollamaModel || 'gemma2:2b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        stream: true,
        options: { num_predict: numPredict, temperature: 0.7 },
      });

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      await new Promise<void>((resolve, reject) => {
        const http = require('http');
        const url = new URL(baseUrl + '/api/chat');
        const reqOpts = {
          hostname: url.hostname,
          port: url.port || 11434,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(ollamaPayload),
          },
        };

        const ollamaReq = http.request(reqOpts, (ollamaResp: any) => {
          if (ollamaResp.statusCode !== 200) {
            sseSend(res, 'error', { message: `Ollama Fehler: HTTP ${ollamaResp.statusCode}` });
            resolve(); return;
          }

          let lineBuf = '';
          ollamaResp.on('data', (chunk: Buffer) => {
            if (aborted) { ollamaReq.destroy(); return; }
            lineBuf += chunk.toString('utf8');
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                const token = parsed.message?.content || '';
                if (token) {
                  fullText += token;
                  sseSend(res, 'token', { text: token });
                }
                if (parsed.done) {
                  inputTokens  = parsed.prompt_eval_count || 0;
                  outputTokens = parsed.eval_count        || 0;
                }
              } catch { /* kein JSON */ }
            }
          });

          ollamaResp.on('end', () => resolve());
          ollamaResp.on('error', reject);
        });

        ollamaReq.on('error', (err: Error) => {
          sseSend(res, 'error', { message: 'Ollama nicht erreichbar — läuft der Dienst?' });
          resolve();
        });

        // Timeout
        ollamaReq.setTimeout(20 * 60 * 1000, () => {
          ollamaReq.destroy();
          resolve();
        });

        ollamaReq.write(ollamaPayload);
        ollamaReq.end();
      });

      trackAiUsage({ provider: 'ollama', function: isPartial ? 'jahresbericht_section' : 'jahresbericht',
        model: ollamaModel, inputTokens, outputTokens, userId: (req as any).user?.userId });

      if (isPartial) {
        sseSend(res, 'sections', { sections: { [sectionKey!]: fullText.trim() } });
      } else {
        sseSend(res, 'sections', { sections: splitIntoSections(fullText) });
      }

    } else if (provider === 'gemini') {
      // ── Gemini streaming ────────────────────────────────────────────────────
      const geminiUrl =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?alt=sse&key=' + apiKey;

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { maxOutputTokens: isPartial ? 600 : 2000, temperature: 0.7 },
        }),
      });

      if (!geminiRes.ok || !geminiRes.body) {
        const errText = await geminiRes.text().catch(() => '');
        console.error('Gemini Fehler:', geminiRes.status, errText);
        let msg = 'KI-Service nicht erreichbar';
        if (geminiRes.status === 429) msg = 'Tageslimit erreicht — bitte später nochmal versuchen';
        sseSend(res, 'error', { message: msg });
        sseEnd(res);
        return;
      }

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (token) { fullText += token; sseSend(res, 'token', { text: token }); }
            const usage = parsed.usageMetadata;
            if (usage) {
              inputTokens  = usage.promptTokenCount     || inputTokens;
              outputTokens = usage.candidatesTokenCount || outputTokens;
            }
          } catch { /* kein valides JSON */ }
        }
      }

      trackAiUsage({ provider: 'gemini', function: isPartial ? 'jahresbericht_section' : 'jahresbericht',
        model: 'gemini-2.0-flash-lite', inputTokens, outputTokens, userId: (req as any).user?.userId });

      if (isPartial) {
        sseSend(res, 'sections', { sections: { [sectionKey!]: fullText.trim() } });
      } else {
        sseSend(res, 'sections', { sections: splitIntoSections(fullText) });
      }

    } else if (provider === 'groq' || provider === 'openai') {
      // ── Groq / OpenAI streaming ─────────────────────────────────────────────
      const url   = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          max_tokens: isPartial ? 600 : 2000, temperature: 0.7, stream: true,
          // Token-Usage im letzten Streaming-Chunk mitsenden (OpenAI & Groq)
          stream_options: { include_usage: true },
        }),
      });

      if (!apiRes.ok || !apiRes.body) {
        const errText = await apiRes.text().catch(() => '');
        console.error(`${provider} Fehler:`, apiRes.status, errText);
        let msg = 'KI-Service nicht erreichbar';
        if (apiRes.status === 429) msg = 'Tageslimit erreicht — bitte später nochmal versuchen';
        sseSend(res, 'error', { message: msg });
        sseEnd(res);
        return;
      }

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      const reader = apiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) { fullText += token; sseSend(res, 'token', { text: token }); }
            if (parsed.usage) {
              inputTokens  = parsed.usage.prompt_tokens     || inputTokens;
              outputTokens = parsed.usage.completion_tokens || outputTokens;
            }
          } catch { /* kein valides JSON */ }
        }
      }

      trackAiUsage({ provider, function: isPartial ? 'jahresbericht_section' : 'jahresbericht',
        model, inputTokens, outputTokens, userId: (req as any).user?.userId });

      if (isPartial) {
        sseSend(res, 'sections', { sections: { [sectionKey!]: fullText.trim() } });
      } else {
        sseSend(res, 'sections', { sections: splitIntoSections(fullText) });
      }
    }

  } catch (error: any) {
    console.error('[AI Stream] Fehler:', error?.message || error);
    if (!res.writableEnded) sseSend(res, 'error', { message: 'Interner Fehler: ' + (error?.message || 'Unbekannt') });
  }

  if (!res.writableEnded) sseEnd(res);
});

export default router;


