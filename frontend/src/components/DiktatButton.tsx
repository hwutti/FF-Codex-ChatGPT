import { useState, useRef } from 'react';
import { Mic, Loader, ThumbsUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface DiktatButtonProps {
  onResult: (text: string) => void;
  className?: string;
}

export default function DiktatButton({ onResult, className = '' }: DiktatButtonProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks   = useRef<Blob[]>([]);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef  = useRef(false);
  const streamRef     = useRef<MediaStream | null>(null);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      cancelledRef.current = false;

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (cancelledRef.current) {
          // Verwerfen – kein Transkribieren
          cancelledRef.current = false;
          audioChunks.current = [];
          setState('idle');
          setDuration(0);
          return;
        }
        // Prüfen ob genug Audio vorhanden (mind. 0.5s)
        const totalSize = audioChunks.current.reduce((sum, c) => sum + c.size, 0);
        if (totalSize < 1000) {
          toast.error('Aufnahme zu kurz');
          setState('idle');
          setDuration(0);
          return;
        }
        setState('transcribing');
        const blob = new Blob(audioChunks.current, { type: mimeType });
        await transcribe(blob, mimeType);
      };

      mediaRecorder.current.start(100);
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Mikrofon-Zugriff verweigert');
    }
  };

  // 👍 Bestätigen – stoppen & transkribieren
  const confirmRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorder.current && state === 'recording') {
      cancelledRef.current = false;
      mediaRecorder.current.stop();
    }
  };

  // ✕ Verwerfen – stoppen ohne Transkription
  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cancelledRef.current = true;
    if (mediaRecorder.current && state === 'recording') {
      try { mediaRecorder.current.stop(); } catch {}
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setState('idle');
      setDuration(0);
    }
  };

  const transcribe = async (blob: Blob, mimeType: string) => {
    try {
      const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
      const form = new FormData();
      form.append('audio', blob, `recording.${ext}`);
      const res = await fetch('/api/whisper/transcribe', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      onResult(data.text);
      toast.success('Diktat übernommen');
    } catch (e: any) {
      toast.error(e.message || 'Transkriptionsfehler');
    } finally {
      setState('idle');
      setDuration(0);
      audioChunks.current = [];
    }
  };

  // ── Ruhezustand: Mikrofon-Button ─────────────────────────────────────
  if (state === 'idle') {
    return (
      <button type="button" onClick={startRecording} title="Diktat starten"
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-fire-700 hover:text-fire-800 hover:bg-fire-50 transition-colors ${className}`}>
        <Mic className="w-4 h-4" />
      </button>
    );
  }

  // ── Aufnahme läuft: pulsierender Ring + X + 👍 ────────────────────────
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Pulsierender roter Ring um Mikrofon */}
        <div className="relative flex items-center justify-center w-8 h-8 flex-shrink-0">
          <span className="absolute inset-0 rounded-full bg-red-400 opacity-40 animate-ping" />
          <span className="relative z-10 text-red-600">
            <Mic className="w-4 h-4" />
          </span>
        </div>
        <span className="text-xs font-mono text-red-500 font-bold min-w-[28px]">
          {fmt(duration)}
        </span>
        {/* X – Verwerfen */}
        <button type="button" onClick={cancelRecording} title="Aufnahme verwerfen"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-sm transition-colors">
          <X className="w-5 h-5" />
        </button>
        {/* 👍 – Bestätigen & transkribieren */}
        <button type="button" onClick={confirmRecording} title="Aufnahme bestätigen"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors">
          <ThumbsUp className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // ── Transkribiere ─────────────────────────────────────────────────────
  return (
    <button type="button" disabled title="Transkribiere..."
      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-fire-700 ${className}`}>
      <Loader className="w-4 h-4 animate-spin" />
    </button>
  );
}
