import FileTypeBadge from '../components/FileTypeBadge';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { documentApi } from '../api';
import { useAuth } from '../utils/AuthContext';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Download, Eye, Trash2 } from 'lucide-react';
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

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const backPath = searchParams.get('back') || '/documents';
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDelete = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER', 'SECRETARY'].includes(user?.role || '');
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    documentApi.list().then((docs: any[]) => {
      const found = docs.find((d: any) => d.id === id);
      if (found) {
        setDoc(found);
        if (found.mimeType === 'application/pdf') {
                fetch(documentApi.viewUrl(id!), {
            credentials: 'include',
          }).then(r => r.blob()).then(blob => {
            setPdfUrl(URL.createObjectURL(blob));
          });
        }
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Dokument wirklich löschen?')) return;
    try {
      await documentApi.delete(id!);
      toast.success('Gelöscht');
      navigate(backPath);
    } catch { toast.error('Fehler beim Löschen'); }
  };

  const handleDownload = async () => {
    try {
        const res = await fetch(documentApi.downloadUrl(id!), {
        credentials: 'include',
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { toast.error('Fehler beim Download'); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" />
    </div>
  );

  if (!doc) return (
    <div className="text-center py-20 text-gray-400">Dokument nicht gefunden</div>
  );

  const isPDF = doc.mimeType === 'application/pdf';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(backPath)} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <FileTypeBadge mimeType={doc.mimeType} />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>{doc.title}</h1>
            <p className="text-sm text-gray-500">{format(parseISO(doc.createdAt), 'd. MMMM yyyy', { locale: de })} · {formatFileSize(doc.fileSize)}</p>
          </div>
        </div>
        {canDelete && (
          <button onClick={handleDelete} className="btn-danger p-2.5" title="Löschen">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* PDF Preview */}
      {isPDF && pdfUrl && (
        <>
          {/* Desktop: iframe Vorschau */}
          <div className="hidden md:block glass-card rounded-2xl border border-black/10 overflow-hidden mb-6" style={{ height: '500px' }}>
            <iframe src={pdfUrl} className="w-full h-full" title={doc.title} />
          </div>
          {/* Mobile: direkter Link */}
          <div className="md:hidden glass-card rounded-2xl border border-black/10 p-6 mb-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              <Eye className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-gray-500 text-center">PDF-Vorschau auf Mobile nicht verfügbar</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" /> PDF öffnen
            </a>
          </div>
        </>
      )}
      {isPDF && !pdfUrl && (
        <div className="glass-card rounded-2xl border border-black/10 flex items-center justify-center mb-6" style={{ height: '80px' }}>
          <div className="w-6 h-6 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button onClick={handleDownload}
          className="btn-primary flex items-center gap-2 flex-1 justify-center">
          <Download className="w-4 h-4" /> Herunterladen
        </button>
        {isPDF && pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2 flex-1 justify-center">
            <Eye className="w-4 h-4" /> Im Browser öffnen
          </a>
        )}
      </div>

      {/* Details */}
      <div className="glass-card rounded-2xl border border-black/10 p-6">
        <div className="space-y-4">
          {[
            { label: 'Titel', value: doc.title },
            { label: 'Kategorie', value: doc.category },
            { label: 'Datum', value: doc.date ? format(parseISO(doc.date), 'd. MMMM yyyy', { locale: de }) : format(parseISO(doc.createdAt), 'd. MMMM yyyy', { locale: de }) },
            { label: 'Verfasser', value: doc.author || '—' },
            { label: 'Hochgeladen', value: format(parseISO(doc.createdAt), 'd. MMMM yyyy', { locale: de }) },
            { label: 'Dateiname', value: doc.fileName },
            { label: 'Dateigröße', value: formatFileSize(doc.fileSize) },
            { label: 'Bemerkungen', value: doc.notes || '—' },
            { label: 'Bereich', value: doc.isPublic ? 'Dokumente Allgemein' : 'Dokumente Kommando' },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-4 py-2 border-b border-black/10 last:border-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-32 flex-shrink-0 pt-0.5">{label}</p>
              <p className="text-sm text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
