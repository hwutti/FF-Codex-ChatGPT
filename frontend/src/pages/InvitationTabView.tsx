import React from 'react';
import { InvitationTabBottom } from './InvitationTabBottom.jsx';
import { Save, X, FileText, Trash2, Eye, Loader, RefreshCw, Check, Plus, ChevronDown } from 'lucide-react';
import DiktatButton from '../components/DiktatButton';
import type { LetterDesign, Signer } from './schriftverkehr.types';

export function InvitationTabView(props: any) {
  const {
    invDraftDirty, invDrafts, currentInvDraftId, invDraftName, setInvDraftName, setInvDraftDirty,
    showInvDraftList, setShowInvDraftList, setCurrentInvDraftId, invKiPrompt, setInvKiPrompt,
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
    saveInvDraft, loadInvDraft, deleteInvDraft, generateInvWithKi, savingInvDraft,
    manualEmail, setManualEmail, showMemberList, setShowMemberList,
    memberFilter, setMemberFilter, members, companionText, setCompanionText,
    expandedId, setExpandedId, previewHtmlMap, previewLoadingId,
    deleting, setDeleting, selectedYear, setSelectedYear,
    previewInvPdf, loadInvTemplate, saveInvTemplate, deleteInvTemplate,
    sendInvitation, toggleHistoryEntry, deleteEntry, switchDesign,
    date, signaturePreview, setInvDirty,
  } = props;

  return (
    <div className="space-y-4">

            {/* Versandbereit-Bar — gleich wie Brief-Tab */}
            <div className={`card border-l-4 ${invDraftDirty ? 'border-l-amber-400' : currentInvDraftId ? 'border-l-emerald-400' : 'border-l-slate-300'}`}>
              {/* Haupt-Zeile */}
              <div className={`p-4 flex items-center gap-3 ${invDraftDirty ? 'bg-amber-50/50' : currentInvDraftId ? 'bg-emerald-50/30' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={invDraftName}
                      onChange={e => { setInvDraftName(e.target.value); setInvDraftDirty(true); }}
                      placeholder={currentInvDraftId ? 'Name der Einladung...' : 'Neue Einladung benennen...'}
                      className="text-sm font-bold text-ink bg-transparent border-none outline-none min-w-0 flex-1 placeholder-ink-faint"
                    />
                    {invDraftDirty && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">● Ungespeicherte Änderungen</span>}
                    {currentInvDraftId && !invDraftDirty && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">✓ Gespeichert</span>}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {currentInvDraftId
                      ? `„${invDraftName || 'Unbenannt'}" — Änderungen speichern damit der Versenden-Tab aktuell ist.`
                      : 'Hier speichern → im Versenden-Tab an Empfänger schicken.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={saveInvDraft} disabled={savingInvDraft}
                    className={`flex items-center gap-2 py-2 px-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${invDraftDirty ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm' : currentInvDraftId ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    {savingInvDraft ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {currentInvDraftId ? 'Aktualisieren' : 'Speichern'}
                  </button>
                  {currentInvDraftId && (
                    <button onClick={() => { setCurrentInvDraftId(null); setInvDraftDirty(false); setInvDraftName(''); }}
                      className="p-2 text-ink-muted hover:text-red-500 rounded-lg flex-shrink-0" title="Neue Einladung (aktuellen Entwurf schließen)">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Gespeicherte Einladungen — aufklappbar */}
              {invDrafts.length > 0 && (
                <div className="border-t border-surface-200">
                  <button onClick={() => setShowInvDraftList((v: boolean) => !v)}
                    className="w-full px-4 py-2 flex items-center gap-2 text-xs text-ink-muted hover:bg-surface-50 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-600">{invDrafts.length} gespeicherte{invDrafts.length !== 1 ? ' Einladungen' : ' Einladung'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${showInvDraftList ? 'rotate-180' : ''}`} />
                  </button>
                  {showInvDraftList && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {invDrafts.map((d: any) => (
                        <div key={d.id} className="flex items-center gap-2 p-2.5 hover:bg-surface-50 rounded-lg group cursor-pointer border border-surface-100">
                          <button onClick={() => loadInvDraft(d)} className="flex-1 text-left min-w-0 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink truncate">{d.title}</div>
                              <div className="text-xs text-ink-muted flex items-center gap-2">
                                <span>{new Date(d.updatedAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                {d.sendCount > 0 && <span className="text-emerald-600 font-medium">✓ {d.sendCount}x versendet</span>}
                              </div>
                            </div>
                          </button>
                          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); deleteInvDraft(d.id); }}
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

            <div className="card p-4 space-y-3">

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Design</span>
                {userDesigns.length === 0 ? (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50">
                    <span className="text-xs text-amber-700">Noch kein eigenes Design — erst im Tab "Design &amp; Vorlagen" ein eigenes erstellen.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <select value={userDesigns.find((d: any) => d.id === selectedDesignId) ? selectedDesignId : ''}
                      onChange={e => e.target.value && switchDesign(e.target.value)}
                      className="input-field flex-1 text-sm">
                      <option value="">Eigenes Design wählen...</option>
                      {userDesigns.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {design && userDesigns.find((d: any) => d.id === selectedDesignId) && (
                      <div className="w-5 h-5 rounded border border-surface-200 flex-shrink-0"
                        style={{ background: design.headerBgColor }} />
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Vorlage</span>
                <select value={invSelectedTemplate} onChange={e => loadInvTemplate(e.target.value)}
                  className="input-field flex-1 min-w-[180px] text-sm">
                  <option value="">Textvorlage laden...</option>
                  {allTemplates.filter((t: any) => t.type === 'invitation').map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {invSelectedTemplate && (
                  <button onClick={() => deleteInvTemplate(invSelectedTemplate)}
                    className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-ink-muted"
                    title="Vorlage löschen">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setInvShowSaveTemplate(true); setInvTemplateName(allTemplates.find((t: any) => t.id === invSelectedTemplate)?.name || ''); }}
                  className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Save className="w-4 h-4" />
                  Speichern
                </button>
                <button onClick={previewInvPdf} disabled={invPreviewLoading}
                  className="btn-secondary flex items-center gap-1.5 text-sm">
                  {invPreviewLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  PDF
                </button>
              </div>

              {invShowSaveTemplate && (
                <div className="rounded-xl p-4 border border-fire-200 bg-fire-50 space-y-3">
                  <p className="text-sm font-medium text-ink">Vorlage speichern unter:</p>
                  <div className="flex gap-2">
                    <input type="text" value={invTemplateName} onChange={e => setInvTemplateName(e.target.value)}
                      placeholder="Name der Vorlage..." className="input-field flex-1 text-sm"
                      onKeyDown={e => e.key === 'Enter' && saveInvTemplate()} autoFocus />
                    <button onClick={saveInvTemplate} disabled={invSavingTemplate} className="btn-primary text-sm">
                      {invSavingTemplate ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setInvShowSaveTemplate(false)} className="btn-secondary text-sm">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
    <InvitationTabBottom {...props} />
    </div>
  );
}

