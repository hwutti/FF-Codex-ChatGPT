import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, Loader, Eye, FileText, Trash2, Plus, X, Check,
  Calendar, ChevronDown, ChevronUp, Users, ClipboardList,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import type { LetterDesign } from './schriftverkehr.types';

const ENTRY_TYPES: { value: string; label: string }[] = [
  { value: 'SCHULUNG',  label: 'Schulung' },
  { value: 'SEMINAR',   label: 'Seminar' },
  { value: 'KURS',      label: 'Kurs' },
  { value: 'WEBINAR',   label: 'Webinar' },
  { value: 'SONSTIGE',  label: 'Sonstige' },
  { value: 'CUSTOM',    label: 'Freitext' },
];

const TYPE_COLORS: Record<string, string> = {
  SCHULUNG:  'bg-violet-100 text-violet-700',
  SEMINAR:   'bg-blue-100 text-blue-800',
  KURS:      'bg-green-100 text-green-800',
  WEBINAR:   'bg-cyan-100 text-cyan-700',
  SONSTIGE:  'bg-surface-100 text-ink-muted',
  CUSTOM:    'bg-amber-100 text-amber-700',
};

interface Props {
  userDesigns: LetterDesign[];
  systemDesigns: LetterDesign[];
  availableSigners: { userId: string; name: string; function: string }[];
  onPreviewHtmlChange: (html: string, loading: boolean) => void;
}

export function SchulungsplanTab({ userDesigns = [], systemDesigns = [], availableSigners = [], onPreviewHtmlChange }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [planTitle, setPlanTitle] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [closing, setClosing] = useState('Mit kameradschaftlichen Grüßen');
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [selectedDesign, setSelectedDesign] = useState<LetterDesign | null>(null);
  const [selectedSignerIds, setSelectedSignerIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showFairness, setShowFairness] = useState(false);
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allDesigns = [...(systemDesigns || []), ...(userDesigns || [])];

  // Laden
  useEffect(() => {
    api.get('/letter/schulungsplaene').then(r => setPlans(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/letter/recipients/members').then(r => setMembers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  // Plan für gewähltes Jahr laden
  useEffect(() => {
    const plan = plans.find(p => p.year === year);
    if (plan) {
      setCurrentPlan(plan);
      setPlanTitle(plan.title || '');
      setEntries(plan.entries.map(e => ({ ...e })));
      setClosing(plan.closing || 'Mit kameradschaftlichen Grüßen');
      setSelectedSignerIds(JSON.parse(plan.signerUserIds || '[]'));
      if (plan.designId) {
        setSelectedDesignId(plan.designId);
        // Zuerst designSnapshot laden (enthält gespeicherte signerPosition etc.)
        if (plan.designSnapshot) {
          try { setSelectedDesign(JSON.parse(plan.designSnapshot)); } catch {}
        } else {
          const d = allDesigns.find(d => d.id === plan.designId);
          if (d) setSelectedDesign(d);
        }
      } else if (plan.designSnapshot) {
        try { setSelectedDesign(JSON.parse(plan.designSnapshot)); } catch {}
      }
      setDirty(false);
    } else {
      setCurrentPlan(null);
      setPlanTitle('');
      setEntries([]);
      setClosing('Mit kameradschaftlichen Grüßen');
      setSelectedSignerIds([]);
      setDirty(false);
    }
  }, [year, plans]);

  // Design-Wechsel
  const switchDesign = (id: string) => {
    const d = allDesigns.find(d => d.id === id);
    setSelectedDesignId(id);
    setSelectedDesign(d || null);
    setDirty(true);
  };

  // Live-Vorschau
  const loadPreview = useCallback(async () => {
    if (!selectedDesign) { onPreviewHtmlChange('', false); return; }
    onPreviewHtmlChange('', true);
    try {
      const res = await api.post('/letter/schulungsplaene/preview-html', {
        year,
        entries,
        signerUserIds: selectedSignerIds,
        closing,
        designSnapshot: selectedDesign,
      }, { responseType: 'text' });
      onPreviewHtmlChange(res.data, false);
    } catch { onPreviewHtmlChange('', false); }
  }, [year, entries, selectedDesign, selectedSignerIds, closing]);

  useEffect(() => {
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(loadPreview, 700);
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current); };
  }, [loadPreview]);

  // Eintrag hinzufügen
  const addEntry = () => {
    setEntries(prev => [...prev, {
      date: '',
      time: '',
      type: 'EINSATZ',
      title: 'Einsatzübung',
      location: '',
      trainerId: null,
      trainerName: '',
      calendarId: null,
      sortOrder: prev.length,
    }]);
    setDirty(true);
  };

  const updateEntry = (i: number, field: string, value: any) => {
    setEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      const updated: any = { ...e, [field]: value };
      // Automatisch title aus type setzen falls leer
      if (field === 'type') {
        const label = ENTRY_TYPES.find(t => t.value === value)?.label || '';
        if (!e.title || ENTRY_TYPES.some(t => t.label === e.title)) updated.title = label;
      }
      // trainerName aus trainerId
      if (field === 'trainerId') {
        const m = members.find((m: any) => (m.userId || m.id) === value);
        updated.trainerName = m ? `${m.firstName} ${m.lastName}` : '';
      }
      return updated;
    }));
    setDirty(true);
  };

  const removeEntry = (i: number) => {
    setEntries(prev => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const moveEntry = (i: number, dir: -1 | 1) => {
    setEntries(prev => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
    setDirty(true);
  };

  // Speichern
  const savePlan = async () => {
    setSaving(true);
    try {
      const res = await api.post('/letter/schulungsplaene', {
        year,
        title: planTitle.trim() || null,
        designId: selectedDesignId || null,
        designSnapshot: selectedDesign,
        signerUserIds: selectedSignerIds,
        closing,
        entries: entries.map((e, i) => ({ ...e, sortOrder: i })),
      });
      const saved = res.data;
      setCurrentPlan(saved);
      setPlans(prev => {
        const existing = prev.findIndex(p => p.year === year);
        if (existing >= 0) { const arr = [...prev]; arr[existing] = saved; return arr; }
        return [saved, ...prev].sort((a, b) => b.year - a.year);
      });
      setDirty(false);
      toast.success(`Schulungsplan ${year} gespeichert`);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  // PDF
  const downloadPdf = async () => {
    if (!selectedDesign) { toast.error('Kein Design gewählt'); return; }
    setPdfLoading(true);
    try {
      const res = await api.post('/letter/schulungsplaene/pdf', {
        year,
        entries,
        signerUserIds: selectedSignerIds,
        closing,
        designSnapshot: selectedDesign,
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Schulungsplan-${year}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF heruntergeladen');
    } catch { toast.error('PDF-Fehler'); }
    finally { setPdfLoading(false); }
  };

  // In Kalender übernehmen
  const toCalendar = async () => {
    if (!currentPlan) { toast.error('Zuerst speichern'); return; }
    setCalendarLoading(true);
    try {
      const res = await api.post(`/letter/schulungsplaene/${currentPlan.id}/to-calendar`, {});
      const { created, updated: updatedCount, deleted, skipped } = res.data;
      const parts = [];
      if (created) parts.push(`${created} neu angelegt`);
      if (updatedCount) parts.push(`${updatedCount} aktualisiert`);
      if (deleted) parts.push(`${deleted} gelöscht`);
      if (skipped) parts.push(`${skipped} übersprungen`);
      toast.success(`Kalender Allgemein: ${parts.join(', ') || 'keine Änderungen'}`);
      // Plan neu laden für calendarId updates
      const planRes = await api.get(`/letter/schulungsplaene/${currentPlan.id}`);
      setCurrentPlan(planRes.data);
      setEntries(planRes.data.entries.map((e: any) => ({ ...e })));
      setPlans(prev => prev.map(p => p.id === planRes.data.id ? planRes.data : p));
    } catch { toast.error('Fehler beim Kalender-Import'); }
    finally { setCalendarLoading(false); }
  };

  // Fairness-Berechnung
  const leaderCounts = entries.reduce<Record<string, { name: string; count: number }>>((acc, e) => {
    if (!e.trainerName) return acc;
    if (!acc[e.trainerName]) acc[e.trainerName] = { name: e.trainerName, count: 0 };
    acc[e.trainerName].count++;
    return acc;
  }, {});
  const leaderList = Object.values(leaderCounts).sort((a, b) => b.count - a.count);
  const maxCount = leaderList[0]?.count || 1;

  const calendarCount = entries.filter(e => e.calendarId).length;
  const nextEntry = entries.find(e => {
    if (!e.date) return false;
    const match = e.date.match(/^(\d{1,2})\.(\d{1,2})\./);
    if (!match) return false;
    const d = new Date(year, parseInt(match[2]) - 1, parseInt(match[1]));
    return d >= new Date();
  });

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">

          {/* Jahr */}
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Jahr</span>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field text-sm w-24">
            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + 3 - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <div className="w-px h-5 bg-surface-200 mx-1" />

          {/* Optionaler Titel */}
          <input
            value={planTitle}
            onChange={e => { setPlanTitle(e.target.value); setDirty(true); }}
            placeholder={`Schulungsplan ${year} (optionaler Titel)`}
            className="input-field text-sm flex-1 min-w-[200px]"
          />

          <div className="w-px h-5 bg-surface-200 mx-1" />

          {/* Design */}
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Design</span>
          {allDesigns.length === 0 ? (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Noch kein Design — erst im Tab "Design & Vorlagen" erstellen.
            </span>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <select value={selectedDesignId} onChange={e => switchDesign(e.target.value)} className="input-field flex-1 text-sm">
                <option value="">Design wählen...</option>
                {userDesigns.length > 0 && (
                  <optgroup label="Eigene Designs">
                    {userDesigns.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                )}
                {systemDesigns.length > 0 && (
                  <optgroup label="System-Designs">
                    {systemDesigns.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                )}
              </select>
              {selectedDesign && (
                <div className="w-5 h-5 rounded border border-surface-200 flex-shrink-0"
                  style={{ background: selectedDesign.headerBgColor }} />
              )}
            </div>
          )}

          <div className="w-px h-5 bg-surface-200 mx-1" />

          {/* Vorjahr laden */}
          {plans.filter(p => p.year !== year).length > 0 && (
            <>
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Vorlage</span>
              <select defaultValue="" onChange={e => {
                if (!e.target.value) return;
                const src = plans.find(p => p.year === Number(e.target.value));
                if (!src) return;
                setEntries(src.entries.map(e => ({ ...e, calendarId: null })));
                setClosing(src.closing);
                setDirty(true);
                toast.success(`Einträge aus ${src.year} übernommen`);
                e.target.value = '';
              }} className="input-field text-sm">
                <option value="">Aus Vorjahr laden...</option>
                {plans.filter(p => p.year !== year).map(p => (
                  <option key={p.id} value={p.year}>{p.year}</option>
                ))}
              </select>
              <div className="w-px h-5 bg-surface-200 mx-1" />
            </>
          )}

          {/* Aktions-Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <button onClick={toCalendar} disabled={calendarLoading || !currentPlan}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              title={!currentPlan ? 'Zuerst speichern' : 'Übungen in Kalender übernehmen'}>
              {calendarLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              In Kalender
              {calendarCount > 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{calendarCount}</span>}
            </button>
            <button onClick={downloadPdf} disabled={pdfLoading || entries.length === 0}
              className="btn-secondary flex items-center gap-1.5 text-sm">
              {pdfLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              PDF
            </button>
            <button onClick={savePlan} disabled={saving}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl font-semibold text-sm transition-all ${dirty ? 'bg-slate-800 hover:bg-slate-900 text-white' : currentPlan ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-surface-100 hover:bg-surface-200 text-ink'}`}>
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {currentPlan ? 'Aktualisieren' : 'Speichern'}
            </button>
          </div>
        </div>

        {/* Status-Zeile */}
        <div className="flex items-center gap-3 flex-wrap">
          {dirty && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">● Ungespeicherte Änderungen</span>}
          {currentPlan && !dirty && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✓ Gespeichert</span>}
          {currentPlan?.sendCount ? <span className="text-xs text-ink-muted">✉ {currentPlan.sendCount}× versendet</span> : null}
          {nextEntry && <span className="text-xs text-ink-muted flex items-center gap-1"><ArrowRight className="w-3 h-3" />Nächste: {nextEntry.date} {nextEntry.title}</span>}
        </div>
      </div>

      {/* Unterzeichner */}
      {availableSigners.length > 0 && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Unterschrift</span>
            {availableSigners.map(s => (
              <button key={s.userId}
                onClick={() => {
                  setSelectedSignerIds(prev =>
                    prev.includes(s.userId) ? prev.filter(id => id !== s.userId) : [...prev, s.userId]
                  );
                  setDirty(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors ${selectedSignerIds.includes(s.userId) ? 'bg-slate-800 text-white border-slate-800' : 'border-surface-200 text-ink-muted hover:border-surface-300'}`}>
                <Check className={`w-3.5 h-3.5 ${selectedSignerIds.includes(s.userId) ? 'opacity-100' : 'opacity-0'}`} />
                {s.name}
                <span className="text-xs opacity-60">{s.function}</span>
              </button>
            ))}
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap ml-4">Position</span>
            {(['left', 'center', 'right'] as const).map(pos => (
              <button key={pos} onClick={() => {
                setSelectedDesign(prev => prev ? { ...prev, signerPosition: pos } : null);
                setDirty(true);
              }}
                className={`px-3 py-1.5 rounded-xl border text-sm transition-colors ${selectedDesign?.signerPosition === pos ? 'bg-slate-800 text-white border-slate-800' : 'border-surface-200 text-ink-muted hover:border-surface-300'}`}>
                {pos === 'left' ? 'Links' : pos === 'center' ? 'Mitte' : 'Rechts'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Eintrags-Tabelle */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-ink-muted" />
            Schulungseinträge {year}
            <span className="text-xs bg-surface-200 text-ink-muted px-2 py-0.5 rounded-full">{entries.length}</span>
          </span>
          <button onClick={addEntry} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Eintrag
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center text-ink-muted">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Einträge — klicke auf "+ Eintrag"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wide w-[90px]">Datum</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wide w-[130px]">Art</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wide">Bezeichnung</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wide w-[120px]">Ort</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wide w-[160px]">Trainer</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wide w-[90px]">Uhrzeit</th>
                  <th className="px-3 py-2.5 w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={i} className={`border-b border-surface-100 hover:bg-surface-50 transition-colors ${entry.calendarId ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-3 py-2">
                      <input value={entry.date} onChange={e => updateEntry(i, 'date', e.target.value)}
                        placeholder="20.03." className="input-field text-sm py-1 w-full" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={entry.type} onChange={e => updateEntry(i, 'type', e.target.value)}
                        className="input-field text-sm py-1 w-full">
                        {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input value={entry.title} onChange={e => updateEntry(i, 'title', e.target.value)}
                        placeholder="z.B. Einsatzübung" className="input-field text-sm py-1 w-full" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={entry.location || ''} onChange={e => updateEntry(i, 'location', e.target.value)}
                        placeholder="Ort (optional)" className="input-field text-sm py-1 w-full" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={entry.trainerId || ''} onChange={e => updateEntry(i, 'trainerId', e.target.value)}
                        className="input-field text-sm py-1 w-full">
                        <option value="">— wählen</option>
                        {members.filter((m: any) => m.status === 'ACTIVE' || m.status === 'RESERVE').map((m: any) => (
                          <option key={m.userId || m.id} value={m.userId || m.id}>
                            {m.lastName} {m.firstName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input value={entry.time || ''} onChange={e => updateEntry(i, 'time', e.target.value)}
                        placeholder="19:00 Uhr" className="input-field text-sm py-1 w-full" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {entry.calendarId && (
                          <span title="Im Kalender" className="text-emerald-600">
                            <Calendar className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <button onClick={() => moveEntry(i, -1)} disabled={i === 0}
                          className="p-1 text-ink-muted hover:text-ink disabled:opacity-20 rounded">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveEntry(i, 1)} disabled={i === entries.length - 1}
                          className="p-1 text-ink-muted hover:text-ink disabled:opacity-20 rounded">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeEntry(i)}
                          className="p-1 text-ink-muted hover:text-red-500 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {entries.length > 0 && (
          <div className="px-4 py-2.5 border-t border-surface-100 flex items-center gap-2 hover:bg-surface-50 cursor-pointer transition-colors"
            onClick={addEntry}>
            <Plus className="w-3.5 h-3.5 text-ink-muted" />
            <span className="text-sm text-ink-muted">Neuer Eintrag</span>
          </div>
        )}
      </div>

      {/* Abschlusstext */}
      <div className="card p-4">
        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-2">Abschlusstext</label>
        <input value={closing} onChange={e => { setClosing(e.target.value); setDirty(true); }}
          className="input-field text-sm w-full" placeholder="Mit kameradschaftlichen Grüßen" />
      </div>

      {/* Fairness-Anzeige */}
      {leaderList.length > 0 && (
        <div className="card overflow-hidden">
          <button onClick={() => setShowFairness(v => !v)}
            className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-50 transition-colors">
            <Users className="w-4 h-4 text-ink-muted" />
            <span className="text-sm font-semibold text-ink">Trainer — Auslastung {year}</span>
            <ChevronDown className={`w-4 h-4 text-ink-muted ml-auto transition-transform ${showFairness ? 'rotate-180' : ''}`} />
          </button>
          {showFairness && (
            <div className="px-4 pb-4 space-y-2.5 border-t border-surface-100">
              {leaderList.map(({ name, count }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm text-ink min-w-[140px] truncate">{name}</span>
                  <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-slate-700 transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-ink-muted w-8 text-right">{count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stat-Karten */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-ink-muted mb-1">Einträge gesamt</div>
          <div className="text-2xl font-semibold text-ink">{entries.length}</div>
          <div className="text-xs text-ink-muted mt-1">geplant {year}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-muted mb-1">Im Kalender</div>
          <div className="text-2xl font-semibold text-emerald-600">{calendarCount}</div>
          <div className="text-xs text-ink-muted mt-1">übernommen</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-muted mb-1">Versendet</div>
          <div className="text-2xl font-semibold text-ink">{currentPlan?.sendCount || 0}×</div>
          <div className="text-xs text-ink-muted mt-1">
            {currentPlan?.lastSentAt ? new Date(currentPlan.lastSentAt).toLocaleDateString('de-AT') : '—'}
          </div>
        </div>
      </div>

    </div>
  );
}
