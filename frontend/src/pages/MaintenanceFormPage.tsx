import React, { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicleApi } from '../api';

const MAINTENANCE_TYPES = ['Inspektion', 'Hauptuntersuchung (HU)', 'Reifenwechsel', 'Ölwechsel', 'Bremsenwartung', 'Fahrzeugpflege', 'Reparatur', 'Sonstiges'];

export default function MaintenanceFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const preselectedVehicleId = searchParams.get('vehicleId') || '';

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vehicleId: preselectedVehicleId,
    type: '',
    date: new Date().toISOString().split('T')[0],
    kmStand: '',
    cost: '',
    nextDueDate: '',
    nextDueKm: '',
    performedBy: '',
    notes: '',
  });

  useEffect(() => {
    Promise.all([
      vehicleApi.listVehicles(),
      !isNew && id ? vehicleApi.listMaintenance().then((r: any) => r?.find((m: any) => m.id === id)) : Promise.resolve(null),
    ]).then(([v, entry]) => {
      const activeVehicles = (v || []).filter((x: any) => x.isActive);
      setVehicles(activeVehicles);
      if (entry) {
        setForm({
          vehicleId: entry.vehicleId || preselectedVehicleId,
          type: entry.type || '',
          date: new Date(entry.date).toISOString().split('T')[0],
          kmStand: entry.kmStand || '',
          cost: entry.cost || '',
          nextDueDate: entry.nextDueDate ? new Date(entry.nextDueDate).toISOString().split('T')[0] : '',
          nextDueKm: entry.nextDueKm || '',
          performedBy: entry.performedBy || '',
          notes: entry.notes || '',
        });
      } else if (preselectedVehicleId) {
        const vehicle = activeVehicles.find((x: any) => x.id === preselectedVehicleId);
        if (vehicle?.currentKm) setForm(f => ({ ...f, kmStand: vehicle.currentKm.toString() }));
      }
    }).catch(() => toast.error('Fehler beim Laden'))
    .finally(() => setLoading(false));
  }, [id, isNew, preselectedVehicleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type) { toast.error('Art der Wartung erforderlich'); return; }
    setSaving(true);
    try {
      if (isNew) { await vehicleApi.createMaintenance(form); toast.success('Wartung eingetragen'); }
      else { await vehicleApi.updateMaintenance(id!, form); toast.success('Wartung aktualisiert'); }
      navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles');
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles')} className="text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{isNew ? 'Wartung eintragen' : 'Wartung bearbeiten'}</h1>
          {selectedVehicle && <p className="text-sm text-ink-muted">{selectedVehicle.name}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Fahrzeug */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Fahrzeug</h2>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fahrzeug *</label>
            <select className="input-field" value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} required>
              <option value="">— Fahrzeug wählen —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}{v.licensePlate ? ` (${v.licensePlate})` : ''}</option>)}
            </select>
          </div>
        </div>

        {/* Wartungsdetails */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Wartungsdetails</h2>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Art der Wartung *</label>
            <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required>
              <option value="">— Auswählen —</option>
              {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">km-Stand</label>
              <input className="input-field" type="number" value={form.kmStand} onChange={e => setForm(f => ({ ...f, kmStand: e.target.value }))} min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Kosten (€)</label>
              <input className="input-field" type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} min="0" placeholder="350.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Durchgeführt von</label>
              <div className="flex gap-2 items-center">
                <input className="input-field" value={form.performedBy} onChange={e => setForm(f => ({ ...f, performedBy: e.target.value }))} placeholder="Werkstatt / Person" />
                <DiktatButton onResult={text => setForm(f => ({ ...f, performedBy: text }))} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
            <div className="flex gap-2 items-start">
<div className="flex gap-2 items-center">
  <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Details zur Wartung..." />
  <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
</div>
<DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
          </div>
        </div>

        {/* Nächste Wartung */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Wrench className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-ink">Nächste Wartung (optional)</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fällig am</label>
              <input className="input-field" type="date" value={form.nextDueDate} onChange={e => setForm(f => ({ ...f, nextDueDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fällig bei km</label>
              <input className="input-field" type="number" value={form.nextDueKm} onChange={e => setForm(f => ({ ...f, nextDueKm: e.target.value }))} min="0" placeholder="25000" />
            </div>
          </div>
          {(form.nextDueDate || form.nextDueKm) && (
            <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">
              ⚠ Erinnerung wird auf der Fahrzeug-Übersicht angezeigt wenn die Wartung bald fällig ist.
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles')} className="btn-secondary flex-1">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
          </button>
        </div>
      </form>
    </div>
  );
}
