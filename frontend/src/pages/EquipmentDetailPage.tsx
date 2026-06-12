import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Plus, Shield, Wrench, AlertTriangle, Package, ChevronRight, CheckCircle, XCircle, Clock, Flame, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { equipmentApi } from '../api';
import api from '../api';
import { INCIDENT_TYPE_LABELS } from '../types';

type Tab = 'checks' | 'repairs' | 'defects' | 'loans';

function fmtDate(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('de-AT'); }
function fmtDateTime(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleString('de-AT'); }
function fmtCost(n?: number | null) { if (!n) return '—'; return n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }); }

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'OK': 'bg-emerald-100 text-emerald-700',
    'Mangel': 'bg-amber-100 text-amber-700',
    'Außer Betrieb': 'bg-red-100 text-red-700',
    'Gemeldet': 'bg-red-100 text-red-700',
    'In Reparatur': 'bg-amber-100 text-amber-700',
    'Behoben': 'bg-emerald-100 text-emerald-700',
    'Abgeschlossen': 'bg-emerald-100 text-emerald-700',
    'In Bearbeitung': 'bg-amber-100 text-amber-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-surface-100 text-ink-muted'}`}>{status}</span>;
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('checks');
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    try {
      const e = await equipmentApi.get(id);
      setEquipment(e);
      // Verwendungshistorie laden
      try {
        const [incRes, evRes] = await Promise.all([
          api.get(`/equipment/${id}/usage`).catch(() => ({ data: [] })),
          api.get(`/equipment/${id}/events`).catch(() => ({ data: [] })),
        ]);
        setUsageHistory([
          ...(incRes.data || []).map((u: any) => ({ ...u, entityType: 'incident' })),
          ...(evRes.data || []).map((u: any) => ({ ...u, entityType: 'event' })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch {}
    } catch { toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleDelete = async () => {
    if (!confirm('Gerät und alle Einträge löschen?')) return;
    await equipmentApi.delete(id!);
    toast.success('Gerät gelöscht');
    navigate('/equipment');
  };

  const handleDefectStatus = async (defectId: string, status: string) => {
    await equipmentApi.updateDefect(defectId, { status });
    load();
    toast.success('Status aktualisiert');
  };

  const handleReturn = async (loanId: string) => {
    await equipmentApi.returnLoan(loanId);
    load();
    toast.success('Rückgabe eingetragen');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;
  if (!equipment) return <div className="p-6"><p className="text-ink-muted">Gerät nicht gefunden.</p></div>;

  const openDefects = equipment.defects?.filter((d: any) => d.status !== 'Behoben') || [];
  const activeLoan = equipment.loans?.find((l: any) => !l.returnedAt);
  const daysUntilCheck = equipment.nextCheckDate
    ? Math.ceil((new Date(equipment.nextCheckDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/equipment')} className="text-ink-muted hover:text-ink"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate" style={{ fontFamily: 'var(--font-headings)' }}>{equipment.name}</h1>
          <p className="text-sm text-ink-muted">{equipment.category || equipment.customCategory || 'Gerät'}{equipment.location ? ` · 📍 ${equipment.location}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/equipment/${id}/edit`)} className="btn-secondary flex items-center gap-1.5"><Edit className="w-4 h-4" /><span className="hidden sm:inline"> Bearbeiten</span></button>
          <button onClick={handleDelete} className="btn-danger p-2.5"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Info Card */}
      <div className="card">
        <div className="flex gap-6 flex-wrap">
          {equipment.photoUrl && (
            <div className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0">
              <img src={equipment.photoUrl} alt={equipment.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Status', value: equipment.isActive ? '✅ Aktiv' : '❌ Inaktiv' },
                { label: 'Seriennummer', value: equipment.serialNumber || '—' },
                { label: 'Hersteller', value: equipment.manufacturer || '—' },
                { label: 'Anschaffung', value: fmtDate(equipment.purchaseDate) },
                { label: 'Preis', value: fmtCost(equipment.purchasePrice) },
                { label: 'Prüfintervall', value: equipment.checkInterval || '—' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-xs text-ink-muted uppercase tracking-wider font-semibold">{item.label}</p>
                  <p className="font-semibold text-ink mt-0.5 text-sm">{item.value}</p>
                </div>
              ))}
            </div>
            {equipment.notes && <p className="text-sm text-ink-muted mt-3 italic">{equipment.notes}</p>}
          </div>
        </div>

        {/* Warnungen */}
        <div className="mt-4 space-y-2">
          {daysUntilCheck !== null && (
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${
              daysUntilCheck <= 0 ? 'bg-red-50 text-red-700' :
              daysUntilCheck <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{daysUntilCheck <= 0 ? '🚨 Prüfung überfällig!' : daysUntilCheck <= 30 ? `⚠ Prüfung in ${daysUntilCheck} Tagen fällig` : `✓ Nächste Prüfung: ${fmtDate(equipment.nextCheckDate)}`}</span>
            </div>
          )}
          {openDefects.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{openDefects.length} offener Defekt{openDefects.length > 1 ? 'e' : ''} gemeldet</span>
            </div>
          )}
          {activeLoan && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm bg-blue-50 text-blue-700">
              <Package className="w-4 h-4 flex-shrink-0" />
              <span>Ausgegeben an <strong>{activeLoan.borrowedByName}</strong> seit {fmtDate(activeLoan.borrowedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-surface-100 p-1 rounded-xl">
          {[
            { id: 'checks', label: 'Prüfungen', icon: Shield, count: equipment.checks?.length },
            { id: 'repairs', label: 'Reparaturen', icon: Wrench, count: equipment.repairs?.length },
            { id: 'defects', label: 'Defekte', icon: AlertTriangle, count: openDefects.length, alert: openDefects.length > 0 },
            { id: 'loans', label: 'Ausgaben', icon: Package, count: equipment.loans?.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              <t.icon className={`w-4 h-4 ${t.alert ? 'text-red-500' : ''}`} />
              {t.label}
              {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.alert ? 'bg-red-100 text-red-700' : 'bg-surface-200'}`}>{t.count}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => navigate(`/equipment/${id}/${tab}/new`)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {tab === 'checks' ? 'Prüfung eintragen' : tab === 'repairs' ? 'Reparatur' : tab === 'defects' ? 'Defekt melden' : 'Ausgabe'}
        </button>
      </div>

      {/* ── Prüfungen ── */}
      {tab === 'checks' && (
        <div className="space-y-3">
          {!equipment.checks?.length ? (
            <div className="card text-center py-10"><Shield className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Noch keine Prüfungen</p></div>
          ) : equipment.checks.map((c: any) => (
            <div key={c.id} className="card flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.result === 'OK' ? 'bg-emerald-50' : c.result === 'Mangel' ? 'bg-amber-50' : 'bg-red-50'}`}>
                {c.result === 'OK' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{fmtDate(c.date)}</span>
                  <StatusBadge status={c.result} />
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {c.checkedByName && `Geprüft von: ${c.checkedByName}`}
                  {c.nextCheckDate && ` · Nächste: ${fmtDate(c.nextCheckDate)}`}
                </p>
                {c.notes && <p className="text-xs text-ink-faint italic mt-0.5">{c.notes}</p>}
                <p className="text-xs text-ink-faint mt-1">Eingetragen von: <strong>{c.createdByName}</strong> · {fmtDateTime(c.createdAt)}</p>
              </div>
              <button onClick={async () => { if (!confirm('Prüfung löschen?')) return; await equipmentApi.deleteCheck(c.id); load(); }}
                className="p-2 hover:bg-red-50 rounded-lg flex-shrink-0"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Reparaturen ── */}
      {tab === 'repairs' && (
        <div className="space-y-3">
          {!equipment.repairs?.length ? (
            <div className="card text-center py-10"><Wrench className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Noch keine Reparaturen</p></div>
          ) : equipment.repairs.map((r: any) => (
            <div key={r.id} className="card flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{r.description}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {fmtDate(r.date)}
                  {r.performedBy && ` · ${r.performedBy}`}
                  {r.cost && ` · ${fmtCost(r.cost)}`}
                </p>
                {r.notes && <p className="text-xs text-ink-faint italic mt-0.5">{r.notes}</p>}
                <p className="text-xs text-ink-faint mt-1">Eingetragen von: <strong>{r.createdByName}</strong> · {fmtDateTime(r.createdAt)}</p>
              </div>
              <button onClick={async () => { if (!confirm('Reparatur löschen?')) return; await equipmentApi.deleteRepair(r.id); load(); }}
                className="p-2 hover:bg-red-50 rounded-lg flex-shrink-0"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Defekte ── */}
      {tab === 'defects' && (
        <div className="space-y-3">
          {!equipment.defects?.length ? (
            <div className="card text-center py-10"><AlertTriangle className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Keine Defekte gemeldet</p></div>
          ) : equipment.defects.map((d: any) => (
            <div key={d.id} className="card flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${d.status === 'Behoben' ? 'bg-emerald-50' : d.status === 'In Reparatur' ? 'bg-amber-50' : 'bg-red-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${d.status === 'Behoben' ? 'text-emerald-600' : d.status === 'In Reparatur' ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{d.description}</span>
                  <StatusBadge status={d.status} />
                </div>
                {d.notes && <p className="text-xs text-ink-faint italic mt-0.5">{d.notes}</p>}
                <p className="text-xs text-ink-faint mt-1">Gemeldet von: <strong>{d.reportedByName}</strong> · {fmtDateTime(d.createdAt)}</p>
                {d.status !== 'Behoben' && (
                  <div className="flex gap-2 mt-2">
                    {d.status === 'Gemeldet' && <button onClick={() => handleDefectStatus(d.id, 'In Reparatur')} className="text-xs btn-secondary px-3 py-1.5">In Reparatur setzen</button>}
                    <button onClick={() => handleDefectStatus(d.id, 'Behoben')} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-medium">Als behoben markieren</button>
                  </div>
                )}
              </div>
              <button onClick={async () => { if (!confirm('Defekt löschen?')) return; await equipmentApi.deleteDefect(d.id); load(); }}
                className="p-2 hover:bg-red-50 rounded-lg flex-shrink-0"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Ausgaben ── */}
      {tab === 'loans' && (
        <div className="space-y-3">
          {!equipment.loans?.length ? (
            <div className="card text-center py-10"><Package className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Keine Ausgaben</p></div>
          ) : equipment.loans.map((l: any) => (
            <div key={l.id} className="card flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!l.returnedAt ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                <Package className={`w-5 h-5 ${!l.returnedAt ? 'text-blue-600' : 'text-emerald-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{l.borrowedByName}</span>
                  <StatusBadge status={l.returnedAt ? 'Zurückgegeben' : 'Ausgegeben'} />
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Ausgegeben: {fmtDate(l.borrowedAt)}
                  {l.expectedReturn && ` · Geplante Rückgabe: ${fmtDate(l.expectedReturn)}`}
                  {l.returnedAt && ` · Zurückgegeben: ${fmtDate(l.returnedAt)}`}
                </p>
                {l.notes && <p className="text-xs text-ink-faint italic mt-0.5">{l.notes}</p>}
                <p className="text-xs text-ink-faint mt-1">Eingetragen von: <strong>{l.createdByName}</strong></p>
                {!l.returnedAt && (
                  <button onClick={() => handleReturn(l.id)} className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-medium">
                    Rückgabe eintragen
                  </button>
                )}
              </div>
              <button onClick={async () => { if (!confirm('Ausgabe löschen?')) return; await equipmentApi.deleteLoan(l.id); load(); }}
                className="p-2 hover:bg-red-50 rounded-lg flex-shrink-0"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Verwendungshistorie */}
      {usageHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-muted" /> Verwendungshistorie ({usageHistory.length})
            </h2>
          </div>
          <div className="divide-y divide-surface-100">
            {usageHistory.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${u.entityType === 'incident' ? 'bg-red-50' : 'bg-blue-50'}`}>
                  {u.entityType === 'incident'
                    ? <Flame className="w-4 h-4 text-red-600" />
                    : <Calendar className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-base truncate">
                    {u.entityType === 'incident'
                      ? (u.incident?.title || INCIDENT_TYPE_LABELS[u.incident?.type as keyof typeof INCIDENT_TYPE_LABELS] || 'Einsatz')
                      : (u.event?.title || 'Übung')}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {u.entityType === 'incident'
                      ? (INCIDENT_TYPE_LABELS[u.incident?.type as keyof typeof INCIDENT_TYPE_LABELS] || u.incident?.type || 'Einsatz')
                      : (u.event?.type || 'Übung')} ·{' '}
                    {u.durationMin ? `${u.durationMin} Minuten` : (u.hoursUsed || u.minutesUsed ? `${(u.hoursUsed||0)*60+(u.minutesUsed||0)} Minuten` : 'Dauer nicht erfasst')}
                  </p>
                </div>
                <span className="text-xs text-ink-subtle">
                  {new Date(u.createdAt).toLocaleDateString('de-AT')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
