import React, { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Shield, Wrench, AlertTriangle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { equipmentApi } from '../api';

// Eine Seite für alle 4 Eintragstypen
export default function EquipmentEntryFormPage() {
  const { id, type } = useParams<{ id: string; type: string }>();
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Prüfung
  const [checkForm, setCheckForm] = useState({ date: new Date().toISOString().split('T')[0], result: 'OK', checkedByName: '', nextCheckDate: '', notes: '' });
  // Reparatur
  const [repairForm, setRepairForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', performedBy: '', cost: '', status: 'Abgeschlossen', notes: '' });
  // Defekt
  const [defectForm, setDefectForm] = useState({ description: '', notes: '' });
  // Ausgabe
  const [loanForm, setLoanForm] = useState({ borrowedByName: '', expectedReturn: '', notes: '' });

  useEffect(() => {
    if (!id) return;
    equipmentApi.get(id)
      .then(e => setEquipment(e))
      .catch(() => { toast.error('Gerät nicht gefunden'); navigate('/equipment'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (type === 'checks') {
        await equipmentApi.createCheck({ ...checkForm, equipmentId: id });
        toast.success('Prüfung eingetragen');
      } else if (type === 'repairs') {
        await equipmentApi.createRepair({ ...repairForm, equipmentId: id });
        toast.success('Reparatur eingetragen');
      } else if (type === 'defects') {
        await equipmentApi.createDefect({ ...defectForm, equipmentId: id });
        toast.success('Defekt gemeldet');
      } else if (type === 'loans') {
        await equipmentApi.createLoan({ ...loanForm, equipmentId: id });
        toast.success('Ausgabe eingetragen');
      }
      navigate(`/equipment/${id}`);
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const config: Record<string, { label: string; icon: any; color: string }> = {
    checks: { label: 'Prüfung eintragen', icon: Shield, color: 'text-emerald-600' },
    repairs: { label: 'Reparatur eintragen', icon: Wrench, color: 'text-purple-600' },
    defects: { label: 'Defekt melden', icon: AlertTriangle, color: 'text-red-600' },
    loans: { label: 'Ausgabe eintragen', icon: Package, color: 'text-blue-600' },
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  const cfg = config[type || ''] || config.checks;
  const Icon = cfg.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/equipment/${id}`)} className="text-ink-muted hover:text-ink"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${cfg.color}`} />
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{cfg.label}</h1>
            {equipment && <p className="text-sm text-ink-muted">{equipment.name}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Prüfung ── */}
        {type === 'checks' && (
          <div className="card space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
                <input className="input-field" type="date" value={checkForm.date} onChange={e => setCheckForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Ergebnis *</label>
                <select className="input-field" value={checkForm.result} onChange={e => setCheckForm(f => ({ ...f, result: e.target.value }))} required>
                  <option value="OK">✅ OK</option>
                  <option value="Mangel">⚠ Mangel</option>
                  <option value="Außer Betrieb">❌ Außer Betrieb</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Geprüft von</label>
                <div className="flex gap-2 items-center">
                  <input className="input-field" value={checkForm.checkedByName} onChange={e => setCheckForm(f => ({ ...f, checkedByName: e.target.value }))} placeholder="Name des Prüfers" />
                  <DiktatButton onResult={text => setCheckForm(f => ({ ...f, checkedByName: text }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Nächste Prüfung fällig</label>
                <input className="input-field" type="date" value={checkForm.nextCheckDate} onChange={e => setCheckForm(f => ({ ...f, nextCheckDate: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
                <div className="flex gap-2 items-center">
                  <textarea className="input-field" rows={3} value={checkForm.notes} onChange={e => setCheckForm(f => ({ ...f, notes: e.target.value }))} placeholder="Befunde, Mängel, Besonderheiten..." />
                  <DiktatButton onResult={text => setCheckForm(f => ({ ...f, notes: text }))} />
                </div>
              </div>
            </div>
            <div className="bg-surface-50 rounded-xl p-3 text-xs text-ink-muted">
              ℹ Dein Name wird automatisch als Ersteller gespeichert und kann nicht geändert werden.
            </div>
          </div>
        )}

        {/* ── Reparatur ── */}
        {type === 'repairs' && (
          <div className="card space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Beschreibung *</label>
              <div className="flex gap-2 items-center">
                <textarea className="input-field" rows={3} value={repairForm.description} onChange={e => setRepairForm(f => ({ ...f, description: e.target.value }))} required placeholder="Was wurde repariert / gemacht?" />
                <DiktatButton onResult={text => setRepairForm(f => ({ ...f, description: text }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
                <input className="input-field" type="date" value={repairForm.date} onChange={e => setRepairForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Status</label>
                <select className="input-field" value={repairForm.status} onChange={e => setRepairForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="Abgeschlossen">✅ Abgeschlossen</option>
                  <option value="In Bearbeitung">🔧 In Bearbeitung</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Durchgeführt von</label>
                <div className="flex gap-2 items-center">
                  <input className="input-field" value={repairForm.performedBy} onChange={e => setRepairForm(f => ({ ...f, performedBy: e.target.value }))} placeholder="Werkstatt / Person" />
                  <DiktatButton onResult={text => setRepairForm(f => ({ ...f, performedBy: text }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Kosten (€)</label>
                <input className="input-field" type="number" step="0.01" value={repairForm.cost} onChange={e => setRepairForm(f => ({ ...f, cost: e.target.value }))} min="0" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
                <div className="flex gap-2 items-center">
                  <textarea className="input-field" rows={2} value={repairForm.notes} onChange={e => setRepairForm(f => ({ ...f, notes: e.target.value }))} />
                  <DiktatButton onResult={text => setRepairForm(f => ({ ...f, notes: text }))} />
                </div>
              </div>
            </div>
            <div className="bg-surface-50 rounded-xl p-3 text-xs text-ink-muted">
              ℹ Dein Name wird automatisch als Ersteller gespeichert und kann nicht geändert werden.
            </div>
          </div>
        )}

        {/* ── Defekt ── */}
        {type === 'defects' && (
          <div className="card space-y-4">
            <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">Defekt melden</p>
                <p className="text-xs text-red-600 mt-0.5">Dein Name wird als Melder gespeichert und ist nicht änderbar.</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Defektbeschreibung *</label>
              <div className="flex gap-2 items-center">
                <textarea className="input-field" rows={4} value={defectForm.description} onChange={e => setDefectForm(f => ({ ...f, description: e.target.value }))} required placeholder="Was ist defekt? Wie wurde es bemerkt? Wann?" />
                <DiktatButton onResult={text => setDefectForm(f => ({ ...f, description: text }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Zusätzliche Notizen</label>
              <div className="flex gap-2 items-center">
                <textarea className="input-field" rows={2} value={defectForm.notes} onChange={e => setDefectForm(f => ({ ...f, notes: e.target.value }))} />
                <DiktatButton onResult={text => setDefectForm(f => ({ ...f, notes: text }))} />
              </div>
            </div>
          </div>
        )}

        {/* ── Ausgabe ── */}
        {type === 'loans' && (
          <div className="card space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Ausgegeben an *</label>
              <div className="flex gap-2 items-center">
                <input className="input-field" value={loanForm.borrowedByName} onChange={e => setLoanForm(f => ({ ...f, borrowedByName: e.target.value }))} required placeholder="Name der Person / Einheit" />
                <DiktatButton onResult={text => setLoanForm(f => ({ ...f, borrowedByName: text }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Geplante Rückgabe</label>
              <input className="input-field" type="date" value={loanForm.expectedReturn} onChange={e => setLoanForm(f => ({ ...f, expectedReturn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
              <div className="flex gap-2 items-center">
                <input className="input-field" value={loanForm.notes} onChange={e => setLoanForm(f => ({ ...f, notes: e.target.value }))} placeholder="Zweck der Ausgabe..." />
                <DiktatButton onResult={text => setLoanForm(f => ({ ...f, notes: text }))} />
              </div>
            </div>
            <div className="bg-surface-50 rounded-xl p-3 text-xs text-ink-muted">
              ℹ Dein Name wird automatisch als Ersteller gespeichert. Die Ausgabe gilt ab sofort.
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/equipment/${id}`)} className="btn-secondary flex-1">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
          </button>
        </div>
      </form>
    </div>
  );
}
