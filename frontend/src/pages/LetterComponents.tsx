import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Eye, Loader, Save, Trash2, X, Check, Plus, ChevronDown, FileText, Upload, Edit2 } from 'lucide-react';
import type { LetterDesign, LetterTemplate } from './schriftverkehr.types';

export function useResizePanel(defaultSide: number, min: number, max: number, reverse = false) {
  const [sideWidth, setSideWidth] = useState(defaultSide);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(defaultSide);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sideWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sideWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = reverse ? startWidth.current + delta : startWidth.current - delta;
      setSideWidth(Math.min(max, Math.max(min, newWidth)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [min, max]);

  return { sideWidth, onMouseDown };
}

// ── ResizeHandle ──────────────────────────────────────────────────────────────
export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 8, cursor: 'col-resize', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, transition: 'background 0.15s',
        background: hover ? 'rgba(0,0,0,0.08)' : 'transparent',
      }}
    >
      <div style={{
        width: 3, height: 32, borderRadius: 2,
        background: hover ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)',
        transition: 'background 0.15s',
      }} />
    </div>
  );
}


// ── Typen ─────────────────────────────────────────────────────────────────────

interface LetterDesign {
  id: string;
  name: string;
  isSystem?: boolean;
  category?: string;
  headerBgColor: string;
  headerBgImage?: string;
  headerBgImageOpacity: number;
  headerLogoLeft?: string;
  headerLogoRight?: string;
  headerLogoCenter?: string;
  headerLogoPosition: string;
  headerTitle: string;
  headerSubtitle: string;
  headerTitleColor: string;
  headerTitleSize: number;
  bodyBgColor: string;
  bodyBgImage?: string;
  bodyBgImageOpacity: number;
  fontFamily: string;
  fontSize: number;
  senderName: string;
  senderAddress: string;
  senderPhone: string;
  senderEmail: string;
  senderWebsite: string;
  senderCity: string;
  senderLineText: string;
  template?: string;
}

interface LetterTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
}

interface LetterContact {
  id: string;
  name: string;
  function?: string;
  organization?: string;
  street?: string;
  zip?: string;
  city?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  status: string;
  rank?: string;
}

interface Signer {
  userId: string;
  name: string;
  function: string;
  hasSignature: boolean;
}

interface SentLetter {
  id: string;
  sentByName: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  signers: string;
  recipients: string;
  sendMode: string;
  status: string;
  createdAt: string;
  designSnapshot?: string;
  template?: { name: string };
}

const TEMPLATES = [
  { value: 'classic',      label: 'Klassisch',        desc: 'Voller Header, Akzentlinie' },
  { value: 'minimal',      label: 'Minimal',           desc: 'Dünne Linie, viel Weißraum' },
  { value: 'sidebar',      label: 'Sidebar Links',     desc: 'Farbige Leiste links' },
  { value: 'diagonal',     label: 'Diagonal',          desc: 'Schräger Schnitt im Header' },
  { value: 'rounded',      label: 'Gerundet',          desc: 'Abgerundete Ecken' },
  { value: 'split',        label: 'Geteilt',           desc: 'Logo-Block links, Titel rechts' },
  { value: 'badge',        label: 'Badge',             desc: 'Logo-Kreis mittig überlappt' },
  { value: 'frame',        label: 'Rahmen',            desc: 'Rahmen um die ganze Seite' },
  { value: 'corner',       label: 'Ecke',              desc: 'Farbblock diagonal oben-links' },
  { value: 'stripe',       label: 'Streifen',          desc: 'Drei horizontale Farbstreifen' },
  { value: 'watermark',    label: 'Wasserzeichen',     desc: 'Logo als Wasserzeichen' },
  { value: 'bold-type',    label: 'Fetter Titel',      desc: 'Großer fetter Titeltext' },
  { value: 'wave',         label: 'Welle',             desc: 'Geschwungene Trennlinie' },
  { value: 'overlap',      label: 'Überlappend',       desc: 'Logo-Kreis überlappt Header' },
  { value: 'duo',          label: 'Duo',               desc: 'Zwei Farbblöcke im Header' },
  { value: 'arch',         label: 'Bogen',             desc: 'Bogen-Ausschnitt im Header' },
  { value: 'sidebar-right',label: 'Sidebar Rechts',    desc: 'Schmale Leiste rechts' },
  { value: 'footer-heavy', label: 'Reicher Footer',    desc: 'Minimaler Header, reicher Footer' },
  { value: 'geometric',    label: 'Geometrisch',       desc: 'Geometrische Formen' },
  { value: 'ribbon',       label: 'Ribbon',            desc: 'Farbband-Streifen' },
];

const FONTS = [
  'Playfair Display',
  'EB Garamond',
  'Cormorant Garamond',
  'Lora',
  'Georgia',
  'Times New Roman',
  'Arial',
  'Helvetica',
  'Verdana',
];
const SEND_MODES = [
  { value: 'pdf',      label: 'Nur PDF (Anhang)' },
  { value: 'html',     label: 'Nur HTML (Email)' },
  { value: 'html_pdf', label: 'HTML + PDF Anhang' },
];
const MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktive',
  RESERVE: 'Reservisten',
  RETIRED: 'Altkameraden',
  YOUTH: 'Jugend',
  HONORARY: 'Ehrenmitglieder',
  CANDIDATE: 'Anwärter',
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────

// ── A4 Live-Vorschau Komponente ───────────────────────────────────────────────


export function LetterPreviewA4({ design, subject, salutation, body, closing, recipientName, recipientAddress, date, signers, signaturePreview }: {
  design: any;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  recipientName: string;
  recipientAddress: string;
  date: string;
  signers: { userId: string; name: string; function: string }[];
  signaturePreview: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const availableHeight = containerRef.current.clientHeight;
        const availableWidth = containerRef.current.clientWidth;
        const a4Height = 1122; // px bei 96dpi
        const a4Width = 794;
        const scaleH = availableHeight / a4Height;
        const scaleW = availableWidth / a4Width;
        setScale(Math.min(scaleH, scaleW, 1));
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  if (!design) return null;

  const accentColor = design.accentColor || design.headerBgColor || '#1a2744';
  const fontFamily = `${design.fontFamily || 'Georgia'}, Georgia, serif`;
  const fontSize = design.fontSize || 12;
  const signerPos = design.signerPosition || 'right';

  const logoStyle: React.CSSProperties = { width: 52, height: 52, objectFit: 'contain' };

  return (
    <div ref={containerRef} className="w-full h-full flex items-start justify-center overflow-hidden" style={{ minHeight: 400 }}>
      <div style={{
        width: 794,
        minHeight: 1122,
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        background: '#fff',
        boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
        fontFamily,
        fontSize,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Briefkopf */}
        <div style={{ background: design.headerBgColor, position: 'relative', overflow: 'hidden', padding: '20px 32px' }}>
          {design.headerBgImage && (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${design.headerBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: design.headerBgImageOpacity }} />
          )}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {(design.headerLogoPosition === 'left' || design.headerLogoPosition === 'both') && (
              design.headerLogoLeft
                ? <img src={design.headerLogoLeft} alt="" style={logoStyle} onError={e => (e.currentTarget.style.display='none')} />
                : <div style={{ width: 52, height: 52 }} />
            )}
            {design.headerLogoPosition === 'center' && design.headerLogoCenter && (
              <img src={design.headerLogoCenter} alt="" style={logoStyle} onError={e => (e.currentTarget.style.display='none')} />
            )}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ color: design.headerTitleColor, fontSize: design.headerTitleSize || 20, fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1.2 }}>
                {design.headerTitle || 'Freiwillige Feuerwehr'}
              </div>
              {design.headerSubtitle && (
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontStyle: 'italic', letterSpacing: '0.08em' }}>
                  {design.headerSubtitle}
                </div>
              )}
            </div>
            {(design.headerLogoPosition === 'right' || design.headerLogoPosition === 'both') && (
              design.headerLogoRight
                ? <img src={design.headerLogoRight} alt="" style={logoStyle} onError={e => (e.currentTarget.style.display='none')} />
                : <div style={{ width: 52, height: 52 }} />
            )}
          </div>
        </div>

        {/* Akzentlinie */}
        <div style={{ height: 4, background: accentColor }} />

        {/* Brief-Body */}
        <div style={{ flex: 1, background: design.bodyBgColor || '#fff', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {design.bodyBgImage && (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${design.bodyBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: design.bodyBgImageOpacity }} />
          )}
          <div style={{ position: 'relative', zIndex: 1, padding: '28px 40px', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Meta-Zeile */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingBottom: 8, borderBottom: '0.5px solid #efefef' }}>
              <div style={{ fontSize: 9, color: '#ccc', letterSpacing: '0.05em' }}>
                {design.senderLineText || [design.senderName, design.senderAddress].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                {design.senderCity ? design.senderCity + ', ' : ''}{date}
              </div>
            </div>

            {/* Empfänger */}
            <div style={{ marginBottom: 24, paddingLeft: 12, borderLeft: `3px solid ${accentColor}`, fontSize: 11, lineHeight: 1.7, color: '#444' }}>
              <div style={{ fontSize: 8, color: '#ccc', marginBottom: 3 }}>{design.senderLineText || [design.senderName, design.senderAddress].filter(Boolean).join(' · ')}</div>
              <div style={{ fontWeight: 500, color: '#222' }}>{recipientName || 'Empfänger Name'}</div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{recipientAddress || 'Straße Nr\nPLZ Ort'}</div>
            </div>

            {/* Betreff */}
            <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#1a1a1a', marginBottom: 18, paddingBottom: 8, borderBottom: `0.5px solid ${accentColor}33`, letterSpacing: '0.01em' }}>
              Betreff: {subject || 'Betreff des Briefes'}
            </div>

            {/* Anrede + Text */}
            <div style={{ fontSize, lineHeight: 1.9, color: '#333' }}>
              {(salutation || 'Sehr geehrte Damen und Herren,') && (
                <div style={{ marginBottom: 12 }}>{salutation || 'Sehr geehrte Damen und Herren,'}</div>
              )}
              <div style={{ color: '#444', whiteSpace: 'pre-wrap' }}>
                {body || 'Hier steht der Inhalt des Briefes. Der Text erscheint hier live während Sie tippen und gibt Ihnen einen realistischen Eindruck des fertigen Dokuments.'}
              </div>
            </div>

            {/* Grußformel - abgesetzt */}
            <div style={{ marginTop: 32, paddingTop: 20, borderTop: '0.5px solid #ececec', fontSize, color: '#555' }}>
              <div>{closing || 'Mit freundlichen Grüßen,'}</div>

              {/* Unterzeichner */}
              <div style={{ marginTop: 40, display: 'flex', justifyContent: signerPos === 'left' ? 'flex-start' : signerPos === 'center' ? 'center' : 'flex-end', gap: 48 }}>
                {signers.length > 0 ? signers.map(s => (
                  <div key={s.userId} style={{ textAlign: 'center', minWidth: 130 }}>
                    {signaturePreview
                      ? <img src={signaturePreview} alt="" style={{ height: 54, maxWidth: 180, objectFit: 'contain', display: 'block', margin: '0 auto 4px', mixBlendMode: 'multiply' as any }} />
                      : <div style={{ height: 54 }} />}
                    <div style={{ borderTop: `1.5px solid ${accentColor}`, paddingTop: 6 }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 11 }}>{s.name}</div>
                      <div style={{ color: '#888', fontSize: 10, marginTop: 2 }}>{s.function}</div>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', minWidth: 130, opacity: 0.35 }}>
                    <div style={{ height: 54 }} />
                    <div style={{ borderTop: `1.5px solid ${accentColor}`, paddingTop: 6 }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 11 }}>Vor- und Nachname</div>
                      <div style={{ color: '#888', fontSize: 10, marginTop: 2 }}>Funktion</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fußzeile */}
        <div style={{ background: design.footerBgColor || design.headerBgColor, padding: '10px 32px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {[design.senderName, design.senderAddress, design.senderPhone, design.senderEmail, design.senderWebsite]
            .filter(Boolean)
            .map((item, i) => (
              <span key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.04em' }}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>·</span>}
                {item}
              </span>
            ))}
          {![design.senderName, design.senderAddress, design.senderPhone, design.senderEmail].some(Boolean) && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Absender-Daten unter Design → Absender eintragen</span>
          )}
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// EINLADUNGS-TAB
// ════════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════════
// VERSENDEN-TAB — Email-Client Layout
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// TEXTVORLAGEN PANEL
// ════════════════════════════════════════════════════════════════════════════


export function TextvorlagenPanel({ templates, setTemplates, body, setBody, introText, setIntroText }: {
  templates: any[];
  setTemplates: (t: any[]) => void;
  body: string;
  setBody: (v: string) => void;
  introText: string;
  setIntroText: (v: string) => void;
}) {
  const [subTab, setSubTab] = useState<'letter' | 'invitation'>('letter');
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const letterTemplates = templates.filter(t => !t.type || t.type === 'letter');
  const invTemplates = templates.filter(t => t.type === 'invitation');
  const currentList = subTab === 'letter' ? letterTemplates : invTemplates;

  const saveTemplate = async () => {
    if (!editingTemplate?.name?.trim() || !editingTemplate?.body?.trim()) {
      toast.error('Name und Text sind Pflichtfelder');
      return;
    }
    setSaving(true);
    try {
      const data = { name: editingTemplate.name, body: editingTemplate.body, type: subTab, description: editingTemplate.description || '' };
      if (editingTemplate.id) {
        const res = await api.put(`/letter/templates/${editingTemplate.id}`, { ...editingTemplate, ...data });
        setTemplates(templates.map(t => t.id === editingTemplate.id ? res.data : t));
        toast.success('Vorlage aktualisiert');
      } else {
        const res = await api.post('/letter/templates', data);
        setTemplates([...templates, res.data]);
        toast.success('Vorlage erstellt');
      }
      setEditingTemplate(null);
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/letter/templates/${deleteId}`);
      setTemplates(templates.filter(t => t.id !== deleteId));
      toast.success('Vorlage gelöscht');
    } catch { toast.error('Fehler'); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const applyTemplate = (t: any) => {
    if (subTab === 'letter') {
      setBody(t.body);
      toast.success(`"${t.name}" in Brief eingefügt`);
    } else {
      setIntroText(t.body);
      toast.success(`"${t.name}" in Einladung eingefügt`);
    }
  };

  return (
    <div className="card overflow-hidden sticky top-4">
      <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-ink-muted" />
          <span className="text-sm font-medium">Textvorlagen</span>
        </div>
        <button onClick={() => setEditingTemplate({ name: '', body: '', type: subTab })}
          className="btn-primary text-xs py-1 px-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Neu
        </button>
      </div>

      {/* Sub-Tabs */}
      <div className="flex border-b border-surface-200">
        <button onClick={() => setSubTab('letter')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${subTab === 'letter' ? 'text-ink border-b-2 border-ink bg-white' : 'text-ink-muted bg-surface-50 hover:text-ink'}`}>
          Brief-Vorlagen ({letterTemplates.length})
        </button>
        <button onClick={() => setSubTab('invitation')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${subTab === 'invitation' ? 'text-ink border-b-2 border-ink bg-white' : 'text-ink-muted bg-surface-50 hover:text-ink'}`}>
          Einladungs-Vorlagen ({invTemplates.length})
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">

        {/* Lösch-Bestätigung */}
        {deleteId && (
          <div className="card p-3 border border-red-200 bg-red-50 space-y-2">
            <p className="text-xs font-medium text-red-800">Vorlage wirklich löschen?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary text-xs py-1 flex-1">Abbrechen</button>
              <button onClick={deleteTemplate} disabled={deleting}
                className="btn-primary text-xs py-1 flex-1 bg-red-600 hover:bg-red-700 flex items-center justify-center gap-1">
                {deleting ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Löschen
              </button>
            </div>
          </div>
        )}

        {/* Formular — neue/bestehende Vorlage bearbeiten */}
        {editingTemplate && (
          <div className="card p-3 space-y-2 border border-surface-300">
            <p className="text-xs font-semibold text-ink">
              {editingTemplate.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
            </p>
            <div>
              <label className="text-xs text-ink-muted block mb-1">Name *</label>
              <input value={editingTemplate.name}
                onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                placeholder="z.B. Standardbegrüßung, Antrag Fahrzeug..."
                className="input-field text-xs w-full" />
            </div>
            <div>
              <label className="text-xs text-ink-muted block mb-1">
                {subTab === 'letter' ? 'Brieftext *' : 'Einladungstext *'}
              </label>
              <textarea value={editingTemplate.body}
                onChange={e => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                placeholder={subTab === 'letter'
                  ? 'im Namen der Freiwilligen Feuerwehr...'
                  : 'Wir laden Sie herzlich zu unserer Veranstaltung ein...'}
                rows={6} className="input-field text-xs w-full" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingTemplate(null)} className="btn-secondary text-xs py-1.5 flex-1">Abbrechen</button>
              <button onClick={saveTemplate} disabled={saving}
                className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1.5">
                {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Speichern
              </button>
            </div>
          </div>
        )}

        {/* Liste */}
        {currentList.length === 0 && !editingTemplate && (
          <div className="text-center py-8 text-ink-muted">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              Noch keine {subTab === 'letter' ? 'Brief' : 'Einladungs'}-Vorlagen
            </p>
            <button onClick={() => setEditingTemplate({ name: '', body: '', type: subTab })}
              className="text-xs text-ink underline mt-2">Erste Vorlage erstellen</button>
          </div>
        )}

        {currentList.map(t => (
          <div key={t.id} className="border border-surface-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 flex items-center gap-2 bg-surface-50">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-ink truncate">{t.name}</div>
                <div className="text-xs text-ink-muted truncate">{t.body.slice(0, 50)}{t.body.length > 50 ? '…' : ''}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                  className="p-1.5 text-ink-muted hover:text-ink rounded-lg transition-colors" title="Vorschau">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => applyTemplate(t)}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="In Brief/Einladung einfügen">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingTemplate({ ...t })}
                  className="p-1.5 text-ink-muted hover:text-ink rounded-lg transition-colors" title="Bearbeiten">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteId(t.id)}
                  className="p-1.5 text-ink-muted hover:text-red-500 rounded-lg transition-colors" title="Löschen">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {previewId === t.id && (
              <div className="px-3 py-2.5 border-t border-surface-100 bg-white">
                <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">{t.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}




// ── Custom Design Dropdown ────────────────────────────────────────────────────
export function DesignDropdown({ designs, selectedId, onSelect, label, onCreateNew }: {
  designs: LetterDesign[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  onCreateNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = designs.find(d => d.id === selectedId);
  const systemDesigns = designs.filter((d: any) => d.isSystem);
  const userDesigns = designs.filter((d: any) => !d.isSystem);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm hover:border-surface-300 transition-colors"
      >
        {selected ? (
          <>
            <div className="w-4 h-4 rounded flex-shrink-0 border border-surface-200" style={{ background: (selected as any).headerBgColor }} />
            <span className="flex-1 text-left truncate font-medium">{selected.name}</span>
            {(selected as any).isSystem && <span className="text-xs text-ink-muted">System</span>}
          </>
        ) : (
          <span className="flex-1 text-left text-ink-muted">{label}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-surface-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {systemDesigns.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider bg-surface-50 border-b border-surface-100">
                  System
                </div>
                {systemDesigns.map(d => (
                  <button key={d.id} onClick={() => { onSelect(d.id); setOpen(false); }}
                    className={'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 transition-colors ' + (d.id === selectedId ? 'bg-fire-50 text-fire-700 font-medium' : 'text-ink')}>
                    <div className="w-4 h-4 rounded flex-shrink-0 border border-surface-200" style={{ background: (d as any).headerBgColor }} />
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </>
            )}
            {userDesigns.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider bg-surface-50 border-b border-surface-100 border-t border-surface-100">
                  Eigene
                </div>
                {userDesigns.map(d => (
                  <button key={d.id} onClick={() => { onSelect(d.id); setOpen(false); }}
                    className={'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 transition-colors ' + (d.id === selectedId ? 'bg-fire-50 text-fire-700 font-medium' : 'text-ink')}>
                    <div className="w-4 h-4 rounded flex-shrink-0 border border-surface-200" style={{ background: (d as any).headerBgColor }} />
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
          {onCreateNew && (
            <div className="border-t border-surface-200">
              <button onClick={() => { onCreateNew(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-muted hover:bg-surface-50 transition-colors">
                <Plus className="w-4 h-4" />
                <span>Neues Design erstellen</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DesignEditor({ design, onChange, onUpload }: {
  design: any;
  onChange: (field: string, value: any) => void;
  onUpload?: (field: string, file: File) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Briefkopf */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Briefkopf</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted block mb-1">Hintergrundfarbe</label>
            <div className="flex items-center gap-2">
              <input type="color" value={design.headerBgColor || '#8B1A1A'}
                onChange={e => onChange('headerBgColor', e.target.value)}
                className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5" />
              <span className="text-xs text-ink-muted font-mono">{design.headerBgColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-muted block mb-1">Titelfarbe</label>
            <div className="flex items-center gap-2">
              <input type="color" value={design.headerTitleColor || '#ffffff'}
                onChange={e => onChange('headerTitleColor', e.target.value)}
                className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5" />
              <span className="text-xs text-ink-muted font-mono">{design.headerTitleColor}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-ink-muted block mb-1">Titel</label>
          <input value={design.headerTitle || ''} onChange={e => onChange('headerTitle', e.target.value)}
            placeholder="z.B. Freiwillige Feuerwehr Görtschach" className="input-field w-full text-sm" />
        </div>
        <div className="mt-2">
          <label className="text-xs text-ink-muted block mb-1">Untertitel</label>
          <input value={design.headerSubtitle || ''} onChange={e => onChange('headerSubtitle', e.target.value)}
            placeholder="z.B. im Gailtal" className="input-field w-full text-sm" />
        </div>
        <div className="mt-2">
          <label className="text-xs text-ink-muted block mb-1">Titelgröße</label>
          <input type="number" min={10} max={32} value={design.headerTitleSize || 16}
            onChange={e => onChange('headerTitleSize', parseInt(e.target.value))}
            className="input-field w-24 text-sm" />
        </div>
      </div>

      {/* Akzentfarbe */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Farben</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted block mb-1">Akzentfarbe</label>
            <div className="flex items-center gap-2">
              <input type="color" value={design.accentColor || '#8B1A1A'}
                onChange={e => onChange('accentColor', e.target.value)}
                className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5" />
              <span className="text-xs text-ink-muted font-mono">{design.accentColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-muted block mb-1">Fußzeile</label>
            <div className="flex items-center gap-2">
              <input type="color" value={design.footerBgColor || design.headerBgColor || '#8B1A1A'}
                onChange={e => onChange('footerBgColor', e.target.value)}
                className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Typografie */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Typografie</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted block mb-1">Schriftart</label>
            <select value={design.fontFamily || 'Arial'} onChange={e => onChange('fontFamily', e.target.value)}
              className="input-field w-full text-sm">
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Garamond">Garamond</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-muted block mb-1">Schriftgröße</label>
            <input type="number" min={10} max={16} value={design.fontSize || 12}
              onChange={e => onChange('fontSize', parseInt(e.target.value))}
              className="input-field w-full text-sm" />
          </div>
        </div>
      </div>

      {/* Absender */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Absender</p>
        <div className="space-y-2">
          <input value={design.senderName || ''} onChange={e => onChange('senderName', e.target.value)}
            placeholder="Name / Organisation" className="input-field w-full text-sm" />
          <input value={design.senderCity || ''} onChange={e => onChange('senderCity', e.target.value)}
            placeholder="Ort (für Datum-Zeile, z.B. Görtschach)" className="input-field w-full text-sm" />
          <input value={design.senderAddress || ''} onChange={e => onChange('senderAddress', e.target.value)}
            placeholder="Adresse" className="input-field w-full text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={design.senderPhone || ''} onChange={e => onChange('senderPhone', e.target.value)}
              placeholder="Telefon" className="input-field text-sm" />
            <input value={design.senderEmail || ''} onChange={e => onChange('senderEmail', e.target.value)}
              placeholder="E-Mail" className="input-field text-sm" />
          </div>
          <input value={design.senderWebsite || ''} onChange={e => onChange('senderWebsite', e.target.value)}
            placeholder="Website" className="input-field w-full text-sm" />
          <input value={design.senderLineText || ''} onChange={e => onChange('senderLineText', e.target.value)}
            placeholder="Absenderzeile (z.B. FF Görtschach im Gailtal)" className="input-field w-full text-sm" />
        </div>
      </div>

      {/* Logo & Bilder */}
      {onUpload && (
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Logo &amp; Bilder</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-ink-muted block mb-1">Logo-Position</label>
              <select value={design.headerLogoPosition || 'both'} onChange={e => onChange('headerLogoPosition', e.target.value)}
                className="input-field text-sm w-full">
                <option value="left">Links</option>
                <option value="center">Mitte</option>
                <option value="right">Rechts</option>
                <option value="both">Links + Rechts</option>
                <option value="none">Kein Logo</option>
              </select>
            </div>
            {['left', 'both'].includes(design.headerLogoPosition || 'both') && (
              <div>
                <label className="text-xs text-ink-muted block mb-1">Logo Links</label>
                <div className="flex items-center gap-2">
                  {design.headerLogoLeft && <img src={design.headerLogoLeft} alt="" className="w-10 h-10 object-contain rounded border border-surface-200" />}
                  <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload('headerLogoLeft', e.target.files[0])} />
                  </label>
                  {design.headerLogoLeft && (
                    <button onClick={() => onChange('headerLogoLeft', undefined)}
                      className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted" title="Entfernen">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {['right', 'both'].includes(design.headerLogoPosition || 'both') && (
              <div>
                <label className="text-xs text-ink-muted block mb-1">Logo Rechts</label>
                <div className="flex items-center gap-2">
                  {design.headerLogoRight && <img src={design.headerLogoRight} alt="" className="w-10 h-10 object-contain rounded border border-surface-200" />}
                  <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload('headerLogoRight', e.target.files[0])} />
                  </label>
                  {design.headerLogoRight && (
                    <button onClick={() => onChange('headerLogoRight', undefined)}
                      className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted" title="Entfernen">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {design.headerLogoPosition === 'center' && (
              <div>
                <label className="text-xs text-ink-muted block mb-1">Logo Mitte</label>
                <div className="flex items-center gap-2">
                  {design.headerLogoCenter && <img src={design.headerLogoCenter} alt="" className="w-10 h-10 object-contain rounded border border-surface-200" />}
                  <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload('headerLogoCenter', e.target.files[0])} />
                  </label>
                  {design.headerLogoCenter && (
                    <button onClick={() => onChange('headerLogoCenter', undefined)}
                      className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted" title="Entfernen">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-ink-muted block mb-1">Hintergrundbild Header</label>
              <div className="flex items-center gap-2">
                {design.headerBgImage && <img src={design.headerBgImage} alt="" className="w-16 h-10 object-cover rounded border border-surface-200" />}
                <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload('headerBgImage', e.target.files[0])} />
                </label>
                {design.headerBgImage && (
                  <button onClick={() => onChange('headerBgImage', undefined)}
                    className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted" title="Entfernen">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layout */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Layout</p>
        <div>
          <label className="text-xs text-ink-muted block mb-1">Unterzeichner-Position</label>
          <select value={design.signerPosition || 'right'} onChange={e => onChange('signerPosition', e.target.value)}
            className="input-field w-full text-sm">
            <option value="right">Rechts</option>
            <option value="center">Mitte</option>
            <option value="left">Links</option>
          </select>
        </div>
      </div>
    </div>
  );
}
