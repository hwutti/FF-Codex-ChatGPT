import { useState, useEffect } from 'react';
import { X, Save, Loader, BookOpen } from 'lucide-react';
import { protocolApi, eventApi } from '../api';
import toast from 'react-hot-toast';

interface Props {
  pdfBlob: Blob;
  defaultTitle: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProtokollSpeichernModal({ pdfBlob, defaultTitle, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: defaultTitle,
    date: new Date().toISOString().slice(0, 10),
    author: '',
    eventId: '',
    notes: '',
  });

  useEffect(() => {
    eventApi.list({ limit: '50' })
      .then(r => setEvents(r.events || r || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Bitte einen Titel eingeben'); return; }
    setSaving(true);
    try {
      // PDF Blob in File umwandeln
      const file = new File([pdfBlob], `${form.title}.pdf`, { type: 'application/pdf' });
      await protocolApi.upload(file, {
        title: form.title,
        date: form.date,
        eventId: form.eventId || undefined,
        author: form.author || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Bericht in Protokolle Kommando abgelegt!');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-fire-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-fire-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
                In Protokolle ablegen
              </h2>
              <p className="text-xs text-ink-muted">Wird in Protokolle Kommando gespeichert</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl">
            <X className="w-4 h-4 text-ink-muted" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Titel *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="z.B. Jahresbericht 2026"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                Datum *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                Verfasser
              </label>
              <input
                type="text"
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                className="input-field"
                placeholder="Name des Verfassers"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Verknüpftes Ereignis (optional)
            </label>
            <select
              value={form.eventId}
              onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}
              className="input-field"
            >
              <option value="">— Kein Ereignis —</option>
              {events.map((ev: any) => (
                <option key={ev.id} value={ev.id}>
                  {new Date(ev.date).toLocaleDateString('de-AT')} · {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Notizen
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none"
              rows={2}
              placeholder="Optionale Bemerkungen..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200 bg-surface-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary text-sm">
            Nicht ablegen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {saving
              ? <Loader className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            In Protokolle speichern
          </button>
        </div>
      </div>
    </div>
  );
}
