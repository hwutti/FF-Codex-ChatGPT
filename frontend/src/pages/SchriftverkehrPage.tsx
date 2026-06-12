import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Plus, Trash2, Edit2, Save, X, Send, FileText,
  ChevronDown, Users, User, Clock, Eye, Upload, Check,
  Settings, RefreshCw, Search, Loader, ClipboardList
} from 'lucide-react';
import api from '../api';
import '@fontsource/playfair-display';
import '@fontsource/eb-garamond';
import '@fontsource/lora';
import '@fontsource/cormorant-garamond';
import toast from 'react-hot-toast';
import DiktatButton from '../components/DiktatButton';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { InvitationTab } from './InvitationTab';
import { TrainingPlanTab } from './TrainingPlanTab';
import { SchulungsplanTab } from './SchulungsplanTab';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';

// ── Resizable Panel Hook ──────────────────────────────────────────────────────
import { useResizePanel, ResizeHandle } from './LetterComponents';
import { TextvorlagenPanel, DesignEditor, DesignDropdown } from './LetterComponents';
import { SendTab } from './SendTab';

const SEND_MODES = [
  { value: 'html_pdf', label: 'HTML + PDF' },
  { value: 'pdf', label: 'Nur PDF' },
  { value: 'html', label: 'Nur HTML' },
];

export default function SchriftverkehrPage() {
  const navigate = useNavigate();
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'editor' | 'invitation' | 'training_plan' | 'send' | 'contacts' | 'history' | 'design' | 'signature'>('editor');
  const [designSubTab, setDesignSubTab] = useState<'brief' | 'invitation' | 'training_plan' | 'vorlagen'>('brief');

  // Design
  const [systemDesigns, setSystemDesigns] = useState<LetterDesign[]>([]);
  const [userDesigns, setUserDesigns] = useState<LetterDesign[]>([]); // Brief-Designs
  const [invSystemDesigns, setInvSystemDesigns] = useState<LetterDesign[]>([]); // Einladungs-System-Designs
  const [invUserDesigns, setInvUserDesigns] = useState<LetterDesign[]>([]); // Einladungs-Designs
  const [tpSystemDesigns, setTpSystemDesigns] = useState<LetterDesign[]>([]); // Übungsplan-System-Designs
  const [tpUserDesigns, setTpUserDesigns] = useState<LetterDesign[]>([]); // Übungsplan-Designs
  const [tpDesign, setTpDesign] = useState<LetterDesign | null>(null);
  const [spDesign, setSpDesign] = useState<LetterDesign | null>(null);
  const [spDesignDirty, setSpDesignDirty] = useState(false);
  const [selectedSpDesignId, setSelectedSpDesignId] = useState<string>('');
  const [spUserDesigns, setSpUserDesigns] = useState<LetterDesign[]>([]);
  const [spSystemDesigns, setSpSystemDesigns] = useState<LetterDesign[]>([]); // aktives Übungsplan-Design
  const [selectedTpDesignId, setSelectedTpDesignId] = useState<string>('');
  const [tpDesignDirty, setTpDesignDirty] = useState(false);
  const [design, setDesign] = useState<LetterDesign | null>(null); // aktives Brief-Design
  const [invDesign, setInvDesign] = useState<LetterDesign | null>(null); // aktives Einladungs-Design
  const [selectedDesignId, setSelectedDesignId] = useState<string>('');
  const [selectedInvDesignId, setSelectedInvDesignId] = useState<string>('');
  const [showNewDesignForm, setShowNewDesignForm] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsType, setSaveAsType] = useState<'brief' | 'invitation' | 'training_plan' | 'schulungsplan'>('brief');
  const [newDesignName, setNewDesignName] = useState('');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [designDirty, setDesignDirty] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  // Vorlagen
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Brief-Felder
  const [subject, setSubject]   = useState('');
  const [salutation, setSalutation] = useState('Sehr geehrte Damen und Herren,');
  const [body, setBody]         = useState('');
  const [closing, setClosing]   = useState('Mit freundlichen Grüßen,');
  const [recipientName, setRecipientName]       = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }));

  // Ansprechpartner
  const [contacts, setContacts] = useState<LetterContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const filteredContacts = contacts.filter(c =>
    !contactSearch || `${c.name} ${c.email} ${c.organization}`.toLowerCase().includes(contactSearch.toLowerCase())
  );
  const [editingContact, setEditingContact] = useState<Partial<LetterContact> | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);

  // Empfänger (Email-Client)
  const [recipients, setRecipients] = useState<{ name: string; email: string }[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [showMemberList, setShowMemberList] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ACTIVE']);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Unterzeichner
  const [availableSigners, setAvailableSigners] = useState<Signer[]>([]);
  const [selectedSignerIds, setSelectedSignerIds] = useState<string[]>([]);

  // Versand
  const [sendMode, setSendMode] = useState<'pdf' | 'html' | 'html_pdf'>('html_pdf');
  const [companionText, setCompanionText] = useState('');
  const [sending, setSending] = useState(false);

  // Historie
  const [history, setHistory] = useState<SentLetter[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');
  const [deleteHistoryId, setDeleteHistoryId] = useState<string | null>(null);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [historyPreviewHtml, setHistoryPreviewHtml] = useState<Record<string, string>>({});
  const [historyPreviewLoading, setHistoryPreviewLoading] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<any>(null);

  // Unterschrift
  const [hasSignature, setHasSignature] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const sigFileRef = useRef<HTMLInputElement>(null);

  // Template-Speichern
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Vorschau
  const [previewLoading, setPreviewLoading] = useState(false);

  // Verteiler
  const [distributors, setDistributors] = useState<any[]>([]);
  const [editingDistributor, setEditingDistributor] = useState<any | null>(null);
  const [showDistributorForm, setShowDistributorForm] = useState(false);

  // ── Einladungs-State (hochgezogen aus InvitationTab) ────────────────────────
  const [invLivePreviewHtml, setInvLivePreviewHtml] = useState('');
  const [invPreviewKey, setInvPreviewKey] = useState(0);
  const [tpDesignPreviewHtml, setTpDesignPreviewHtml] = useState('');
  const [spDesignPreviewHtml, setSpDesignPreviewHtml] = useState('');
  const [invLivePreviewLoading, setInvLivePreviewLoading] = useState(false);
  const [invEventName, setInvEventName] = useState('');
  const [invEventDate, setInvEventDate] = useState('');
  const [invEventTime, setInvEventTime] = useState('');
  const [invEventLocation, setInvEventLocation] = useState('');
  const [invEventProgram, setInvEventProgram] = useState('');
  const [invRsvpDeadline, setInvRsvpDeadline] = useState('');
  const [invDirections, setInvDirections] = useState('');
  const [invIntroText, setInvIntroText] = useState('');
  const [invClosing, setInvClosing] = useState('Mit freundlichen Grüßen,');
  const [invDirty, setInvDirty] = useState(false);

  // Entwürfe
  const [drafts, setDrafts] = useState<any[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<any[]>([]);
  const [schulungsplaene, setSchulungsplaene] = useState<any[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showDraftList, setShowDraftList] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [livePreviewHtml, setLivePreviewHtml] = useState<string>('');
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);

  // KI-Assistent
  const [kiPrompt, setKiPrompt] = useState('');
  const [kiRunning, setKiRunning] = useState(false);
  const [kiStreamText, setKiStreamText] = useState('');
  const kiAbortRef = useRef<AbortController | null>(null);

  // Resizable panels
  const briefResize = useResizePanel(400, 200, 800);
  const invResize = useResizePanel(400, 200, 800);
  const sendResizeSide = useResizePanel(220, 150, 350, true);

  // Unsaved Guard (Brief-Tab — draftDirty ist der dirty-State)
  const isDirty = draftDirty || invDirty || !!(body || subject) || !!(invIntroText || invEventName);
  const { confirmNavigation, resolve: resolveGuard } = useUnsavedGuard(isDirty);

  const guardedNavigate = async (path: string) => {
    const result = await confirmNavigation();
    if (result === 'cancel') return;
    if (result === 'save') {
      // saveDraft is async — handled by modal
    }
    navigate(path);
  };

  // ── Laden ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    // Jeden Call einzeln absichern damit ein Fehler nicht alles blockiert
    try {
      const [briefRes, invRes, tpRes, spRes] = await Promise.all([
        api.get('/letter/designs?type=brief'),
        api.get('/letter/designs?type=invitation'),
        api.get('/letter/designs?type=training_plan'),
        api.get('/letter/designs?type=schulungsplan'),
      ]);
      const briefSys = (briefRes.data.systemDesigns || []);
      const briefUsr = (briefRes.data.userDesigns || []);
      const invSys = (invRes.data.systemDesigns || []);
      const invUsr = (invRes.data.userDesigns || []);
      const tpSys = Array.isArray(tpRes.data.systemDesigns) ? tpRes.data.systemDesigns : [];
      const tpUsr = Array.isArray(tpRes.data.userDesigns) ? tpRes.data.userDesigns : [];
      const spSys = Array.isArray(spRes.data.systemDesigns) ? spRes.data.systemDesigns : [];
      const spUsr = Array.isArray(spRes.data.userDesigns) ? spRes.data.userDesigns : [];
      setSystemDesigns(briefSys);
      setInvSystemDesigns(invSys);
      setTpSystemDesigns(tpSys);
      setSpSystemDesigns(spSys);
      setUserDesigns(briefUsr);
      setInvUserDesigns(invUsr);
      setTpUserDesigns(tpUsr);
      setSpUserDesigns(spUsr);
      const allBrief = [...briefSys, ...briefUsr];
      if (allBrief.length > 0 && !selectedDesignId) {
        setDesign(allBrief[0]);
        setSelectedDesignId(allBrief[0].id);
      }
      const allInv = [...invSys, ...invUsr];
      if (allInv.length > 0 && !selectedInvDesignId) {
        setInvDesign(allInv[0]);
        setSelectedInvDesignId(allInv[0].id);
      }
      const allTp = [...tpSys, ...tpUsr];
      if (allTp.length > 0 && !selectedTpDesignId) {
        setTpDesign(allTp[0]);
        setSelectedTpDesignId(allTp[0].id);
      }
      const allSp = [...spSys, ...spUsr];
      if (allSp.length > 0 && !selectedSpDesignId) {
        setSpDesign(allSp[0]);
        setSelectedSpDesignId(allSp[0].id);
      }
    } catch (e) { console.error('[Schriftverkehr] designs:', e); }

    try {
      const templatesRes = await api.get('/letter/templates');
      setTemplates(templatesRes.data);
    } catch (e) { console.error('[Schriftverkehr] templates:', e); }

    try {
      const contactsRes = await api.get('/letter/contacts');
      setContacts(contactsRes.data);
    } catch (e) { console.error('[Schriftverkehr] contacts:', e); }

    try {
      const membersRes = await api.get('/letter/recipients/members');
      setMembers(membersRes.data);
    } catch (e) { console.error('[Schriftverkehr] members:', e); }

    try {
      const signersRes = await api.get('/letter/signers');
      setAvailableSigners(signersRes.data);
    } catch (e) { console.error('[Schriftverkehr] signers:', e); }

    try {
      const sigRes = await api.get('/letter/signature/me');
      setHasSignature(sigRes.data.hasSignature);
      if (sigRes.data.hasSignature) setSignaturePreview(sigRes.data.dataUrl);
    } catch (e) { console.error('[Schriftverkehr] signature:', e); }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/letter/history');
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  // ── Vorlage laden ────────────────────────────────────────────────────────

  const loadTemplate = (id: string) => {
    const t = templates.find(t => t.id === id);
    if (!t) return;
    setSubject(t.subject);
    setSalutation(t.salutation);
    setBody(t.body);
    setClosing(t.closing);
    setSelectedTemplate(id);
    toast.success(`Vorlage "${t.name}" geladen`);
  };

  // ── Vorlage speichern ────────────────────────────────────────────────────

  const saveTemplate = async () => {
    if (!templateName.trim()) { toast.error('Bitte einen Namen eingeben'); return; }
    setSavingTemplate(true);
    try {
      const data = { name: templateName, subject, salutation, body, closing };
      if (selectedTemplate) {
        await api.put(`/letter/templates/${selectedTemplate}`, { ...data, name: templateName });
        toast.success('Vorlage aktualisiert');
      } else {
        const res = await api.post('/letter/templates', data);
        setTemplates(prev => [res.data, ...prev]);
        setSelectedTemplate(res.data.id);
        toast.success('Vorlage gespeichert');
      }
      setShowSaveTemplate(false);
      setTemplateName('');
      const res = await api.get('/letter/templates');
      setTemplates(res.data);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingTemplate(false); }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.delete(`/letter/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplate === id) setSelectedTemplate('');
      toast.success('Vorlage gelöscht');
    } catch { toast.error('Fehler beim Löschen'); }
  };

  // ── Ansprechpartner ──────────────────────────────────────────────────────

  const saveContact = async () => {
    if (!editingContact?.name) { toast.error('Name erforderlich'); return; }
    try {
      if (editingContact.id) {
        const res = await api.put(`/letter/contacts/${editingContact.id}`, editingContact);
        setContacts(prev => prev.map(c => c.id === editingContact.id ? res.data : c));
        toast.success('Kontakt aktualisiert');
      } else {
        const res = await api.post('/letter/contacts', editingContact);
        setContacts(prev => [res.data, ...prev]);
        toast.success('Kontakt gespeichert');
      }
      setEditingContact(null);
      setShowContactForm(false);
    } catch { toast.error('Fehler beim Speichern'); }
  };

  const deleteContact = async (id: string) => {
    try {
      await api.delete(`/letter/contacts/${id}`);
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Kontakt gelöscht');
    } catch { toast.error('Fehler'); }
  };

  const useContact = (c: LetterContact) => {
    setRecipientName(c.name + (c.function ? `, ${c.function}` : ''));
    const addr = [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join('\n');
    setRecipientAddress(addr);
    setSalutation(`Sehr geehrte/r ${c.name},`);
    if (c.email) addRecipient(c.name, c.email);
    toast.success(`${c.name} übernommen`);
  };

  // ── Empfänger ────────────────────────────────────────────────────────────

  const addRecipient = (name: string, email: string) => {
    if (!email) return;
    if (recipients.find(r => r.email === email)) return;
    setRecipients(prev => [...prev, { name, email }]);
  };

  const addFromInput = () => {
    const parts = recipientInput.trim().split(',').flatMap(p => p.split(';'));
    parts.forEach(p => {
      const email = p.trim();
      if (email.includes('@')) addRecipient(email, email);
    });
    setRecipientInput('');
  };

  const toggleMemberStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const filteredMembers = members.filter(m => selectedStatuses.includes(m.status));

  const addSelectedMembers = () => {
    filteredMembers
      .filter(m => selectedMemberIds.has(m.id) && m.email)
      .forEach(m => addRecipient(`${m.firstName} ${m.lastName}`, m.email!));
    setSelectedMemberIds(new Set());
    setShowMemberList(false);
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllMembers = () => {
    const withEmail = filteredMembers.filter(m => m.email);
    if (selectedMemberIds.size === withEmail.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(withEmail.map(m => m.id)));
    }
  };

  // ── Design speichern ─────────────────────────────────────────────────────

  const saveDesign = async () => {
    if (!design) return;
    // System-Design → automatisch "Speichern unter"
    if (design.isSystem) { setShowNewDesignForm(true); return; }
    // Eigene Vorlage → Bestätigung
    setShowOverwriteConfirm(true);
  };

  const confirmSaveDesign = async () => {
    if (!design) return;
    setShowOverwriteConfirm(false);
    setSavingDesign(true);
    try {
      await api.put(`/letter/design/${design.id}`, design);
      setUserDesigns(prev => prev.map(d => d.id === design.id ? design : d));
      toast.success('Design gespeichert');
      setDesignDirty(false);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingDesign(false); }
  };

  const openSaveAsModal = (type: 'brief' | 'invitation' | 'training_plan' | 'schulungsplan') => {
    setSaveAsType(type);
    setNewDesignName('');
    setShowSaveAsModal(true);
  };

  const confirmSaveAs = async () => {
    if (!newDesignName.trim()) return;
    if (saveAsType === 'brief' && design) {
      try {
        const { isSystem, category, ...designData } = design as any;
        const res = await api.post('/letter/designs', { ...designData, id: undefined, name: newDesignName, designType: 'brief' });
        setUserDesigns(prev => [...prev, res.data]);
        setDesign(res.data);
        setSelectedDesignId(res.data.id);
        toast.success(`Design "${newDesignName}" erstellt`);
      } catch { toast.error('Fehler beim Erstellen'); }
    } else if (saveAsType === 'invitation' && invDesign) {
      try {
        const { isSystem, category, id: _id, ...designData } = invDesign as any;
        const res = await api.post('/letter/designs', { ...designData, id: undefined, name: newDesignName, designType: 'invitation' });
        setInvUserDesigns(prev => [...prev, res.data]);
        setInvDesign(res.data);
        setSelectedInvDesignId(res.data.id);
        toast.success(`Design "${newDesignName}" erstellt`);
      } catch { toast.error('Fehler beim Erstellen'); }
    } else if (saveAsType === 'training_plan') {
      try {
        const base = tpDesign || design || {};
        const { isSystem, category, id: _id, ...designData } = base as any;
        const res = await api.post('/letter/designs', { ...designData, id: undefined, name: newDesignName, designType: 'training_plan' });
        setTpUserDesigns(prev => [...prev, res.data]);
        setTpDesign(res.data);
        setSelectedTpDesignId(res.data.id);
        toast.success(`Übungsplan-Design "${newDesignName}" erstellt`);
      } catch { toast.error('Fehler beim Erstellen'); }
    } else if (saveAsType === 'schulungsplan') {
      try {
        const base = spDesign || design || {};
        const { isSystem, category, id: _id, ...designData } = base as any;
        const res = await api.post('/letter/designs', { ...designData, id: undefined, name: newDesignName, designType: 'schulungsplan' });
        setSpUserDesigns(prev => [...prev, res.data]);
        setSpDesign(res.data);
        setSelectedSpDesignId(res.data.id);
        toast.success(`Schulungsplan-Design "${newDesignName}" erstellt`);
      } catch { toast.error('Fehler beim Erstellen'); }
    }
    setShowSaveAsModal(false);
    setNewDesignName('');
  };

  const createNewDesign = async () => {
    if (!newDesignName.trim() || !design) return;
    try {
      const { isSystem, category, ...designData } = design as any;
      const res = await api.post('/letter/designs', { ...designData, id: undefined, name: newDesignName, designType: 'brief' });
      setUserDesigns(prev => [...prev, res.data]);
      setDesign(res.data);
      setSelectedDesignId(res.data.id);
      setNewDesignName('');
      setShowNewDesignForm(false);
      toast.success(`Design "${newDesignName}" erstellt`);
    } catch { toast.error('Fehler beim Erstellen'); }
  };

  const deleteDesign = async (id: string) => {
    try {
      await api.delete(`/letter/designs/${id}`);
      const remaining = userDesigns.filter(d => d.id !== id);
      setUserDesigns(remaining);
      const fallback = remaining[0] || systemDesigns[0];
      if (fallback) { setDesign(fallback); setSelectedDesignId(fallback.id); }
      toast.success('Design gelöscht');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
  };

  const deleteInvDesign = async (id: string) => {
    try {
      await api.delete(`/letter/designs/${id}`);
      const remaining = invUserDesigns.filter(d => d.id !== id);
      setInvUserDesigns(remaining);
      const fallback = remaining[0] || invSystemDesigns[0];
      if (fallback) { setInvDesign(fallback); setSelectedInvDesignId(fallback.id); }
      toast.success('Einladungs-Design gelöscht');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
  };

  const switchTpDesign = (id: string) => {
    const d = [...tpSystemDesigns, ...tpUserDesigns].find(d => d.id === id);
    if (d) { setTpDesign(d); setSelectedTpDesignId(id); setTpDesignDirty(false); }
  };

  const saveTpDesign = async () => {
    if (!tpDesign) return;
    setSavingDesign(true);
    try {
      await api.put('/letter/design/' + tpDesign.id, tpDesign);
      setTpUserDesigns(prev => prev.map(d => d.id === tpDesign.id ? tpDesign : d));
      toast.success('Übungsplan-Design gespeichert');
      setTpDesignDirty(false);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingDesign(false); }
  };

  const deleteTpDesign = async (id: string) => {
    try {
      await api.delete(`/letter/designs/${id}`);
      const remaining = tpUserDesigns.filter(d => d.id !== id);
      setTpUserDesigns(remaining);
      const fallback = remaining[0] || tpSystemDesigns[0];
      if (fallback) { setTpDesign(fallback); setSelectedTpDesignId(fallback.id); }
      else { setTpDesign(null); setSelectedTpDesignId(''); }
      toast.success('Übungsplan-Design gelöscht');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
  };

  const switchSpDesign = (id: string) => {
    const d = [...spSystemDesigns, ...spUserDesigns].find(d => d.id === id);
    if (d) { setSpDesign(d); setSelectedSpDesignId(id); setSpDesignDirty(false); }
  };

  const saveSpDesign = async () => {
    if (!spDesign) return;
    setSavingDesign(true);
    try {
      await api.put('/letter/design/' + spDesign.id, spDesign);
      setSpUserDesigns(prev => prev.map(d => d.id === spDesign.id ? spDesign : d));
      toast.success('Schulungsplan-Design gespeichert');
      setSpDesignDirty(false);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingDesign(false); }
  };

  const deleteSpDesign = async (id: string) => {
    try {
      await api.delete(`/letter/designs/${id}`);
      const remaining = spUserDesigns.filter(d => d.id !== id);
      setSpUserDesigns(remaining);
      const fallback = remaining[0] || spSystemDesigns[0];
      if (fallback) { setSpDesign(fallback); setSelectedSpDesignId(fallback.id); }
      else { setSpDesign(null); setSelectedSpDesignId(''); }
      toast.success('Schulungsplan-Design gelöscht');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
  };

  const uploadTpDesignImage = async (field: string, file: File) => {
    if (!tpDesign || tpDesign.id.startsWith('system:')) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('field', field);
    try {
      const res = await api.post(`/letter/designs/${tpDesign.id}/upload-image`, formData);
      setTpDesign(prev => prev ? { ...prev, [field]: res.data.url } : prev);
      setTpUserDesigns(prev => prev.map(d => d.id === tpDesign.id ? { ...d, [field]: res.data.url } : d));
    } catch { toast.error('Fehler beim Hochladen'); }
  };

  const uploadSpDesignImage = async (field: string, file: File) => {
    if (!spDesign || spDesign.id.startsWith('system:')) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('field', field);
    try {
      const res = await api.post(`/letter/designs/${spDesign.id}/upload-image`, formData);
      setSpDesign(prev => prev ? { ...prev, [field]: res.data.url } : prev);
      setSpUserDesigns(prev => prev.map(d => d.id === spDesign.id ? { ...d, [field]: res.data.url } : d));
    } catch { toast.error('Fehler beim Hochladen'); }
  };

  const saveInvDesign = async () => {
    if (!invDesign) return;
    setSavingDesign(true);
    try {
      await api.put('/letter/design/' + invDesign.id, invDesign);
      setInvUserDesigns(prev => prev.map(d => d.id === invDesign.id ? invDesign : d));
      toast.success('Einladungs-Design gespeichert');
      setDesignDirty(false);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingDesign(false); }
  };

  const createNewInvDesign = async () => {
    if (!newDesignName.trim()) return;
    try {
      const base = invDesign || design || {};
      const { isSystem, category, id: _id, ...designData } = base as any;
      const res = await api.post('/letter/designs', { ...designData, id: undefined, name: newDesignName, designType: 'invitation' });
      setInvUserDesigns(prev => [...prev, res.data]);
      setInvDesign(res.data);
      setSelectedInvDesignId(res.data.id);
      setShowNewDesignForm(false);
      setNewDesignName('');
      toast.success('Einladungs-Design erstellt');
    } catch { toast.error('Fehler'); }
  };

  const switchInvDesign = (id: string) => {
    const all = [...invSystemDesigns, ...invUserDesigns];
    const d = all.find(d => d.id === id);
    if (d) { setInvDesign(d); setSelectedInvDesignId(id); }
  };

  const switchDesign = (id: string) => {
    const d = [...systemDesigns, ...userDesigns].find(d => d.id === id);
    if (d) { setDesign(d); setSelectedDesignId(id); setDesignDirty(false); }
  };

  const uploadDesignImage = async (field: string, file: File) => {
    if (!design || design.id.startsWith('system:')) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('field', field);
    try {
      const res = await api.post(`/letter/designs/${design.id}/upload-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDesign(prev => prev ? { ...prev, [field]: res.data.url } : prev);
      setDesignDirty(true);
      toast.success('Bild hochgeladen');
    } catch { toast.error('Fehler beim Upload'); }
  };

  const uploadInvDesignImage = async (field: string, file: File) => {
    if (!invDesign || invDesign.id.startsWith('system:')) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('field', field);
    try {
      const res = await api.post(`/letter/designs/${invDesign.id}/upload-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setInvDesign(prev => prev ? { ...prev, [field]: res.data.url } : prev);
      toast.success('Bild hochgeladen');
    } catch { toast.error('Fehler beim Upload'); }
  };

  // ── Unterschrift ─────────────────────────────────────────────────────────

  const uploadSignature = async (file: File) => {
    setUploadingSignature(true);
    const formData = new FormData();
    formData.append('signature', file);
    try {
      await api.post('/letter/signature', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const res = await api.get('/letter/signature/me');
      setHasSignature(true);
      setSignaturePreview(res.data.dataUrl);
      toast.success('Unterschrift gespeichert');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploadingSignature(false); }
  };

  const deleteSignature = async () => {
    try {
      await api.delete('/letter/signature/me');
      setHasSignature(false);
      setSignaturePreview(null);
      toast.success('Unterschrift gelöscht');
    } catch { toast.error('Fehler'); }
  };

  // ── Versenden ────────────────────────────────────────────────────────────

  const sendLetter = async () => {
    if (!subject.trim()) { toast.error('Bitte einen Betreff eingeben'); return; }
    if (!body.trim()) { toast.error('Bitte einen Text eingeben'); return; }
    if (recipients.length === 0) { toast.error('Bitte mindestens einen Empfänger angeben'); return; }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('salutation', salutation);
      formData.append('body', body);
      formData.append('closing', closing);
      formData.append('recipients', JSON.stringify(recipients));
      formData.append('signerUserIds', JSON.stringify(selectedSignerIds));
      formData.append('sendMode', sendMode);
      formData.append('templateId', selectedTemplate || '');
      formData.append('designId', design?.id || '');
      formData.append('recipientName', recipientName);
      formData.append('recipientAddress', recipientAddress);
      formData.append('companionText', companionText);
      formData.append('date', date);
      const res = await api.post('/letter/send', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { sent, failed, errors } = res.data;
      const errDetail = errors?.length ? `\n${errors.join('\n')}` : '';
      if (sent > 0 && failed === 0) {
        toast.success(`${sent} Email(s) erfolgreich versendet`);
      } else if (sent > 0 && failed > 0) {
        toast.error(`${sent} gesendet, ${failed} fehlgeschlagen${errDetail}`);
      } else {
        toast.error(`Versand fehlgeschlagen${errDetail}`);
      }
      if (sent > 0) setRecipients([]);
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler beim Versenden'); }
    finally { setSending(false); }
  };

  // ── Verteiler ───────────────────────────────────────────────────────────────
  const saveDistributor = async () => {
    if (!editingDistributor?.name?.trim()) { toast.error('Name ist Pflichtfeld'); return; }
    try {
      const data = {
        name: editingDistributor.name,
        memberIds: editingDistributor.memberIds || [],
        contactIds: editingDistributor.contactIds || [],
      };
      if (editingDistributor.id) {
        const res = await api.put(`/letter/distributors/${editingDistributor.id}`, data);
        setDistributors(prev => prev.map(d => d.id === editingDistributor.id ? res.data : d));
        toast.success('Verteiler aktualisiert');
      } else {
        const res = await api.post('/letter/distributors', data);
        setDistributors(prev => [...prev, res.data]);
        toast.success('Verteiler erstellt');
      }
      setShowDistributorForm(false);
      setEditingDistributor(null);
    } catch { toast.error('Fehler beim Speichern'); }
  };

  const deleteDistributor = async (id: string) => {
    try {
      await api.delete(`/letter/distributors/${id}`);
      setDistributors(prev => prev.filter(d => d.id !== id));
      toast.success('Verteiler gelöscht');
    } catch { toast.error('Fehler beim Löschen'); }
  };

  // ── Historien-Vorschau laden ────────────────────────────────────────────────
  const toggleHistoryEntry = async (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(id);
    if (historyPreviewHtml[id]) return; // bereits geladen
    setHistoryPreviewLoading(id);
    try {
      const res = await api.get(`/letter/history/${id}/preview`, { responseType: 'text' });
      setHistoryPreviewHtml(prev => ({ ...prev, [id]: res.data }));
    } catch { /* Vorschau nicht verfügbar */ }
    finally { setHistoryPreviewLoading(null); }
  };

  // ── Historien-Eintrag löschen ───────────────────────────────────────────────
  const deleteHistoryEntry = async () => {
    if (!deleteHistoryId) return;
    setDeletingHistory(true);
    try {
      await api.delete(`/letter/history/${deleteHistoryId}`);
      setHistory(prev => prev.filter(h => h.id !== deleteHistoryId));
      setHistoryPreviewHtml(prev => { const n = { ...prev }; delete n[deleteHistoryId!]; return n; });
      if (expandedHistoryId === deleteHistoryId) setExpandedHistoryId(null);
      toast.success('Eintrag gelöscht');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler beim Löschen'); }
    finally { setDeletingHistory(false); setDeleteHistoryId(null); }
  };

  // ── KI-Brief-Generierung ─────────────────────────────────────────────────

  const generateWithKi = async (instruction?: string) => {
    if (kiRunning) return;
    const prompt = instruction || kiPrompt;
    if (!prompt.trim()) return;
    setKiRunning(true);
    setKiStreamText('');
    kiAbortRef.current?.abort();
    const controller = new AbortController();
    kiAbortRef.current = controller;
    const token = localStorage.getItem('token');
    const viteUrl = import.meta.env.VITE_API_URL || ''; const baseUrl = viteUrl.endsWith('/api') ? viteUrl.slice(0, -4) : viteUrl;
    const isPartial = !!(body && instruction);
    try {
      const res = await fetch(`${baseUrl}/api/letter/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, recipientName, subject, currentText: isPartial ? body : '', instruction: isPartial ? instruction : '' }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) { toast.error('KI nicht erreichbar'); setKiRunning(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; let event = ''; let streamedText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('event: ')) { event = line.slice(7).trim(); }
          else if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (event === 'token') { streamedText += parsed.text || ''; setKiStreamText(streamedText); }
              if (event === 'result') {
                if (parsed.body) setBody(parsed.body);
                if (parsed.subject && !subject) setSubject(parsed.subject);
                if (parsed.salutation && !salutation) setSalutation(parsed.salutation);
                setKiStreamText(''); setKiPrompt('');
              }
              if (event === 'error') toast.error(parsed.message || 'KI-Fehler');
            } catch {}
            event = '';
          }
        }
      }
      reader.releaseLock();
    } catch (e: any) { if (e?.name !== 'AbortError') toast.error('Verbindungsfehler'); }
    setKiRunning(false); setKiStreamText('');
  };

  // ── Live-HTML-Vorschau ──────────────────────────────────────────────────────
  const loadLivePreview = async () => {
    if (!design) return;
    setLivePreviewLoading(true);
    try {
      const res = await api.post('/letter/preview-html', {
        subject, salutation, body, closing,
        recipientName, recipientAddress,
        signerUserIds: selectedSignerIds,
        designSnapshot: design,
        date,
      }, { responseType: 'text' });
      setLivePreviewHtml(res.data);
    } catch {}
    finally { setLivePreviewLoading(false); }
  };

  const invDesignPreviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tpDesignPreviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Brief-Vorschau: debounced bei jeder Änderung
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => { loadLivePreview(); }, 600);
    return () => { if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current); };
  }, [design, subject, salutation, body, closing, recipientName, recipientAddress, selectedSignerIds, date, activeTab]);

  const loadInvDesignPreview = async () => {
    if (!invDesign) return;
    setInvLivePreviewLoading(true);
    try {
      const res = await api.post('/letter/invitation/preview-html', {
        eventName: 'Muster-Veranstaltung',
        eventDate: new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }),
        eventTime: '19:00',
        eventLocation: '',
        eventProgram: '',
        rsvpDeadline: '',
        directions: '',
        introText: 'Wir laden Sie herzlich zu unserer Veranstaltung ein.',
        closing: 'Mit kameradschaftlichen Grüßen',
        recipientName: '',
        recipientAddress: '',
        signerUserIds: selectedSignerIds,
        date: new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }),
        designSnapshot: invDesign,
      }, { responseType: 'text' });
      setInvLivePreviewHtml(res.data);
      setInvPreviewKey(k => k + 1);
    } catch {}
    finally { setInvLivePreviewLoading(false); }
  };

  const loadTpDesignPreview = async () => {
    if (!tpDesign) return;
    try {
      const res = await api.post('/letter/training-plans/preview-html', {
        year: new Date().getFullYear(),
        entries: [
          { date: '20.03', time: '19:30', type: 'FUNK', title: 'Funkübung in Dellach', location: 'Dellach', leaderName: 'Wolfgang Novak' },
          { date: '11.04', time: '19:00', type: 'EINSATZ', title: 'Einsatzübung', location: '', leaderName: 'Dannie Wutti' },
          { date: '08.05', time: '', type: 'GEMEINDE', title: 'Gemeindeübung in Förolach', location: 'Förolach', leaderName: 'Herbert Thomas Wutti' },
        ],
        signerUserIds: selectedSignerIds,
        closing: 'Mit kameradschaftlichen Grüßen',
        designSnapshot: tpDesign,
      }, { responseType: 'text' });
      setTpDesignPreviewHtml(res.data);
    } catch {}
  };

  // Einladungs-Design Vorschau: bei invDesign-Änderung oder Design-Tab
  useEffect(() => {
    if (!(activeTab === 'design' && designSubTab === 'invitation') && activeTab !== 'invitation') return;
    if (!invDesign) return;
    if (invDesignPreviewDebounceRef.current) clearTimeout(invDesignPreviewDebounceRef.current);
    invDesignPreviewDebounceRef.current = setTimeout(() => { loadInvDesignPreview(); }, 600);
    return () => { if (invDesignPreviewDebounceRef.current) clearTimeout(invDesignPreviewDebounceRef.current); };
  }, [invDesign, selectedSignerIds, activeTab, designSubTab]);

  // Übungsplan-Design Vorschau
  useEffect(() => {
    if (activeTab !== 'design' || designSubTab !== 'training_plan') return;
    if (!tpDesign) return;
    if (tpDesignPreviewDebounceRef.current) clearTimeout(tpDesignPreviewDebounceRef.current);
    tpDesignPreviewDebounceRef.current = setTimeout(() => { loadTpDesignPreview(); }, 600);
    return () => { if (tpDesignPreviewDebounceRef.current) clearTimeout(tpDesignPreviewDebounceRef.current); };
  }, [tpDesign, selectedSignerIds, activeTab, designSubTab]);

  // ── Schulungsplan-Design-Vorschau debounced ───────────────────────────────
  const spDesignPreviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSpDesignPreview = async () => {
    if (!spDesign) return;
    try {
      const res = await api.post('/letter/schulungsplaene/preview-html', {
        year: new Date().getFullYear(),
        entries: [],
        signerUserIds: selectedSignerIds,
        closing: 'Mit kameradschaftlichen Grüßen',
        designSnapshot: spDesign,
      }, { responseType: 'text' });
      setSpDesignPreviewHtml(res.data);
    } catch {}
  };
  useEffect(() => {
    if (!(activeTab === 'design' && designSubTab === 'schulungsplan')) return;
    if (!spDesign) return;
    if (spDesignPreviewDebounceRef.current) clearTimeout(spDesignPreviewDebounceRef.current);
    spDesignPreviewDebounceRef.current = setTimeout(() => { loadSpDesignPreview(); }, 600);
    return () => { if (spDesignPreviewDebounceRef.current) clearTimeout(spDesignPreviewDebounceRef.current); };
  }, [spDesign, selectedSignerIds, activeTab, designSubTab]);

  // ── Entwürfe ────────────────────────────────────────────────────────────────
  const loadDrafts = async () => {
    try {
      const res = await api.get('/letter/drafts');
      setDrafts(res.data);
    } catch (e) { console.error('[loadDrafts] Fehler:', e); }
  };

  const loadTrainingPlans = async () => {
    try {
      const res = await api.get('/letter/training-plans');
      setTrainingPlans(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error('[loadTrainingPlans] Fehler:', e); }
  };

  const loadSchulungsplaene = async () => {
    try {
      const res = await api.get('/letter/schulungsplaene');
      const plans = await Promise.all((Array.isArray(res.data) ? res.data : []).map(async (p: any) => {
        const detail = await api.get('/letter/schulungsplaene/' + p.id);
        return detail.data;
      }));
      setSchulungsplaene(plans);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'send') { loadDrafts(); loadTrainingPlans(); loadSchulungsplaene(); }
  }, [activeTab]);

  useEffect(() => {
    loadDrafts();
    api.get('/letter/distributors').then(r => {
      setDistributors(r.data);
    }).catch(() => {});
  }, []);

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const data = {
        type: 'letter',
        title: subject || 'Unbenannter Entwurf',
        subject, salutation, body, closing,
        recipientName, recipientAddress, date,
        signerUserIds: selectedSignerIds,
        designSnapshot: design,
      };
      if (currentDraftId) {
        await api.put(`/letter/drafts/${currentDraftId}`, data);
        toast.success('Entwurf aktualisiert');
      } else {
        const res = await api.post('/letter/drafts', data);
        setCurrentDraftId(res.data.id);
        toast.success('Entwurf gespeichert');
      }
      setDraftDirty(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Fehler beim Speichern');
    }
    finally {
      setSavingDraft(false);
      loadDrafts(); // immer neu laden, auch nach Fehler
    }
  };

  const loadDraft = (draft: any) => {
    setSubject(draft.subject || '');
    setSalutation(draft.salutation || '');
    setBody(draft.body || '');
    setClosing(draft.closing || '');
    setRecipientName(draft.recipientName || '');
    setRecipientAddress(draft.recipientAddress || '');
    setDate(draft.date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }));
    const signerIds = JSON.parse(draft.signerUserIds || '[]');
    setSelectedSignerIds(signerIds);
    if (draft.designSnapshot) {
      try { setDesign(JSON.parse(draft.designSnapshot)); } catch {}
    }
    setCurrentDraftId(draft.id);
    setDraftDirty(false);
    setShowDraftList(false);
    toast.success(`Entwurf "${draft.title}" geladen`);
  };

  const deleteDraft = async (id: string) => {
    try {
      await api.delete(`/letter/drafts/${id}`);
      setDrafts(prev => prev.filter(d => d.id !== id));
      if (currentDraftId === id) { setCurrentDraftId(null); setDraftDirty(false); }
      toast.success('Entwurf gelöscht');
    } catch { toast.error('Fehler beim Löschen'); }
  };

  const previewPdf = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.post('/letter/preview-pdf', {
        subject, salutation, body, closing,
        recipientName, recipientAddress,
        signerUserIds: selectedSignerIds,
        designId: design?.id || null,
        date,
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { toast.error('Fehler bei der PDF-Vorschau'); }
    finally { setPreviewLoading(false); }
  };


  // ── Render ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'editor',        label: 'Briefe',            icon: FileText,      color: 'text-blue-600',    activeBg: 'bg-blue-600 text-white',    hoverBg: 'hover:bg-blue-50 hover:text-blue-700' },
    { id: 'invitation',    label: 'Einladungen',       icon: Mail,          color: 'text-emerald-700', activeBg: 'bg-emerald-600 text-white', hoverBg: 'hover:bg-emerald-50 hover:text-emerald-700' },
    { id: 'training_plan', label: 'Übungspläne',       icon: ClipboardList, color: 'text-amber-700',   activeBg: 'bg-amber-600 text-white',   hoverBg: 'hover:bg-amber-50 hover:text-amber-700' },
    { id: 'schulungsplan', label: 'Schulungspläne',    icon: ClipboardList, color: 'text-violet-700',  activeBg: 'bg-violet-600 text-white',  hoverBg: 'hover:bg-violet-50 hover:text-violet-700' },
    { id: 'send',          label: 'Versenden',         icon: Send,          color: 'text-ink-muted',   activeBg: 'bg-white text-ink',         hoverBg: 'hover:text-ink' },
    { id: 'contacts',      label: 'Kontakte',          icon: User,          color: 'text-ink-muted',   activeBg: 'bg-white text-ink',         hoverBg: 'hover:text-ink' },
    { id: 'history',       label: 'Historie',          icon: Clock,         color: 'text-ink-muted',   activeBg: 'bg-white text-ink',         hoverBg: 'hover:text-ink' },
    { id: 'design',        label: 'Design & Vorlagen', icon: Settings,      color: 'text-ink-muted',   activeBg: 'bg-white text-ink',         hoverBg: 'hover:text-ink' },
    { id: 'signature',     label: 'Unterschrift',      icon: Edit2,         color: 'text-ink-muted',   activeBg: 'bg-white text-ink',         hoverBg: 'hover:text-ink' },
  ];

  // Mobile-Sperre: Schriftverkehr nur auf Tablet/Desktop
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center">
        <div className="text-6xl mb-6">🖥️</div>
        <h2 className="text-xl font-bold text-ink mb-3">Schriftverkehr nicht verfügbar</h2>
        <p className="text-ink-muted text-sm max-w-xs leading-relaxed">
          Der Schriftverkehr ist für die Nutzung auf einem Tablet, PC oder Mac ausgelegt und steht auf dem Smartphone nicht zur Verfügung.
        </p>
        <p className="text-ink-muted text-xs mt-4 opacity-60">
          Bitte öffne die App auf einem größeren Gerät.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
            Schriftverkehr
          </h1>
          <p className="text-sm text-ink-muted">Briefe erstellen, Vorlagen verwalten und versenden</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 mb-4">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                isActive
                  ? ((t as any).activeBg + ' shadow-sm')
                  : ((t as any).color + ' ' + (t as any).hoverBg)
              }`}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Brief + Einladungen: resizable 2-column layout — nur wenn Editor oder Einladungs-Tab aktiv */}
      {(activeTab === 'editor' || activeTab === 'invitation') && (
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        {/* Linke Spalte: Tab-Inhalt */}
        <div className="space-y-4 min-w-0" style={{ flex: 1, minWidth: 0 }}>

      {/* ── TAB: Brief-Editor ── */}
      {activeTab === 'editor' && (
        <div className="space-y-4">

            {/* Versandbereit-Bar */}
            <div className={`card border-l-4 ${draftDirty ? 'border-l-amber-400' : currentDraftId ? 'border-l-emerald-400' : 'border-l-slate-300'}`}>
              {/* Haupt-Zeile */}
              <div className={`p-4 flex items-center gap-3 ${draftDirty ? 'bg-amber-50/50' : currentDraftId ? 'bg-emerald-50/30' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-ink">Versandbereit</span>
                    {draftDirty && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">● Ungespeicherte Änderungen</span>}
                    {currentDraftId && !draftDirty && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✓ Gespeichert</span>}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {currentDraftId
                      ? `„${drafts.find(d => d.id === currentDraftId)?.title || 'Unbenannt'}" — Änderungen speichern damit der Versenden-Tab aktuell ist.`
                      : 'Hier speichern → im Versenden-Tab an Empfänger schicken.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={saveDraft} disabled={savingDraft}
                    className={`flex items-center gap-2 py-2 px-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${draftDirty ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm' : currentDraftId ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    {savingDraft ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {currentDraftId ? 'Aktualisieren' : 'Speichern'}
                  </button>
                  {currentDraftId && (
                    <button onClick={() => { setCurrentDraftId(null); setDraftDirty(false); }}
                      className="p-2 text-ink-muted hover:text-red-500 rounded-lg flex-shrink-0" title="Neuer Brief (aktuellen Entwurf schließen)">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Gespeicherte Dokumente — immer sichtbar wenn vorhanden */}
              {drafts.filter(d => d.type === 'letter').length > 0 && (
                <div className="border-t border-surface-200">
                  <button onClick={() => setShowDraftList(v => !v)}
                    className="w-full px-4 py-2 flex items-center gap-2 text-xs text-ink-muted hover:bg-surface-50 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-600">{drafts.filter(d => d.type === 'letter').length} gespeicherte{drafts.filter(d => d.type === 'letter').length !== 1 ? ' Briefe' : 'r Brief'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${showDraftList ? 'rotate-180' : ''}`} />
                  </button>
                  {showDraftList && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {drafts.filter(d => d.type === 'letter').map(d => (
                        <div key={d.id} className="flex items-center gap-2 p-2.5 hover:bg-surface-50 rounded-lg group cursor-pointer border border-surface-100">
                          <button onClick={() => loadDraft(d)} className="flex-1 text-left min-w-0 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink truncate">{d.title}</div>
                              <div className="text-xs text-ink-muted flex items-center gap-2">
                                <span>{new Date(d.updatedAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                {d.sendCount > 0 && <span className="text-emerald-600 font-medium">✓ {d.sendCount}x versendet</span>}
                              </div>
                            </div>
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteDraft(d.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-ink-muted hover:text-red-500 rounded transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Toolbar: Design + Textvorlage + Aktionen */}
            <div className="card p-4 space-y-3">
              {/* Zeile 1: Design wählen — nur eigene Designs */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Design</span>
                {userDesigns.length === 0 ? (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50">
                    <span className="text-xs text-amber-700">Noch kein eigenes Design — erst im Tab "Design" ein eigenes erstellen.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <select value={userDesigns.find(d => d.id === selectedDesignId) ? selectedDesignId : ''}
                      onChange={e => e.target.value && switchDesign(e.target.value)}
                      className="input-field flex-1 text-sm">
                      <option value="">Eigenes Design wählen...</option>
                      {userDesigns.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {design && userDesigns.find(d => d.id === selectedDesignId) && (
                      <div className="w-5 h-5 rounded border border-surface-200 flex-shrink-0"
                        style={{ background: design.headerBgColor }} />
                    )}
                  </div>
                )}
              </div>

              {/* Zeile 2: Textvorlage wählen */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Vorlage</span>
                <select value={selectedTemplate} onChange={e => loadTemplate(e.target.value)}
                  className="input-field flex-1 min-w-[180px] text-sm">
                  <option value="">Textvorlage laden...</option>
                  {templates.filter(t => !t.type || t.type === 'letter').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTemplate && (
                  <button onClick={() => deleteTemplate(selectedTemplate)}
                    className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted"
                    title="Vorlage löschen">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowSaveTemplate(true); setTemplateName(templates.find(t => t.id === selectedTemplate)?.name || ''); }}
                  className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Save className="w-4 h-4" />
                  Speichern
                </button>
                <button onClick={previewPdf} disabled={previewLoading}
                  className="btn-secondary flex items-center gap-1.5 text-sm">
                  {previewLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  PDF
                </button>
              </div>
            </div>

            {/* Template-Name Dialog */}
            {showSaveTemplate && (
              <div className="card p-4 border-fire-200 bg-fire-50 space-y-3">
                <p className="text-sm font-medium text-ink">Vorlage speichern unter:</p>
                <div className="flex gap-2">
                  <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                    placeholder="Name der Vorlage..." className="input-field flex-1 text-sm"
                    onKeyDown={e => e.key === 'Enter' && saveTemplate()} autoFocus />
                  <button onClick={saveTemplate} disabled={savingTemplate} className="btn-primary text-sm">
                    {savingTemplate ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setShowSaveTemplate(false)} className="btn-secondary text-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Brief-Formular */}
            <div className="card p-5 space-y-4">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Empfänger</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Name / Anschrift Zeile 1</label>
                  <div className="flex gap-2">
                    <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)}
                      placeholder="Bürgermeister Franz Müller" className="input-field text-sm flex-1" />
                    {/* Kontakt wählen */}
                    <div className="relative">
                      <select onChange={e => { const c = contacts.find(c => c.id === e.target.value); if (c) useContact(c); e.target.value = ''; }}
                        className="input-field text-sm pl-2 pr-6" defaultValue="">
                        <option value="">📋</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Datum</label>
                  <input type="text" value={date} onChange={e => setDate(e.target.value)}
                    className="input-field text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Adresse</label>
                <textarea value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)}
                  rows={2} placeholder="Straße Nr&#10;PLZ Ort" className="input-field text-sm resize-none w-full" />
              </div>

              <div className="border-t border-surface-200 pt-4">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Briefinhalt</p>
              </div>

              <div>
                <label className="text-xs text-ink-muted block mb-1">Betreff</label>
                <input type="text" value={subject} onChange={e => { setSubject(e.target.value); setDraftDirty(true); }}
                  placeholder="Betreff des Briefes..." className="input-field text-sm w-full" />
              </div>

              <div>
                <label className="text-xs text-ink-muted block mb-1">Anrede</label>
                <input type="text" value={salutation} onChange={e => { setSalutation(e.target.value); setDraftDirty(true); }}
                  className="input-field text-sm w-full" />
              </div>

              <div>
                <label className="text-xs text-ink-muted block mb-1">Text</label>
                <div className="flex gap-2 items-start">
                  <textarea value={body} onChange={e => { setBody(e.target.value); setDraftDirty(true); }}
                    rows={8} placeholder="Inhalt des Briefes..." className="input-field text-sm resize-y w-full leading-relaxed" />
                  <DiktatButton onResult={text => setBody(prev => prev + (prev ? '\n\n' : '') + text)} />
                </div>
              </div>

              {/* KI-Assistent */}
              <div className="bg-surface-50 rounded-xl border border-surface-200 p-3 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">🤖 KI-Assistent</span>
                  {kiRunning && <span className="text-xs text-fire-600 flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> schreibt...</span>}
                </div>
                {kiStreamText && (
                  <div className="bg-ink rounded-lg p-2 text-xs text-gray-300 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {kiStreamText}<span className="animate-pulse">▍</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={kiPrompt}
                    onChange={e => setKiPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !kiRunning) generateWithKi(); }}
                    placeholder="z.B. 'Einladung zur Jahreshauptversammlung am 15. Juli um 19 Uhr im Feuerwehrhaus'"
                    className="input-field text-xs flex-1 py-1.5"
                    disabled={kiRunning} />
                  <button onClick={() => generateWithKi()} disabled={kiRunning || !kiPrompt.trim()}
                    className="flex items-center gap-1.5 text-xs text-fire-700 font-medium px-3 py-1.5 rounded-lg hover:bg-fire-50 border border-fire-200 transition-colors disabled:opacity-50 whitespace-nowrap">
                    {kiRunning ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Generieren
                  </button>
                </div>
                {body && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-surface-200">
                    <span className="text-xs text-ink-muted self-center">Text:</span>
                    {['Kürzer fassen', 'Länger ausführen', 'Förmlicher', 'Persönlicher', 'Neu schreiben'].map(btn => (
                      <button key={btn} type="button" onClick={() => generateWithKi(btn)} disabled={kiRunning}
                        className="text-xs px-2.5 py-1 rounded-lg border border-surface-300 bg-white hover:bg-fire-50 hover:border-fire-300 hover:text-fire-700 transition-colors disabled:opacity-40 text-ink-muted">
                        {btn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Grußformel</label>
                  <input type="text" value={closing} onChange={e => { setClosing(e.target.value); setDraftDirty(true); }}
                    className="input-field text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Unterzeichner (max. 3)</label>
                  <div className="space-y-1">
                    {availableSigners.map(s => (
                      <label key={s.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox"
                          checked={selectedSignerIds.includes(s.userId)}
                          onChange={e => {
                            if (e.target.checked && selectedSignerIds.length < 3)
                              setSelectedSignerIds(prev => [...prev, s.userId]);
                            else setSelectedSignerIds(prev => prev.filter(id => id !== s.userId));
                          }}
                          disabled={!selectedSignerIds.includes(s.userId) && selectedSignerIds.length >= 3}
                        />
                        <span>{s.name}</span>
                        <span className="text-ink-muted text-xs">{s.function}</span>
                      </label>
                    ))}
                    {availableSigners.length === 0 && (
                      <p className="text-xs text-ink-muted">Keine Unterzeichner verfügbar. Unterschrift unter "Unterschrift" hochladen.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

        </div>
      )}


      {/* ── TAB: Einladungen ── */}
      {activeTab === 'invitation' && (
        <InvitationTab
          design={invDesign}
          availableSigners={availableSigners}
          signaturePreview={signaturePreview}
          allTemplates={templates}
          eventName={invEventName} setEventName={setInvEventName}
          eventDate={invEventDate} setEventDate={setInvEventDate}
          eventTime={invEventTime} setEventTime={setInvEventTime}
          eventLocation={invEventLocation} setEventLocation={setInvEventLocation}
          eventProgram={invEventProgram} setEventProgram={setInvEventProgram}
          rsvpDeadline={invRsvpDeadline} setRsvpDeadline={setInvRsvpDeadline}
          directions={invDirections} setDirections={setInvDirections}
          introText={invIntroText} setIntroText={setInvIntroText}
          closing={invClosing} setClosing={setInvClosing}
          invDirty={invDirty} setInvDirty={setInvDirty}
          userDesigns={invUserDesigns} selectedDesignId={selectedInvDesignId} switchDesign={switchInvDesign}
          onPreviewHtmlChange={(html, loading) => { setInvLivePreviewHtml(html); setInvLivePreviewLoading(loading); }}
        />
      )}

        </div>

        {/* Resize Handle — Brief, Einladungs, Übungsplan, Schulungsplan, Design-Tabs */}
        {(activeTab === 'editor' || activeTab === 'invitation') && (
          <ResizeHandle onMouseDown={briefResize.onMouseDown} />
        )}

        {/* Rechte Spalte: Live-Vorschau für alle Tabs */}
        {(activeTab === 'editor' || activeTab === 'invitation') && (
          <div style={{ width: briefResize.sideWidth, flexShrink: 0, position: 'sticky', top: '1rem', height: 'calc(100vh - 2rem)', maxHeight: 900 }}>
            <div className="card overflow-hidden h-full flex flex-col">
              <div className="px-4 py-2 border-b border-surface-200 bg-surface-50 flex items-center gap-2 flex-shrink-0">
                <Eye className="w-4 h-4 text-ink-muted" />
                <span className="text-sm font-medium text-ink">Vorschau</span>
                <span className="text-xs text-ink-muted ml-auto">
                  {(activeTab === 'design' ? false : activeTab === 'editor' ? livePreviewLoading : invLivePreviewLoading) ? 'Wird aktualisiert...' : 'A4 · Live'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 bg-gray-100">
                {(activeTab === 'design' ? false : (activeTab === 'editor' ? livePreviewLoading : invLivePreviewLoading)) && !(activeTab === 'editor' ? livePreviewHtml : invLivePreviewHtml) && (
                  <div className="flex items-center justify-center h-full gap-2 text-ink-muted">
                    <Loader className="w-5 h-5 animate-spin" /><span className="text-sm">Vorschau wird geladen...</span>
                  </div>
                )}
                {(activeTab === 'design'
                  ? (designSubTab === 'brief' ? livePreviewHtml : designSubTab === 'invitation' ? invLivePreviewHtml : designSubTab === 'training_plan' ? tpDesignPreviewHtml : spDesignPreviewHtml)
                  : activeTab === 'editor' ? livePreviewHtml : invLivePreviewHtml) && (
                  <div style={{ position: 'relative' }}>
                    {(activeTab === 'editor' ? livePreviewLoading : invLivePreviewLoading) && (
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                        <Loader className="w-4 h-4 animate-spin text-ink-muted" />
                      </div>
                    )}
                    <iframe
                      srcDoc={
                        activeTab === 'design'
                          ? (designSubTab === 'brief' ? livePreviewHtml :
                             designSubTab === 'invitation' ? invLivePreviewHtml :
                             designSubTab === 'training_plan' ? tpDesignPreviewHtml :
                             designSubTab === 'schulungsplan' ? spDesignPreviewHtml : '')
                          : activeTab === 'editor' ? livePreviewHtml
                          : activeTab === 'training_plan' ? livePreviewHtml
                          : activeTab === 'schulungsplan' ? livePreviewHtml
                          : invLivePreviewHtml
                      }
                      style={{ width: '100%', height: '900px', border: 'none', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'block' }}
                      title="Vorschau"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── TAB: Kontakte & Verteiler ── */}
      {activeTab === 'contacts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── LINKE SPALTE: Verteiler ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Verteiler</h2>
              <button onClick={() => { setEditingDistributor({ name: '', memberIds: [], contactIds: [] }); setShowDistributorForm(true); }}
                className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
                <Plus className="w-3.5 h-3.5" /> Neuer Verteiler
              </button>
            </div>

            {/* Verteiler-Formular */}
            {showDistributorForm && editingDistributor && (
              <div className="card p-4 space-y-3 border border-surface-300">
                <p className="text-sm font-semibold text-ink">{editingDistributor.id ? 'Verteiler bearbeiten' : 'Neuer Verteiler'}</p>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Name *</label>
                  <input value={editingDistributor.name}
                    onChange={e => setEditingDistributor(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Kommando, Alle Aktiven..." className="input-field w-full" />
                </div>

                {/* Mitglieder zuweisen */}
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Mitglieder</label>
                  <div className="max-h-40 overflow-y-auto border border-surface-200 rounded-lg">
                    {members.filter(m => m.email).map(m => {
                      const _editMemberIds = editingDistributor.memberIds || [];
                      const checked = _editMemberIds.includes(m.userId || m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={e => setEditingDistributor(prev => ({
                              ...prev,
                              memberIds: e.target.checked
                                ? [...(prev.memberIds || []), m.userId || m.id]
                                : (prev.memberIds || []).filter((id: string) => id !== (m.userId || m.id))
                            }))} className="rounded" />
                          <span className="text-xs">{m.firstName} {m.lastName}</span>
                          <span className="text-xs text-ink-muted ml-auto truncate max-w-[120px]">{m.email}</span>
                        </label>
                      );
                    })}
                    {members.filter(m => m.email).length === 0 && (
                      <p className="text-xs text-ink-muted p-3">Keine Mitglieder mit Email</p>
                    )}
                  </div>
                </div>

                {/* Externe Kontakte zuweisen */}
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Externe Kontakte</label>
                  <div className="max-h-32 overflow-y-auto border border-surface-200 rounded-lg">
                    {contacts.map(c => {
                      const checked = (editingDistributor.contactIds || []).includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={e => setEditingDistributor(prev => ({
                              ...prev,
                              contactIds: e.target.checked
                                ? [...(prev.contactIds || []), c.id]
                                : (prev.contactIds || []).filter((id: string) => id !== c.id)
                            }))} className="rounded" />
                          <span className="text-xs">{c.name}</span>
                          <span className="text-xs text-ink-muted ml-auto truncate max-w-[120px]">{c.email}</span>
                        </label>
                      );
                    })}
                    {contacts.length === 0 && (
                      <p className="text-xs text-ink-muted p-3">Noch keine externen Kontakte</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowDistributorForm(false); setEditingDistributor(null); }}
                    className="btn-secondary text-sm">Abbrechen</button>
                  <button onClick={saveDistributor} className="btn-primary text-sm">Speichern</button>
                </div>
              </div>
            )}

            {/* Verteiler-Liste */}
            {distributors.length === 0 && !showDistributorForm && (
              <div className="card p-8 text-center text-ink-muted">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Verteiler</p>
                <p className="text-xs mt-1">Erstelle Verteiler um Mitglieder und externe Kontakte zu gruppieren</p>
              </div>
            )}

            {distributors.map(dist => {
              const _memberIds = dist.memberIds || [];
              const _contactIds = dist.contactIds || [];
              const distMemberCount = _memberIds.length;
              const distContactCount = _contactIds.length;
              return (
                <div key={dist.id} className="card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-ink">{dist.name}</p>
                      <p className="text-xs text-ink-muted">
                        {distMemberCount > 0 && `${distMemberCount} Mitglied${distMemberCount !== 1 ? 'er' : ''}`}
                        {distMemberCount > 0 && distContactCount > 0 && ' · '}
                        {distContactCount > 0 && `${distContactCount} externe${distContactCount !== 1 ? ' Kontakte' : 'r Kontakt'}`}
                        {distMemberCount === 0 && distContactCount === 0 && 'Leer'}
                      </p>
                    </div>
                    <button onClick={() => { setEditingDistributor({ ...dist, memberIds: dist.memberIds || [], contactIds: dist.contactIds || [] }); setShowDistributorForm(true); }}
                      className="p-1.5 text-ink-muted hover:text-ink rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteDistributor(dist.id)}
                      className="p-1.5 text-ink-muted hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Mitglieder-Chips */}
                  {_memberIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {members.filter(m => _memberIds.includes(m.userId || m.id)).slice(0, 5).map(m => (
                        <span key={m.id} className="text-xs bg-surface-100 text-ink-muted px-2 py-0.5 rounded-full">
                          {m.firstName} {m.lastName}
                        </span>
                      ))}
                      {_memberIds.length > 5 && (
                        <span className="text-xs text-ink-muted">+{_memberIds.length - 5} weitere</span>
                      )}
                    </div>
                  )}
                  {/* Externe Kontakt-Chips */}
                  {(dist.contactIds || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {contacts.filter(c => (dist.contactIds || []).includes(c.id)).map(c => (
                        <span key={c.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── RECHTE SPALTE: Externe Kontakte ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Externe Kontakte</h2>
              <button onClick={() => { setEditingContact({}); setShowContactForm(true); }}
                className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
                <Plus className="w-3.5 h-3.5" /> Neuer Kontakt
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <input type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                placeholder="Kontakte durchsuchen..." className="input-field pl-9 w-full" />
            </div>

            {showContactForm && editingContact && (
              <div className="card p-5 space-y-3 border border-surface-300">
                <p className="text-sm font-semibold text-ink">{editingContact.id ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { field: 'name', label: 'Name *', placeholder: 'Bürgermeister Franz Müller' },
                    { field: 'function', label: 'Funktion', placeholder: 'Bürgermeister' },
                    { field: 'organization', label: 'Organisation', placeholder: 'Gemeindeamt Dellach' },
                    { field: 'email', label: 'Email', placeholder: 'bf@dellach.at' },
                    { field: 'phone', label: 'Telefon', placeholder: '+43 ...' },
                    { field: 'street', label: 'Straße', placeholder: 'Hauptstraße 1' },
                    { field: 'zip', label: 'PLZ', placeholder: '9635' },
                    { field: 'city', label: 'Ort', placeholder: 'Dellach im Gailtal' },
                  ].map(f => (
                    <div key={f.field}>
                      <label className="text-xs text-ink-muted block mb-1">{f.label}</label>
                      <input type="text"
                        value={(editingContact as any)[f.field] || ''}
                        onChange={e => setEditingContact(prev => ({ ...prev, [f.field]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="input-field text-sm w-full" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Notizen</label>
                  <textarea value={editingContact.notes || ''}
                    onChange={e => setEditingContact(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2} className="input-field text-sm w-full resize-none" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowContactForm(false); setEditingContact(null); }} className="btn-secondary text-sm">Abbrechen</button>
                  <button onClick={saveContact} className="btn-primary text-sm">Speichern</button>
                </div>
              </div>
            )}

            {filteredContacts.length === 0 && !showContactForm && (
              <div className="card p-8 text-center text-ink-muted">
                <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{contactSearch ? 'Keine Treffer' : 'Noch keine externen Kontakte'}</p>
              </div>
            )}

            <div className="space-y-2">
              {filteredContacts.map(c => (
                <div key={c.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0 text-xs font-medium text-ink-muted">
                      {c.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{c.name}</p>
                      {c.function && <p className="text-xs text-ink-muted">{c.function}{c.organization && ` · ${c.organization}`}</p>}
                      {c.email && <p className="text-xs text-ink-muted">{c.email}</p>}
                      {c.phone && <p className="text-xs text-ink-muted">{c.phone}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingContact(c); setShowContactForm(true); }}
                        className="p-1.5 text-ink-muted hover:text-ink rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteContact(c.id)}
                        className="p-1.5 text-ink-muted hover:text-red-500 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── TAB: Übungsplan ── */}
      {activeTab === 'training_plan' && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        <div className="space-y-4 min-w-0" style={{ flex: 1, minWidth: 0 }}>
          <TrainingPlanTab
            userDesigns={tpUserDesigns}
            systemDesigns={tpSystemDesigns}
            availableSigners={availableSigners}
            onPreviewHtmlChange={(html, loading) => {
              if (activeTab === 'training_plan') {
                setLivePreviewHtml(html);
                setLivePreviewLoading(loading);
              }
            }}
          />
        </div>
        <ResizeHandle onMouseDown={briefResize.onMouseDown} />
        <div className="card overflow-hidden flex-shrink-0" style={{ width: briefResize.sideWidth }}>
          <div className="px-3 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center gap-2">
            <Eye className="w-4 h-4 text-ink-muted" />
            <span className="text-sm font-medium">Vorschau</span>
            {livePreviewLoading && <Loader className="w-3.5 h-3.5 animate-spin text-ink-muted ml-auto" />}
          </div>
          <div className="overflow-auto" style={{ maxHeight: '80vh' }}>
            {livePreviewHtml
              ? <iframe srcDoc={livePreviewHtml} style={{ width: '100%', height: '900px', border: 'none' }} title="Vorschau" />
              : <div className="flex flex-col items-center justify-center h-48 text-ink-muted">
                  <Eye className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Design wählen für Vorschau</p>
                </div>
            }
          </div>
        </div>
        </div>
      )}

      {activeTab === 'schulungsplan' && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        <div className="space-y-4 min-w-0" style={{ flex: 1, minWidth: 0 }}>
          <SchulungsplanTab
            userDesigns={spUserDesigns}
            systemDesigns={spSystemDesigns}
            availableSigners={availableSigners}
            onPreviewHtmlChange={(html, loading) => {
              if (activeTab === 'schulungsplan') {
                setLivePreviewHtml(html);
                setLivePreviewLoading(loading);
              }
            }}
          />
        </div>
        <ResizeHandle onMouseDown={briefResize.onMouseDown} />
        <div className="card overflow-hidden flex-shrink-0" style={{ width: briefResize.sideWidth }}>
          <div className="px-3 py-2.5 border-b border-surface-200 bg-surface-50 flex items-center gap-2">
            <Eye className="w-4 h-4 text-ink-muted" />
            <span className="text-sm font-medium">Vorschau</span>
            {livePreviewLoading && <Loader className="w-3.5 h-3.5 animate-spin text-ink-muted ml-auto" />}
          </div>
          <div className="overflow-auto" style={{ maxHeight: '80vh' }}>
            {livePreviewHtml
              ? <iframe srcDoc={livePreviewHtml} style={{ width: '100%', height: '900px', border: 'none' }} title="Schulungsplan Vorschau" />
              : <div className="flex flex-col items-center justify-center h-48 text-ink-muted">
                  <Eye className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Design wählen für Vorschau</p>
                </div>
            }
          </div>
        </div>
        </div>
      )}

      {/* ── TAB: Historie ── */}

      {activeTab === 'history' && (() => {
        const safeHistory = Array.isArray(history) ? history : [];
        const availableYears = [...new Set(safeHistory.map(h => new Date(h.createdAt).getFullYear()))].sort((a, b) => b - a);
        const filteredHistory = safeHistory
          .filter(h => new Date(h.createdAt).getFullYear() === selectedHistoryYear)
          .filter(h => historyTypeFilter === 'all' || (h.type || 'letter') === historyTypeFilter);
        return (
        <div className="space-y-3">
          {/* Typ-Filter — Segmented Control */}
          <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 gap-0.5 mb-3">
            {([
              ['all',           'Alle',          'bg-gray-600 text-white shadow-sm',    'text-gray-500 hover:bg-gray-50 hover:text-gray-700'],
              ['letter',        'Briefe',         'bg-blue-600 text-white shadow-sm',    'text-blue-600 hover:bg-blue-50'],
              ['invitation',    'Einladungen',    'bg-emerald-600 text-white shadow-sm', 'text-emerald-700 hover:bg-emerald-50'],
              ['training_plan', 'Übungspläne',    'bg-amber-600 text-white shadow-sm',   'text-amber-700 hover:bg-amber-50'],
              ['schulungsplan', 'Schulungspläne', 'bg-violet-600 text-white shadow-sm',  'text-violet-700 hover:bg-violet-50'],
            ] as [string,string,string,string][]).map(([val, label, activeCls, inactiveCls]) => (
              <button key={val} onClick={() => setHistoryTypeFilter(val)}
                className={"px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all " + (historyTypeFilter === val ? activeCls : inactiveCls)}>
                {label}
              </button>
            ))}
          </div>
          {/* Jahres-Dropdown */}
          {availableYears.length > 0 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-muted">{filteredHistory.length} {filteredHistory.length === 1 ? 'Eintrag' : 'Einträge'}</span>
              <div className="relative">
                <select value={selectedHistoryYear}
                  onChange={e => { setSelectedHistoryYear(Number(e.target.value)); setExpandedHistoryId(null); }}
                  className="input-field text-sm py-1 pl-3 pr-8 appearance-none cursor-pointer">
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}
          {/* Bestätigungs-Dialog */}
          {deleteHistoryId && (
            <div className="card p-4 border border-red-200 bg-red-50 space-y-3">
              <p className="text-sm font-medium text-red-800">Diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteHistoryId(null)} className="btn-secondary text-sm">Abbrechen</button>
                <button onClick={deleteHistoryEntry} disabled={deletingHistory}
                  className="btn-primary text-sm bg-red-600 hover:bg-red-700 flex items-center gap-1.5">
                  {deletingHistory ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Löschen
                </button>
              </div>
            </div>
          )}
          {filteredHistory.length === 0 && (
            <div className="text-center py-12 text-ink-muted">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{safeHistory.length === 0 ? 'Noch keine Einträge' : `Keine Einträge in ${selectedHistoryYear}`}</p>
            </div>
          )}
          {filteredHistory.map(h => {
            const isOpen = expandedHistoryId === h.id;
            const rcpts = (() => { try { const p = JSON.parse(h.recipients || '[]'); return Array.isArray(p) ? p : []; } catch { return []; } })();
            return (
              <div key={h.id} className="card overflow-hidden">
                {/* Kopfzeile — klickbar */}
                <div className="p-4 cursor-pointer select-none hover:bg-surface-50 transition-colors"
                  onClick={() => toggleHistoryEntry(h.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className={`w-4 h-4 text-ink-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={"text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 " + ((h.type||'letter')==='letter'?"bg-blue-100 text-blue-700":h.type==='invitation'?"bg-emerald-100 text-emerald-700":h.type==='schulungsplan'?"bg-violet-100 text-violet-700":"bg-amber-100 text-amber-700")}>
                            {(h.type||'letter')==='letter'?'Brief':h.type==='invitation'?'Einladung':h.type==='schulungsplan'?'Schulungsplan':'Übungsplan'}
                          </span>
                          <p className="font-medium text-sm text-ink truncate">{h.subject}</p>
                        </div>
                        <p className="text-xs text-ink-muted">
                          {h.sentByName} · {new Date(h.createdAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : h.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {h.status === 'sent' ? 'Gesendet' : h.status === 'partial' ? 'Teilweise' : 'Fehler'}
                      </span>
                      <span className="text-xs text-ink-muted">{SEND_MODES.find(m => m.value === h.sendMode)?.label}</span>
                      <button onClick={e => { e.stopPropagation(); setDeleteHistoryId(h.id); }}
                        className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted" title="Löschen">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-ink-muted mt-1 ml-6">
                    {rcpts.length} Empfänger: {rcpts.map((r: any) => r.name || r.email).join(', ')}
                    {h.template && <span> · Vorlage: {h.template.name}</span>}
                  </p>
                </div>

                {/* Accordion-Inhalt: A4-Vorschau */}
                {isOpen && (
                  <div className="border-t border-surface-200 bg-surface-50 p-4">
                    {historyPreviewLoading === h.id ? (
                      <div className="flex items-center justify-center py-12 text-ink-muted gap-2">
                        <Loader className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Vorschau wird geladen...</span>
                      </div>
                    ) : historyPreviewHtml[h.id] ? (
                      <div className="bg-gray-100 rounded-xl p-3 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                        <div style={{ width: '210mm', maxWidth: '100%', margin: '0 auto', transform: 'scale(0.75)', transformOrigin: 'top center', marginBottom: '-25%' }}>
                          <iframe
                            srcDoc={historyPreviewHtml[h.id]}
                            style={{ width: '210mm', height: '297mm', border: 'none', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
                            title="Brief-Vorschau"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-ink-muted text-sm">
                        Vorschau nicht verfügbar (ältere Einträge ohne Design-Snapshot)
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}


      {/* ── TAB: Design & Vorlagen ── */}
      {activeTab === 'design' && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        <div className="space-y-4 min-w-0" style={{ flex: 1, minWidth: 0 }}>
          {/* Sub-Tab Bar */}
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {([
              { id: 'brief',         label: 'Design Briefe',          activeClass: 'bg-blue-600 text-white shadow-sm',    inactiveClass: 'text-blue-600 hover:bg-blue-50' },
              { id: 'invitation',    label: 'Design Einladungen',      activeClass: 'bg-emerald-600 text-white shadow-sm', inactiveClass: 'text-emerald-700 hover:bg-emerald-50' },
              { id: 'training_plan', label: 'Design Übungspläne',      activeClass: 'bg-amber-600 text-white shadow-sm',   inactiveClass: 'text-amber-700 hover:bg-amber-50' },
              { id: 'schulungsplan', label: 'Design Schulungspläne',   activeClass: 'bg-violet-600 text-white shadow-sm',  inactiveClass: 'text-violet-700 hover:bg-violet-50' },
              { id: 'vorlagen',      label: 'Textvorlagen',            activeClass: 'bg-white text-ink shadow-sm',         inactiveClass: 'text-ink-muted hover:text-ink' },
            ] as {id: string, label: string, activeClass: string, inactiveClass: string}[]).map(t => (
              <button key={t.id} onClick={() => setDesignSubTab(t.id)}
                className={'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ' + (designSubTab === t.id ? t.activeClass : t.inactiveClass)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Sub-Tab: Design Brief */}
          {designSubTab === 'brief' && (
            <div>
              {design && (
                <div className="space-y-3">
                  <div className="card p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <DesignDropdown
                          designs={[...systemDesigns.filter((d: any) => !d.designType || d.designType === 'brief'), ...userDesigns]}
                          selectedId={selectedDesignId}
                          onSelect={switchDesign}
                          label="Design wählen..."
                          onCreateNew={() => openSaveAsModal('brief')}
                        />
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {systemDesigns.find(d => d.id === selectedDesignId) && (
                          <button onClick={() => openSaveAsModal('brief')}
                            className="btn-secondary text-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Als eigenes speichern
                          </button>
                        )}
                        {userDesigns.find(d => d.id === selectedDesignId) && (
                          <button onClick={saveDesign} disabled={!designDirty || savingDesign}
                            className="btn-primary text-sm flex items-center gap-2">
                            {savingDesign ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Speichern
                          </button>
                        )}
                        {userDesigns.find(d => d.id === selectedDesignId) && (
                          <button onClick={() => { deleteDesign(selectedDesignId); }}
                            className="btn-secondary text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Template-Auswahl direkt unter Design */}
                    <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Template</label>
                      <select value={design.template || 'classic'}
                         onChange={e => { setDesign(prev => prev ? { ...prev, template: e.target.value } : prev); setDesignDirty(true); }}
                         className="input-field text-sm flex-1">
                        <option value="classic">Klassisch</option>
                        <option value="minimal">Minimal</option>
                        <option value="overlap">Überlappend</option>
                        <option value="badge">Badge (Logo-Kreis)</option>
                        <option value="sidebar">Sidebar Links</option>
                        <option value="sidebar-right">Sidebar Rechts</option>
                        <option value="diagonal">Diagonal</option>
                        <option value="split">Geteilt</option>
                        <option value="rounded">Gerundet</option>
                        <option value="ribbon">Ribbon</option>
                        <option value="bold-type">Fetter Titel</option>
                        <option value="wave">Welle</option>
                        <option value="duo">Duo</option>
                        <option value="arch">Bogen</option>
                        <option value="frame">Rahmen</option>
                        <option value="corner">Ecke</option>
                        <option value="stripe">Streifen</option>
                        <option value="watermark">Wasserzeichen</option>
                        <option value="geometric">Geometrisch</option>
                        <option value="footer-heavy">Reicher Footer</option>
                        <option value="flame">🔥 Flamme</option>
                        <option value="ticket">🎫 Ticket</option>
                        <option value="poster">🎯 Poster</option>
                        <option value="einsatz">🚨 Einsatz</option>
                        <option value="hydrant">🚒 Hydrant</option>
                      </select>
                    </div>
                    {/* Name ändern — nur für eigene Designs */}
                    {userDesigns.find(d => d.id === selectedDesignId) && (
                      <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Name</label>
                        <input value={design.name || ''} onChange={e => { setDesign(prev => prev ? { ...prev, name: e.target.value } : prev); setDesignDirty(true); }}
                          className="input-field text-sm flex-1" placeholder="Design-Name" />
                      </div>
                    )}
                    <DesignEditor design={design} onChange={(field, val) => { setDesign(prev => prev ? { ...prev, [field]: val } : prev); setDesignDirty(true); }} onUpload={userDesigns.find(d => d.id === selectedDesignId) ? uploadDesignImage : undefined} />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Sub-Tab: Design Einladung */}
          {designSubTab === 'invitation' && (
            <div>
              <div className="space-y-3">
                {invDesign && (
                  <div className="card p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <DesignDropdown
                          designs={[...invSystemDesigns, ...invUserDesigns]}
                          selectedId={selectedInvDesignId}
                          onSelect={switchInvDesign}
                          label="Design wählen..."
                          onCreateNew={() => openSaveAsModal('invitation')}
                        />
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {invSystemDesigns.find(d => d.id === selectedInvDesignId) && (
                          <button onClick={() => openSaveAsModal('invitation')}
                            className="btn-secondary text-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Als eigenes speichern
                          </button>
                        )}
                        {invUserDesigns.find(d => d.id === selectedInvDesignId) && (
                          <button onClick={saveInvDesign} disabled={savingDesign}
                            className="btn-primary text-sm flex items-center gap-2">
                            {savingDesign ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Speichern
                          </button>
                        )}
                        {invUserDesigns.find(d => d.id === selectedInvDesignId) && (
                          <button onClick={() => deleteInvDesign(selectedInvDesignId)}
                            className="btn-secondary text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Template-Auswahl direkt unter Design */}
                    <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Template</label>
                      <select value={invDesign.template || 'classic'}
                         onChange={e => { setInvDesign(prev => prev ? { ...prev, template: e.target.value } : prev); }}
                         className="input-field text-sm flex-1">
                        <option value="classic">Klassisch</option>
                        <option value="minimal">Minimal</option>
                        <option value="overlap">Überlappend</option>
                        <option value="badge">Badge (Logo-Kreis)</option>
                        <option value="sidebar">Sidebar Links</option>
                        <option value="sidebar-right">Sidebar Rechts</option>
                        <option value="diagonal">Diagonal</option>
                        <option value="split">Geteilt</option>
                        <option value="rounded">Gerundet</option>
                        <option value="ribbon">Ribbon</option>
                        <option value="bold-type">Fetter Titel</option>
                        <option value="wave">Welle</option>
                        <option value="duo">Duo</option>
                        <option value="arch">Bogen</option>
                        <option value="frame">Rahmen</option>
                        <option value="corner">Ecke</option>
                        <option value="stripe">Streifen</option>
                        <option value="watermark">Wasserzeichen</option>
                        <option value="geometric">Geometrisch</option>
                        <option value="footer-heavy">Reicher Footer</option>
                        <option value="flame">🔥 Flamme</option>
                        <option value="ticket">🎫 Ticket</option>
                        <option value="poster">🎯 Poster</option>
                        <option value="einsatz">🚨 Einsatz</option>
                        <option value="hydrant">🚒 Hydrant</option>
                      </select>
                    </div>
                    {/* Name ändern — nur für eigene Designs */}
                    {invUserDesigns.find(d => d.id === selectedInvDesignId) && (
                      <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Name</label>
                        <input value={invDesign.name || ''} onChange={e => { setInvDesign(prev => prev ? { ...prev, name: e.target.value } : prev); }}
                          className="input-field text-sm flex-1" placeholder="Design-Name" />
                      </div>
                    )}
                    <DesignEditor design={invDesign} onChange={(field, val) => { setInvDesign(prev => prev ? { ...prev, [field]: val } : prev); }} onUpload={invUserDesigns.find(d => d.id === selectedInvDesignId) ? uploadInvDesignImage : undefined} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-Tab: Design Übungspläne */}
          {designSubTab === 'training_plan' && (
            <div>
              <div className="space-y-3">
                {tpDesign ? (
                  <div className="card p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <DesignDropdown
                          designs={[...tpSystemDesigns, ...tpUserDesigns]}
                          selectedId={selectedTpDesignId}
                          onSelect={switchTpDesign}
                          label="Design wählen..."
                          onCreateNew={() => openSaveAsModal('training_plan')}
                        />
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {tpSystemDesigns.find(d => d.id === selectedTpDesignId) && (
                          <button onClick={() => openSaveAsModal('training_plan')}
                            className="btn-secondary text-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Als eigenes speichern
                          </button>
                        )}

                        {tpUserDesigns.find(d => d.id === selectedTpDesignId) && (
                          <button onClick={saveTpDesign} disabled={!tpDesignDirty || savingDesign}
                            className="btn-primary text-sm flex items-center gap-2">
                            {savingDesign ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Speichern
                          </button>
                        )}
                        {tpUserDesigns.find(d => d.id === selectedTpDesignId) && (
                          <button onClick={() => deleteTpDesign(selectedTpDesignId)}
                            className="btn-secondary text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Template-Auswahl direkt unter Design */}
                    <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Template</label>
                      <select value={tpDesign.template || 'classic'}
                         onChange={e => { setTpDesign(prev => prev ? { ...prev, template: e.target.value } : prev); setTpDesignDirty(true); }}
                         className="input-field text-sm flex-1">
                        <option value="classic">Klassisch</option>
                        <option value="minimal">Minimal</option>
                        <option value="overlap">Überlappend</option>
                        <option value="badge">Badge (Logo-Kreis)</option>
                        <option value="sidebar">Sidebar Links</option>
                        <option value="sidebar-right">Sidebar Rechts</option>
                        <option value="diagonal">Diagonal</option>
                        <option value="split">Geteilt</option>
                        <option value="rounded">Gerundet</option>
                        <option value="ribbon">Ribbon</option>
                        <option value="bold-type">Fetter Titel</option>
                        <option value="wave">Welle</option>
                        <option value="duo">Duo</option>
                        <option value="arch">Bogen</option>
                        <option value="frame">Rahmen</option>
                        <option value="corner">Ecke</option>
                        <option value="stripe">Streifen</option>
                        <option value="watermark">Wasserzeichen</option>
                        <option value="geometric">Geometrisch</option>
                        <option value="footer-heavy">Reicher Footer</option>
                        <option value="flame">🔥 Flamme</option>
                        <option value="ticket">🎫 Ticket</option>
                        <option value="poster">🎯 Poster</option>
                        <option value="einsatz">🚨 Einsatz</option>
                        <option value="hydrant">🚒 Hydrant</option>
                      </select>
                    </div>
                    {/* Name ändern — nur für eigene Designs */}
                    {tpUserDesigns.find(d => d.id === selectedTpDesignId) && (
                      <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Name</label>
                        <input value={tpDesign.name || ''} onChange={e => { setTpDesign(prev => prev ? { ...prev, name: e.target.value } : prev); setTpDesignDirty(true); }}
                          className="input-field text-sm flex-1" placeholder="Design-Name" />
                      </div>
                    )}
                    <DesignEditor
                      design={tpDesign}
                      onChange={(field, val) => { setTpDesign(prev => prev ? { ...prev, [field]: val } : prev); setTpDesignDirty(true); }}
                      onUpload={tpUserDesigns.find(d => d.id === selectedTpDesignId) ? uploadTpDesignImage : undefined}
                    />
                  </div>
                ) : (
                  <div className="card p-8 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-3 text-ink-muted opacity-40" />
                    <p className="text-sm text-ink-muted mb-4">Noch kein Übungsplan-Design vorhanden</p>
                    <button onClick={() => openSaveAsModal('training_plan')} className="btn-primary text-sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Neues Design erstellen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {designSubTab === 'schulungsplan' && (
            <div>
              <div className="space-y-3">
                {spDesign ? (
                  <div className="card p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <DesignDropdown
                          designs={[...spSystemDesigns, ...spUserDesigns]}
                          selectedId={selectedSpDesignId}
                          onSelect={switchSpDesign}
                          label="Design wählen..."
                          onCreateNew={() => openSaveAsModal('schulungsplan')}
                        />
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {spSystemDesigns.find(d => d.id === selectedSpDesignId) && (
                          <button onClick={() => openSaveAsModal('schulungsplan')}
                            className="btn-secondary text-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Als eigenes speichern
                          </button>
                        )}
                        {spUserDesigns.find(d => d.id === selectedSpDesignId) && (
                          <button onClick={saveSpDesign} disabled={!spDesignDirty || savingDesign}
                            className="btn-primary text-sm flex items-center gap-2">
                            {savingDesign ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Speichern
                          </button>
                        )}
                        {spUserDesigns.find(d => d.id === selectedSpDesignId) && (
                          <button onClick={() => deleteSpDesign(selectedSpDesignId)}
                            className="btn-secondary text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Template-Auswahl direkt unter Design */}
                    <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Template</label>
                      <select value={spDesign.template || 'classic'}
                         onChange={e => { setSpDesign(prev => prev ? { ...prev, template: e.target.value } : prev); setSpDesignDirty(true); }}
                         className="input-field text-sm flex-1">
                        <option value="classic">Klassisch</option>
                        <option value="minimal">Minimal</option>
                        <option value="overlap">Überlappend</option>
                        <option value="badge">Badge (Logo-Kreis)</option>
                        <option value="sidebar">Sidebar Links</option>
                        <option value="sidebar-right">Sidebar Rechts</option>
                        <option value="diagonal">Diagonal</option>
                        <option value="split">Geteilt</option>
                        <option value="rounded">Gerundet</option>
                        <option value="ribbon">Ribbon</option>
                        <option value="bold-type">Fetter Titel</option>
                        <option value="wave">Welle</option>
                        <option value="duo">Duo</option>
                        <option value="arch">Bogen</option>
                        <option value="frame">Rahmen</option>
                        <option value="corner">Ecke</option>
                        <option value="stripe">Streifen</option>
                        <option value="watermark">Wasserzeichen</option>
                        <option value="geometric">Geometrisch</option>
                        <option value="footer-heavy">Reicher Footer</option>
                        <option value="flame">🔥 Flamme</option>
                        <option value="ticket">🎫 Ticket</option>
                        <option value="poster">🎯 Poster</option>
                        <option value="einsatz">🚨 Einsatz</option>
                        <option value="hydrant">🚒 Hydrant</option>
                      </select>
                    </div>
                    {/* Name ändern — nur für eigene Designs */}
                    {spUserDesigns.find(d => d.id === selectedSpDesignId) && (
                      <div className="flex items-center gap-3 pt-1 border-t border-surface-100">
                        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Name</label>
                        <input value={spDesign.name || ''} onChange={e => { setSpDesign(prev => prev ? { ...prev, name: e.target.value } : prev); setSpDesignDirty(true); }}
                          className="input-field text-sm flex-1" placeholder="Design-Name" />
                      </div>
                    )}
                    <DesignEditor
                      design={spDesign}
                      onChange={(field, val) => { setSpDesign(prev => prev ? { ...prev, [field]: val } : prev); setSpDesignDirty(true); }}
                      onUpload={spUserDesigns.find(d => d.id === selectedSpDesignId) ? uploadSpDesignImage : undefined}
                    />
                  </div>
                ) : (
                  <div className="card p-8 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-3 text-ink-muted opacity-40" />
                    <p className="text-sm text-ink-muted mb-4">Noch kein Schulungsplan-Design vorhanden</p>
                    <button onClick={() => openSaveAsModal('schulungsplan')} className="btn-primary text-sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Neues Design erstellen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-Tab: Textvorlagen */}
          {designSubTab === 'vorlagen' && (
            <TextvorlagenPanel
              templates={templates}
              setTemplates={setTemplates}
              body={body} setBody={setBody}
              introText={invIntroText} setIntroText={setInvIntroText}
            />
          )}
        </div>
        {designSubTab !== 'vorlagen' && (
          <ResizeHandle onMouseDown={briefResize.onMouseDown} />
        )}
        {designSubTab !== 'vorlagen' && (
          <div className="card overflow-hidden flex-shrink-0 flex flex-col" style={{ width: briefResize.sideWidth, position: 'sticky', top: '1rem', height: 'calc(100vh - 2rem)', maxHeight: 900 }}>
            <div className="px-4 py-2 border-b border-surface-200 bg-surface-50 flex items-center gap-2 flex-shrink-0">
              <Eye className="w-4 h-4 text-ink-muted" />
              <span className="text-sm font-medium">Vorschau</span>
              <span className="text-xs text-ink-muted ml-auto">A4 · Live</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-gray-100">
              {(designSubTab === 'brief' ? livePreviewHtml : designSubTab === 'invitation' ? invLivePreviewHtml : designSubTab === 'training_plan' ? tpDesignPreviewHtml : spDesignPreviewHtml) ? (
                <iframe
                  key={designSubTab}
                  srcDoc={designSubTab === 'brief' ? livePreviewHtml : designSubTab === 'invitation' ? invLivePreviewHtml : designSubTab === 'training_plan' ? tpDesignPreviewHtml : spDesignPreviewHtml}
                  style={{ width: '100%', height: '900px', border: 'none', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'block' }}
                  title="Design-Vorschau"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-ink-muted">
                  <Eye className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Design wählen für Vorschau</p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      )}

      {/* ── TAB: Unterschrift ── */}
      {activeTab === 'signature' && (
        <div className="space-y-4 max-w-md">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-ink-muted" />
              <p className="text-sm font-semibold text-ink">Meine Unterschrift</p>
            </div>

            <div className="rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 p-6 text-center">
              {signaturePreview ? (
                <div className="space-y-3">
                  <img src={signaturePreview} alt="Unterschrift"
                    className="max-h-24 mx-auto object-contain" />
                  <div className="border-t border-surface-300 pt-2 text-xs text-ink-muted">Unterschrift</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Edit2 className="w-8 h-8 mx-auto text-ink-muted opacity-30" />
                  <p className="text-sm text-ink-muted">Noch keine Unterschrift hochgeladen</p>
                  <p className="text-xs text-ink-muted">Transparentes PNG empfohlen</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer">
                {uploadingSignature ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {hasSignature ? 'Unterschrift ersetzen' : 'Unterschrift hochladen'}
                <input ref={sigFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadSignature(e.target.files[0])} />
              </label>
              {hasSignature && (
                <button onClick={deleteSignature}
                  className="w-full btn-secondary text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 text-sm">
                  <Trash2 className="w-4 h-4" />
                  Unterschrift löschen
                </button>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800">
                Deine Unterschrift ist verschlüsselt gespeichert und nur für dich sichtbar.
                Sie wird nur in Briefen angezeigt in denen du als Unterzeichner ausgewählt wirst.
              </p>
            </div>
          </div>
        </div>
      )}



      {/* ── TAB: Versenden ── volle Breite, außerhalb flex */}
      {activeTab === 'send' && (
        <SendTab design={design} allDrafts={drafts} onDraftsChange={loadDrafts} sendResizeSide={sendResizeSide} allTrainingPlans={trainingPlans} allSchulungsplaene={schulungsplaene} />
      )}

      {/* Unsaved Changes Guard */}
      <UnsavedChangesModal
        onSave={async () => {
          try {
            await saveDraft();
            return true;
          } catch {
            return false;
          }
        }}
        onResolve={resolveGuard}
      />

      {/* SaveAs Modal */}
      {showSaveAsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSaveAsModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-ink">
              {saveAsType === 'brief' ? 'Brief-Design' : saveAsType === 'invitation' ? 'Einladungs-Design' : saveAsType === 'training_plan' ? 'Übungsplan-Design' : 'Schulungsplan-Design'} speichern unter
            </p>
            <input
              autoFocus
              value={newDesignName}
              onChange={e => setNewDesignName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmSaveAs(); if (e.key === 'Escape') setShowSaveAsModal(false); }}
              placeholder="Name des Designs"
              className="input-field w-full"
            />
            <div className="flex gap-2">
              <button onClick={confirmSaveAs} disabled={!newDesignName.trim()}
                className="btn-primary flex-1 text-sm">Speichern</button>
              <button onClick={() => setShowSaveAsModal(false)}
                className="btn-secondary text-sm px-4">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
