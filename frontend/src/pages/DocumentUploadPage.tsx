import FileTypeBadge from '../components/FileTypeBadge';
import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { documentApi } from '../api';
import { Upload, X, ArrowLeft, CheckCircle } from 'lucide-react';
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category') || '';
  const categoryLabel = searchParams.get('label') || 'Dokument';
  const backPath = searchParams.get('back') || '/documents';
  // Determine isPublic from the current URL path (most reliable)
  const isPublicUpload = window.location.pathname.startsWith('/documents-public') ||
    decodeURIComponent(backPath).includes('documents-public');

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    author: '',
    notes: '',
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); if (!form.title) setForm(p => ({ ...p, title: f.name.replace(/\.[^.]+$/, '') })); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); if (!form.title) setForm(p => ({ ...p, title: f.name.replace(/\.[^.]+$/, '') })); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error('Bitte eine Datei auswählen'); return; }
    setUploading(true);
    try {
      await documentApi.upload(file, {
        title: form.title,
        category: categoryId,
        isPublic: isPublicUpload,
        author: form.author || undefined,
        notes: form.notes || undefined,
        date: form.date,
      });
      toast.success('Dokument erfolgreich hochgeladen');
      navigate(backPath);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Upload');
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate(backPath)} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>
            Dokument hochladen
          </h1>
          <p className="text-sm text-gray-500">Kategorie: {categoryLabel} · PDF, Word oder OpenDocument — max. 50MB</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all ${
            file
              ? 'border-emerald-300 bg-emerald-50 cursor-default'
              : dragging
              ? 'border-gold-400 bg-gold-400/10 cursor-copy'
              : 'border-surface-300 hover:border-gold-300 hover:bg-black/5 cursor-pointer'
          }`}
        >
          {file ? (
            <div className="flex items-center gap-4 p-6">
              <FileTypeBadge mimeType={file.type} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                <div className="flex items-center gap-1.5 mt-2 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Datei bereit zum Hochladen</span>
                </div>
              </div>
              <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                className="p-2 hover:bg-emerald-100 rounded-xl transition-colors flex-shrink-0">
                <X className="w-5 h-5 text-emerald-700" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragging ? 'bg-fire-100' : 'bg-black/5'}`}>
                <Upload className={`w-7 h-7 transition-colors ${dragging ? 'text-gold-400' : 'text-gray-400'}`} />
              </div>
              <p className="font-semibold text-gray-900 mb-1">{dragging ? 'Datei loslassen' : 'Datei hier ablegen'}</p>
              <p className="text-sm text-gray-500 mb-4">oder klicken um eine Datei auszuwählen</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {['PDF', 'DOC', 'DOCX', 'ODT', 'ODS', 'ODP'].map(ext => (
                  <span key={ext} className="text-xs glass-card border border-black/10 rounded-lg px-2 py-1 text-gray-500 font-mono">.{ext.toLowerCase()}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.odt,.ods,.odp,.odf" onChange={handleFileSelect} />

        {/* Form fields */}
        <div className="glass-card rounded-2xl border border-black/10 p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Titel *</label>
            <input type="text" className="input-field" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Dokumententitel" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datum *</label>
              <input type="date" className="input-field" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verfasser</label>
              <input type="text" className="input-field" value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="Name des Verfassers" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bemerkungen (optional)</label>
            <textarea className="input-field" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optionale Anmerkungen zum Dokument..." />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(backPath)} className="btn-secondary flex-1">
            Abbrechen
          </button>
          <button type="submit" disabled={uploading || !file || !form.title} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {uploading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird hochgeladen...</>
              : <><Upload className="w-4 h-4" /> Dokument hochladen</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
