import FileTypeBadge from '../components/FileTypeBadge';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { hasAdvancedAccess } from '../utils/rankAccess';
import { documentApi } from '../api';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Upload, Shield, X, Plus, Download, Trash2, ChevronDown, ChevronRight,
  BookOpen, Pencil, Check, Eye,
} from 'lucide-react';
import { FileText, FolderOpen, BookOpen, ScrollText, GraduationCap, ClipboardList, ClipboardCheck, FileSearch, FilePlus, FileStack, Shield, ShieldCheck, Flame, Truck, AlertTriangle, Users, UserCheck, BadgeCheck, Award, Star, Wrench, Settings, Hammer, HardHat, Map, MapPin, Building, Home, Flag, Layers } from 'lucide-react';

const ICON_MAP: Record<string, any> = { FileText: FileText, FolderOpen: FolderOpen, BookOpen: BookOpen, ScrollText: ScrollText, GraduationCap: GraduationCap, ClipboardList: ClipboardList, ClipboardCheck: ClipboardCheck, FileSearch: FileSearch, FilePlus: FilePlus, FileStack: FileStack, Shield: Shield, ShieldCheck: ShieldCheck, Flame: Flame, Truck: Truck, AlertTriangle: AlertTriangle, Users: Users, UserCheck: UserCheck, BadgeCheck: BadgeCheck, Award: Award, Star: Star, Wrench: Wrench, Settings: Settings, Hammer: Hammer, HardHat: HardHat, Map: Map, MapPin: MapPin, Building: Building, Home: Home, Flag: Flag, Layers: Layers };
import toast from 'react-hot-toast';

// ── Storage key ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'fw_document_public_categories';

const DEFAULT_CATEGORIES = [
  { id: 'public_general',  label: 'Allgemein',        icon: 'FolderOpen', color: '#3b82f6', description: 'Allgemeine Dokumente für alle Mitglieder' },
  { id: 'public_notices',  label: 'Bekanntmachungen', icon: 'Flag',       color: '#f59e0b', description: 'Informationen und Bekanntmachungen' },
  { id: 'public_calendar', label: 'Termine & Pläne',  icon: 'Map',        color: '#10b981', description: 'Dienstpläne, Termine und Übersichten' },
];

function loadCategories() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(stored);
    // Merge: add any missing default categories
    const ids = parsed.map((c: any) => c.id);
    const missing = DEFAULT_CATEGORIES.filter(d => !ids.includes(d.id));
    return [...missing, ...parsed];
  } catch { return DEFAULT_CATEGORIES; }
}

function saveCategories(cats: any[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
}

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

// ── Dynamic Lucide Icon ───────────────────────────────────────────────────────
function DynIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] || FileText;
  return <Icon className={className} style={style} />;
}

const PRESET_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];


// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ category, onClose, onSave }: { category: any; onClose: () => void; onSave: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');

  const handleFileSelect = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setUploading(true);
    try {
      await protocolApi.upload(file, {
        title,
        date: new Date().toISOString().slice(0, 10),
        notes: `__category:${category.id}`,
      });
      toast.success('Dokument hochgeladen');
      onSave();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Upload');
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: category.color + '20' }}>
              <DynIcon name={category.icon} className="w-4 h-4" style={{ color: category.color }} />
            </div>
            <h3 className="font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>{category.label}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragging ? 'border-fire-500 bg-fire-50' : 'border-surface-200 hover:border-fire-300 hover:bg-surface-50'}`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">{MIME_ICONS[file.type] || '📎'}</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 p-1 hover:bg-surface-100 rounded-lg"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Datei hierher ziehen oder klicken</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, OpenDocument — max. 50MB</p>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.odt,.ods,.odp" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Titel *</label>
            <input type="text" className="input-field" value={title}
              onChange={e => setTitle(e.target.value)} required placeholder="Dokumententitel" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={uploading || !file || !title} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {uploading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Lädt...</> : <><Upload className="w-4 h-4" />Hochladen</>}
            </button>
          </div>
        </form>
      </div>
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-surface-100 flex-shrink-0">
            <h3 className="font-bold text-gray-900">{previewDoc.name}</h3>
            <button onClick={() => { URL.revokeObjectURL(previewDoc.url); setPreviewDoc(null); }}
              className="btn-secondary text-sm">✕ Schließen</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe src={previewDoc.url} className="w-full h-full" title={previewDoc.name} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DocumentsPublicPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>(loadCategories);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isAdmin = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER', 'SECRETARY'].includes(user?.role || '');

  const load = () => {
    setLoading(true);
    documentApi.list({ isPublic: true }).then(data => {
      setDocs(data || []);
    }).catch(() => setDocs([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const getDocsForCategory = (catId: string) =>
    docs.filter((d: any) => d.category === catId);

  const toggleExpanded = (id: string) =>
    setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleDelete = async (doc: any) => {
    if (!confirm('Dokument wirklich löschen?')) return;
    try { await documentApi.delete(doc.id); toast.success('Gelöscht'); load(); }
    catch { toast.error('Fehler'); }
  };

  const handleDeleteCategory = (catId: string) => {
    if (!confirm('Kategorie wirklich löschen? Alle Dokumente darin bleiben erhalten.')) return;
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    saveCategories(updated);
    toast.success('Kategorie gelöscht');
  };

  const handleDownload = async (doc: any) => {
    const res = await fetch(documentApi.downloadUrl(doc.id), {
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = doc.fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const [previewDoc, setPreviewDoc] = useState<{url: string; name: string} | null>(null);

  const handleView = async (doc: any) => {
    const res = await fetch(documentApi.viewUrl(doc.id), {
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setPreviewDoc({ url, name: doc.title });
  };

  const handleSaveCategory = (cat: any) => {
    let updated;
    if (categories.find(c => c.id === cat.id)) {
      updated = categories.map(c => c.id === cat.id ? cat : c);
    } else {
      updated = [...categories, cat];
    }
    setCategories(updated);
    saveCategories(updated);
    toast.success('Kategorie gespeichert');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-headings)' }}>Dokumente Allgemein</h1>
          <p className="text-sm text-gray-500 mt-0.5">Allgemeine Dokumente für alle Mitglieder</p>
        </div>
        <button onClick={() => navigate('/documents-public/new')}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Neue Kategorie
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const catDocs = getDocsForCategory(cat.id);
            const isOpen = !!expanded[cat.id];

            return (
              <div key={cat.id} className="card p-0 overflow-hidden">
                {/* Category Header — clickable */}
                <div className="flex flex-col">
                  {/* Zeile 1: Icon + Name + Chevron */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-1 cursor-pointer select-none"
                    onClick={() => toggleExpanded(cat.id)}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cat.color + '15', border: `1px solid ${cat.color}30` }}>
                      <DynIcon name={cat.icon} className="w-4 h-4" style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'var(--font-headings)' }}>{cat.label}</h2>
                      <p className="text-xs text-gray-500">{catDocs.length} Dokument{catDocs.length !== 1 ? 'e' : ''}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                  {/* Zeile 2: Buttons */}
                  <div className="flex items-center gap-1 px-4 pb-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate(`/documents-public/edit?edit=${cat.id}`)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-surface-100 rounded-xl transition-colors" title="Bearbeiten">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDeleteCategory(cat.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Kategorie löschen">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => navigate(`/documents-public/upload?category=${cat.id}&label=${encodeURIComponent(cat.label)}&back=/documents-public`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors bg-surface-100 text-gray-600 hover:bg-surface-200 ml-1">
                      <Plus className="w-3.5 h-3.5" /> Hinzufügen
                    </button>
                  </div>
                </div>

                {/* Documents — collapsible */}
                <div style={{
                  maxHeight: isOpen ? '2000px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  {catDocs.length === 0 ? (
                    <div className="px-6 py-6 text-center border-t border-surface-100">
                      <BookOpen className="w-7 h-7 opacity-10 mx-auto mb-2 text-gray-500" />
                      <p className="text-sm text-gray-400">Noch keine Dokumente</p>
                      <button onClick={() => navigate(`/documents-public/upload?category=${cat.id}&label=${encodeURIComponent(cat.label)}&back=/documents-public`)}
                        className="text-xs mt-1 font-medium" style={{ color: cat.color }}>
                        + Erstes Dokument hochladen
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-surface-100">
                      {catDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 px-5 py-3 border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors">
                          <FileTypeBadge mimeType={doc.mimeType} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{doc.title}</p>
                            <p className="text-xs text-gray-400">
                              {format(parseISO(doc.createdAt), 'd. MMM yyyy', { locale: de })}
                              {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                            <button onClick={() => navigate(`/documents-public/${doc.id}?back=/documents-public`)}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium bg-surface-100 text-gray-600 hover:bg-surface-200 transition-colors">
                              <Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Details</span>
                            </button>
                            <button onClick={() => handleDownload(doc)}
                              className="p-2 text-gray-400 hover:text-fire-700 hover:bg-fire-50 rounded-xl transition-colors" title="Herunterladen">
                              <Download className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDelete(doc)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Löschen">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-surface-100 flex-shrink-0">
            <h3 className="font-bold text-gray-900">{previewDoc.name}</h3>
            <button onClick={() => { URL.revokeObjectURL(previewDoc.url); setPreviewDoc(null); }}
              className="btn-secondary text-sm">✕ Schließen</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe src={previewDoc.url} className="w-full h-full" title={previewDoc.name} />
          </div>
        </div>
      )}
    </div>
  );
}
