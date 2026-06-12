import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder, FolderPlus, Upload, Search, X, ChevronRight, ArrowLeft, WifiOff, RefreshCw, CheckCircle2, AlertTriangle,
  FileText, Image, File, Trash2, Edit2, Eye, Download,
  FolderOpen, Check
} from 'lucide-react';
import api from '../api';
import { getFileFromCache } from '../hooks/useEinsatzplaeneCache';
import { useEinsatzplaeneCacheStatus } from '../utils/EinsatzplaeneCacheContext';
import { useAuth } from '../utils/AuthContext';
import { usePermission } from '../utils/PermissionContext';
import toast from 'react-hot-toast';
import DiktatButton from '../components/DiktatButton';

interface EinsatzplanFolder {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  children: EinsatzplanFolder[];
  _count: { plans: number };
}

interface Einsatzplan {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  folderId?: string;
  folder?: EinsatzplanFolder;
  createdAt: string;
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mimeType, className = 'w-8 h-8' }: { mimeType?: string; className?: string }) {
  if (mimeType?.includes('pdf')) return <FileText className={`${className} text-red-500`} />;
  if (mimeType?.startsWith('image/')) return <Image className={`${className} text-blue-500`} />;
  return <File className={`${className} text-gray-400`} />;
}

// ── Upload helper ─────────────────────────────────────────────────────────────
async function uploadFile(file: File, title: string, description: string, folderId?: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title || file.name.replace(/\.[^.]+$/, ''));
  form.append('description', description);
  if (folderId) form.append('folderId', folderId);
  const token = localStorage.getItem('token');
  const res = await fetch('/api/einsatzplaene', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error('Upload fehlgeschlagen');
  return res.json();
}

// ── Offline-fähiges Öffnen/Herunterladen ─────────────────────────────────────
// Liest Datei aus IndexedDB (gecacht via useEinsatzplaeneCache),
// fällt bei Misserfolg auf Netz-URL zurück.
async function openFileOfflineAware(fileUrl: string, fileName: string, asDownload = false) {
  const absoluteUrl = fileUrl.startsWith('http')
    ? fileUrl
    : window.location.origin + fileUrl;

  let blobUrl: string | null = null;

  try {
    const blob = await getFileFromCache(absoluteUrl);
    if (blob && blob.size > 0) {
      blobUrl = URL.createObjectURL(blob);
    } else if (blob) {
      toast.error('Gecachte Datei ist leer (0 Bytes) – bitte online öffnen');
    }
  } catch (e: any) {
    toast.error('Cache-Fehler: ' + (e?.message || String(e)));
  }

  if (!blobUrl) {
    if (!navigator.onLine) {
      // Offline und nicht gecacht → klarer Hinweis
      toast.error('Datei nicht offline verfügbar – bitte zuerst online öffnen damit sie gecacht wird');
      return;
    }
    // Online-Fallback: direkt vom Netz
    if (asDownload) {
      const a = document.createElement('a');
      a.href = absoluteUrl;
      a.download = fileName;
      a.click();
    } else {
      window.open(absoluteUrl, '_blank');
    }
    return;
  }

  // Blob-URL aus IndexedDB → funktioniert auch offline
  const a = document.createElement('a');
  a.href = blobUrl;
  if (asDownload) a.download = fileName;
  else a.target = '_blank';
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl!), 10_000);
}

// ── Datei öffnen: neuer Tab (online) oder Blob-URL aus Cache (offline) ────────
async function openFile(plan: Einsatzplan) {
  const absoluteUrl = plan.fileUrl.startsWith('http')
    ? plan.fileUrl
    : window.location.origin + plan.fileUrl;

  // Offline: Blob aus IndexedDB → neuer Tab mit blob: URL
  if (!navigator.onLine) {
    try {
      const blob = await getFileFromCache(absoluteUrl);
      if (blob && blob.size > 0) {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        return;
      }
    } catch {}
    toast.error('Datei offline nicht verfügbar – bitte zuerst online öffnen');
    return;
  }

  // Online: direkt URL in neuem Tab öffnen
  window.open(absoluteUrl, '_blank');
}

// ── Folder Modal ──────────────────────────────────────────────────────────────
function FolderModal({ folder, parentId, onSave, onClose }: {
  folder?: EinsatzplanFolder; parentId?: string; onSave: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(folder?.name || '');
  const [color, setColor] = useState(folder?.color || '#16a34a');
  const [saving, setSaving] = useState(false);
  const PRESETS = ['#16a34a', '#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#374151', '#FFB900', '#ea580c'];

  const save = async () => {
    if (!name.trim()) { toast.error('Name erforderlich'); return; }
    setSaving(true);
    try {
      if (folder) await api.put(`/einsatzplaene/folders/${folder.id}`, { name, color });
      else await api.post('/einsatzplaene/folders', { name, color, parentId });
      toast.success(folder ? 'Ordner aktualisiert' : 'Ordner erstellt');
      onSave();
    } catch { toast.error('Fehler'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-lg">{folder ? 'Ordner bearbeiten' : 'Neuer Ordner'}</h3>
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Brandobjekte" className="input-field w-full" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Farbe</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESETS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className="w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center"
                style={{ backgroundColor: c, borderColor: color === c ? '#000' : 'transparent' }}>
                {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer" />
            <span className="text-sm text-ink-muted">Eigene Farbe</span>
            <span className="ml-auto font-mono text-sm text-ink-muted">{color}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
          <Folder className="w-6 h-6" style={{ color, fill: color }} />
          <span className="text-sm font-medium">{name || 'Ordnername'}</span>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Speichern...' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal with Drag & Drop + Multi-file ────────────────────────────────
function UploadModal({ folderId, onSave, onClose }: { folderId?: string; onSave: () => void; onClose: () => void; }) {
  const [files, setFiles] = useState<{ file: File; title: string; description: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => [
      ...prev,
      ...newFiles.map(f => ({ file: f, title: f.name.replace(/\.[^.]+$/, ''), description: '' }))
    ]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  const upload = async () => {
    if (!files.length) { toast.error('Bitte Dateien auswählen'); return; }
    setUploading(true);
    try {
      for (const { file, title, description } of files) {
        await uploadFile(file, title, description, folderId);
      }
      toast.success(`${files.length} Datei(en) hochgeladen`);
      onSave();
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">Einsatzpläne hochladen</h3>

        {/* Drop Zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragOver ? 'border-fire-500 bg-fire-50 scale-[1.01]' : 'border-surface-300 hover:border-fire-400'
          }`}>
          <Upload className={`w-10 h-10 mx-auto mb-2 ${dragOver ? 'text-fire-600' : 'text-ink-faint'}`} />
          <p className="text-sm font-medium">{dragOver ? 'Dateien loslassen...' : 'Dateien hierher ziehen oder klicken'}</p>
          <p className="text-xs text-ink-muted mt-1">PDF, Bilder, alle Dateitypen · Mehrere Dateien gleichzeitig möglich</p>
          <input ref={fileRef} type="file" multiple className="hidden"
            onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((item, idx) => (
              <div key={idx} className="card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileIcon mimeType={item.file.type} className="w-6 h-6 flex-shrink-0" />
                  <span className="text-xs text-ink-muted truncate flex-1">{item.file.name} · {formatSize(item.file.size)}</span>
                  <button onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="text-ink-muted hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <input value={item.title} onChange={e => setFiles(prev => prev.map((f, i) => i === idx ? { ...f, title: e.target.value } : f))}
                    placeholder="Titel" className="input-field flex-1 text-sm" />
                  <DiktatButton onResult={text => setFiles(prev => prev.map((f, i) => i === idx ? { ...f, title: text } : f))} />
                </div>
                <div className="flex gap-2 items-center">
                  <input value={item.description} onChange={e => setFiles(prev => prev.map((f, i) => i === idx ? { ...f, description: e.target.value } : f))}
                    placeholder="Beschreibung (optional)" className="input-field flex-1 text-sm" />
                  <DiktatButton onResult={text => setFiles(prev => prev.map((f, i) => i === idx ? { ...f, description: text } : f))} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
          <button onClick={upload} disabled={uploading || !files.length} className="btn-primary flex-1">
            {uploading ? `Lade hoch...` : `${files.length || 0} Datei(en) hochladen`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan-Karte (einheitlich überall) ─────────────────────────────────────────
function PlanCard({ plan, onView, onDelete }: { plan: Einsatzplan; onView: () => void; onDelete: () => void }) {
  return (
    <div className="card p-4 hover:shadow-md transition-all overflow-hidden">
      <div className="flex items-start gap-3 min-w-0">
        <FileIcon mimeType={plan.mimeType} className="w-9 h-9 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-semibold text-sm break-words leading-snug">{plan.title}</p>
          {plan.description && <p className="text-xs text-ink-muted mt-0.5 break-words">{plan.description}</p>}
          <p className="text-xs text-ink-muted mt-0.5 break-all">{plan.fileName} · {formatSize(plan.fileSize)}</p>
          {(plan as any).folder && (
            <div className="flex items-center gap-1 mt-0.5">
              <Folder className="w-3 h-3" style={{ color: (plan as any).folder.color, fill: (plan as any).folder.color }} />
              <span className="text-xs text-ink-muted">{(plan as any).folder.name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1 justify-end mt-2">
        <button onClick={onView} title="Anzeigen"
          className="p-2 rounded-lg hover:bg-surface-100 text-ink-muted hover:text-fire-700 transition-colors">
          <Eye className="w-4 h-4" />
        </button>
        <button onClick={() => openFileOfflineAware(plan.fileUrl, plan.fileName, true)} title="Herunterladen"
          className="p-2 rounded-lg hover:bg-surface-100 text-ink-muted hover:text-ink transition-colors">
          <Download className="w-4 h-4" />
        </button>
        <button onClick={onDelete} title="Löschen"
          className="p-2 rounded-lg hover:bg-red-50 text-ink-muted hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EinsatzplaenePage() {
  const [folders, setFolders] = useState<EinsatzplanFolder[]>([]);
  const [plans, setPlans] = useState<Einsatzplan[]>([]);
  const { user } = useAuth();
  const { can } = usePermission();
  const cacheStatus = useEinsatzplaeneCacheStatus(); // globaler Status aus Context
  const isAdmin = user?.role === 'ADMIN';
  const canCreate = can('einsatzplaene', 'CREATE');
  const canEdit   = can('einsatzplaene', 'EDIT');
  const canDelete = can('einsatzplaene', 'DELETE');
  const [currentFolder, setCurrentFolder] = useState<EinsatzplanFolder | null>(null);
  const [folderPath, setFolderPath] = useState<EinsatzplanFolder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editFolder, setEditFolder] = useState<EinsatzplanFolder | undefined>();
  const [showUpload, setShowUpload] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const confirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  const loadFolders = useCallback(async () => {
    try {
      const r = await api.get('/einsatzplaene/folders');
      setFolders(r.data);
      // Offline-Cache: Ordnerstruktur im localStorage speichern
      try { localStorage.setItem('ep_folders_cache', JSON.stringify(r.data)); } catch {}
    } catch (err: any) {
      const isOffline = !err.response;
      if (isOffline) {
        // Offline: gecachte Ordner laden
        try {
          const cached = localStorage.getItem('ep_folders_cache');
          if (cached) setFolders(JSON.parse(cached));
        } catch {}
      }
    }
  }, []);

  const loadPlans = useCallback(async (folderId?: string, q?: string) => {
    setLoading(true);
    const cacheKey = `ep_plans_cache_${folderId || 'root'}_${q || ''}`;
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folderId', folderId);
      if (q) params.set('search', q);
      const r = await api.get(`/einsatzplaene?${params}`);
      setPlans(r.data);
      // Offline-Cache: Planliste speichern
      try { localStorage.setItem(cacheKey, JSON.stringify(r.data)); } catch {}
    } catch (err: any) {
      const isOffline = !err.response;
      if (isOffline) {
        // Offline: gecachte Pläne laden
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) setPlans(JSON.parse(cached));
        } catch {}
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    if (search) {
      const t = setTimeout(() => loadPlans(undefined, search), 300);
      return () => clearTimeout(t);
    } else if (currentFolder) {
      loadPlans(currentFolder.id);
    } else {
      setPlans([]); setLoading(false);
    }
  }, [search, currentFolder, loadPlans]);

  const refresh = useCallback(async () => {
    await loadFolders();
    if (currentFolder) loadPlans(currentFolder.id);
    setShowFolderModal(false);
    setShowUpload(false);
    setEditFolder(undefined);
  }, [loadFolders, loadPlans, currentFolder]);

  const deleteFolder = async (f: EinsatzplanFolder) => {
    if (!canDelete) { toast.error('Du hast keine Berechtigung zum Löschen'); return; }
    confirm(`Ordner "${f.name}" löschen?`, async () => {
      await api.delete(`/einsatzplaene/folders/${f.id}`);
      await loadFolders();
      if (currentFolder?.id === f.id) setCurrentFolder(null);
      toast.success('Ordner gelöscht');
    });
  };

  const deletePlan = async (p: Einsatzplan) => {
    if (!canDelete) { toast.error('Du hast keine Berechtigung zum Löschen'); return; }
    confirm(`"${p.title}" löschen?`, async () => {
      await api.delete(`/einsatzplaene/${p.id}`);
      setPlans(prev => {
        const updated = prev.filter(x => x.id !== p.id);
        // Offline-Cache aktualisieren
        const cacheKey = `ep_plans_cache_${p.folderId || 'root'}_`;
        try { localStorage.setItem(cacheKey, JSON.stringify(updated)); } catch {}
        return updated;
      });
      // Gecachte Datei aus SW-Cache entfernen
      if (p.fileUrl && 'caches' in window) {
        try {
          const cache = await caches.open('einsatzplaene-v2');
          const absUrl = p.fileUrl.startsWith('http') ? p.fileUrl : window.location.origin + p.fileUrl;
          await cache.delete(absUrl);
        } catch {}
      }
      toast.success('Gelöscht');
    });
  };

  // Drag & Drop directly onto folder cards
  const handleFolderDrop = async (e: React.DragEvent, folder: EinsatzplanFolder) => {
    e.preventDefault();
    setDragOverFolder(null);
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;
    toast.loading(`Lade ${dropped.length} Datei(en) hoch...`, { id: 'folder-upload' });
    try {
      for (const file of dropped) {
        await uploadFile(file, file.name.replace(/\.[^.]+$/, ''), '', folder.id);
      }
      toast.success(`${dropped.length} Datei(en) in "${folder.name}" hochgeladen`, { id: 'folder-upload' });
      await loadFolders();
      if (currentFolder?.id === folder.id) loadPlans(folder.id);
    } catch {
      toast.error('Fehler beim Upload', { id: 'folder-upload' });
    }
  };

  const navigateToFolder = async (folder: EinsatzplanFolder, pathUpTo?: EinsatzplanFolder[]) => {
    // Load fresh folder data with children
    try {
      const r = await api.get(`/einsatzplaene/folders/${folder.id}`);
      setCurrentFolder(r.data);
    } catch {
      setCurrentFolder(folder);
    }
    if (pathUpTo !== undefined) {
      setFolderPath(pathUpTo);
    } else {
      setFolderPath(prev => [...prev, folder]);
    }
  };

  const navigateToRoot = () => {
    setCurrentFolder(null);
    setFolderPath([]);
  };

  const navigateToBreadcrumb = (folder: EinsatzplanFolder, index: number) => {
    setCurrentFolder(folder);
    setFolderPath(prev => prev.slice(0, index + 1));
  };

  const goBack = () => {
    if (folderPath.length === 0) return;
    if (folderPath.length === 1) {
      navigateToRoot();
    } else {
      const parent = folderPath[folderPath.length - 2];
      navigateToBreadcrumb(parent, folderPath.length - 2);
    }
  };

  const subFolders = currentFolder
    ? (currentFolder.children || [])
    : folders;

  const isSearching = search.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Folder className="w-5 h-5 text-emerald-700" style={{ fill: '#16a34a' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Einsatzpläne</h1>
          <p className="text-sm text-ink-muted">Gebäudepläne, Hydranten-Karten und weitere Dokumente</p>
        </div>
      </div>

      {/* Sync Status */}
      {cacheStatus.status !== 'idle' && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm mb-4 ${
          cacheStatus.status === 'caching' ? 'bg-blue-50 border border-blue-200 text-blue-700' :
          cacheStatus.status === 'done' && !cacheStatus.warning ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
          cacheStatus.warning ? 'bg-amber-50 border border-amber-200 text-amber-700' :
          'bg-surface-50 border border-surface-200 text-ink-muted'
        }`}>
          {cacheStatus.status === 'caching' && (
            <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          )}
          {cacheStatus.status === 'done' && !cacheStatus.warning && (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          )}
          {cacheStatus.warning && (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          {cacheStatus.status === 'error' && (
            <WifiOff className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="flex-1">
            {cacheStatus.status === 'caching' && `Synchronisiere Einsatzpläne... (${cacheStatus.cached} von ${cacheStatus.total})`}
            {cacheStatus.status === 'done' && !cacheStatus.warning && `Offline verfügbar · ${cacheStatus.cached} Datei(en) · ${cacheStatus.totalMB} MB`}
            {cacheStatus.warning && cacheStatus.warning}
          </span>
          {cacheStatus.status === 'caching' && (
            <div className="ml-auto w-24 h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: cacheStatus.total > 0 ? `${(cacheStatus.cached / cacheStatus.total) * 100}%` : '0%' }} />
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Einsatzplan suchen..."
          className="input-field pl-10 w-full" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Breadcrumb + Back button */}
      {!isSearching && currentFolder && (
        <button onClick={goBack}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink mb-3 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>{folderPath.length > 1 ? folderPath[folderPath.length - 2].name : 'Einsatzpläne'}</span>
        </button>
      )}
      {!isSearching && (
        <div className="flex items-center gap-2 mb-4 text-sm flex-wrap">
          <button onClick={navigateToRoot}
            className={`flex items-center gap-1 transition-colors ${!currentFolder ? 'text-emerald-700 font-semibold' : 'text-ink-muted hover:text-ink'}`}>
            <Folder className="w-4 h-4" style={{ color: '#008B45', fill: '#008B45' }} />
            Einsatzpläne
          </button>
          {folderPath.map((f, index) => (
            <span key={f.id} className="flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
              <button
                onClick={() => navigateToBreadcrumb(f, index)}
                className={`flex items-center gap-1 transition-colors ${
                  index === folderPath.length - 1 ? 'font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
                style={{ color: index === folderPath.length - 1 ? f.color : undefined }}>
                <Folder className="w-4 h-4" style={{ color: f.color, fill: f.color }} />
                {f.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {isSearching ? (
        // ── Suchergebnisse ──────────────────────────────────────────────────
        <div className="space-y-2">
          <p className="text-sm text-ink-muted mb-3">{plans.length} Ergebnisse für „{search}"</p>
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} onView={() => openFile(plan)} onDelete={() => deletePlan(plan)} />)}
          {plans.length === 0 && !loading && (
            <div className="card p-8 text-center text-ink-muted">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Keine Pläne gefunden</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Ordner / Unterordner ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                {currentFolder ? 'Unterordner' : 'Ordner'}
              </p>
              {isAdmin && (
                <button onClick={() => { setEditFolder(undefined); setShowFolderModal(true); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                  <FolderPlus className="w-3.5 h-3.5" />
                  Neuer Ordner
                </button>
              )}
            </div>

            {subFolders.length === 0 && !currentFolder && (
              <div className="card p-6 text-center text-ink-muted text-sm">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Noch keine Ordner — erstelle deinen ersten Ordner</p>
              </div>
            )}

            {subFolders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {subFolders.map(folder => (
                  <div key={folder.id}
                    onDragOver={e => { e.preventDefault(); setDragOverFolder(folder.id); }}
                    onDragLeave={() => setDragOverFolder(null)}
                    onDrop={e => handleFolderDrop(e, folder)}
                    className={`card p-4 cursor-pointer hover:shadow-md transition-all group relative ${
                      dragOverFolder === folder.id ? 'ring-2 scale-105 bg-surface-50' : ''
                    }`}
                    onClick={() => navigateToFolder(folder)}>
                    {dragOverFolder === folder.id && (
                      <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-white/80 z-10">
                        <p className="text-xs font-semibold" style={{ color: folder.color }}>Loslassen zum Hochladen</p>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Folder className="w-10 h-10" style={{ color: folder.color, fill: folder.color }} />
                      <p className="text-sm font-medium break-words w-full">{folder.name}</p>
                      <p className="text-xs text-ink-muted">{folder._count.plans} Pläne</p>
                    </div>
                    {isAdmin && (
                      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                        <button onClick={e => { e.stopPropagation(); setEditFolder(folder); setShowFolderModal(true); }}
                          className="p-1 rounded bg-white shadow text-ink-muted hover:text-ink">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteFolder(folder); }}
                          className="p-1 rounded bg-white shadow text-ink-muted hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pläne im aktuellen Ordner ──────────────────────────────────── */}
          {currentFolder && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  Pläne in diesem Ordner
                </p>
                {isAdmin && (
                  <button onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-fire-50 text-fire-700 border border-fire-200 rounded-lg hover:bg-fire-100 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Hochladen
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : plans.length === 0 ? (
                <div className="card p-8 text-center text-ink-muted border-2 border-dashed">
                  <Upload className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Noch keine Pläne</p>
                  {isAdmin && (
                    <>
                      <p className="text-xs mt-1">Dateien hier hineinziehen oder hochladen</p>
                      <button onClick={() => setShowUpload(true)} className="mt-3 btn-primary text-sm px-4 py-2">Plan hochladen</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {plans.map(plan => <PlanCard key={plan.id} plan={plan} onView={() => openFile(plan)} onDelete={() => deletePlan(plan)} />)}
                </div>
              )}
            </div>
          )}

          {/* Hint wenn kein Ordner gewählt */}
          {!currentFolder && subFolders.length > 0 && (
            <div className="card p-4 text-center text-ink-muted text-sm border-2 border-dashed">
              <p>Ordner auswählen · Dateien direkt auf einen Ordner ziehen zum Hochladen</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-ink">Löschen bestätigen</p>
                <p className="text-sm text-ink-muted mt-1">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setConfirmDialog(null)}
                className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors">
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
      {showFolderModal && (
        <FolderModal folder={editFolder} parentId={currentFolder?.id} onSave={refresh}
          onClose={() => { setShowFolderModal(false); setEditFolder(undefined); }} />
      )}
      {showUpload && <UploadModal folderId={currentFolder?.id} onSave={refresh} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
