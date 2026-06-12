import FileTypeBadge from '../components/FileTypeBadge';
import DiktatButton from '../components/DiktatButton';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { protocolApi, eventApi } from '../api';
import { useAuth } from '../utils/AuthContext';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  FileText, Upload, Download, Trash2, Eye, X, Save,
  ChevronRight, Calendar, User, Plus, Search, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const ALLOWED_ROLES = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER', 'SECRETARY'];

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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupByYear(protocols: any[]) {
  const groups: Record<string, any[]> = {};
  protocols.forEach(p => {
    const year = new Date(p.date).getFullYear().toString();
    if (!groups[year]) groups[year] = [];
    groups[year].push(p);
  });
  // Innerhalb jeder Gruppe nach createdAt absteigend sortieren
  Object.values(groups).forEach(group => {
    group.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  });
  return Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
}

function DetailModal({ protocol, events, onClose, onDelete, onSave }: { protocol: any; events: any[]; onClose: () => void; onDelete: () => void; onSave: () => void }) {
  const { user } = useAuth();
  const canDelete = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER'].includes(user?.role || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: protocol.title, date: protocol.date ? protocol.date.slice(0, 10) : '', eventId: protocol.eventId || '', author: protocol.author || '', notes: protocol.notes || '' });
  const isPDF = protocol.mimeType === 'application/pdf';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await protocolApi.update(protocol.id, form); toast.success('Gespeichert'); setEditing(false); onSave(); }
    catch { toast.error('Fehler'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Protokoll wirklich löschen?')) return;
    try { await protocolApi.delete(protocol.id); toast.success('Gelöscht'); onDelete(); }
    catch { toast.error('Fehler'); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl  w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileTypeBadge mimeType={protocol.mimeType} size="sm" />
            <div>
              <h3 className="font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>{protocol.title}</h3>
              <p className="text-xs text-gray-500">{format(parseISO(protocol.date), 'd. MMMM yyyy', { locale: de })} · {formatFileSize(protocol.fileSize)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isPDF && (
            <div className="h-80 border-b border-black/10 flex-shrink-0">
              <iframe src={`${protocol.fileUrl}#toolbar=0`} className="w-full h-full" title={protocol.title} />
            </div>
          )}
          <div className="p-6 space-y-4">
            {!editing ? (
              <div className="space-y-3">
                {[
                  { label: 'Datum', value: format(parseISO(protocol.date), 'd. MMMM yyyy', { locale: de }) },
                  { label: 'Ereignis', value: protocol.event ? `${protocol.event.title} (${format(parseISO(protocol.event.date), 'd. MMM yyyy', { locale: de })})` : '—' },
                  { label: 'Verfasser', value: protocol.author || '—' },
                  { label: 'Datei', value: protocol.fileName },
                  { label: 'Bemerkungen', value: protocol.notes || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-28 flex-shrink-0 pt-0.5">{label}</p>
                    <p className="text-sm text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Titel *</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                    <DiktatButton onResult={text => setForm(f => ({ ...f, title: text }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datum *</label>
                  <input type="date" className="input-field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verfasser</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" className="input-field" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                    <DiktatButton onResult={text => setForm(f => ({ ...f, author: text }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bemerkungen</label>
                  <div className="flex gap-2 items-center">
                    <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">Abbrechen</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />{saving ? 'Speichern...' : 'Speichern'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        {!editing && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-black/10 flex-shrink-0">
            <a href={protocolApi.downloadUrl(protocol.id)} download={protocol.fileName} className="btn-primary flex items-center gap-2 flex-1 justify-center text-sm">
              <Download className="w-4 h-4" /> Herunterladen
            </a>
            {isPDF && (
              <a href={protocol.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2 flex-1 justify-center text-sm">
                <Eye className="w-4 h-4" /> Im Browser öffnen
              </a>
            )}
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm px-4">Bearbeiten</button>
            {canDelete && (
              <button onClick={handleDelete} className="btn-danger p-2.5" title="Löschen"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProtocolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [protocols, setProtocols] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const hasAccess = ALLOWED_ROLES.includes(user?.role || '');

  const load = useCallback(() => {
    if (!hasAccess) return;
    setLoading(true);
    Promise.all([protocolApi.list(), eventApi.list()])
      .then(([p, e]) => { setProtocols(p || []); setEvents(Array.isArray(e) ? e : (e.events || [])); })
      .finally(() => setLoading(false));
  }, [hasAccess]);

  useEffect(() => { load(); }, [load]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
        <Shield className="w-12 h-12 opacity-20" />
        <p className="font-medium">Kein Zugriff — nur für Kommandanten, Schriftführer und Administratoren</p>
      </div>
    );
  }

  const filtered = protocols.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) || (p.author?.toLowerCase() || '').includes(search.toLowerCase())
  );
  const grouped = groupByYear(filtered);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>Protokolle</h1>
          <p className="text-sm text-gray-500">{protocols.length} Dokumente</p>
        </div>
        <button onClick={() => navigate('/protocols/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Protokoll hochladen
        </button>
      </div>
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="search" placeholder="Protokoll suchen..." className="input-field pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-black/10 border-t-fire-700 rounded-full animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
          <FileText className="w-12 h-12 opacity-20" />
          <p className="font-medium">{search ? 'Keine Protokolle gefunden' : 'Noch keine Protokolle vorhanden'}</p>
          {!search && <button onClick={() => navigate('/protocols/new')} className="btn-primary mt-2">Erstes Protokoll hochladen</button>}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([year, items]) => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold text-gold-400" style={{ fontFamily: 'var(--font-headings)' }}>{year}</h2>
                <div className="flex-1 h-px bg-black/10" />
                <span className="text-xs text-gray-400">{items.length} Dokument{items.length !== 1 ? 'e' : ''}</span>
              </div>
              <div className="glass-card rounded-2xl border border-black/10  overflow-hidden">
                {items.map((p: any) => (
                  <div key={p.id}>
                    {/* Haupt-Protokoll */}
                    <div className="flex items-center gap-4 px-5 py-4 border-b border-black/10 last:border-0 hover:bg-black/5 transition-colors">
                      <FileTypeBadge mimeType={p.mimeType} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm truncate">{p.title}</p>
                          {p.signatures?.length > 0 && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              ✍️ {p.signatures.length} Unterschrift{p.signatures.length !== 1 ? 'en' : ''}
                            </span>
                          )}
                          {p.signedVersions?.length > 0 && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">
                              ✅ {p.signedVersions.length} signierte Version{p.signedVersions.length !== 1 ? 'en' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{format(parseISO(p.date), 'd. MMMM yyyy', { locale: de })}</span>
                          {p.author && <span className="text-xs text-gray-500 flex items-center gap-1 font-medium"><User className="w-3 h-3" />{p.author}</span>}
                          {p.createdAt && !isNaN(new Date(p.createdAt).getTime()) && <span className="text-xs text-gray-400 flex items-center gap-1" title="Erstellungszeitpunkt"><span>🕐</span> {format(new Date(p.createdAt), 'd.M.yyyy, HH:mm', { locale: de })} Uhr</span>}
                          {p.event && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{p.event.title}</span>}
                          {p.fileSize && <span className="text-xs text-gray-400">{formatFileSize(p.fileSize)}</span>}
                        </div>
                      </div>
                      <button onClick={() => navigate(`/protocols/${p.id}`)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
                        <ChevronRight className="w-3.5 h-3.5" /> Details
                      </button>
                    </div>

                    {/* Signierte Versionen — eingerückt */}
                    {p.signedVersions?.map((sv: any) => (
                      <div key={sv.id} className="flex items-center gap-4 pl-12 pr-5 py-3 border-b border-black/10 last:border-0 bg-green-50/50 hover:bg-green-50 transition-colors">
                        <div className="w-6 h-6 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0 text-sm">✍️</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{sv.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-green-600 font-medium">Signierte Version</span>
                            {sv.createdAt && <span className="text-xs text-gray-400">{format(new Date(sv.createdAt), 'd.M.yyyy, HH:mm', { locale: de })} Uhr</span>}
                            {sv.fileSize && <span className="text-xs text-gray-400">{formatFileSize(sv.fileSize)}</span>}
                          </div>
                        </div>
                        <button onClick={() => navigate(`/protocols/${sv.id}`)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
                          <ChevronRight className="w-3.5 h-3.5" /> Details
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
