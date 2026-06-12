import React, { useState, useEffect } from 'react';
import { Bell, Trash2, Send, RefreshCw, Smartphone, Monitor, Tablet, CheckCircle, XCircle } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

type Subscription = {
  id: string;
  endpoint: string;
  userAgent: string;
  createdAt: string;
  userId: string;
  userName: string;
  rank: string;
  settings: {
    pushNewEvent: boolean;
    pushNewExercise: boolean;
    pushNewIncident: boolean;
    pushBirthday: boolean;
    pushUpdate: boolean;
    pushReminder7: boolean;
    pushReminder3: boolean;
    pushReminder1: boolean;
  };
};

const SETTINGS_LABELS: { key: keyof Subscription['settings']; label: string; emoji: string }[] = [
  { key: 'pushNewEvent',    label: 'Ereignisse',    emoji: '📅' },
  { key: 'pushNewExercise', label: 'Übungen',       emoji: '🧯' },
  { key: 'pushNewIncident', label: 'Einsätze',      emoji: '🚨' },
  { key: 'pushBirthday',    label: 'Geburtstage',   emoji: '🎂' },
  { key: 'pushUpdate',      label: 'App-Updates',   emoji: '🔄' },
  { key: 'pushReminder7',   label: '7 Tage vorher', emoji: '⏰' },
  { key: 'pushReminder3',   label: '3 Tage vorher', emoji: '⏰' },
  { key: 'pushReminder1',   label: '1 Tag vorher',  emoji: '⏰' },
];

function getDeviceIcon(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone className="w-4 h-4" />;
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return <Tablet className="w-4 h-4" />;
  }
  return <Monitor className="w-4 h-4" />;
}

function getDeviceName(userAgent: string) {
  const ua = userAgent;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) {
    // Neuere Android-Versionen verstecken Gerätenamen (zeigen nur "K" o.ä.)
    const match = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    if (match) {
      const name = match[1].trim();
      // Wenn der Name zu kurz/unbekannt ist, generischen Namen verwenden
      if (name.length <= 2 || name === 'K' || name === 'Linux') {
        return 'Android-Gerät';
      }
      return name;
    }
    return 'Android-Gerät';
  }
  if (ua.includes('Windows')) return 'Windows PC';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'Mac';
  if (ua.includes('Linux')) return 'Linux PC';
  return 'Unbekanntes Gerät';
}

function getBrowserName(userAgent: string) {
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  return 'Browser';
}

export default function PushOverviewPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/push/subscriptions');
      setSubs(r.data);
    } catch {
      toast.error('Fehler beim Laden der Subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, userName: string) => {
    setDeleting(id);
    try {
      await api.delete(`/push/subscriptions/${id}`);
      toast.success(`Subscription von ${userName} gelöscht`);
      setSubs(prev => prev.filter(s => s.id !== id));
    } catch {
      toast.error('Fehler beim Löschen');
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id: string, userName: string) => {
    setTesting(id);
    try {
      await api.post(`/push/subscriptions/${id}/test`);
      toast.success(`Test-Push an ${userName} gesendet`);
    } catch {
      toast.error('Fehler beim Senden');
    } finally {
      setTesting(null);
    }
  };

  // Gruppiere Subscriptions nach User
  const byUser = subs.reduce<Record<string, Subscription[]>>((acc, sub) => {
    if (!acc[sub.userId]) acc[sub.userId] = [];
    acc[sub.userId].push(sub);
    return acc;
  }, {});

  const uniqueUsers = Object.keys(byUser).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
            Push-Übersicht
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {loading ? 'Wird geladen...' : `${subs.length} Gerät${subs.length !== 1 ? 'e' : ''} · ${uniqueUsers} User`}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Leer-Zustand */}
      {!loading && subs.length === 0 && (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 text-ink-muted/30 mx-auto mb-3" />
          <p className="font-semibold text-ink-muted">Keine aktiven Push-Subscriptions</p>
          <p className="text-sm text-ink-muted mt-1">Noch niemand hat Push-Benachrichtigungen aktiviert.</p>
        </div>
      )}

      {/* User-Gruppen */}
      {!loading && Object.entries(byUser).map(([userId, userSubs]) => {
        const firstSub = userSubs[0];
        const activeSettings = SETTINGS_LABELS.filter(s => firstSub.settings[s.key]);
        const inactiveSettings = SETTINGS_LABELS.filter(s => !firstSub.settings[s.key]);

        return (
          <div key={userId} className="card overflow-hidden">
            {/* User Header */}
            <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-fire-100 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-fire-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">
                  {firstSub.rank ? `${firstSub.rank} ` : ''}{firstSub.userName}
                </p>
                <p className="text-xs text-ink-muted">
                  {userSubs.length} Gerät{userSubs.length !== 1 ? 'e' : ''} registriert
                </p>
              </div>
              {/* Aktive Benachrichtigungen */}
              <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-xs">
                {activeSettings.map(s => (
                  <span key={s.key} className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                    {s.emoji} {s.label}
                  </span>
                ))}
                {inactiveSettings.map(s => (
                  <span key={s.key} className="text-xs px-1.5 py-0.5 rounded-md bg-surface-100 text-ink-muted font-medium line-through">
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Aktive Benachrichtigungen (mobile) */}
            <div className="sm:hidden px-5 py-3 border-b border-surface-100 flex flex-wrap gap-1">
              {activeSettings.map(s => (
                <span key={s.key} className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                  {s.emoji} {s.label}
                </span>
              ))}
              {inactiveSettings.map(s => (
                <span key={s.key} className="text-xs px-1.5 py-0.5 rounded-md bg-surface-100 text-ink-muted font-medium line-through">
                  {s.label}
                </span>
              ))}
            </div>

            {/* Geräte */}
            <div className="divide-y divide-surface-100">
              {userSubs.map(sub => (
                <div key={sub.id} className="px-5 py-3 flex items-center gap-3">
                  {/* Gerät Icon */}
                  <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0 text-ink-muted">
                    {getDeviceIcon(sub.userAgent)}
                  </div>
                  {/* Gerät Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {getDeviceName(sub.userAgent)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {getBrowserName(sub.userAgent)} · registriert {new Date(sub.createdAt).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(sub.createdAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {/* Aktionen */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTest(sub.id, firstSub.userName)}
                      disabled={testing === sub.id}
                      title="Test-Push senden"
                      className="p-2 rounded-lg hover:bg-blue-50 hover:text-blue-700 text-ink-muted transition-colors">
                      {testing === sub.id
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id, firstSub.userName)}
                      disabled={deleting === sub.id}
                      title="Subscription löschen"
                      className="p-2 rounded-lg hover:bg-red-50 hover:text-red-700 text-ink-muted transition-colors">
                      {deleting === sub.id
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
