import { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Save } from 'lucide-react';
import { Mic, MicOff, Copy, Check, Download, Loader, Volume2, Terminal, ThumbsUp, X } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../utils/AuthContext';

interface WhisperStatus {
  installed: boolean;
  model: boolean;
  engine?: string;
  cppInstalled?: boolean;
  cppModelReady?: boolean;
  configuredModel?: string;
  configuredLanguage?: string;
}

export default function DiktatSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [status, setStatus]             = useState<WhisperStatus | null>(null);
  const [installing, setInstalling]     = useState(false);
  const [installLog, setInstallLog]     = useState('');
  const [installDone, setInstallDone]   = useState(false);
  const [installError, setInstallError] = useState('');
  const [recording, setRecording]       = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [text, setText]                 = useState('');
  const [copied, setCopied]             = useState(false);
  const [duration, setDuration]         = useState(0);
  const [wsModel, setWsModel]           = useState('medium');
  const [wsLanguage, setWsLanguage]     = useState('de');
  const [wsEngine, setWsEngine]         = useState<'faster-whisper' | 'whisper-cpp'>('faster-whisper');
  const [wsGpuMode, setWsGpuMode]       = useState<'auto' | 'gpu' | 'cpu'>('auto');

  // Modell-Download State
  const [modelDownloading, setModelDownloading] = useState(false);
  const [modelDownloadLog, setModelDownloadLog] = useState('');
  const [modelDownloadDone, setModelDownloadDone] = useState(false);
  const [modelDownloadError, setModelDownloadError] = useState('');
  const [showModelLog, setShowModelLog] = useState(false);
  const modelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wsSaving, setWsSaving]         = useState(false);
  const [wsChanged, setWsChanged]       = useState(false);

  // Engine-Wechsel Dialog
  const [pendingEngine, setPendingEngine] = useState<'faster-whisper' | 'whisper-cpp' | null>(null);
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);

  // whisper.cpp Installation
  const [cppInstalling, setCppInstalling]   = useState(false);
  const [cppInstallLog, setCppInstallLog]   = useState('');
  const [cppInstallDone, setCppInstallDone] = useState(false);
  const [cppInstallError, setCppInstallError] = useState('');
  const [showCppLog, setShowCppLog]         = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks   = useRef<Blob[]>([]);
  const cancelledRef  = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const cppPollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef        = useRef<HTMLDivElement>(null);
  const cppLogRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/whisper/settings').then(r => {
      setWsModel(r.data.model || 'medium');
      setWsLanguage(r.data.language || 'de');
      setWsEngine(r.data.engine || 'faster-whisper');
      setWsGpuMode(r.data.gpuMode || 'auto');
    }).catch(() => {});
  }, []);

  const loadStatus = useCallback(() => {
    api.get('/whisper/status')
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ installed: false, model: false }));
  }, []);

  useEffect(() => {
    loadStatus();
    api.get('/whisper/install-status').then(r => {
      if (r.data.running) {
        setInstalling(true);
        if (r.data.log) setInstallLog(r.data.log);
        pollRef.current = setInterval(pollInstallStatus, 2000);
      } else if (r.data.done && r.data.success) {
        loadStatus();
      }
    }).catch(() => {});

    // whisper.cpp Install-Status prüfen
    api.get('/whisper/install-cpp-status').then(r => {
      if (r.data.running) {
        setCppInstalling(true);
        setShowCppLog(true);
        if (r.data.log) setCppInstallLog(r.data.log);
        cppPollRef.current = setInterval(pollCppInstallStatus, 2000);
      }
    }).catch(() => {});
  }, [loadStatus]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [installLog]);

  useEffect(() => {
    if (cppLogRef.current) cppLogRef.current.scrollTop = cppLogRef.current.scrollHeight;
  }, [cppInstallLog]);

  const pollInstallStatus = useCallback(() => {
    api.get('/whisper/install-status').then(r => {
      const { done, success, error, log } = r.data;
      if (log) setInstallLog(log);
      if (done) {
        clearInterval(pollRef.current!);
        setInstalling(false);
        setInstallDone(true);
        if (success) { toast.success('faster-whisper erfolgreich installiert!'); loadStatus(); }
        else { setInstallError(error || 'Unbekannter Fehler'); toast.error('Installation fehlgeschlagen'); }
      }
    }).catch(() => {});
  }, [loadStatus]);

  const pollCppInstallStatus = useCallback(() => {
    api.get('/whisper/install-cpp-status').then(r => {
      const { done, success, error, log } = r.data;
      if (log) setCppInstallLog(log);
      if (done) {
        clearInterval(cppPollRef.current!);
        setCppInstalling(false);
        setCppInstallDone(true);
        if (success) {
          toast.success('whisper.cpp erfolgreich installiert!');
          // Engine automatisch auf whisper.cpp umschalten und Service neu starten
          api.put('/whisper/settings', { engine: 'whisper-cpp' }).then(() => {
            setWsEngine('whisper-cpp');
            loadStatus();
            toast.success('Engine auf whisper.cpp umgeschaltet!');
          });
        } else {
          setCppInstallError(error || 'Unbekannter Fehler');
          toast.error('whisper.cpp Installation fehlgeschlagen');
        }
      }
    }).catch(() => {});
  }, [loadStatus]);

  const install = async () => {
    setInstalling(true);
    setInstallLog('');
    setInstallDone(false);
    setInstallError('');
    try {
      await api.post('/whisper/install');
      pollRef.current = setInterval(pollInstallStatus, 2000);
    } catch {
      toast.error('Fehler beim Starten der Installation');
      setInstalling(false);
    }
  };

  const installCpp = async () => {
    setShowInstallConfirm(false);
    setCppInstalling(true);
    setCppInstallLog('');
    setCppInstallDone(false);
    setCppInstallError('');
    setShowCppLog(true);
    try {
      await api.post('/whisper/install-cpp');
      cppPollRef.current = setInterval(pollCppInstallStatus, 2000);
    } catch {
      toast.error('Fehler beim Starten der Installation');
      setCppInstalling(false);
    }
  };

  // Engine-Radio-Button geklickt
  const handleEngineChange = async (engine: 'faster-whisper' | 'whisper-cpp') => {
    if (engine === wsEngine) return;

    if (engine === 'whisper-cpp' && !status?.cppInstalled) {
      // Noch nicht installiert → Bestätigung anzeigen
      setPendingEngine(engine);
      setShowInstallConfirm(true);
      return;
    }

    if (engine === 'faster-whisper' && !status?.installed) {
      setPendingEngine(engine);
      setShowInstallConfirm(true);
      return;
    }

    // Bereits installiert → einfach umschalten + Service-Neustart
    try {
      await api.put('/whisper/settings', { engine });
      setWsEngine(engine);
      toast.success(`Engine auf ${engine} umgeschaltet — Service wird neu gestartet...`);
      setTimeout(() => { loadStatus(); }, 3000);
    } catch {
      toast.error('Fehler beim Umschalten der Engine');
    }
  };

  const confirmInstall = () => {
    if (pendingEngine === 'whisper-cpp') {
      installCpp();
    } else if (pendingEngine === 'faster-whisper') {
      install();
    }
    setPendingEngine(null);
  };

  const cancelInstall = () => {
    setPendingEngine(null);
    setShowInstallConfirm(false);
  };

  // Modell-Größen Info
  const MODEL_SIZES: Record<string, string> = {
    tiny: '~75 MB', base: '~150 MB', small: '~500 MB',
    medium: '~1.5 GB', large: '~3 GB',
  };

  const downloadModel = async () => {
    setModelDownloading(true);
    setModelDownloadLog('');
    setModelDownloadDone(false);
    setModelDownloadError('');
    setShowModelLog(true);
    try {
      await api.post('/whisper/download-model', { model: wsModel, engine: wsEngine });
      // Polling für Download-Status
      modelPollRef.current = setInterval(async () => {
        try {
          const r = await api.get('/whisper/download-model-status');
          if (r.data.log) setModelDownloadLog(r.data.log);
          if (r.data.done) {
            clearInterval(modelPollRef.current!);
            setModelDownloading(false);
            setModelDownloadDone(true);
            if (r.data.success) {
              toast.success('Modell erfolgreich heruntergeladen!');
              loadStatus();
            } else {
              setModelDownloadError(r.data.error || 'Fehler beim Herunterladen');
              toast.error('Download fehlgeschlagen');
            }
          }
        } catch {}
      }, 2000);
    } catch {
      toast.error('Fehler beim Starten des Downloads');
      setModelDownloading(false);
    }
  };

  const saveWsSettings = async () => {
    setWsSaving(true);
    try {
      await api.put('/whisper/settings', { model: wsModel, language: wsLanguage, gpuMode: wsGpuMode });
      setWsChanged(false);
      toast.success('Einstellungen gespeichert – Service wird neu gestartet...');
      await api.post('/whisper/restart-service').catch(() => {});
      toast.success('Whisper-Service neu gestartet!');
      loadStatus();
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setWsSaving(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (cancelledRef.current) { cancelledRef.current = false; audioChunks.current = []; return; }
        const blob = new Blob(audioChunks.current, { type: mimeType });
        await transcribe(blob, mimeType);
      };
      mediaRecorder.current.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Mikrofon-Zugriff verweigert — bitte Berechtigung erlauben');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder.current && recording) {
      cancelledRef.current = true;
      mediaRecorder.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const transcribe = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    try {
      const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
      const form = new FormData();
      form.append('audio', blob, `recording.${ext}`);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/whisper/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setText(prev => prev ? prev + ' ' + data.text : data.text);
      toast.success('Diktat transkribiert!');
    } catch (e: any) {
      toast.error(e.message || 'Transkriptionsfehler');
    } finally {
      setTranscribing(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const langLabel = (l: string) => ({ de: 'Deutsch', en: 'Englisch', it: 'Italienisch', sl: 'Slowenisch', hr: 'Kroatisch' }[l] || 'Auto');

  const activeEngineReady = wsEngine === 'whisper-cpp'
    ? (status?.cppInstalled && status?.cppModelReady)
    : (status?.installed && status?.model);

  // whisper.cpp installiert aber Modell fehlt
  const cppInstalledButNoModel = wsEngine === 'whisper-cpp' && status?.cppInstalled && !status?.cppModelReady;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>
          Diktat (Sprache zu Text)
        </h2>
        <p className="text-sm text-ink-muted">
          Powered by Whisper — läuft lokal auf dem Server, kostenlos und privat.
        </p>
      </div>

      {/* ── Engine-Auswahl (nur Admins) ── */}
      {isAdmin && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Engine</p>
          <div className="flex gap-4">
            {/* faster-whisper */}
            <label className={`flex items-start gap-3 cursor-pointer flex-1 p-3 rounded-xl border-2 transition-all ${wsEngine === 'faster-whisper' ? 'border-emerald-400 bg-emerald-50' : 'border-transparent'}`}>
              <input
                type="radio"
                name="whisper-engine"
                value="faster-whisper"
                checked={wsEngine === 'faster-whisper'}
                onChange={() => handleEngineChange('faster-whisper')}
                className={`mt-1 ${wsEngine === 'faster-whisper' ? 'accent-emerald-600' : 'accent-surface-300'}`}
              />
              <div>
                <p className="text-sm font-semibold">faster-whisper</p>
                <p className="text-xs text-ink-muted">Python · einfache Installation</p>
                {status?.installed
                  ? <span className="text-xs text-emerald-600 font-medium">✓ installiert</span>
                  : <span className="text-xs text-ink-muted">nicht installiert</span>}
              </div>
            </label>

            {/* whisper.cpp */}
            <label className={`flex items-start gap-3 cursor-pointer flex-1 p-3 rounded-xl border-2 transition-all ${wsEngine === 'whisper-cpp' ? 'border-emerald-400 bg-emerald-50' : 'border-transparent'}`}>
              <input
                type="radio"
                name="whisper-engine"
                value="whisper-cpp"
                checked={wsEngine === 'whisper-cpp'}
                onChange={() => handleEngineChange('whisper-cpp')}
                className={`mt-1 ${wsEngine === 'whisper-cpp' ? 'accent-emerald-600' : 'accent-surface-300'}`}
              />
              <div>
                <p className="text-sm font-semibold">whisper.cpp</p>
                <p className="text-xs text-ink-muted">C++ · 3–5× schneller</p>
                {status?.cppInstalled
                  ? <span className="text-xs text-emerald-600 font-medium">✓ installiert</span>
                  : <span className="text-xs text-ink-muted">nicht installiert</span>}
              </div>
            </label>
          </div>

          {/* whisper.cpp Installation läuft */}
          {cppInstalling && (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Loader className="w-3.5 h-3.5 animate-spin text-fire-700" />
              <span>whisper.cpp wird installiert...</span>
              <button onClick={() => setShowCppLog(v => !v)} className="ml-auto text-fire-700 underline">
                {showCppLog ? 'Log ausblenden' : 'Log anzeigen'}
              </button>
            </div>
          )}

          {/* whisper.cpp Install-Log */}
          {showCppLog && (cppInstalling || cppInstallDone) && (
            <div className="space-y-2">
              <div
                ref={cppLogRef}
                className="bg-gray-950 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5"
              >
                {cppInstallLog ? cppInstallLog.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className={
                    line.startsWith('FEHLER') || line.includes('Error') ? 'text-red-400' :
                    line.startsWith('>>>') ? 'text-green-300 font-semibold' :
                    'text-gray-300'
                  }>{line}</div>
                )) : <div className="text-gray-500">Starte Installation...</div>}
                {cppInstalling && <div className="text-green-400 animate-pulse">▋</div>}
              </div>
              {cppInstallDone && !cppInstallError && (
                <p className="text-xs text-emerald-600 font-semibold">✓ whisper.cpp erfolgreich installiert!</p>
              )}
              {cppInstallError && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-red-500">✗ {cppInstallError}</p>
                  <button onClick={installCpp} className="text-xs text-fire-700 underline">Erneut versuchen</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bestätigungs-Dialog ── */}
      {showInstallConfirm && (
        <div className="card p-5 border-amber-200 bg-amber-50 space-y-3">
          <p className="text-sm font-semibold text-amber-900">
            {pendingEngine === 'whisper-cpp'
              ? 'whisper.cpp ist noch nicht installiert.'
              : 'faster-whisper ist noch nicht installiert.'}
          </p>
          <p className="text-xs text-amber-800">
            {pendingEngine === 'whisper-cpp'
              ? 'whisper.cpp muss einmalig kompiliert und das Modell heruntergeladen werden (~1.5 GB, dauert 5–15 Minuten).'
              : 'faster-whisper + Modell muss heruntergeladen werden (~500 MB).'}
          </p>
          <div className="flex gap-2">
            <button onClick={confirmInstall}
              className="flex-1 py-2 bg-fire-700 text-white rounded-xl text-sm font-semibold hover:bg-fire-800">
              <Download className="w-4 h-4 inline mr-1.5" />
              Jetzt installieren
            </button>
            <button onClick={cancelInstall}
              className="flex-1 py-2 bg-white border border-surface-200 rounded-xl text-sm font-semibold hover:bg-surface-50">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* ── Whisper-Einstellungen ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-ink-muted" />
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Whisper-Einstellungen</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-muted mb-1">Modell</label>
            <select value={wsModel} onChange={e => { setWsModel(e.target.value); setWsChanged(true); setModelDownloadDone(false); setModelDownloadLog(''); setShowModelLog(false); }}
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-fire-300">
              <option value="tiny">tiny (schnellst, ungenau)</option>
              <option value="base">base (schnell)</option>
              <option value="small">small (ausgewogen)</option>
              <option value="medium">medium (empfohlen)</option>
              <option value="large">large (langsam, genau)</option>
            </select>

            {/* Modell herunterladen Button */}
            <button
              onClick={downloadModel}
              disabled={modelDownloading}
              className="w-full flex items-center justify-center gap-2 py-2 border border-surface-200 rounded-lg text-xs font-semibold text-ink-muted hover:bg-surface-50 hover:border-fire-300 hover:text-fire-700 transition-all disabled:opacity-50"
            >
              {modelDownloading ? (
                <><div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Lädt herunter...</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Modell laden ({MODEL_SIZES[wsModel] || '?'})</>
              )}
            </button>

            {/* Download Log */}
            {showModelLog && (modelDownloading || modelDownloadDone) && (
              <div className="space-y-1.5">
                <div className="bg-gray-950 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs space-y-0.5">
                  {modelDownloadLog ? modelDownloadLog.split('\n').filter(Boolean).map((line, i) => (
                    <div key={i} className={
                      line.includes('Fehler') || line.includes('Error') ? 'text-red-400' :
                      line.startsWith('>>>') ? 'text-green-300 font-semibold' : 'text-gray-300'
                    }>{line}</div>
                  )) : <div className="text-gray-500">Starte Download...</div>}
                  {modelDownloading && <div className="text-green-400 animate-pulse">▋</div>}
                </div>
                {modelDownloadDone && !modelDownloadError && (
                  <p className="text-xs text-emerald-600 font-semibold">✓ Modell erfolgreich heruntergeladen!</p>
                )}
                {modelDownloadError && (
                  <p className="text-xs text-red-500">✗ {modelDownloadError}</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Sprache</label>
            <select value={wsLanguage} onChange={e => { setWsLanguage(e.target.value); setWsChanged(true); }}
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-fire-300">
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
              <option value="it">Italienisch</option>
              <option value="sl">Slowenisch</option>
              <option value="hr">Kroatisch</option>
            </select>
          </div>
        </div>
        {/* GPU-Modus — nur bei whisper.cpp */}
        {wsEngine === 'whisper-cpp' && (
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-2">GPU-Modus</label>
            <div className="flex gap-2">
              {(['auto', 'gpu', 'cpu'] as const).map(mode => (
                <button key={mode} onClick={() => { setWsGpuMode(mode); setWsChanged(true); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    wsGpuMode === mode
                      ? 'bg-fire-700 text-white border-fire-700'
                      : 'bg-white text-ink-muted border-surface-200 hover:border-fire-300'
                  }`}>
                  {mode === 'auto' ? '🔍 Automatisch' : mode === 'gpu' ? '⚡ GPU' : '🖥️ CPU'}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted mt-1">
              {wsGpuMode === 'auto' ? 'Erkennt automatisch ob eine NVIDIA GPU vorhanden ist'
                : wsGpuMode === 'gpu' ? 'GPU erzwingen (nur wenn NVIDIA GPU + CUDA vorhanden)'
                : 'Immer CPU verwenden (kein GPU)'}
            </p>
          </div>
        )}

        {wsChanged && (
          <button onClick={saveWsSettings} disabled={wsSaving}
            className="btn-primary flex items-center gap-2 w-full justify-center">
            {wsSaving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Speichern...</>
              : <><Save className="w-4 h-4" /> Einstellungen speichern</>}
          </button>
        )}
      </div>

            {/* ── Status-Box ── */}
      {status === null ? (
        <div className="card p-4 flex items-center gap-3 text-ink-muted">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">Status wird geprüft...</span>
        </div>
      ) : !activeEngineReady ? (
        <div className="card p-5 space-y-4">
          {!installing && !installDone && (
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cppInstalledButNoModel ? 'bg-amber-400' : 'bg-red-400'}`} />
              <div>
                <p className="font-semibold text-sm">
                  {cppInstalledButNoModel
                    ? 'Whisper bereit — Modell fehlt'
                    : `${wsEngine === 'whisper-cpp' ? 'whisper.cpp' : 'faster-whisper'} nicht installiert`}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {cppInstalledButNoModel
                    ? `Das Modell "${wsModel}" wurde noch nicht heruntergeladen. Bitte oben "Modell laden" klicken.`
                    : wsEngine === 'whisper-cpp'
                      ? 'Bitte oben "Jetzt installieren" wählen'
                      : 'faster-whisper + Modell wird heruntergeladen (~500 MB)'}
                </p>
              </div>
            </div>
          )}

          {wsEngine === 'faster-whisper' && !installing && !installDone && (
            <button onClick={install}
              className="btn-primary flex items-center gap-2 w-full justify-center">
              <Download className="w-4 h-4" />
              Whisper installieren &amp; Modell laden
            </button>
          )}

          {(installing || installDone) && wsEngine === 'faster-whisper' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-ink-muted" />
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  {installing ? 'Installation läuft...' : installError ? 'Fehlgeschlagen' : 'Abgeschlossen'}
                </span>
                {installing && <Loader className="w-3.5 h-3.5 animate-spin text-fire-700 ml-auto" />}
                {installDone && !installError && <span className="ml-auto text-xs font-semibold text-emerald-600">✓ Erfolgreich</span>}
              </div>
              <div ref={logRef} className="bg-gray-950 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5">
                {installLog ? installLog.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className={
                    line.startsWith('FEHLER') ? 'text-red-400' :
                    line.startsWith('>>>') ? 'text-green-300 font-semibold' : 'text-gray-300'
                  }>{line}</div>
                )) : <div className="text-gray-500">Starte Installation...</div>}
                {installing && <div className="text-green-400 animate-pulse">▋</div>}
              </div>
              {installDone && !installError && (
                <button onClick={() => { setInstallDone(false); loadStatus(); }} className="btn-primary w-full">
                  Whisper verwenden
                </button>
              )}
              {installError && (
                <button onClick={install} className="btn-secondary w-full">Erneut versuchen</button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Bereit */}
          <div className="card p-4 flex items-center gap-3 bg-emerald-50 border-emerald-200">
            <Volume2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Whisper bereit</p>
              <p className="text-xs text-emerald-700">
                Konfiguriert: {wsModel} · {langLabel(wsLanguage)} · Lokal · {wsEngine}
              </p>
            </div>
          </div>

          {/* Aufnahme */}
          <div className="card p-6 flex flex-col items-center gap-4">
            {/* Ruhezustand: nur Mikrofon */}
            {!recording && !transcribing && (
              <button
                onClick={startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg bg-fire-700 hover:bg-fire-800"
              >
                <Mic className="w-8 h-8 text-white" />
              </button>
            )}

            {/* Aufnahme läuft: Schallwellen-Mikrofon + Timer + X + 👍 */}
            {recording && (
              <div className="flex flex-col items-center gap-5">
                {/* Schallwellen-Animation */}
                <div className="relative flex items-center justify-center">
                  {/* Schallwellen — 3 Ringe die nach außen laufen */}
                  <span className="absolute w-24 h-24 rounded-full bg-red-400 opacity-20 animate-ping" style={{ animationDuration: '1.2s' }} />
                  <span className="absolute w-16 h-16 rounded-full bg-red-400 opacity-30 animate-ping" style={{ animationDuration: '1.2s', animationDelay: '0.3s' }} />
                  <span className="absolute w-10 h-10 rounded-full bg-red-500 opacity-40 animate-ping" style={{ animationDuration: '1.2s', animationDelay: '0.6s' }} />
                  {/* Mikrofon-Kreis */}
                  <div className="relative z-10 w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                </div>
                {/* Timer */}
                <p className="text-red-500 font-mono font-bold text-2xl">{fmt(duration)}</p>
                {/* X + 👍 */}
                <div className="flex items-center gap-4">
                  <button onClick={cancelRecording} title="Aufnahme verwerfen"
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg">
                    <X className="w-6 h-6 text-white" />
                  </button>
                  <button onClick={stopRecording} title="Aufnahme bestätigen & transkribieren"
                    className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-all shadow-lg">
                    <ThumbsUp className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Transkribiere */}
            {transcribing && (
              <div className="flex flex-col items-center gap-3">
                <Loader className="w-10 h-10 text-fire-700 animate-spin" />
                <p className="text-sm text-ink-muted">Transkribiere...</p>
              </div>
            )}

            <p className="text-sm text-ink-muted text-center">
              {transcribing ? ''
                : recording ? 'Aufnahme läuft — ✕ verwerfen oder 👍 bestätigen & transkribieren'
                : 'Klicken um Aufnahme zu starten'}
            </p>
          </div>

          {/* Textfeld */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Transkribierter Text
              </label>
              <div className="flex gap-2">
                {text && (
                  <>
                    <button onClick={copyText}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Kopiert!' : 'Kopieren'}
                    </button>
                    <button onClick={() => setText('')}
                      className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Hier erscheint der transkribierte Text..."
              rows={8}
              className="w-full border border-surface-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-fire-300"
            />
            <p className="text-xs text-ink-muted">
              Tipp: Mehrere Aufnahmen werden zusammengefügt. Text kann bearbeitet werden.
            </p>


          </div>
        </>
      )}
    </div>
  );
}
