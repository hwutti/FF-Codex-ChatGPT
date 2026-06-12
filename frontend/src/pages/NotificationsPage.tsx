import { useState, useEffect } from 'react';
import { usePush } from '../hooks/usePush';
import { useAuth } from '../utils/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

interface PushMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  rank?: string;
}

export default function NotificationsPage() {
  const { supported, permission, settings, loading, subscribe, unsubscribe, updateSettings } = usePush();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Aktiv = Browser erlaubt Benachrichtigungen UND Server hat eine gültige Subscription
  const isGranted = permission === 'granted' && settings?.hasSubscription === true;
  // Button anzeigen wenn: permission nicht 'denied' UND (nicht aktiv ODER aktiv zum Deaktivieren)
  const showButton = permission !== 'denied';

  // Admin state
  const [reminderHour, setReminderHour]     = useState(19);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody]   = useState('');
  const [sending, setSending]               = useState(false);

  // Broadcast Zielgruppe
  const [broadcastMode, setBroadcastMode]   = useState<'all' | 'select'>('all');
  const [pushMembers, setPushMembers]       = useState<PushMember[]>([]);
  const [selected, setSelected]             = useState<Set<string>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/push/admin-settings').then(r => {
      setReminderHour(r.data.pushReminderHour ?? 19);
      setReminderMinute(r.data.pushReminderMinute ?? 0);
    }).catch(() => {});
  }, [isAdmin]);

  // Mitglieder mit Push laden wenn "bestimmte" gewählt
  useEffect(() => {
    if (broadcastMode !== 'select' || !isAdmin) return;
    setLoadingMembers(true);
    api.get('/push/members').then(r => {
      setPushMembers(r.data);
      setSelected(new Set(r.data.map((m: PushMember) => m.userId)));
    }).catch(() => {}).finally(() => setLoadingMembers(false));
  }, [broadcastMode, isAdmin]);

  const toggleMember = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pushMembers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pushMembers.map(m => m.userId)));
    }
  };

  const saveReminderTime = async () => {
    try {
      await api.put('/push/admin-settings', { pushReminderHour: reminderHour, pushReminderMinute: reminderMinute });
      toast.success('Erinnerungszeit gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      await api.post('/push/test');
      toast.success('Test-Benachrichtigung gesendet!');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler beim Senden');
    } finally { setSending(false); }
  };

  const sendBroadcast = async () => {
    if (!broadcastTitle || !broadcastBody) { toast.error('Titel und Text erforderlich'); return; }
    if (broadcastMode === 'select' && selected.size === 0) { toast.error('Keine Mitglieder ausgewählt'); return; }
    setSending(true);
    try {
      const payload = broadcastMode === 'all'
        ? { title: broadcastTitle, body: broadcastBody, mode: 'all' }
        : { title: broadcastTitle, body: broadcastBody, mode: 'select', userIds: Array.from(selected) };
      const r = await api.post('/push/broadcast', payload);
      toast.success(`Gesendet an ${r.data.users} User (${r.data.sent} Geräte)`);
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler beim Senden');
    } finally { setSending(false); }
  };

  const handleToggle = async () => {
    if (isGranted) {
      await unsubscribe();
      toast.success('Push-Benachrichtigungen deaktiviert');
    } else {
      const ok = await subscribe();
      if (ok) {
        toast.success('Push-Benachrichtigungen aktiviert! 🔔');
      } else if (permission === 'denied') {
        toast.error('Berechtigung verweigert. Bitte in den Browser-Einstellungen erlauben.');
      } else {
        toast.error('Aktivierung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.');
      }
    }
  };

  const NOTIF_ITEMS = [
    { key: 'pushNewEvent',    label: 'Neue Ereignisse',  desc: 'Wenn ein Ereignis hinzugefügt wird', emoji: '📅' },
    { key: 'pushNewExercise', label: 'Neue Übungen',     desc: 'Wenn eine Übung hinzugefügt wird',   emoji: '🧯' },
    { key: 'pushNewIncident', label: 'Neue Einsätze',    desc: 'Sofort wenn ein Einsatz eingetragen wird', emoji: '🚨' },
    { key: 'pushBirthday',   label: 'Geburtstage',      desc: 'Am Geburtstag eines Kameraden',      emoji: '🎂' },
  ] as const;

  const REMINDER_ITEMS = [
    { key: 'pushReminder7', label: '7 Tage vorher', desc: 'Eine Woche vor dem Termin' },
    { key: 'pushReminder3', label: '3 Tage vorher', desc: 'Drei Tage vor dem Termin' },
    { key: 'pushReminder1', label: '1 Tag vorher',  desc: 'Am Vorabend des Termins' },
  ] as const;

  return (
    <div className="max-w-lg mx-auto p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Benachrichtigungen</h1>
        <p className="text-sm text-ink-muted">Push-Benachrichtigungen auf diesem Gerät.</p>
      </div>

      {!supported ? (
        <div className="card p-6 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="font-semibold">Nicht unterstützt</p>
          <p className="text-sm text-ink-muted mt-1">Bitte Chrome, Firefox oder Safari (iOS 16.4+) verwenden.</p>
          <p className="text-sm text-ink-muted mt-1">Die App muss über <strong>HTTPS</strong> geöffnet sein.</p>
        </div>
      ) : (
        <>
          {/* Aktivieren/Deaktivieren */}
          <div className={`card p-5 flex items-center justify-between gap-4 ${isGranted ? 'border-green-200 bg-green-50' : ''}`}>
            <div>
              <p className="font-semibold">{isGranted ? '🔔 Aktiv auf diesem Gerät' : '🔕 Deaktiviert'}</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {isGranted
                  ? 'Du erhältst Push-Benachrichtigungen.'
                  : permission === 'denied'
                    ? 'Berechtigung verweigert — in Browser-Einstellungen erlauben.'
                    : 'Aktiviere um keine Termine zu verpassen.'}
              </p>
            </div>
            {showButton && (
              <button
                onClick={handleToggle}
                disabled={loading}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 disabled:opacity-50 ${
                  isGranted
                    ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                    : 'bg-fire-700 text-white hover:bg-fire-800'
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Bitte warten…
                  </span>
                ) : isGranted ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            )}
          </div>

          {/* iOS Hinweis */}
          {/iphone|ipad/i.test(navigator.userAgent) && !isGranted && (
            <div className="card p-4 bg-blue-50 border-blue-200 text-sm text-blue-800">
              <p className="font-semibold mb-1">📱 iPhone / iPad</p>
              <p>Safari → Teilen → „Zum Home-Bildschirm" hinzufügen. Dann funktionieren Push-Benachrichtigungen.</p>
            </div>
          )}

          {/* Android Akku-Optimierung Hinweis */}
          {/android/i.test(navigator.userAgent) && isGranted && (
            <div className="card p-4 bg-amber-50 border border-amber-200 text-sm">
              <p className="font-semibold text-amber-900 mb-2">⚡ Keine Benachrichtigungen wenn App geschlossen?</p>
              <p className="text-amber-800 mb-3">Android schränkt Apps im Hintergrund ein. So deaktivierst du die Akku-Optimierung für Chrome:</p>
              <ol className="space-y-1.5 text-amber-800">
                <li className="flex gap-2"><span className="font-bold flex-shrink-0">1.</span><span>Einstellungen öffnen</span></li>
                <li className="flex gap-2"><span className="font-bold flex-shrink-0">2.</span><span>Apps → Chrome antippen</span></li>
                <li className="flex gap-2"><span className="font-bold flex-shrink-0">3.</span><span>Akku → <strong>„Nicht optimieren"</strong> oder <strong>„Uneingeschränkt"</strong> wählen</span></li>
              </ol>
              <p className="text-xs text-amber-700 mt-3">💡 Bei Samsung: Einstellungen → Gerätewartung → Akku → App-Energieverwaltung → Chrome → <strong>Uneingeschränkt</strong></p>
            </div>
          )}

          {isGranted && settings && (
            <>
              {/* Sofort-Benachrichtigungen */}
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">Sofort-Benachrichtigungen</p>
                <div className="divide-y divide-surface-100">
                  {NOTIF_ITEMS.map(({ key, label, desc, emoji }) => (
                    <div key={key} className="flex items-center justify-between py-3 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{emoji}</span>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-ink-muted">{desc}</p>
                        </div>
                      </div>
                      <button onClick={() => updateSettings({ [key]: !settings[key] })}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings[key] ? 'bg-fire-700' : 'bg-surface-200'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[key] ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Erinnerungen */}
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Termin-Erinnerungen</p>
                <p className="text-xs text-ink-muted mb-4">Erinnerung vor Kalendereinträgen (Übungen, Sitzungen, Einsätze…)</p>
                <div className="divide-y divide-surface-100">
                  {REMINDER_ITEMS.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-3 gap-4">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-ink-muted">{desc}</p>
                      </div>
                      <button onClick={() => updateSettings({ [key]: !settings[key] })}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings[key] ? 'bg-fire-700' : 'bg-surface-200'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[key] ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Admin-Bereich */}
          {isAdmin && (
            <>
              {/* Erinnerungszeit */}
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">🔧 Erinnerungszeit</p>
                <p className="text-xs text-ink-muted mb-3">Uhrzeit zu der tägliche Erinnerungen gesendet werden.</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={23} value={reminderHour}
                    onChange={e => setReminderHour(parseInt(e.target.value))}
                    className="w-16 border border-surface-200 rounded-lg px-3 py-2 text-center text-sm font-mono" />
                  <span className="font-bold text-ink-muted">:</span>
                  <input type="number" min={0} max={59} value={String(reminderMinute).padStart(2,'0')}
                    onChange={e => setReminderMinute(parseInt(e.target.value))}
                    className="w-16 border border-surface-200 rounded-lg px-3 py-2 text-center text-sm font-mono" />
                  <span className="text-sm text-ink-muted">Uhr</span>
                  <button onClick={saveReminderTime}
                    className="ml-auto px-4 py-2 bg-fire-700 text-white rounded-lg text-sm font-semibold hover:bg-fire-800">
                    Speichern
                  </button>
                </div>
              </div>

              {/* Test */}
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">🧪 Test-Benachrichtigung</p>
                <p className="text-xs text-ink-muted mb-3">Sendet eine Test-Benachrichtigung nur an dich.</p>
                <button onClick={sendTest} disabled={sending || !isGranted}
                  className="w-full py-2.5 bg-surface-100 border border-surface-200 text-ink rounded-xl text-sm font-semibold hover:bg-surface-200 disabled:opacity-50 transition-all">
                  {sending ? 'Sende...' : '🧪 Test senden'}
                </button>
                {!isGranted && <p className="text-xs text-red-500 mt-2">Push muss auf diesem Gerät aktiviert sein.</p>}
              </div>

              {/* Broadcast */}
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">📢 Nachricht senden</p>

                {/* Zielgruppe */}
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setBroadcastMode('all')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      broadcastMode === 'all'
                        ? 'bg-fire-700 text-white border-fire-700'
                        : 'bg-white text-ink-muted border-surface-200 hover:border-fire-300'
                    }`}>
                    Alle Aktiven
                  </button>
                  <button onClick={() => setBroadcastMode('select')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      broadcastMode === 'select'
                        ? 'bg-fire-700 text-white border-fire-700'
                        : 'bg-white text-ink-muted border-surface-200 hover:border-fire-300'
                    }`}>
                    Bestimmte Mitglieder
                  </button>
                </div>

                {/* Mitgliederliste */}
                {broadcastMode === 'select' && (
                  <div className="mb-4 border border-surface-200 rounded-xl overflow-hidden">
                    {loadingMembers ? (
                      <p className="text-sm text-ink-muted text-center py-4">Lade Mitglieder…</p>
                    ) : pushMembers.length === 0 ? (
                      <p className="text-sm text-ink-muted text-center py-4">Keine Mitglieder mit aktivem Push</p>
                    ) : (
                      <>
                        <button onClick={toggleAll}
                          className="flex items-center gap-3 w-full px-4 py-2.5 bg-surface-50 border-b border-surface-200 text-sm font-medium hover:bg-surface-100">
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected.size === pushMembers.length ? 'bg-fire-700 border-fire-700' : 'border-surface-300'
                          }`}>
                            {selected.size === pushMembers.length && <span className="text-white text-xs">✓</span>}
                          </span>
                          Alle auswählen ({pushMembers.length})
                        </button>
                        <div className="max-h-48 overflow-y-auto divide-y divide-surface-100">
                          {pushMembers.map(m => (
                            <button key={m.userId} onClick={() => toggleMember(m.userId)}
                              className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-surface-50 transition-colors">
                              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                selected.has(m.userId) ? 'bg-fire-700 border-fire-700' : 'border-surface-300'
                              }`}>
                                {selected.has(m.userId) && <span className="text-white text-xs">✓</span>}
                              </span>
                              <span className="text-sm font-medium">{m.firstName} {m.lastName}</span>
                              {m.rank && <span className="text-xs text-ink-muted ml-auto">{m.rank}</span>}
                            </button>
                          ))}
                        </div>
                        <div className="px-4 py-2 bg-surface-50 border-t border-surface-200 text-xs text-ink-muted">
                          {selected.size} von {pushMembers.length} ausgewählt
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Nachricht */}
                <div className="space-y-3">
                  <input type="text" placeholder="Titel" value={broadcastTitle}
                    onChange={e => setBroadcastTitle(e.target.value)}
                    className="w-full border border-surface-200 rounded-xl px-4 py-2.5 text-sm" />
                  <textarea placeholder="Nachricht..." value={broadcastBody}
                    onChange={e => setBroadcastBody(e.target.value)} rows={3}
                    className="w-full border border-surface-200 rounded-xl px-4 py-2.5 text-sm resize-none" />
                  <button onClick={sendBroadcast}
                    disabled={sending || !broadcastTitle || !broadcastBody || (broadcastMode === 'select' && selected.size === 0)}
                    className="w-full py-2.5 bg-fire-700 text-white rounded-xl text-sm font-semibold hover:bg-fire-800 disabled:opacity-50 transition-all">
                    {sending ? 'Sende...' : broadcastMode === 'all' ? '📢 An alle Aktiven senden' : `📢 An ${selected.size} Mitglieder senden`}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
