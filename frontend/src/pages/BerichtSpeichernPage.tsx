import { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Loader, Save, Check, FileText } from 'lucide-react';
import { protocolApi, eventApi } from '../api';
import { useAuth } from '../utils/AuthContext';
import { useBranding } from '../utils/BrandingContext';
import { generatePDFReport } from './ReportsPage';
import toast from 'react-hot-toast';

export default function BerichtSpeichernPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branding } = useBranding();
  const { user } = useAuth();
  const userName = user?.member ? `${user.member.firstName} ${user.member.lastName}` : (user?.email || '');

  const reportId = searchParams.get('id') || '';
  const reportTitle = decodeURIComponent(searchParams.get('title') || 'Bericht');
  const dateFrom = searchParams.get('from') || undefined;
  const dateTo = searchParams.get('to') || undefined;
  const fromJahresbericht = searchParams.get('fromJahresbericht') === '1';

  const [generating, setGenerating] = useState(true);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: reportTitle,
    date: new Date().toISOString().slice(0, 10),
    author: '',
    eventId: '',
    notes: '',
  });

  useEffect(() => {
    eventApi.list({ limit: '50' })
      .then(r => setEvents(r.events || r || []))
      .catch(() => {});
    // Author bleibt leer - User soll selbst eintragen
    generateReport();
  }, []);

  const generateReport = async () => {
    setGenerating(true);
    try {
      // KI-Texte aus sessionStorage holen falls Jahresbericht
      let aiSections: Record<string, string> | undefined;
      if (fromJahresbericht) {
        const stored = sessionStorage.getItem('jahresberichtSections');
        if (stored) {
          aiSections = JSON.parse(stored);
          sessionStorage.removeItem('jahresberichtSections');
          sessionStorage.removeItem('jahresberichtYear');
        }
      }

      const result = await generatePDFReport(
        reportId, branding.name, branding.logoUrl,
        dateFrom, dateTo, aiSections, userName
      );
      const url = URL.createObjectURL(result.blob);
      setPdfBlob(result.blob);
      setPdfUrl(url);
      setFileName(result.fileName);
      setForm(f => ({ ...f, title: reportTitle }));
    } catch (err: any) {
      toast.error('Fehler beim Generieren: ' + (err?.message || String(err)));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBlob || !fileName) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdfBlob);
    a.download = fileName;
    a.click();
  };

  const handleOpenInBrowser = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank');
  };

  const handleSaveToProtocol = async () => {
    if (!pdfBlob) return;
    if (!form.title.trim()) { toast.error('Bitte einen Titel eingeben'); return; }
    setSaving(true);
    try {
      const file = new File([pdfBlob], `${form.title}.pdf`, { type: 'application/pdf' });
      await protocolApi.upload(file, {
        title: form.title,
        date: form.date,
        eventId: form.eventId || undefined,
        author: form.author || undefined,
        notes: form.notes || undefined,
      });
      setSaved(true);
      toast.success('In Protokolle Kommando abgelegt!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader className="w-10 h-10 animate-spin text-fire-700" />
        <p className="text-ink font-medium">Bericht wird generiert...</p>
        <p className="text-ink-muted text-sm">{reportTitle}</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fromJahresbericht ? '/reports/jahresbericht' : '/reports')}
          className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink-muted" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
            {reportTitle}
          </h1>
          <p className="text-sm text-ink-muted">Bericht speichern</p>
        </div>
      </div>

      {/* Einzel-Block */}
      <div className="card p-6 space-y-4">

        {/* PDF bereit Hinweis */}
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>PDF erfolgreich generiert — {fileName}</span>
        </div>

        {saved ? (
          /* Nach dem Speichern */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <Check className="w-5 h-5" />
              <span>In Protokolle Kommando gespeichert als "{form.title}"</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button onClick={() => navigate('/protocols')} className="btn-secondary text-sm text-center">
                Zu Protokolle →
              </button>
              <button onClick={handleDownload} className="btn-secondary flex items-center gap-1.5 justify-center text-sm">
                <Download className="w-4 h-4" /> Laden
              </button>
              <button onClick={handleOpenInBrowser} className="btn-secondary flex items-center gap-1.5 justify-center text-sm">
                <Eye className="w-4 h-4" /> Öffnen
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Titel */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Titel *</label>
              <input type="text" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="input-field font-semibold" placeholder="Titel des Berichts" />
            </div>

            {/* Datum + Verfasser */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Verfasser</label>
                <input type="text" value={form.author}
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                  className="input-field" placeholder="Name" />
              </div>
            </div>

            {/* Ereignis */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                Verknüpftes Ereignis (optional)
              </label>
              <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}
                className="input-field">
                <option value="">— Kein Ereignis —</option>
                {events.map((ev: any) => (
                  <option key={ev.id} value={ev.id}>
                    {new Date(ev.date).toLocaleDateString('de-AT')} · {ev.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Notizen */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
              <div className="flex gap-2 items-start">
<textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field resize-none" rows={2} placeholder="Optionale Bemerkungen..." />
<DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
            </div>

            {/* Trennlinie */}
            <div className="border-t border-surface-200" />

            {/* Primär: Protokoll speichern */}
            <button onClick={handleSaveToProtocol}
              disabled={saving || !pdfBlob || !form.title.trim()}
              className="btn-primary flex items-center gap-2 justify-center w-full">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              In Protokolle Kommando speichern
            </button>

            {/* Sekundär: Lokal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={handleDownload} disabled={!pdfBlob}
                className="btn-secondary flex items-center gap-2 justify-center text-sm">
                <Download className="w-4 h-4" /> Herunterladen
              </button>
              <button onClick={handleOpenInBrowser} disabled={!pdfBlob}
                className="btn-secondary flex items-center gap-2 justify-center text-sm">
                <Eye className="w-4 h-4" /> Im Browser öffnen
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => navigate('/reports')} className="btn-secondary text-sm">
        ← Zurück zu Berichten
      </button>
    </div>
  );
}
