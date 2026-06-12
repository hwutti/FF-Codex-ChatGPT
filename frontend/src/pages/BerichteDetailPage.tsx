import { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Download, Eye } from 'lucide-react';
import { protocolApi } from '../api';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import SignaturePanel from '../components/SignaturePanel';

const BEREICH_LABELS: Record<string, string> = {
  kameradschaftsfuehrer: 'Berichte Kameradschaftsführer',
  kassier: 'Berichte Kassier',
};

export default function BerichteDetailPage() {
  const navigate = useNavigate();
  const { bereich, id } = useParams<{ bereich: string; id: string }>();
  const label = BEREICH_LABELS[bereich || ''] || 'Berichte';

  const [protocol, setProtocol] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', date: '', author: '', notes: '' });
  const [dirty, setDirty] = useState(false);
  const { confirmNavigation, resolve: resolveGuard } = useUnsavedGuard(dirty && editing);
  const guardedNavigate = async (path: string) => {
    const result = await confirmNavigation();
    if (result === 'cancel') return;
    navigate(path);
  };

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const p = await protocolApi.get(id!);
      setProtocol(p);
      // Notizen ohne Bereichs-Tag anzeigen
      const cleanNotes = (p.notes || '').replace(/\[[\w]+\]\s?/, '').trim();
      setForm({ title: p.title, date: p.date?.slice(0, 10) || '', author: p.author || '', notes: cleanNotes });
      // PDF laden
      if (p.mimeType === 'application/pdf') {
        const token = localStorage.getItem('token');
        fetch(`/api/protocols/${id}/download`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include'
        })
          .then(r => r.blob())
          .then(blob => setPdfUrl(URL.createObjectURL(blob)));
      }
    } catch { toast.error('Bericht nicht gefunden'); guardedNavigate(`/berichte/${bereich}`); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Bereichs-Tag in Notizen behalten
      const notesWithTag = `[${bereich}]${form.notes ? ' ' + form.notes : ''}`;
      await protocolApi.update(id!, { ...form, notes: notesWithTag });
      toast.success('Gespeichert');
      setDirty(false);
      setEditing(false);
      load();
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/protocols/${id}/download`, { credentials: 'include' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = protocol.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Fehler beim Download'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!protocol) return null;

  return (
    <>
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => guardedNavigate(`/berichte/${bereich}`)}
          className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs text-ink-muted">{label}</p>
          <h1 className="text-xl font-bold text-ink-base">{protocol.title}</h1>
        </div>
      </div>

      {/* PDF-Vorschau — immer sichtbar */}
      {pdfUrl && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <iframe src={pdfUrl} className="w-full" style={{ height: '70vh' }} title="PDF Vorschau" />
        </div>
      )}

      {/* Dokument-Info */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-base">Dokumentinfo</h2>
          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5">
              <Download className="w-4 h-4" /> Herunterladen
            </button>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noreferrer"
                className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5">
                <Eye className="w-4 h-4" /> Im Browser öffnen
              </a>
            )}
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="btn-primary text-sm px-3 py-1.5">Bearbeiten</button>
            )}
          </div>
        </div>

        {!editing ? (
          <div className="space-y-2">
            {[
              { label: 'Datum', value: format(parseISO(protocol.date), 'd. MMMM yyyy', { locale: de }) },
              { label: 'Verfasser', value: protocol.author || '—' },
              { label: 'Dateiname', value: protocol.fileName },
              { label: 'Dateigröße', value: protocol.fileSize ? `${(protocol.fileSize / 1024).toFixed(1)} KB` : '—' },
              { label: 'Notizen', value: (protocol.notes || '').replace(/\[[\w]+\]\s?/, '').trim() || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4 py-2 border-b border-surface-100 last:border-0">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider w-28 flex-shrink-0 pt-0.5">{label}</p>
                <p className="text-sm text-ink-base">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="settings-label">Titel *</label>
                <input className="input-field w-full mt-1" value={form.title}
                  onChange={e => { setDirty(true); setForm(f => ({ ...f, title: e.target.value })); } } />
              </div>
              <div>
                <label className="settings-label">Datum *</label>
                <input type="date" className="input-field w-full mt-1" value={form.date}
                  onChange={e => { setDirty(true); setForm(f => ({ ...f, date: e.target.value })); } } />
              </div>
            </div>
            <div>
              <label className="settings-label">Verfasser</label>
              <input className="input-field w-full mt-1" value={form.author}
                onChange={e => { setDirty(true); setForm(f => ({ ...f, author: e.target.value })); } } />
            </div>
            <div>
              <label className="settings-label">Notizen</label>
              <div className="flex gap-2 items-start">
<textarea className="input-field w-full mt-1" rows={3} value={form.notes}
                onChange={e => { setDirty(true); setForm(f => ({ ...f, notes: e.target.value })); } } />
<DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" />{saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {/* Unterschriften */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <SignaturePanel
          protocolId={id!}
          protocolTitle={protocol.title}
          onSignedSaved={() => load()}
        />
      </div>
    </div>
      <UnsavedChangesModal
        onSave={async () => { try { await handleSave(); return true; } catch { return false; } }}
        onResolve={resolveGuard}
      />
    </>
  );
}
