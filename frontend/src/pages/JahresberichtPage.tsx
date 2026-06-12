import { useEffect, useState, useRef } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, FileText, Loader, Check } from 'lucide-react';
import { eventApi, incidentApi, vehicleApi, memberApi } from '../api';
import api from '../api';
import toast from 'react-hot-toast';
import { useBranding } from '../utils/BrandingContext';

const SECTION_LABELS: Record<string, string> = {
  vorwort:    'Vorwort',
  mitglieder: 'Mitgliederstand',
  einsaetze:  'Einsatzgeschehen',
  uebungen:   'Ausbildung & Übungen',
  fahrzeuge:  'Fahrzeuge & Gerät',
  schlusswort:'Schlusswort',
};

const SECTION_KEYS = ['vorwort', 'mitglieder', 'einsaetze', 'uebungen', 'fahrzeuge', 'schlusswort'];
const QUICK_BUTTONS = ['Kürzer fassen', 'Länger ausführen', 'Förmlicher', 'Persönlicher', 'Neu schreiben'];

// Bereinigt Modell-Artefakte aus dem generierten Text
function cleanText(text: string): string {
  return text
    // Markdown-Überschriften entfernen: ## VORWORT, ### Mitgliederstand etc.
    .replace(/^#{1,3}\s*[^\n]+\n?/gm, '')
    // Prompt-Anweisungen die das Modell manchmal übernimmt: (2-3 Saetze, ...) am Anfang
    .replace(/^\s*\([^)]{10,200}\)\s*\n?/gm, '')
    // Nummerierte Überschriften: "1. VORWORT", "2. MITGLIEDERSTAND"
    .replace(/^\d+\.\s+(VORWORT|MITGLIEDERSTAND|EINSATZGESCHEHEN|AUSBILDUNG|FAHRZEUGE|SCHLUSSWORT)[^\n]*\n?/gim, '')
    // Mehrfache Leerzeilen reduzieren
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
}

// Teilt Rohtext live auf — zeigt immer die aktuell laufende Sektion
function splitLive(raw: string): { sections: Record<string, string>; currentIdx: number } {
  const parts = raw.split('###ABSCHNITT###');
  const sections: Record<string, string> = {};
  SECTION_KEYS.forEach((k, i) => {
    sections[k] = i < parts.length ? cleanText(parts[i]) : '';
  });
  return { sections, currentIdx: parts.length - 1 };
}

export default function JahresberichtPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branding } = useBranding();
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const isManual = searchParams.get('manual') === '1';

  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState<string>('Daten werden geladen...');
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [aiRunning, setAiRunning] = useState(false);
  const [streamingSection, setStreamingSection] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('ollama');
  const abortRef = useRef<AbortController | null>(null);
  const rawBufferRef = useRef<string>(''); // Rohtext-Buffer außerhalb React-State
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [promptInputs, setPromptInputs] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, string>>({
    vorwort: '', mitglieder: '', einsaetze: '', uebungen: '', fahrzeuge: '', schlusswort: '',
  });

  useEffect(() => {
    if (isManual) { loadDataOnly(); } else { loadDataAndGenerate(); }
    return () => { abortRef.current?.abort(); };
  }, []);

  const loadDataOnly = async () => {
    setLoading(true);
    try {
      const from = `${year}-01-01`; const to = `${year}-12-31`;
      const [evRes, incRes, tripRes, memRes, memActiveRes] = await Promise.all([
        eventApi.list({ from, to, limit: '9999' }),
        incidentApi.list({ from, to, limit: '9999' }),
        vehicleApi.listTrips({ from, to, limit: '9999' }),
        memberApi.list({ limit: '9999' }),
        memberApi.list({ status: 'ACTIVE', limit: '9999' }),
      ]);
      setStats(buildStats(evRes, incRes, tripRes, memActiveRes));
      setSections({ vorwort: '', mitglieder: '', einsaetze: '', uebungen: '', fahrzeuge: '', schlusswort: '' });
    } catch { toast.error('Fehler beim Laden der Daten'); }
    finally { setLoading(false); }
  };

  const buildStats = (evRes: any, incRes: any, tripRes: any, memActiveRes: any) => {
    const evts = evRes.events || evRes || [];
    const incs = incRes.incidents || incRes || [];
    const trps = tripRes.trips || [];
    const mems = memActiveRes.members || memActiveRes || [];
    const totalKm = trps.reduce((s: number, t: any) => s + (t.endKm - t.startKm), 0);
    return {
      activeMembers: mems.length, youthMembers: 0, reserveMembers: 0, honorMembers: 0,
      newMembers: mems.filter((m: any) => m.joinDate && new Date(m.joinDate).getFullYear() === year).length,
      totalIncidents: incs.length,
      fireIncidents: incs.filter((i: any) => i.type === 'FIRE').length,
      technicalIncidents: incs.filter((i: any) => i.type === 'TECHNICAL').length,
      waterIncidents: incs.filter((i: any) => i.type === 'WATER').length,
      otherIncidents: incs.filter((i: any) => i.type === 'OTHER').length,
      totalEvents: evts.length,
      avgAttendance: evts.length > 0
        ? Math.round(evts.reduce((s: number, e: any) => s + (e._count?.attendances || 0), 0) / evts.length) : 0,
      totalTrips: trps.length, totalKm: totalKm.toLocaleString('de-AT'),
      fuelCost: 'keine Daten', activeEquipment: 0, checksPerformed: 0,
      openDefects: 0, totalHonors: 0, honorDetails: '',
    };
  };

  // ── Fetch-basiertes SSE ───────────────────────────────────────────────────

  const startStream = async (
    body: Record<string, unknown>,
    onToken: (token: string) => void,
    onSections: (s: Record<string, string>) => void,
    onError: (msg: string) => void,
    onDone: () => void,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const url = `${getBaseUrl()}/api/ai/jahresbericht/stream`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') onError('Verbindungsfehler');
      onDone(); return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({})) as any;
      onError(errData?.error || `Fehler ${response.status}`);
      onDone(); return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { onError('Stream nicht verfügbar'); onDone(); return; }

    let buffer = ''; let event = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('event: ')) { event = line.slice(7).trim(); }
          else if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (event === 'token')    onToken(parsed.text || '');
              if (event === 'sections') onSections(parsed.sections || {});
              if (event === 'error')    onError(parsed.message || 'Fehler');
            } catch { /* kein JSON */ }
            event = '';
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') onError('Verbindung unterbrochen');
    } finally { reader.releaseLock(); onDone(); }
  };

  // ── Laden + KI-Generierung ────────────────────────────────────────────────

  const loadDataAndGenerate = async () => {
    setLoading(true);
    setLoadingStep('Mitglieder & Einsätze werden geladen...');
    setLoadingStepIndex(0);
    try {
      const from = `${year}-01-01`; const to = `${year}-12-31`;
      const [evRes, incRes, tripRes, memRes, memActiveRes] = await Promise.all([
        eventApi.list({ from, to, limit: '9999' }),
        incidentApi.list({ from, to, limit: '9999' }),
        vehicleApi.listTrips({ from, to, limit: '9999' }),
        memberApi.list({ limit: '9999' }),
        memberApi.list({ status: 'ACTIVE', limit: '9999' }),
      ]);
      setLoadingStep('Statistiken werden berechnet...');
      setLoadingStepIndex(1);
      const computedStats = buildStats(evRes, incRes, tripRes, memActiveRes);
      setStats(computedStats);

      let resolvedProvider = 'ollama';
      try {
        const r = await api.get('/settings/active-ai-provider');
        resolvedProvider = r.data.provider || 'ollama';
        setActiveProvider(resolvedProvider);
      } catch {}

      // Loading weg → Hauptseite sichtbar, KI schreibt live
      setLoading(false);
      setAiRunning(true);
      rawBufferRef.current = '';

      await new Promise<void>((resolve) => {
        startStream(
          { year, stats: computedStats },
          (token) => {
            // Token zum Buffer hinzufügen
            rawBufferRef.current += token;
            const { sections: liveSections, currentIdx } = splitLive(rawBufferRef.current);
            // Nur Sektionen bis zur aktuellen updaten (verhindert flackern)
            setSections(prev => {
              const next = { ...prev };
              SECTION_KEYS.forEach((k, i) => {
                if (i <= currentIdx) next[k] = liveSections[k] || '';
              });
              return next;
            });
            setStreamingSection(SECTION_KEYS[Math.min(currentIdx, SECTION_KEYS.length - 1)]);
          },
          (finalSections) => {
            // Finaler bereinigter Text
            const cleaned: Record<string, string> = {};
            for (const [k, v] of Object.entries(finalSections)) cleaned[k] = cleanText(v as string);
            setSections(cleaned);
          },
          (msg) => toast(msg ? 'KI nicht verfügbar — ' + msg : 'KI nicht verfügbar', { icon: 'ℹ️' }),
          () => resolve(),
        );
      });

    } catch { toast.error('Fehler beim Laden der Daten'); setLoading(false); }
    finally { setAiRunning(false); setStreamingSection(null); rawBufferRef.current = ''; }
  };

  // ── Partial-Regenerierung ─────────────────────────────────────────────────

  const regenerateSection = (key: string, instruction?: string) => {
    if (!stats || regenerating) return;
    const instr = instruction || promptInputs[key] || '';
    if (!instr) return;
    setRegenerating(key);
    setStreamingSection(key);
    setSections(prev => ({ ...prev, [key]: '' }));
    let partialBuf = '';
    startStream(
      { year, stats, sectionKey: key, currentText: sections[key] || '', instruction: instr },
      (token) => {
        partialBuf += token;
        setSections(prev => ({ ...prev, [key]: cleanText(partialBuf) }));
      },
      (newSections) => {
        if (newSections[key]) setSections(prev => ({ ...prev, [key]: cleanText(newSections[key]) }));
        setPromptInputs(prev => ({ ...prev, [key]: '' }));
      },
      (msg) => toast.error(msg || 'Fehler beim Neu-Generieren'),
      () => { setRegenerating(null); setStreamingSection(null); },
    );
  };

  const goToSpeichern = () => {
    sessionStorage.setItem('jahresberichtSections', JSON.stringify(sections));
    sessionStorage.setItem('jahresberichtYear', String(year));
    navigate(`/reports/speichern?id=annual&title=Jahresbericht+${year}&from=${year}-01-01&to=${year}-12-31&fromJahresbericht=1`);
  };

  // ── Loading Screen ────────────────────────────────────────────────────────

  if (loading) {
    const steps = [
      { label: 'Mitglieder & Einsätze laden', icon: '📋' },
      { label: 'Statistiken berechnen', icon: '📊' },
    ];
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-8 max-w-sm mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-fire-50 flex items-center justify-center mx-auto mb-4">
            <Loader className="w-8 h-8 animate-spin text-fire-700" />
          </div>
          <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>
            Jahresbericht {year} wird vorbereitet
          </h2>
          <p className="text-sm text-ink-muted">{loadingStep}</p>
        </div>
        <div className="w-full space-y-3">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              i < loadingStepIndex ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : i === loadingStepIndex ? 'bg-fire-50 border-fire-200 text-fire-700'
              : 'bg-surface-50 border-surface-200 text-ink-muted'
            }`}>
              <span className="text-lg">{step.icon}</span>
              <span className="text-sm font-medium flex-1">{step.label}</span>
              {i < loadingStepIndex && <Check className="w-4 h-4 text-emerald-600" />}
              {i === loadingStepIndex && <Loader className="w-4 h-4 animate-spin text-fire-700" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Hauptseite ────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-muted" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
              Jahresbericht {year} {isManual ? '✍️ Händisch' : '🤖 KI-generiert'}
            </h1>
            <p className="text-sm text-ink-muted">
              {aiRunning
                ? `⚡ ${activeProvider.toUpperCase()} schreibt — Text erscheint live in den Feldern`
                : 'KI-Texte prüfen, bearbeiten & PDF erstellen'}
            </p>
          </div>
        </div>
        <button onClick={goToSpeichern} disabled={aiRunning} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
          aiRunning
            ? 'bg-surface-200 text-ink-muted cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}>
          <FileText className="w-4 h-4" />
          PDF erstellen
        </button>
      </div>

      {aiRunning ? (
        <div className="rounded-xl border border-fire-200 bg-fire-50 px-4 py-3 flex items-center gap-3">
          <Loader className="w-4 h-4 text-fire-600 animate-spin flex-shrink-0" />
          <p className="text-xs text-fire-700">
            Die KI generiert gerade alle Abschnitte — Text erscheint direkt in den Feldern. Bitte warten.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Alle Texte wurden von der KI generiert und können frei bearbeitet werden. Leer lassen = kein Text im PDF.
          </p>
        </div>
      )}

      {Object.entries(SECTION_LABELS).map(([key, label]) => {
        const isStreaming = streamingSection === key;
        const isRegen = regenerating === key;
        return (
          <div key={key} className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{label}</p>
              {(isStreaming || isRegen) && (
                <span className="text-xs text-fire-600 flex items-center gap-1">
                  <Loader className="w-3 h-3 animate-spin" /> schreibt...
                </span>
              )}
            </div>

            <div className="flex gap-2 items-start">
              <div className="relative w-full">
                <textarea
                  value={sections[key] || ''}
                  onChange={e => setSections(prev => ({ ...prev, [key]: e.target.value }))}
                  rows={key === 'vorwort' || key === 'schlusswort' ? 4 : 6}
                  className={`input-field resize-y text-sm leading-relaxed w-full transition-colors ${
                    isStreaming || isRegen ? 'border-fire-300 bg-fire-50/30' : ''
                  }`}
                  placeholder={`${label} — Text hier eingeben oder von der KI generieren lassen...`}
                  readOnly={aiRunning}
                />
                {(isStreaming || isRegen) && (
                  <span className="absolute bottom-3 right-8 text-fire-500 text-base animate-pulse select-none pointer-events-none">▍</span>
                )}
              </div>
              <DiktatButton onResult={text => setSections(prev => ({ ...prev, [key]: text }))} />
            </div>

            <div className="bg-surface-50 rounded-xl border border-surface-200 p-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_BUTTONS.map(btn => (
                  <button key={btn} type="button"
                    onClick={() => regenerateSection(key, btn)}
                    disabled={!!regenerating || aiRunning}
                    className="text-xs px-2.5 py-1 rounded-lg border border-surface-300 bg-white hover:bg-fire-50 hover:border-fire-300 hover:text-fire-700 transition-colors disabled:opacity-40 text-ink-muted"
                  >
                    {isRegen ? <Loader className="w-3 h-3 animate-spin inline" /> : btn}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text"
                  value={promptInputs[key] || ''}
                  onChange={e => setPromptInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && !regenerating && !aiRunning) regenerateSection(key); }}
                  placeholder="Eigene Anweisung, z.B. 'Den Einsatz in Hermagor erwähnen'..."
                  className="input-field text-xs flex-1 py-1.5"
                  disabled={!!regenerating || aiRunning}
                />
                <button type="button"
                  onClick={() => regenerateSection(key)}
                  disabled={!!regenerating || aiRunning}
                  className="flex items-center gap-1.5 text-xs text-fire-700 hover:text-fire-800 font-medium px-3 py-1.5 rounded-lg hover:bg-fire-50 border border-fire-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isRegen ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Neu generieren
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-between items-center pb-6">
        <button onClick={() => navigate('/reports')} className="btn-secondary">Abbrechen</button>
        <button onClick={goToSpeichern} disabled={aiRunning} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
          aiRunning
            ? 'bg-surface-200 text-ink-muted cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}>
          <FileText className="w-4 h-4" />
          PDF erstellen
        </button>
      </div>
    </div>
  );
}
