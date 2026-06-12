import React from 'react';
import { Save, X, FileText, Trash2, Eye, Loader, RefreshCw, Check, Plus } from 'lucide-react';
import DiktatButton from '../components/DiktatButton';

export function InvitationTabBottom(props) {
  const {
    invDraftDirty, invDrafts, currentInvDraftId, invDraftName, setInvDraftName,
    showInvDraftList, setShowInvDraftList, invKiPrompt, setInvKiPrompt,
    invKiRunning, invKiStreamText, invSelectedTemplate, allTemplates,
    userDesigns, selectedDesignId, design, introText, setIntroText,
    eventName, setEventName, eventDate, setEventDate, eventTime, setEventTime,
    eventLocation, setEventLocation, eventProgram, setEventProgram,
    rsvpDeadline, setRsvpDeadline, directions, setDirections,
    closing, setClosing, recipientName, setRecipientName,
    recipientAddress, setRecipientAddress, selectedSignerIds, setSelectedSignerIds,
    availableSigners, sendMode, setSendMode, sending, sendResult,
    recipients, setRecipients, historyEntries, showHistoryPreview,
    historyPreviewHtml, historyPreviewLoading, deleteId, setDeleteId,
    invPreviewLoading, invShowSaveTemplate, setInvShowSaveTemplate,
    invTemplateName, setInvTemplateName, invSavingTemplate,
    saveInvDraft, loadInvDraft, deleteInvDraft, generateInvWithKi,
    previewInvPdf, loadInvTemplate, saveInvTemplate, deleteInvTemplate,
    sendInvitation, toggleHistoryEntry, deleteEntry, switchDesign,
    date, signaturePreview, setInvDirty,
  } = props;

  return (
    <>

            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-ink uppercase tracking-wide">Veranstaltung</p>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Veranstaltungsname *</label>
                <input value={eventName} onChange={e => { setEventName(e.target.value); setInvDirty(true); }} placeholder="z.B. Jahreshauptversammlung 2026" className="input-field w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Datum</label>
                  <input value={eventDate} onChange={e => { setEventDate(e.target.value); setInvDirty(true); }} placeholder="z.B. Samstag, 15. März 2026" className="input-field w-full" />
                </div>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Uhrzeit</label>
                  <input value={eventTime} onChange={e => { setEventTime(e.target.value); setInvDirty(true); }} placeholder="z.B. 19:00 Uhr" className="input-field w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Ort / Treffpunkt</label>
                <input value={eventLocation} onChange={e => { setEventLocation(e.target.value); setInvDirty(true); }} placeholder="z.B. Feuerwehrhaus Görtschach" className="input-field w-full" />
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Programmpunkte</label>
                <textarea value={eventProgram} onChange={e => { setEventProgram(e.target.value); setInvDirty(true); }} placeholder="z.B. 1. Begrüßung&#10;2. Jahresbericht&#10;3. Ehrungen" className="input-field w-full" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Anmeldeschluss</label>
                  <input value={rsvpDeadline} onChange={e => { setRsvpDeadline(e.target.value); setInvDirty(true); }} placeholder="z.B. 10. März 2026" className="input-field w-full" />
                </div>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">Briefdatum</label>
                  <input value={date} onChange={e => setDate(e.target.value)} className="input-field w-full" />
                </div>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-ink uppercase tracking-wide">Einladungstext</p>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-ink-muted">Einleitungstext</label>
                </div>
                <textarea value={introText} onChange={e => { setIntroText(e.target.value); setInvDirty(true); }} placeholder="z.B. Wir laden Sie herzlich zu unserer Jahreshauptversammlung ein..." className="input-field w-full" rows={4} />

                <div className="bg-surface-50 rounded-xl border border-surface-200 p-3 space-y-2 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">🤖 KI-Assistent</span>
                    {invKiRunning && <span className="text-xs text-fire-600 flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> schreibt...</span>}
                  </div>
                  {invKiStreamText && (
                    <div className="bg-ink rounded-lg p-2 text-xs text-gray-300 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {invKiStreamText}<span className="animate-pulse">▍</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={invKiPrompt}
                      onChange={e => setInvKiPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !invKiRunning) generateInvWithKi(invKiPrompt); }}
                      placeholder="z.B. 'Lade herzlich zur Jahreshauptversammlung ein, betone die Wichtigkeit der Teilnahme'"
                      className="input-field text-xs flex-1 py-1.5"
                      disabled={invKiRunning} />
                    <button onClick={() => generateInvWithKi(invKiPrompt)} disabled={invKiRunning || !invKiPrompt.trim()}
                      className="flex items-center gap-1.5 text-xs text-fire-700 font-medium px-3 py-1.5 rounded-lg hover:bg-fire-50 border border-fire-200 disabled:opacity-50 whitespace-nowrap">
                      {invKiRunning ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Generieren
                    </button>
                  </div>
                  {introText && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-surface-200">
                      <span className="text-xs text-ink-muted self-center">Text:</span>
                      {['Kürzer fassen', 'Länger ausführen', 'Förmlicher', 'Persönlicher', 'Neu schreiben'].map(btn => (
                        <button key={btn} type="button" onClick={() => generateInvWithKi(btn)} disabled={invKiRunning}
                          className="text-xs px-2.5 py-1 rounded-lg border border-surface-300 bg-white hover:bg-fire-50 hover:text-fire-700 disabled:opacity-40 text-ink-muted">
                          {btn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Anreise-Hinweis</label>
                <textarea value={directions} onChange={e => { setDirections(e.target.value); setInvDirty(true); }} placeholder="z.B. Parkplätze vorhanden, Bushaltestelle 200m entfernt" className="input-field w-full" rows={2} />
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Grußformel</label>
                <input value={closing} onChange={e => { setClosing(e.target.value); setInvDirty(true); }} className="input-field w-full" />
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-ink uppercase tracking-wide">Empfänger (Vorschau)</p>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Name / Anschrift</label>
                <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Bürgermeister Franz Muster" className="input-field w-full" />
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-1">Adresse</label>
                <textarea value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} placeholder="Hauptstraße 1&#10;9620 Hermagor" className="input-field w-full" rows={2} />
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-ink uppercase tracking-wide">Unterzeichner</p>
              {availableSigners.map(s => (
                <label key={s.userId} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedSignerIds.includes(s.userId)}
                    onChange={e => { const v=e.target.checked; setSelectedSignerIds(p => v ? [...p,s.userId] : p.filter(i => i!==s.userId)); }}
                    className="rounded" />
                  <span className="text-sm">{s.name}</span>
                  <span className="text-xs text-ink-muted">{s.function}</span>
                </label>
              ))}
            </div>
  </>
  );
}

