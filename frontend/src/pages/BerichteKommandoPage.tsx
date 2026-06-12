import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Trash2, Download, Plus, X, Calendar, User, Eye } from 'lucide-react';
import { protocolApi } from '../api';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const BEREICH_CONFIG: Record<string, { title: string; description: string; icon: string }> = {
  kameradschaftsfuehrer: {
    title: 'Berichte Kameradschaftsführer',
    description: 'Berichte und Dokumente des Kameradschaftsführers',
    icon: '👥',
  },
  kassier: {
    title: 'Berichte Kassier',
    description: 'Finanzberichte und Dokumente des Kassiers',
    icon: '💰',
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BerichteKommandoPage() {
  const navigate = useNavigate();
  const { bereich } = useParams<{ bereich: string }>();
  const config = BEREICH_CONFIG[bereich || ''] || { title: 'Berichte', description: '', icon: '📄' };

  const fileRef = useRef<HTMLInputElement>(null);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    author: '',
    notes: '',
  });

  useEffect(() => { load(); }, [bereich]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await protocolApi.list();
      const tag = `[${bereich}]`;
      const filtered = (data.protocols || data || []).filter((p: any) =>
        p.notes?.includes(tag) || p.title?.startsWith(`[${bereich}]`)
      );
      setProtocols(filtered);
    } catch { toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  };

  const handleFile = (f: File) => {
    setFile(f);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '') }));
  };

  const handleUpload = async () => {
    if (!file || !form.title) { toast.error('Datei und Titel erforderlich'); return; }
    setUploading(true);
    try {
      await protocolApi.upload(file, {
        title: form.title,
        date: form.date,
        author: form.author || undefined,
        notes: `[${bereich}]${form.notes ? ' ' + form.notes : ''}`,
      });
      toast.success('Bericht hochgeladen!');
      setShowUpload(false);
      setFile(null);
      setForm({ title: '', date: new Date().toISOString().slice(0, 10), author: '', notes: '' });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Hochladen');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bericht löschen?')) return;
    try {
      await protocolApi.delete(id);
      toast.success('Bericht gelöscht');
      load();
    } catch { toast.error('Fehler beim Löschen'); }
  };

  // Group by year
  const grouped: Record<string, any[]> = {};
  protocols.forEach(p => {
    const year = new Date(p.date).getFullYear().toString();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(p);
  });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-muted" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{config.title}</h1>
              <p className="text-sm text-ink-muted">{config.description}</p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Bericht hochladen
        </button>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className="card p-5 space-y-4 border-fire-200">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink">Neuen Bericht hochladen</p>
            <button onClick={() => { setShowUpload(false); setFile(null); }}
              className="p-1 hover:bg-surface-100 rounded-lg">
              <X className="w-4 h-4 text-ink-muted" />
            </button>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragging ? 'border-fire-400 bg-fire-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-surface-300 hover:border-fire-300'
            }`}
          >
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-emerald-600">({formatFileSize(file.size)})</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-8 h-8 text-ink-muted mx-auto" />
                <p className="text-sm text-ink-muted">Datei hierher ziehen oder klicken</p>
                <p className="text-xs text-ink-faint">PDF, Word, Excel, PowerPoint</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Titel *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="input-field" placeholder="z.B. Jahresbericht 2026" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Verfasser</label>
                <input type="text" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                  className="input-field" placeholder="Name" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field" placeholder="Optionale Bemerkungen..." />
            </div>
          </div>

          <button onClick={handleUpload} disabled={uploading || !file || !form.title}
            className="btn-primary flex items-center gap-2 w-full justify-center">
            {uploading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            Hochladen
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <span className="w-6 h-6 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : protocols.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">{config.icon}</div>
          <p className="text-ink font-medium">Noch keine Berichte</p>
          <p className="text-ink-muted text-sm mt-1">Lade deinen ersten Bericht hoch</p>
        </div>
      ) : (
        Object.entries(grouped).sort(([a],[b]) => Number(b)-Number(a)).map(([year, items]) => (
          <div key={year} className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-fire-700">{year}</span>
              <div className="flex-1 h-px bg-surface-200" />
              <span className="text-xs text-ink-muted">{items.length} Dokument{items.length !== 1 ? 'e' : ''}</span>
            </div>
            {items.map((p: any) => (
              <div key={p.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-fire-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-fire-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink text-sm truncate">{p.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-ink-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(p.date), 'd. MMMM yyyy', { locale: de })}
                    </span>
                    {p.author && (
                      <span className="text-xs text-ink-muted flex items-center gap-1">
                        <User className="w-3 h-3" />{p.author}
                      </span>
                    )}
                    {p.fileSize && <span className="text-xs text-ink-muted">{formatFileSize(p.fileSize)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => navigate(`/berichte/${bereich}/${p.id}`)}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Details
                  </button>
                  <a href={protocolApi.downloadUrl(p.id)} target="_blank" rel="noreferrer"
                    className="p-2 hover:bg-surface-100 rounded-lg transition-colors" title="Herunterladen">
                    <Download className="w-4 h-4 text-ink-muted" />
                  </a>
                  <button onClick={() => handleDelete(p.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Löschen">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
