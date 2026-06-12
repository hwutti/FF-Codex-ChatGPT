import FileTypeBadge from '../components/FileTypeBadge';
import DiktatButton from '../components/DiktatButton';
import SignaturePanel from '../components/SignaturePanel';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { protocolApi, eventApi } from '../api';
import { useAuth } from '../utils/AuthContext';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Download, Eye, Trash2, Save, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const MIME_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.oasis.opendocument.text': '📄',
  'application/vnd.oasis.opendocument.spreadsheet': '📊',
  'application/vnd.oasis.opendocument.presentation': '📊',
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProtocolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDelete = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER'].includes(user?.role || '');
  const [protocol, setProtocol] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', eventId: '', author: '', notes: '' });

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const loadProtocol = () => {
    Promise.all([protocolApi.get(id!), eventApi.list()])
      .then(([p, e]) => {
        setProtocol(p);
        setForm({ title: p.title, date: p.date?.slice(0, 10) || '', eventId: p.eventId || '', author: p.author || '', notes: p.notes || '' });
        setEvents(Array.isArray(e) ? e : (e.events || []));
        if (p.mimeType === 'application/pdf') {
          fetch(`/api/protocols/${id}/download`, {
            credentials: 'include'
          }).then(r => r.blob()).then(blob => { setPdfUrl(URL.createObjectURL(blob)); });
        }
      })
      .catch(() => { toast.error('Protokoll nicht gefunden'); navigate('/protocols'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProtocol(); }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const updated = await protocolApi.update(id!, form);
      setProtocol(updated);
      toast.success('Gespeichert');
      setEditing(false);
    } catch { toast.error('Fehler'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Protokoll wirklich löschen? Die Datei wird ebenfalls gelöscht.')) return;
    try { await protocolApi.delete(id!); toast.success('Gelöscht'); navigate('/protocols'); }
    catch { toast.error('Fehler beim Löschen'); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-black/10 border-t-fire-700 rounded-full animate-spin" /></div>;
  if (!protocol) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(protocolApi.downloadUrl(protocol.id), {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Download fehlgeschlagen');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = protocol.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('Fehler beim Download'); }
  };

  const isPDF = protocol.mimeType === 'application/pdf';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/protocols')} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <FileTypeBadge mimeType={protocol.mimeType} size="lg" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>{protocol.title}</h1>
            <p className="text-sm text-gray-500">{format(parseISO(protocol.date), 'd. MMMM yyyy', { locale: de })} · {formatFileSize(protocol.fileSize)}</p>
          </div>
        </div>
        {canDelete && !editing && (
          <button onClick={handleDelete} className="btn-danger p-2.5" title="Löschen"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>

      {/* PDF Preview */}
      {isPDF && !editing && pdfUrl && (
        <>
          {/* Desktop */}
          <div className="hidden md:block glass-card rounded-2xl border border-black/10 overflow-hidden mb-6" style={{ height: '500px' }}>
            <iframe src={pdfUrl} className="w-full h-full" title={protocol.title} />
          </div>
          {/* Mobile */}
          <div className="md:hidden glass-card rounded-2xl border border-black/10 p-6 mb-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
              <FileText className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-sm text-gray-500 text-center">PDF-Vorschau auf Mobile nicht verfügbar</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2">
              PDF öffnen
            </a>
          </div>
        </>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-3 mb-6">
          <button onClick={handleDownload}
            className="btn-primary flex items-center gap-2 flex-1 justify-center">
            <Download className="w-4 h-4" /> Herunterladen
          </button>
          {isPDF && (
            <a href={pdfUrl || '#'} target="_blank" rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2 flex-1 justify-center">
              <Eye className="w-4 h-4" /> Im Browser öffnen
            </a>
          )}
          <button onClick={() => setEditing(true)} className="btn-secondary px-5">Bearbeiten</button>
        </div>
      )}

      {/* Detail / Edit */}
      <div className="glass-card rounded-2xl border border-black/10  p-6">
        {!editing ? (
          <div className="space-y-4">
            {[
              { label: 'Datum', value: format(parseISO(protocol.date), 'd. MMMM yyyy', { locale: de }) },
              { label: 'Ereignis', value: protocol.event ? `${protocol.event.title} (${format(parseISO(protocol.event.date), 'd. MMM yyyy', { locale: de })})` : '—' },
              { label: 'Verfasser', value: protocol.author || '—' },
              { label: 'Dateiname', value: protocol.fileName },
              { label: 'Dateigröße', value: formatFileSize(protocol.fileSize) },
              { label: 'Bemerkungen', value: (protocol.notes || '').replace(/\[Signierte Version:.*?\]/g, '').trim() || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4 py-2 border-b border-black/10 last:border-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-32 flex-shrink-0 pt-0.5">{label}</p>
                <p className="text-sm text-gray-800">{value}</p>
              </div>
            ))}
            {protocol.notes?.includes('[Signierte Version:') && (
              <div className="flex gap-2 items-center py-2 px-3 bg-green-50 border border-green-200 rounded-lg mt-2">
                <span className="text-green-600">✅</span>
                <p className="text-sm text-green-700 font-medium">Signierte Version vorhanden</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Titel *</label>
              <div className="flex gap-2 items-center">
                <input type="text" className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                <DiktatButton onResult={text => setForm(f => ({ ...f, title: text }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datum *</label>
                <input type="date" className="input-field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verfasser</label>
                <div className="flex gap-2 items-center">
                  <input type="text" className="input-field" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                  <DiktatButton onResult={text => setForm(f => ({ ...f, author: text }))} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verknüpftes Ereignis</label>
              <select className="input-field" value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                <option value="">— Kein Ereignis —</option>
                {events.map((ev: any) => (
                  <option key={ev.id} value={ev.id}>{format(parseISO(ev.date), 'd. MMM yyyy', { locale: de })} · {ev.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bemerkungen</label>
              <div className="flex gap-2 items-center">
                <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </form>
        )}
        {protocol && (
          <SignaturePanel 
            protocolId={protocol.id} 
            protocolTitle={protocol.title}
            onSignedSaved={() => { loadProtocol(); }} 
          />
        )}
      </div>
    </div>
  );
}
