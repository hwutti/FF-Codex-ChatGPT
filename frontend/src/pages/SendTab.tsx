import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Users, User, Mail, Send, Eye, Loader, ChevronDown, FileText, Trash2, Check, X, Plus, Search, Clock, Calendar, ClipboardList } from 'lucide-react';
import type { LetterDesign, TrainingPlan } from './schriftverkehr.types';

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseDown={onMouseDown} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 8, cursor: 'col-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, transition: 'background 0.15s', background: hover ? 'rgba(0,0,0,0.08)' : 'transparent' }}>
      <div style={{ width: 3, height: 32, borderRadius: 2, background: hover ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)', transition: 'background 0.15s' }} />
    </div>
  );
}

export function SendTab({ design, allDrafts, onDraftsChange, sendResizeSide, allTrainingPlans = [], allSchulungsplaene = [] }: { design: LetterDesign | null; allDrafts: any[]; onDraftsChange: () => void; sendResizeSide: { sideWidth: number; onMouseDown: (e: MouseEvent) => void }; allTrainingPlans?: any[] }) {
  // ── Verteiler ──────────────────────────────────────────────────────────────
  const [distributors, setDistributors] = useState<any[]>([]);
  const [showDistributorForm, setShowDistributorForm] = useState(false);
  const [newDistributorName, setNewDistributorName] = useState('');
  const [expandedSections, setExpandedSections] = useState({ verteiler: true, kontakte: true, extern: false });

  // ── Empfänger ──────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<any[]>([]);
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<{ name: string; email: string; type: 'member' | 'extern' }[]>([]);
  const [externalEmail, setExternalEmail] = useState('');
  const [recentRecipientSets, setRecentRecipientSets] = useState<{ label: string; recipients: any[] }[]>([]);

  // ── Mitteilung ─────────────────────────────────────────────────────────────
  const [localDrafts, setLocalDrafts] = useState<any[]>(allDrafts);
  // trainingPlans kommen als Prop von SchriftverkehrPage — persistent über Tab-Wechsel
  const trainingPlans = Array.isArray(allTrainingPlans) ? allTrainingPlans : [];

  // Sync mit Parent + eigener Load beim Mount
  useEffect(() => {
    setLocalDrafts(allDrafts);
  }, [allDrafts]);

  useEffect(() => {
    api.get('/letter/drafts').then(r => {
      setLocalDrafts(r.data);
      onDraftsChange();
    }).catch(() => {});
  }, []);

  const drafts = localDrafts;
  const [selectedDraft, setSelectedDraft] = useState<any | null>(null);
  const [sendMode, setSendMode] = useState('html_pdf');
  const [companionText, setCompanionText] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Vorschau ───────────────────────────────────────────────────────────────
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewDebounce = useRef<any>(null);

  // ── Versand ────────────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);
  const [lastSendStats, setLastSendStats] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  // ── Geplanter Versand prüfen ───────────────────────────────────────────────
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/letter/recipients/members').then(r => setMembers(r.data)).catch(() => {});
    onDraftsChange(); // Entwürfe neu laden
    api.get('/letter/distributors').then(r => setDistributors(r.data)).catch(() => {});
    loadScheduledJobs();
    // Letzte Empfänger aus localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('ff_recent_recipients') || '[]');
      setRecentRecipientSets(saved);
    } catch {}
  }, []);

  // Live-Vorschau laden wenn Entwurf gewechselt
  useEffect(() => {
    if (!selectedDraft) { setPreviewHtml(''); return; }
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        if (selectedDraft.type === 'training_plan' || selectedDraft.type === 'schulungsplan') {
          const designSnap = selectedDraft.designSnapshot ? (typeof selectedDraft.designSnapshot === 'string' ? JSON.parse(selectedDraft.designSnapshot) : selectedDraft.designSnapshot) : null;
          const endpoint = selectedDraft.type === 'schulungsplan' ? '/letter/schulungsplaene/preview-html' : '/letter/training-plans/preview-html';
          const res = await api.post(endpoint, {
            year: selectedDraft.year,
            entries: selectedDraft.entries || [],
            signerUserIds: typeof selectedDraft.signerUserIds === 'string' ? JSON.parse(selectedDraft.signerUserIds || '[]') : (selectedDraft.signerUserIds || []),
            closing: selectedDraft.closing,
            designSnapshot: designSnap,
          }, { responseType: 'text' });
          setPreviewHtml(res.data);
        } else {
          const endpoint = selectedDraft.type === 'invitation' ? '/letter/invitation/preview-html' : '/letter/preview-html';
          const body: any = { designSnapshot: selectedDraft.designSnapshot ? JSON.parse(selectedDraft.designSnapshot) : design };
          if (selectedDraft.type === 'letter') {
            Object.assign(body, { subject: selectedDraft.subject, salutation: selectedDraft.salutation, body: selectedDraft.body, closing: selectedDraft.closing, recipientName: '', recipientAddress: '', date: selectedDraft.date, signerUserIds: JSON.parse(selectedDraft.signerUserIds || '[]') });
          } else {
            Object.assign(body, { eventName: selectedDraft.eventName, eventDate: selectedDraft.eventDate, eventTime: selectedDraft.eventTime, eventLocation: selectedDraft.eventLocation, eventProgram: selectedDraft.eventProgram, rsvpDeadline: selectedDraft.rsvpDeadline, directions: selectedDraft.directions, introText: selectedDraft.introText, closing: selectedDraft.closing, recipientName: '', recipientAddress: '', date: selectedDraft.date, signerUserIds: JSON.parse(selectedDraft.signerUserIds || '[]') });
          }
          const res = await api.post(endpoint, body, { responseType: 'text' });
          setPreviewHtml(res.data);
        }
      } catch {}
      finally { setPreviewLoading(false); }
    }, 400);
  }, [selectedDraft]);

  // Empfänger-Helfer
  const toggleMember = (m: any) => {
    if (!m.email) return;
    const existing = selectedRecipients.find(r => r.email === m.email);
    if (existing) setSelectedRecipients(prev => prev.filter(r => r.email !== m.email));
    else setSelectedRecipients(prev => [...prev, { name: `${m.firstName} ${m.lastName}`, email: m.email, type: 'member' }]);
  };

  const toggleDistributor = (dist: any) => {
    const distMembers = members.filter(m => m.email && (dist.memberIds || []).includes(m.userId || m.id));
    const allSelected = distMembers.every(m => selectedRecipients.some(r => r.email === m.email));
    if (allSelected) {
      setSelectedRecipients(prev => prev.filter(r => !distMembers.some(m => m.email === r.email)));
    } else {
      const toAdd = distMembers.filter(m => !selectedRecipients.some(r => r.email === m.email))
        .map(m => ({ name: `${m.firstName} ${m.lastName}`, email: m.email, type: 'member' as const }));
      setSelectedRecipients(prev => [...prev, ...toAdd]);
    }
  };

  const addExternalEmail = () => {
    if (!externalEmail.includes('@')) return;
    if (selectedRecipients.some(r => r.email === externalEmail)) { setExternalEmail(''); return; }
    setSelectedRecipients(prev => [...prev, { name: externalEmail, email: externalEmail, type: 'extern' }]);
    setExternalEmail('');
  };

  const saveRecentSet = () => {
    if (selectedRecipients.length === 0) return;
    const label = `${selectedRecipients.length} Empfänger · ${new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })}`;
    const updated = [{ label, recipients: selectedRecipients }, ...recentRecipientSets].slice(0, 5);
    setRecentRecipientSets(updated);
    try { localStorage.setItem('ff_recent_recipients', JSON.stringify(updated)); } catch {}
  };

  // Pflichtfelder-Prüfung
  const missingFields: string[] = [];
  if (!selectedDraft) missingFields.push('Kein Dokument gewählt');
  if (selectedRecipients.length === 0) missingFields.push('Keine Empfänger');

  // Dateigröße prüfen
  const totalFileSize = extraFiles.reduce((sum, f) => sum + f.size, 0);
  const fileSizeWarning = totalFileSize > 10 * 1024 * 1024;

  // Vorschau-Email senden
  const sendPreviewEmail = async () => {
    if (!selectedDraft) return;
    const me = members.find(m => m.userId === (window as any).__currentUserId);
    if (!me?.email) { toast.error('Eigene Email-Adresse nicht gefunden'); return; }
    try {
      const isTP = selectedDraft.type === 'training_plan';
      const isSP = selectedDraft.type === 'schulungsplan';
      const endpoint = selectedDraft.type === 'invitation' ? '/letter/invitation/send'
        : isTP ? '/letter/training-plans/send'
        : isSP ? '/letter/schulungsplaene/send'
        : '/letter/send';
      const payload = (isTP || isSP) ? {
        planId: selectedDraft.id,
        recipients: [{ name: me.firstName + ' ' + me.lastName, email: me.email }],
        signerUserIds: [],
        closing: selectedDraft.closing || '',
        designSnapshot: selectedDraft.designSnapshot ? (typeof selectedDraft.designSnapshot === 'string' ? JSON.parse(selectedDraft.designSnapshot) : selectedDraft.designSnapshot) : null,
        sendMode: 'html_pdf',
      } : {
        ...(selectedDraft.type === 'letter' ? {
          subject: selectedDraft.subject, salutation: selectedDraft.salutation,
          body: selectedDraft.body, closing: selectedDraft.closing,
          recipientName: me.firstName + ' ' + me.lastName, recipientAddress: '',
          date: selectedDraft.date,
        } : {
          eventName: selectedDraft.eventName, eventDate: selectedDraft.eventDate,
          eventTime: selectedDraft.eventTime, eventLocation: selectedDraft.eventLocation,
          eventProgram: selectedDraft.eventProgram, rsvpDeadline: selectedDraft.rsvpDeadline,
          directions: selectedDraft.directions, introText: selectedDraft.introText,
          closing: selectedDraft.closing, date: selectedDraft.date,
        }),
        recipients: [{ name: me.firstName + ' ' + me.lastName, email: me.email }],
        signerUserIds: JSON.parse(selectedDraft.signerUserIds || '[]'),
        sendMode, designSnapshot: selectedDraft.designSnapshot ? JSON.parse(selectedDraft.designSnapshot) : design,
      };
      await api.post(endpoint, payload);
      toast.success('Testmail an dich gesendet');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
  };

  // Geplante Jobs laden
  const loadScheduledJobs = async () => {
    try {
      const res = await api.get('/letter/scheduled');
      setScheduledJobs(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  // Versand stornieren
  const cancelJob = async (id: string) => {
    try {
      await api.delete('/letter/scheduled/' + id);
      toast.success('Versandauftrag storniert');
      setScheduledJobs(prev => prev.filter(j => j.id !== id));
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler beim Stornieren'); }
  };

  // Versand einplanen
  const scheduleNow = async () => {
    if (missingFields.length > 0 || !scheduledAt) return;
    setSending(true);
    try {
      const recipients = selectedRecipients.map(r => ({ name: r.name, email: r.email }));
      let sendPayload: any;
      if (selectedDraft!.type === 'training_plan' || selectedDraft!.type === 'schulungsplan') {
        sendPayload = {
          planId: selectedDraft!.id,
          recipients,
          signerUserIds: typeof selectedDraft!.signerUserIds === 'string' ? JSON.parse(selectedDraft!.signerUserIds || '[]') : (selectedDraft!.signerUserIds || []),
          closing: selectedDraft!.closing,
          designSnapshot: selectedDraft!.designSnapshot ? (typeof selectedDraft!.designSnapshot === 'string' ? JSON.parse(selectedDraft!.designSnapshot) : selectedDraft!.designSnapshot) : null,
          sendMode, companionText,
        };
      } else if (selectedDraft!.type === 'invitation') {
        sendPayload = {
          eventName: selectedDraft!.eventName || '', eventDate: selectedDraft!.eventDate || '',
          eventTime: selectedDraft!.eventTime || '', eventLocation: selectedDraft!.eventLocation || '',
          eventProgram: selectedDraft!.eventProgram || '', rsvpDeadline: selectedDraft!.rsvpDeadline || '',
          directions: selectedDraft!.directions || '', introText: selectedDraft!.introText || '',
          closing: selectedDraft!.closing || '', date: selectedDraft!.date || '',
          recipients, signerUserIds: selectedDraft!.signerUserIds || '[]',
          sendMode, designSnapshot: selectedDraft!.designSnapshot || '', companionText,
        };
      } else {
        sendPayload = {
          subject: selectedDraft!.subject || '', salutation: selectedDraft!.salutation || '',
          body: selectedDraft!.body || '', closing: selectedDraft!.closing || '',
          recipientName: '', recipientAddress: '', date: selectedDraft!.date || '',
          recipients, signerUserIds: selectedDraft!.signerUserIds || '[]',
          sendMode, designSnapshot: selectedDraft!.designSnapshot || '', companionText,
        };
      }
      const draftTitle = selectedDraft!.type === 'training_plan' ? ('Übungsplan ' + (selectedDraft!.year || ''))
        : selectedDraft!.type === 'schulungsplan' ? ('Schulungsplan ' + (selectedDraft!.year || ''))
        : (selectedDraft!.subject || selectedDraft!.eventName || 'Dokument');
      // FormData verwenden damit Datei-Anhänge Base64-codiert in der DB landen
      const schedFormData = new FormData();
      schedFormData.append('scheduledAt', scheduledAt);
      schedFormData.append('draftType', selectedDraft!.type);
      schedFormData.append('draftId', selectedDraft!.id);
      schedFormData.append('draftTitle', draftTitle);
      schedFormData.append('recipients', JSON.stringify(recipients));
      schedFormData.append('payload', JSON.stringify(sendPayload));
      for (const file of extraFiles) {
        schedFormData.append('attachments', file);
      }
      await api.post('/letter/schedule', schedFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Versand geplant für ' + new Date(scheduledAt).toLocaleString('de-AT'));
      setScheduledAt('');
      setShowScheduler(false);
      await loadScheduledJobs();
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler beim Planen'); }
    finally { setSending(false); }
  };

  // Versenden
  const sendNow = async () => {
    if (missingFields.length > 0) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setLastSendStats(null);
    try {
      // Übungsplan / Schulungsplan-Versand
      if (selectedDraft!.type === 'training_plan' || selectedDraft!.type === 'schulungsplan') {
        const planEndpoint = selectedDraft!.type === 'schulungsplan' ? '/letter/schulungsplaene/send' : '/letter/training-plans/send';
        const res = await api.post(planEndpoint, {
          planId: selectedDraft!.id,
          recipients: selectedRecipients.map(r => ({ name: r.name, email: r.email })),
          signerUserIds: typeof selectedDraft!.signerUserIds === 'string' ? JSON.parse(selectedDraft!.signerUserIds || '[]') : (selectedDraft!.signerUserIds || []),
          closing: selectedDraft!.closing,
          designSnapshot: selectedDraft!.designSnapshot ? (typeof selectedDraft!.designSnapshot === 'string' ? JSON.parse(selectedDraft!.designSnapshot) : selectedDraft!.designSnapshot) : null,
          sendMode,
          companionText,
        });
        const { sent, failed } = res.data;
        setLastSendStats({ sent, failed, errors: [] });
        if (sent > 0) {
          // sendCount wird beim nächsten loadTrainingPlans() aktualisiert
          setSelectedDraft((prev: any) => prev ? { ...prev, sendCount: (prev.sendCount || 0) + sent } : prev);
          saveRecentSet();
        }
        if (sent > 0 && failed === 0) toast.success(`${sent} Email(s) versendet`);
        else if (sent > 0) toast.error(`${sent} gesendet, ${failed} fehlgeschlagen`);
        else toast.error('Versand fehlgeschlagen');
        return;
      }

      const endpoint = selectedDraft!.type === 'invitation' ? '/letter/invitation/send' : '/letter/send';

      const formData = new FormData();
      const commonFields: Record<string, any> = {
        recipients: JSON.stringify(selectedRecipients.map(r => ({ name: r.name, email: r.email }))),
        signerUserIds: selectedDraft!.signerUserIds || '[]',
        sendMode,
        designSnapshot: selectedDraft!.designSnapshot || '',
        companionText,
      };
      const specificFields: Record<string, any> = selectedDraft!.type === 'letter' ? {
        subject: selectedDraft!.subject, salutation: selectedDraft!.salutation,
        body: selectedDraft!.body, closing: selectedDraft!.closing,
        recipientName: '', recipientAddress: '', date: selectedDraft!.date || '',
      } : {
        eventName: selectedDraft!.eventName || '', eventDate: selectedDraft!.eventDate || '',
        eventTime: selectedDraft!.eventTime || '', eventLocation: selectedDraft!.eventLocation || '',
        eventProgram: selectedDraft!.eventProgram || '', rsvpDeadline: selectedDraft!.rsvpDeadline || '',
        directions: selectedDraft!.directions || '', introText: selectedDraft!.introText || '',
        closing: selectedDraft!.closing || '', date: selectedDraft!.date || '',
      };

      for (const [k, v] of Object.entries({ ...commonFields, ...specificFields })) {
        formData.append(k, v ?? '');
      }
      for (const file of extraFiles) {
        formData.append('attachments', file);
      }

      const res = await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { sent, failed, errors } = res.data;
      setLastSendStats({ sent, failed, errors: errors || [] });
      if (sent > 0) {
        try {
          await api.post(`/letter/drafts/${selectedDraft!.id}/mark-sent`);
          setDrafts(prev => prev.map(d => d.id === selectedDraft!.id ? { ...d, sendCount: d.sendCount + 1, lastSentAt: new Date().toISOString() } : d));
          setSelectedDraft(prev => prev ? { ...prev, sendCount: (prev.sendCount || 0) + 1 } : prev);
        } catch (markErr: any) {
          console.warn('[mark-sent] Fehler (nicht kritisch):', markErr?.response?.data?.error || markErr?.message);
        }
        saveRecentSet();
      }
      if (sent > 0 && failed === 0) toast.success(`${sent} Email(s) versendet`);
      else if (sent > 0) toast.error(`${sent} gesendet, ${failed} fehlgeschlagen`);
      else toast.error('Versand fehlgeschlagen');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler beim Versenden'); }
    finally { setSending(false); sendingRef.current = false; }
  };

  const filteredMembers = members
    .filter(m => memberFilter === 'ALL' || m.status === memberFilter)
    .filter(m => !memberSearch || `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(memberSearch.toLowerCase()))
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));

  // Alphabetisch gruppieren
  const groupedMembers: Record<string, any[]> = {};
  filteredMembers.forEach(m => {
    const letter = m.lastName?.[0]?.toUpperCase() || '#';
    if (!groupedMembers[letter]) groupedMembers[letter] = [];
    groupedMembers[letter].push(m);
  });

  const toggleContactSection = (key: keyof typeof expandedSections) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const SEND_MODES = [
    { value: 'html_pdf', label: 'HTML + PDF' },
    { value: 'pdf', label: 'Nur PDF' },
    { value: 'html', label: 'Nur HTML' },
  ];

  const letterDrafts = drafts.filter(d => d.type === 'letter');
  const invDrafts = drafts.filter(d => d.type === 'invitation');
  const planDrafts = trainingPlans.map(p => ({ ...p, type: 'training_plan', title: p.title ? `${p.title} (${p.year})` : `Übungsplan ${p.year}`, updatedAt: p.updatedAt }));
  const spDrafts = (Array.isArray(allSchulungsplaene) ? allSchulungsplaene : []).map((p: any) => ({ ...p, type: 'schulungsplan', title: p.title ? `${p.title} (${p.year})` : `Schulungsplan ${p.year}`, updatedAt: p.updatedAt }));

  // Auf/Zu-State für DocTree
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('send-open-sections');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    const yr = new Date().getFullYear().toString();
    return new Set(['briefe', `briefe-${yr}`, `einladungen-${yr}`]);
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('send-open-sections', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const selectDraft = (d: any) => {
    const type = d.type === 'invitation' ? 'einladungen' : 'briefe';
    const yr = new Date(d.updatedAt).getFullYear().toString();
    setOpenSections(prev => {
      const next = new Set(prev);
      next.add(type);
      next.add(`${type}-${yr}`);
      try { localStorage.setItem('send-open-sections', JSON.stringify([...next])); } catch {}
      return next;
    });
    setSelectedDraft(d);
  };

  // Dokumente nach Jahr gruppieren
  const groupByYear = (docs: any[]) => {
    const map: Record<string, any[]> = {};
    docs.forEach(d => {
      const yr = new Date(d.updatedAt).getFullYear().toString();
      if (!map[yr]) map[yr] = [];
      map[yr].push(d);
    });
    return Object.entries(map).sort((a, b) => Number(b[0]) - Number(a[0]));
  };

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', minHeight: '80vh' }}>

      {/* ── LINKE SPALTE: Kontakte & Verteiler ── */}
      <div className="card overflow-hidden flex flex-col" style={{ width: sendResizeSide.sideWidth, flexShrink: 0 }}>
        <div className="px-3 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center gap-2 flex-shrink-0">
          <Users className="w-4 h-4 text-ink-muted" />
          <span className="text-sm font-medium">Kontakte & Verteiler</span>
        </div>

        {/* Zusammenfassung */}
        {selectedRecipients.length > 0 && (
          <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 flex-shrink-0">
            <div className="text-xs text-emerald-700 font-medium">
              {selectedRecipients.length} Empfänger ausgewählt
            </div>
            <div className="text-xs text-emerald-600 mt-0.5 flex flex-wrap gap-1">
              {selectedRecipients.slice(0, 3).map(r => <span key={r.email} className="truncate max-w-[80px]">{r.name.split(' ')[0]}</span>)}
              {selectedRecipients.length > 3 && <span>+{selectedRecipients.length - 3} weitere</span>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Verteiler */}
          <div className="border-b border-surface-200">
            <button onClick={() => toggleContactSection('verteiler')}
              className="w-full px-3 py-2.5 flex items-center justify-between bg-surface-50 hover:bg-surface-100 transition-colors">
              <span className="text-sm font-semibold text-ink flex items-center gap-2">
                <Mail className="w-4 h-4" /> Verteiler
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted bg-surface-200 px-1.5 py-0.5 rounded-full">{distributors.length}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform ${expandedSections.verteiler ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSections.verteiler && (
              <div className="px-2 py-2 space-y-1">
                {distributors.map(dist => {
                  const distMembers = members.filter(m => m.email && (dist.memberIds || []).includes(m.userId || m.id));
                  const allSelected = distMembers.length > 0 && distMembers.every(m => selectedRecipients.some(r => r.email === m.email));
                  return (
                    <div key={dist.id} onClick={() => toggleDistributor(dist)}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${allSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-surface-50'}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-emerald-600 border-emerald-600' : 'border-surface-300 bg-white'}`}>
                        {allSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-ink">{dist.name}</div>
                        <div className="text-xs text-ink-muted">{distMembers.length} Mitglieder</div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setShowDistributorForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-surface-300 text-xs text-ink-muted hover:text-ink hover:border-surface-400 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Neuer Verteiler
                </button>
                {showDistributorForm && (
                  <div className="p-2 bg-surface-50 rounded-lg border border-surface-200 space-y-2">
                    <input value={newDistributorName} onChange={e => setNewDistributorName(e.target.value)}
                      placeholder="Name des Verteilers"
                      className="input-field text-xs py-1.5 w-full" />
                    <div className="flex gap-1">
                      <button onClick={async () => {
                        if (!newDistributorName.trim()) return;
                        try {
                          const res = await api.post('/letter/distributors', { name: newDistributorName, memberIds: [] });
                          setDistributors(prev => [...prev, res.data]);
                          setNewDistributorName('');
                          setShowDistributorForm(false);
                          toast.success('Verteiler erstellt');
                        } catch { toast.error('Fehler'); }
                      }} className="btn-primary text-xs py-1 px-3 flex-1">Erstellen</button>
                      <button onClick={() => setShowDistributorForm(false)} className="btn-secondary text-xs py-1 px-3">Abbrechen</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Einzelkontakte */}
          <div className="border-b border-surface-200">
            <button onClick={() => toggleContactSection('kontakte')}
              className="w-full px-3 py-2.5 flex items-center justify-between bg-surface-50 hover:bg-surface-100 transition-colors">
              <span className="text-xs font-semibold text-ink flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Mitglieder
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted bg-surface-200 px-1.5 py-0.5 rounded-full">
                  {selectedRecipients.filter(r => r.type === 'member').length} / {members.filter(m => m.email).length}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform ${expandedSections.kontakte ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSections.kontakte && (
              <div>
                <div className="px-2 py-2 border-b border-surface-100">
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Suchen..." className="input-field text-xs py-1.5 w-full" />
                </div>
                <div className="px-2 py-1.5 flex gap-1 flex-wrap border-b border-surface-100">
                  {['ALL', 'ACTIVE', 'RESERVE', 'YOUTH', 'RETIRED'].map(s => (
                    <button key={s} onClick={() => setMemberFilter(s)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${memberFilter === s ? 'bg-ink text-white border-ink' : 'border-surface-300 text-ink-muted hover:border-surface-400'}`}>
                      {s === 'ALL' ? 'Alle' : s === 'ACTIVE' ? 'Aktiv' : s === 'RESERVE' ? 'Reserve' : s === 'YOUTH' ? 'Jugend' : 'Altk.'}
                    </button>
                  ))}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {Object.entries(groupedMembers).map(([letter, group]) => (
                    <div key={letter}>
                      <div className="px-3 py-1.5 text-xs font-bold text-ink-muted bg-surface-100 sticky top-0 border-b border-surface-200 tracking-wider">{letter}</div>
                      {group.map(m => {
                        const isSelected = selectedRecipients.some(r => r.email === m.email);
                        const hasEmail = !!m.email;
                        return (
                          <div key={m.id} onClick={() => hasEmail && toggleMember(m)}
                            className={`flex items-center gap-3 px-3 py-2.5 border-b border-surface-100 transition-colors ${hasEmail ? 'cursor-pointer hover:bg-slate-50' : 'opacity-40 cursor-not-allowed'} ${isSelected ? 'bg-indigo-50' : ''}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-surface-300 bg-white'}`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink truncate">{m.lastName} {m.firstName}</div>
                              {!hasEmail && <div className="text-xs text-red-400 font-medium">Keine Email-Adresse</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Extern */}
          <div>
            <button onClick={() => toggleContactSection('extern')}
              className="w-full px-3 py-2.5 flex items-center justify-between bg-surface-50 hover:bg-surface-100 transition-colors">
              <span className="text-xs font-semibold text-ink flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Externe Adressen
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted bg-surface-200 px-1.5 py-0.5 rounded-full">
                  {selectedRecipients.filter(r => r.type === 'extern').length}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform ${expandedSections.extern ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSections.extern && (
              <div className="px-2 py-2 space-y-1.5">
                {selectedRecipients.filter(r => r.type === 'extern').map(r => (
                  <div key={r.email} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-ink-muted">{r.email}</span>
                    <button onClick={() => setSelectedRecipients(prev => prev.filter(p => p.email !== r.email))}
                      className="text-ink-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <div className="flex gap-1">
                  <input value={externalEmail} onChange={e => setExternalEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExternalEmail()}
                    placeholder="email@beispiel.at" className="input-field text-xs py-1.5 flex-1" />
                  <button onClick={addExternalEmail} className="btn-secondary text-xs py-1 px-2 flex-shrink-0">+</button>
                </div>
              </div>
            )}
          </div>

          {/* Letzte Empfänger */}
          {recentRecipientSets.length > 0 && (
            <div className="border-t border-surface-200">
              <div className="px-3 py-2 text-xs font-semibold text-ink-muted bg-surface-50">Zuletzt verwendet</div>
              <div className="px-2 py-1 space-y-1">
                {recentRecipientSets.map((set, i) => (
                  <button key={i} onClick={() => setSelectedRecipients(set.recipients)}
                    className="w-full text-left px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-50 rounded-lg transition-colors">
                    {set.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MITTLERE SPALTE: Mitteilung ── */}
      <ResizeHandle onMouseDown={sendResizeSide.onMouseDown} />
      <div className="card overflow-hidden flex flex-col" style={{ flex: 1, minWidth: 0 }}>
        <div className="px-3 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center gap-2 flex-shrink-0">
          <Send className="w-4 h-4 text-ink-muted" />
          <span className="text-sm font-medium">Mitteilung</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Dokument wählen */}
          <div>
            <p className="text-sm font-bold text-ink uppercase tracking-wide mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Dokument wählen</p>
            {letterDrafts.length === 0 && invDrafts.length === 0 && planDrafts.length === 0 && (
              <div className="text-center py-6 text-ink-muted">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Noch keine Entwürfe — erstelle zuerst einen Brief, eine Einladung oder einen Übungsplan</p>
              </div>
            )}

            <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">

              {/* BRIEFE */}
              {letterDrafts.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('briefe')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors">
                    <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform flex-shrink-0 ${openSections.has('briefe') ? '' : '-rotate-90'}`} />
                    <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Briefe</span>
                    <span className="ml-auto text-xs text-ink-muted">{letterDrafts.length}</span>
                  </button>
                  {openSections.has('briefe') && (
                    <div className="ml-3 border-l border-surface-200 pl-2 space-y-0.5 mt-0.5">
                      {groupByYear(letterDrafts).map(([yr, docs]) => (
                        <div key={yr}>
                          <button onClick={() => toggleSection(`briefe-${yr}`)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-50 transition-colors">
                            <ChevronDown className={`w-3 h-3 text-ink-muted transition-transform flex-shrink-0 ${openSections.has(`briefe-${yr}`) ? '' : '-rotate-90'}`} />
                            <span className="text-xs font-medium text-ink-muted">{yr}</span>
                            <span className="ml-auto text-xs text-ink-muted">{docs.length}</span>
                          </button>
                          {openSections.has(`briefe-${yr}`) && (
                            <div className="ml-3 border-l border-surface-100 pl-2 space-y-0.5 mt-0.5">
                              {docs.map(d => (
                                <div key={d.id} onClick={() => selectDraft(d)}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${selectedDraft?.id === d.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-surface-50 border border-transparent'}`}>
                                  <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${selectedDraft?.id === d.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-ink truncate">{d.title}</div>
                                    <div className="text-xs text-ink-muted">{new Date(d.updatedAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })}</div>
                                  </div>
                                  {d.sendCount > 0 && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex-shrink-0">✓ {d.sendCount}x</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EINLADUNGEN */}
              {invDrafts.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('einladungen')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors">
                    <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform flex-shrink-0 ${openSections.has('einladungen') ? '' : '-rotate-90'}`} />
                    <Mail className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Einladungen</span>
                    <span className="ml-auto text-xs text-ink-muted">{invDrafts.length}</span>
                  </button>
                  {openSections.has('einladungen') && (
                    <div className="ml-3 border-l border-surface-200 pl-2 space-y-0.5 mt-0.5">
                      {groupByYear(invDrafts).map(([yr, docs]) => (
                        <div key={yr}>
                          <button onClick={() => toggleSection(`einladungen-${yr}`)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-50 transition-colors">
                            <ChevronDown className={`w-3 h-3 text-ink-muted transition-transform flex-shrink-0 ${openSections.has(`einladungen-${yr}`) ? '' : '-rotate-90'}`} />
                            <span className="text-xs font-medium text-ink-muted">{yr}</span>
                            <span className="ml-auto text-xs text-ink-muted">{docs.length}</span>
                          </button>
                          {openSections.has(`einladungen-${yr}`) && (
                            <div className="ml-3 border-l border-surface-100 pl-2 space-y-0.5 mt-0.5">
                              {docs.map(d => (
                                <div key={d.id} onClick={() => selectDraft(d)}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${selectedDraft?.id === d.id ? 'bg-indigo-50 border border-indigo-300' : 'hover:bg-surface-50 border border-transparent'}`}>
                                  <Mail className={`w-3.5 h-3.5 flex-shrink-0 ${selectedDraft?.id === d.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-ink truncate">{d.title}</div>
                                    <div className="text-xs text-ink-muted">{d.eventDate ? `${d.eventDate} · ` : ''}{new Date(d.updatedAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })}</div>
                                  </div>
                                  {d.sendCount > 0 && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex-shrink-0">✓ {d.sendCount}x</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SCHULUNGSPLÄNE */}
              {spDrafts.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('schulungsplaene')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors">
                    <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform flex-shrink-0 ${openSections.has('schulungsplaene') ? '' : '-rotate-90'}`} />
                    <ClipboardList className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Schulungspläne</span>
                    <span className="ml-auto text-xs text-ink-muted">{spDrafts.length}</span>
                  </button>
                  {openSections.has('schulungsplaene') && (
                    <div className="ml-3 border-l border-surface-200 pl-2 space-y-0.5 mt-0.5">
                      {spDrafts.map((d: any) => (
                        <div key={d.id} onClick={() => {
                          setOpenSections(prev => {
                            const next = new Set(prev);
                            next.add('schulungsplaene');
                            try { localStorage.setItem('send-open-sections', JSON.stringify([...next])); } catch {}
                            return next;
                          });
                          setSelectedDraft(d);
                        }}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${selectedDraft?.id === d.id ? 'bg-violet-50 border border-violet-300' : 'hover:bg-surface-50 border border-transparent'}`}>
                          <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${selectedDraft?.id === d.id ? 'text-violet-500' : 'text-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-ink truncate">{d.title}</div>
                            <div className="text-xs text-ink-muted">{d.entries?.length || 0} Einträge</div>
                          </div>
                          {d.sendCount > 0 && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex-shrink-0">✓ {d.sendCount}×</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ÜBUNGSPLÄNE */}
              {planDrafts.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('uebungsplaene')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors">
                    <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform flex-shrink-0 ${openSections.has('uebungsplaene') ? '' : '-rotate-90'}`} />
                    <ClipboardList className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Übungspläne</span>
                    <span className="ml-auto text-xs text-ink-muted">{planDrafts.length}</span>
                  </button>
                  {openSections.has('uebungsplaene') && (
                    <div className="ml-3 border-l border-surface-200 pl-2 space-y-0.5 mt-0.5">
                      {planDrafts.map(d => (
                        <div key={d.id} onClick={() => {
                          setOpenSections(prev => {
                            const next = new Set(prev);
                            next.add('uebungsplaene');
                            try { localStorage.setItem('send-open-sections', JSON.stringify([...next])); } catch {}
                            return next;
                          });
                          setSelectedDraft(d);
                        }}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${selectedDraft?.id === d.id ? 'bg-indigo-50 border border-indigo-300' : 'hover:bg-surface-50 border border-transparent'}`}>
                          <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${selectedDraft?.id === d.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-ink truncate">{d.title}</div>
                            <div className="text-xs text-ink-muted">{(d as any).entries?.length || 0} Einträge</div>
                          </div>
                          {d.sendCount > 0 && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex-shrink-0">✓ {d.sendCount}×</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          <div className="border-t-2 border-surface-200 my-1" />

          {/* Anhänge */}
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Anhänge</p>
            {extraFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg mb-1.5">
                <FileText className="w-4 h-4 text-ink-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{f.name}</div>
                  <div className="text-xs text-ink-muted">{(f.size / 1024).toFixed(0)} KB</div>
                </div>
                <button onClick={() => setExtraFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-ink-muted hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {fileSizeWarning && (
              <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-2 flex items-center gap-1.5">
                <span>⚠️</span> Gesamtgröße über 10MB — manche Mailserver lehnen große Emails ab
              </div>
            )}
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden" onChange={e => setExtraFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5 py-2">
              <Plus className="w-3.5 h-3.5" /> Datei hinzufügen (PDF, Word, Bild)
            </button>
          </div>

          <div className="border-t border-surface-100" />

          {/* Versandoptionen */}
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Versandoptionen</p>
            <div className="flex gap-2 mb-3">
              {SEND_MODES.map(m => (
                <button key={m.value} onClick={() => setSendMode(m.value)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${sendMode === m.value ? 'border-ink bg-ink text-white' : 'border-surface-200 text-ink-muted hover:border-surface-300'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <textarea value={companionText} onChange={e => setCompanionText(e.target.value)}
              placeholder="Begleittext (optional)..." rows={2}
              className="input-field w-full text-xs" />
          </div>

          <div className="border-t border-surface-100" />

          {/* Geplanter Versand */}
          <div>
            <button onClick={() => setShowScheduler(v => !v)}
              className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink transition-colors">
              <Clock className="w-3.5 h-3.5" />
              <span>{showScheduler ? 'Sofort senden' : 'Versand planen'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showScheduler ? 'rotate-180' : ''}`} />
            </button>
            {showScheduler && (
              <div className="mt-2">
                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                  className="input-field text-xs w-full" />
                <p className="text-xs text-ink-muted mt-1">⚠️ Geplanter Versand wird beim nächsten Server-Neustart ausgeführt</p>
              </div>
            )}
          </div>

          {/* Pflichtfelder-Prüfung */}
          {missingFields.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Vor dem Senden ausfüllen</p>
              {missingFields.map((f, i) => (
                <div key={i} className="text-sm text-amber-800 flex items-center gap-2 font-medium">
                  <span className="text-amber-500 text-base">⚠</span> {f}
                </div>
              ))}
            </div>
          )}

          {/* Versand-Statistik */}
          {lastSendStats && (
            <div className={`rounded-lg p-3 border ${lastSendStats.failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className="text-xs font-medium mb-1">{lastSendStats.failed === 0 ? '✓ Versand erfolgreich' : '⚠ Versand mit Fehlern'}</p>
              <div className="text-xs space-y-0.5">
                <div className="text-emerald-700">{lastSendStats.sent} erfolgreich gesendet</div>
                {lastSendStats.failed > 0 && <div className="text-red-600">{lastSendStats.failed} fehlgeschlagen</div>}
                {lastSendStats.errors.map((e, i) => <div key={i} className="text-red-500 text-xs">{e}</div>)}
              </div>
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="space-y-2 pt-2">
            <button onClick={sendPreviewEmail} disabled={!selectedDraft}
              className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 disabled:opacity-40">
              <Mail className="w-3.5 h-3.5" /> Testmail an mich senden
            </button>
            <button onClick={showScheduler && scheduledAt ? scheduleNow : sendNow} disabled={sending || missingFields.length > 0 || (showScheduler && !scheduledAt)}
              className={"w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-40 shadow-md hover:shadow-lg disabled:cursor-not-allowed " + (showScheduler && scheduledAt ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-slate-800 hover:bg-slate-900 text-white")}>
              {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {showScheduler && scheduledAt ? ('Einplanen: ' + new Date(scheduledAt).toLocaleString('de-AT')) : ('An ' + selectedRecipients.length + ' Empfänger senden')}
            </button>
          </div>
        </div>
      </div>

      {/* Geplante Versände */}
      {scheduledJobs.length > 0 && (
        <div className="card p-4 space-y-2 border border-amber-200 bg-amber-50/40">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-ink">Geplante Versände</h3>
            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">{scheduledJobs.length}</span>
          </div>
          {scheduledJobs.map((job: any) => (
            <div key={job.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-amber-200">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{job.draftTitle || 'Dokument'}</p>
                <p className="text-xs text-ink-muted">
                  {new Date(job.scheduledAt).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr · {job.recipientCount} Empfänger
                </p>
              </div>
              <button onClick={() => cancelJob(job.id)}
                className="btn-secondary text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5 flex-shrink-0 py-1.5">
                <X className="w-3 h-3" />
                Stornieren
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── RECHTE SPALTE: Vorschau ── */}
      <ResizeHandle onMouseDown={sendResizeSide.onMouseDown} />
      <div className="card overflow-hidden flex flex-col" style={{ width: sendResizeSide.sideWidth, flexShrink: 0 }}>
        <div className="px-3 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center gap-2 flex-shrink-0">
          <Eye className="w-4 h-4 text-ink-muted" />
          <span className="text-sm font-medium">Vorschau</span>
          {previewLoading && <Loader className="w-3.5 h-3.5 animate-spin text-ink-muted ml-auto" />}
        </div>
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100">
          {!selectedDraft && (
            <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-2 py-12">
              <Eye className="w-8 h-8 opacity-30" />
              <p className="text-xs">Dokument wählen für Vorschau</p>
            </div>
          )}
          {selectedDraft && previewHtml && (
            <iframe srcDoc={previewHtml}
              style={{ width: '100%', height: '600px', border: 'none', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'block' }}
              title="Vorschau" />
          )}
          {selectedDraft && !previewHtml && !previewLoading && (
            <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-2 py-12">
              <Loader className="w-6 h-6 animate-spin opacity-30" />
              <p className="text-xs">Vorschau wird geladen...</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

