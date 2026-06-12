import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Save } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';

export default function UpdateBanner() {
  const { user } = useAuth() as any;
  const isAdmin = user?.role === 'ADMIN';
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(300);
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<'update' | 'restart'>('update');
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);
  const activeRef = useRef(false);

  const startCountdown = (remaining: number, m: 'update' | 'restart' = 'update') => {
    if (activeRef.current) return;
    activeRef.current = true;
    setMode(m);
    if (timerRef.current) clearInterval(timerRef.current);
    setSeconds(remaining);
    setVisible(true);
    setDismissed(false);
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current); activeRef.current = false; return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    activeRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setVisible(false);
    setDismissed(false);
  };

  // Polling: prüft alle 5 Sekunden den announce-status (update + restart)
  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch('/api/update/announce-status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.announced) {
          const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
          const remaining = (data.countdown || 300) - elapsed;
          if (remaining > 0) startCountdown(remaining, 'update');
        } else {
          // Restart prüfen
          const res2 = await fetch('/api/update/restart-announce-status', { headers: { Authorization: `Bearer ${token}` } });
          const data2 = await res2.json();
          if (data2.announced) {
            const elapsed = Math.floor((Date.now() - new Date(data2.startedAt).getTime()) / 1000);
            const remaining = (data2.countdown || 300) - elapsed;
            if (remaining > 0) startCountdown(remaining, 'restart');
          } else {
            if (activeRef.current) stopCountdown();
          }
        }
      } catch {}
    }, 5000);
  };

  useEffect(() => {
    // Nur für Admins — andere User brauchen das nicht
    if (!isAdmin) return;

    // Sofort beim Mount prüfen
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/update/announce-status', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.announced) {
            const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
            const remaining = (data.countdown || 300) - elapsed;
            if (remaining > 0) startCountdown(remaining);
          }
        })
        .catch(() => {});
    }

    // Polling starten (5 Sek Intervall) — fängt alle Fälle ab
    startPolling();

    // WebSocket für sofortige Benachrichtigung
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'UPDATE_ANNOUNCED') {
            startCountdown(msg.countdown || 300, 'update');
          } else if (msg.type === 'UPDATE_CANCELLED') {
            stopCountdown();
          } else if (msg.type === 'RESTART_ANNOUNCED') {
            startCountdown(msg.countdown || 300, 'restart');
          } else if (msg.type === 'RESTART_CANCELLED') {
            stopCountdown();
          }
        } catch {}
      };

      ws.onclose = () => setTimeout(connect, 3000);
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      wsRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progress = seconds / 300;
  const circumference = 2 * Math.PI * 20;
  const strokeDash = circumference * progress;

  if (!visible || dismissed) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
      <div className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1a1410 0%, #2d1f10 50%, #1a1410 100%)',
          border: '1px solid rgba(168, 40, 40, 0.4)',
          minWidth: '320px',
          maxWidth: '380px',
        }}>

        {/* Animated top border */}
        <div className="h-0.5 w-full"
          style={{
            background: `linear-gradient(90deg, #a82828, #ff6b35, #a82828)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
          }} />

        {/* Glow effect */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at top right, rgba(168,40,40,0.15) 0%, transparent 70%)',
          }} />

        <div className="p-4 relative">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0">
              {/* Countdown Circle */}
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(168,40,40,0.2)" strokeWidth="3" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#a82828" strokeWidth="3"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference - strokeDash}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white font-mono">{formatTime(seconds)}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-headings)' }}>
                  {mode === 'restart' ? 'App-Neustart' : 'System-Update'}
                </p>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                In <span className="text-amber-400 font-bold font-mono">{formatTime(seconds)}</span> wird die App {mode === 'restart' ? 'neu gestartet' : 'aktualisiert'}. Bitte alle offenen Punkte speichern!
              </p>
            </div>

            <button onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Warning */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3"
            style={{ background: 'rgba(168,40,40,0.15)', border: '1px solid rgba(168,40,40,0.3)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
            <p className="text-xs text-red-300">
              {mode === 'restart' ? 'Die App startet kurz neu — kurze Unterbrechung!' : 'Der Server startet nach dem Update neu — kurze Unterbrechung!'}
            </p>
          </div>

          {/* Save reminder */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Save className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Alle ungespeicherten Änderungen gehen verloren</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progress * 100}%`,
                background: seconds > 60
                  ? 'linear-gradient(90deg, #a82828, #ff6b35)'
                  : 'linear-gradient(90deg, #dc2626, #ef4444)',
              }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}
