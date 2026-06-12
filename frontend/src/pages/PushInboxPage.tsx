import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, CheckCheck, ExternalLink, ChevronRight } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  url?: string;
  read: boolean;
  createdAt: string;
  user?: { member?: { firstName: string; lastName: string } };
}

export default function PushInboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await api.get('/push/inbox');
      setNotifications(r.data);
    } catch { toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // Alle als gelesen markieren
    api.put('/push/inbox/read-all').catch(() => {});
  }, []);

  const deleteOne = async (id: string) => {
    await api.delete(`/push/inbox/${id}`);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const deleteAll = async () => {
    setShowDeleteModal(false);
    await api.delete('/push/inbox');
    setNotifications([]);
    toast.success('Alle gelöscht');
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-fire-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-fire-700" />
            </div>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-fire-700 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
              {isAdmin ? 'Alle Benachrichtigungen' : 'Meine Benachrichtigungen'}
            </h1>
            <p className="text-xs text-ink-muted">{notifications.length} Nachrichten</p>
          </div>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => { api.put('/push/inbox/read-all'); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }}
              className="p-2 rounded-xl hover:bg-surface-100 text-ink-muted transition-colors" title="Alle gelesen">
              <CheckCheck className="w-4 h-4" />
            </button>
            <button onClick={() => setShowDeleteModal(true)}
              className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors" title="Alle löschen">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 text-surface-200 mx-auto mb-3" />
          <p className="font-medium text-ink-muted">Keine Benachrichtigungen</p>
          <p className="text-sm text-ink-muted mt-1">Hier erscheinen alle Push-Nachrichten</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id}
              className={`card p-4 transition-all ${!n.read ? 'border-fire-200 bg-fire-50/30' : ''}`}>
              <div className="flex items-start gap-3">
                {/* Ungelesen-Dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${!n.read ? 'bg-fire-700' : 'bg-transparent'}`} />

                <div className="flex-1 min-w-0">
                  {/* Admin: Wer hat sie bekommen */}
                  {isAdmin && n.user?.member && (
                    <p className="text-xs text-ink-muted mb-1">
                      → {n.user.member.firstName} {n.user.member.lastName}
                    </p>
                  )}
                  {/* Titel */}
                  <p className="font-semibold text-sm text-ink">{n.title}</p>
                  {/* Body — Zeilenumbrüche respektieren */}
                  <p className="text-sm text-ink-muted mt-1 whitespace-pre-line leading-relaxed">
                    {n.body}
                  </p>
                  {/* Datum */}
                  <p className="text-xs text-ink-muted mt-2">
                    {format(new Date(n.createdAt), 'dd. MMM yyyy, HH:mm', { locale: de })} Uhr
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Link zum Termin */}
                  {n.url && n.url !== '/' && (
                    <button onClick={() => navigate(n.url!)}
                      className="p-1.5 rounded-lg hover:bg-surface-100 text-ink-muted hover:text-fire-700 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  {/* Löschen */}
                  <button onClick={() => deleteOne(n.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-ink-muted hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🗑️</span>
                </div>
                <div>
                  <h3 className="font-bold text-ink">Alle löschen?</h3>
                  <p className="text-xs text-ink-muted">Alle {notifications.length} Benachrichtigungen werden gelöscht.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={deleteAll} className="btn-danger flex-1">Alle löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
