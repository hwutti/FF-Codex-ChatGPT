import React, { useState, useEffect, useRef } from 'react';
import type { LetterDesign, LetterTemplate, LetterContact, Member, Signer, SentLetter } from './schriftverkehr.types';
import { InvitationTabView } from './InvitationTabView';
import api from '../api';
import toast from 'react-hot-toast';
import { Save, X, FileText, Trash2, Eye, Loader, RefreshCw, Check, Plus } from 'lucide-react';
import DiktatButton from '../components/DiktatButton';
import { useInvKiGenerate } from './useInvKiGenerate';

export function InvitationTab({ design, availableSigners, signaturePreview, allTemplates,
  eventName, setEventName, eventDate, setEventDate, eventTime, setEventTime,
  eventLocation, setEventLocation, eventProgram, setEventProgram,
  rsvpDeadline, setRsvpDeadline, directions, setDirections,
  introText, setIntroText, closing, setClosing,
  invDirty, setInvDirty,
  userDesigns, selectedDesignId, switchDesign,
  onPreviewHtmlChange,
}: {
  design: LetterDesign | null;
  availableSigners: { userId: string; name: string; function: string }[];
  signaturePreview: string | null;
  allTemplates: any[];
  eventName: string; setEventName: (v: string) => void;
  eventDate: string; setEventDate: (v: string) => void;
  eventTime: string; setEventTime: (v: string) => void;
  eventLocation: string; setEventLocation: (v: string) => void;
  eventProgram: string; setEventProgram: (v: string) => void;
  rsvpDeadline: string; setRsvpDeadline: (v: string) => void;
  directions: string; setDirections: (v: string) => void;
  introText: string; setIntroText: (v: string) => void;
  closing: string; setClosing: (v: string) => void;
  invDirty: boolean; setInvDirty: (v: boolean) => void;
  userDesigns: LetterDesign[]; selectedDesignId: string; switchDesign: (id: string) => void;
  onPreviewHtmlChange: (html: string, loading: boolean) => void;
}) {
  

  

  
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipients, setRecipients] = useState<{ name: string; email: string }[]>([]);
  const [manualEmail, setManualEmail] = useState('');
  const [showMemberList, setShowMemberList] = useState(false);
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [members, setMembers] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState('html_pdf');
  const [companionText, setCompanionText] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }));
  const [selectedSignerIds, setSelectedSignerIds] = useState<string[]>([]);

  
  const [invKiPrompt, setInvKiPrompt] = useState('');
  const [invKiRunning, setInvKiRunning] = useState(false);
  const [invKiStreamText, setInvKiStreamText] = useState('');

  
  const [invSelectedTemplate, setInvSelectedTemplate] = useState('');
  const [invShowSaveTemplate, setInvShowSaveTemplate] = useState(false);
  const [invTemplateName, setInvTemplateName] = useState('');
  const [invSavingTemplate, setInvSavingTemplate] = useState(false);
  const [invPreviewLoading, setInvPreviewLoading] = useState(false);

  
  const [livePreviewHtml, setLivePreviewHtml] = useState('');
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  
  const [invDrafts, setInvDrafts] = useState<any[]>([]);
  const [currentInvDraftId, setCurrentInvDraftId] = useState<string | null>(null);
  const [savingInvDraft, setSavingInvDraft] = useState(false);
  const [invDraftName, setInvDraftName] = useState('');
  const [showInvDraftList, setShowInvDraftList] = useState(false);
  const [invDraftDirty, setInvDraftDirty] = useState(false);

  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewHtmlMap, setPreviewHtmlMap] = useState<Record<string, string>>({});
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get('/letter/recipients/members').then(r => setMembers(r.data)).catch(() => {});
    api.get('/letter/drafts').then(r => setInvDrafts(r.data.filter((d: any) => d.type === 'invitation'))).catch(() => {});
  }, []);

  const saveInvDraft = async () => {
    setSavingInvDraft(true);
    try {
      const data = {
        type: 'invitation',
        title: invDraftName.trim() || eventName || 'Unbenannte Einladung',
        eventName, eventDate, eventTime, eventLocation, eventProgram,
        rsvpDeadline, directions, introText, closing,
        signerUserIds: selectedSignerIds,
        designSnapshot: design,
        date,
      };
      if (currentInvDraftId) {
        await api.put('/letter/drafts/' + currentInvDraftId, data);
        toast.success('Entwurf aktualisiert');
      } else {
        const res = await api.post('/letter/drafts', data);
        setCurrentInvDraftId(res.data.id);
        setInvDrafts(prev => [res.data, ...prev]);
        toast.success('Entwurf gespeichert');
      }
      setInvDraftDirty(false);
      api.get('/letter/drafts').then(r => setInvDrafts(r.data.filter((d: any) => d.type === 'invitation'))).catch(() => {});
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingInvDraft(false); }
  };

  const loadInvDraft = (draft: any) => {
    setEventName(draft.eventName || '');
    setEventDate(draft.eventDate || '');
    setEventTime(draft.eventTime || '');
    setEventLocation(draft.eventLocation || '');
    setEventProgram(draft.eventProgram || '');
    setRsvpDeadline(draft.rsvpDeadline || '');
    setDirections(draft.directions || '');
    setIntroText(draft.introText || '');
    setClosing(draft.closing || '');
    setDate(draft.date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }));
    const signerIds = JSON.parse(draft.signerUserIds || '[]');
    setSelectedSignerIds(signerIds);

    setCurrentInvDraftId(draft.id);
    setInvDraftName(draft.title || '');
    setInvDraftDirty(false);
    setShowInvDraftList(false);
    toast.success(`Entwurf geladen`);
  };

  const deleteInvDraft = async (id: string) => {
    try {
      await api.delete('/letter/drafts/' + id);
      setInvDrafts(prev => prev.filter(d => d.id !== id));
      if (currentInvDraftId === id) { setCurrentInvDraftId(null); setInvDraftDirty(false); }
      toast.success('Entwurf gelöscht');
    } catch { toast.error('Fehler'); }
  };

  
  
  const { generateInvWithKi } = useInvKiGenerate({
    introText, setIntroText,
    eventName, eventDate, eventTime, eventLocation,
    eventProgram, rsvpDeadline, directions, design,
    setInvKiRunning, setInvKiStreamText,
  });

  
  const previewInvPdf = async () => {
    setInvPreviewLoading(true);
    try {
      const res = await api.post('/letter/invitation/preview-pdf', {
        eventName, eventDate, eventTime, eventLocation, eventProgram,
        rsvpDeadline, directions, introText, closing,
        recipientName, recipientAddress,
        signerUserIds: selectedSignerIds,
        designSnapshot: design, date,
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { toast.error('Fehler bei der PDF-Vorschau'); }
    finally { setInvPreviewLoading(false); }
  };

  
  const loadInvTemplate = (id: string) => {
    const t = allTemplates.find((t: any) => t.id === id);
    if (!t) return;
    setIntroText(t.body || '');
    setInvSelectedTemplate(id);
    setInvDirty(true);
    toast.success(`"${t.name}" eingefügt`);
  };

  const saveInvTemplate = async () => {
    if (!invTemplateName.trim()) return;
    setInvSavingTemplate(true);
    try {
      if (invSelectedTemplate) {
        await api.put('/letter/templates/' + invSelectedTemplate, { name: invTemplateName, body: introText, type: 'invitation' });
        toast.success('Vorlage aktualisiert');
      } else {
        await api.post('/letter/templates', { name: invTemplateName, body: introText, type: 'invitation' });
        toast.success('Vorlage gespeichert');
      }
      setInvShowSaveTemplate(false);
      setInvTemplateName('');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setInvSavingTemplate(false); }
  };

  const deleteInvTemplate = async (id: string) => {
    try {
      await api.delete('/letter/templates/' + id);
      setInvSelectedTemplate('');
      toast.success('Vorlage gelöscht');
    } catch { toast.error('Fehler'); }
  };

  

  
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      if (!design) return;
      setLivePreviewLoading(true);
      onPreviewHtmlChange(livePreviewHtml, true);
      try {
        const res = await api.post('/letter/invitation/preview-html', {
          eventName, eventDate, eventTime, eventLocation, eventProgram,
          rsvpDeadline, directions, introText, closing,
          recipientName, recipientAddress,
          signerUserIds: selectedSignerIds,
          designSnapshot: design, date,
        }, { responseType: 'text' });
        setLivePreviewHtml(res.data);
        onPreviewHtmlChange(res.data, false);
      } catch { onPreviewHtmlChange('', false); }
      finally { setLivePreviewLoading(false); }
    }, 600);
    return () => { if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current); };
  }, [design, eventName, eventDate, eventTime, eventLocation, eventProgram, rsvpDeadline, directions, introText, closing, recipientName, recipientAddress, selectedSignerIds, date]);

  const sendInvitation = async () => {
    if (recipients.length === 0) { toast.error('Keine Empfänger ausgewählt'); return; }
    setSending(true);
    try {
      const res = await api.post('/letter/invitation/send', {
        eventName, eventDate, eventTime, eventLocation, eventProgram,
        rsvpDeadline, directions, introText, closing,
        recipients, signerUserIds: selectedSignerIds,
        sendMode, date, designSnapshot: design,
      });
      const { sent, failed, errors: errs } = res.data;
      const errDetail = errs?.length ? `\n${errs.join('\n')}` : '';
      if (sent > 0 && failed === 0) toast.success(`${sent} Einladung(en) versendet`);
      else if (sent > 0) toast.error(`${sent} gesendet, ${failed} fehlgeschlagen${errDetail}`);
      else toast.error(`Versand fehlgeschlagen${errDetail}`);
      if (sent > 0) setRecipients([]);
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler beim Versenden'); }
    finally { setSending(false); }
  };

  const toggleHistoryEntry = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (previewHtmlMap[id]) return;
    setPreviewLoadingId(id);
    try {
      const res = await api.get('/letter/invitation/history/' + id + '/preview', { responseType: 'text' });
      setPreviewHtmlMap(prev => ({ ...prev, [id]: res.data }));
    } catch {}
    finally { setPreviewLoadingId(null); }
  };

  const deleteEntry = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete('/letter/invitation/history/' + deleteId);
      setHistory(prev => prev.filter(h => h.id !== deleteId));
      if (expandedId === deleteId) setExpandedId(null);
      toast.success('Eintrag gelöscht');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const invTemplatesForDropdown = allTemplates.filter(t => t.type === 'invitation');
  const filteredMembers = memberFilter === 'ALL' ? members : members.filter((m: any) => m.status === memberFilter);

  const SEND_MODES = [
    { value: 'pdf', label: 'Nur PDF (Anhang)' },
    { value: 'html', label: 'Nur HTML (Email)' },
    { value: 'html_pdf', label: 'HTML + PDF Anhang' },
  ];


  return (
    <InvitationTabView
      invDraftDirty={invDraftDirty} invDrafts={invDrafts} currentInvDraftId={currentInvDraftId}
      invDraftName={invDraftName} setInvDraftName={setInvDraftName} setInvDraftDirty={setInvDraftDirty}
      showInvDraftList={showInvDraftList} setShowInvDraftList={setShowInvDraftList} setCurrentInvDraftId={setCurrentInvDraftId}
      invKiPrompt={invKiPrompt} setInvKiPrompt={setInvKiPrompt}
      invKiRunning={invKiRunning} invKiStreamText={invKiStreamText}
      invSelectedTemplate={invSelectedTemplate} allTemplates={allTemplates}
      userDesigns={userDesigns} selectedDesignId={selectedDesignId}
      design={design} introText={introText} setIntroText={setIntroText}
      eventName={eventName} setEventName={setEventName}
      eventDate={eventDate} setEventDate={setEventDate}
      eventTime={eventTime} setEventTime={setEventTime}
      eventLocation={eventLocation} setEventLocation={setEventLocation}
      eventProgram={eventProgram} setEventProgram={setEventProgram}
      rsvpDeadline={rsvpDeadline} setRsvpDeadline={setRsvpDeadline}
      directions={directions} setDirections={setDirections}
      closing={closing} setClosing={setClosing}
      recipientName={recipientName} setRecipientName={setRecipientName}
      recipientAddress={recipientAddress} setRecipientAddress={setRecipientAddress}
      selectedSignerIds={selectedSignerIds} setSelectedSignerIds={setSelectedSignerIds}
      availableSigners={availableSigners} sendMode={sendMode} setSendMode={setSendMode}
      sending={sending}
      recipients={recipients} setRecipients={setRecipients}
      historyEntries={[]} showHistoryPreview={!!expandedId}
      historyPreviewHtml={expandedId ? (previewHtmlMap[expandedId] || '') : ''} historyPreviewLoading={previewLoadingId === expandedId}
      deleteId={deleteId} setDeleteId={setDeleteId}
      invPreviewLoading={invPreviewLoading}
      invShowSaveTemplate={invShowSaveTemplate} setInvShowSaveTemplate={setInvShowSaveTemplate}
      invTemplateName={invTemplateName} setInvTemplateName={setInvTemplateName}
      invSavingTemplate={invSavingTemplate}
      saveInvDraft={saveInvDraft} loadInvDraft={loadInvDraft} deleteInvDraft={deleteInvDraft}
      generateInvWithKi={generateInvWithKi} previewInvPdf={previewInvPdf}
      loadInvTemplate={loadInvTemplate} saveInvTemplate={saveInvTemplate}
      deleteInvTemplate={deleteInvTemplate} sendInvitation={sendInvitation}
      toggleHistoryEntry={toggleHistoryEntry} deleteEntry={deleteEntry}
      switchDesign={switchDesign} date={date} signaturePreview={signaturePreview}
      savingInvDraft={savingInvDraft}
      manualEmail={manualEmail} setManualEmail={setManualEmail}
      showMemberList={showMemberList} setShowMemberList={setShowMemberList}
      memberFilter={memberFilter} setMemberFilter={setMemberFilter}
      members={members} companionText={companionText} setCompanionText={setCompanionText}
      livePreviewHtml={livePreviewHtml} livePreviewLoading={livePreviewLoading}
      expandedId={expandedId} setExpandedId={setExpandedId}
      previewHtmlMap={previewHtmlMap} previewLoadingId={previewLoadingId}
      deleting={deleting} setDeleting={setDeleting}
      selectedYear={selectedYear} setSelectedYear={setSelectedYear}
    />
  );
}


