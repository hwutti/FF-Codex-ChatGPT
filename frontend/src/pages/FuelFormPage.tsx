import React, { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Fuel } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicleApi } from '../api';

export default function FuelFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const preselectedVehicleId = searchParams.get('vehicleId') || '';

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vehicleId: preselectedVehicleId,
    tripId: '',
    date: new Date().toISOString().split('T')[0],
    liters: '',
    costTotal: '',
    kmStand: '',
    notes: '',
  });

  useEffect(() => {
    Promise.all([
      vehicleApi.listVehicles(),
      !isNew && id ? vehicleApi.listFuel().then((r: any) => r?.find((f: any) => f.id === id)) : Promise.resolve(null),
    ]).then(([v, entry]) => {
      const activeVehicles = (v || []).filter((x: any) => x.isActive);
      setVehicles(activeVehicles);
      if (entry) {
        if (entry.vehicleId) vehicleApi.listTrips({ vehicleId: entry.vehicleId }).then((r: any) => setTrips(r?.trips || [])).catch(() => {});
        setForm({
          vehicleId: entry.vehicleId || preselectedVehicleId,
          tripId: entry.tripId || '',
          date: new Date(entry.date).toISOString().split('T')[0],
          liters: entry.liters || '',
          costTotal: entry.costTotal || '',
          kmStand: entry.kmStand || '',
          notes: entry.notes || '',
        });
      } else if (preselectedVehicleId) {
        const vehicle = activeVehicles.find((x: any) => x.id === preselectedVehicleId);
        if (vehicle?.currentKm) setForm(f => ({ ...f, kmStand: vehicle.currentKm.toString() }));
        vehicleApi.listTrips({ vehicleId: preselectedVehicleId }).then((r: any) => setTrips(r?.trips || [])).catch(() => {});
      }
    }).catch(() => toast.error('Fehler beim Laden'))
    .finally(() => setLoading(false));
  }, [id, isNew, preselectedVehicleId]);

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setForm(f => ({ ...f, vehicleId, tripId: '', kmStand: vehicle?.currentKm ? vehicle.currentKm.toString() : f.kmStand }));
    if (vehicleId) {
      vehicleApi.listTrips({ vehicleId }).then((r: any) => setTrips(r?.trips || [])).catch(() => {});
    } else {
      setTrips([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) { await vehicleApi.createFuel(form); toast.success('Tankeintrag gespeichert'); }
      else { await vehicleApi.updateFuel(id!, form); toast.success('Tankeintrag aktualisiert'); }
      navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles');
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const pricePerLiter = form.liters && form.costTotal
    ? (parseFloat(form.costTotal as string) / parseFloat(form.liters as string)).toFixed(3) : null;
  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles')} className="text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{isNew ? 'Tanken' : 'Tankeintrag bearbeiten'}</h1>
          {selectedVehicle && <p className="text-sm text-ink-muted">{selectedVehicle.name}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Fahrzeug</h2>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fahrzeug *</label>
            <select className="input-field" value={form.vehicleId} onChange={e => handleVehicleChange(e.target.value)} required>
              <option value="">— Fahrzeug wählen —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}{v.licensePlate ? ` (${v.licensePlate})` : ''}</option>)}
            </select>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Tankdaten</h2>
          {trips.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Zu welcher Fahrt gehört das Tanken?</label>
              <select className="input-field" value={form.tripId} onChange={e => setForm(f => ({ ...f, tripId: e.target.value }))}>
                <option value="">— Keiner Fahrt zuordnen —</option>
                {trips.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {new Date(t.date).toLocaleDateString('de-AT')} · {t.endKm - t.startKm} km
                    {t.purpose ? ` · ${t.purpose}` : ''}
                    {t.startLocation && t.endLocation ? ` · ${t.startLocation} → ${t.endLocation}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">km-Stand *</label>
              <input className="input-field" type="number" value={form.kmStand} onChange={e => setForm(f => ({ ...f, kmStand: e.target.value }))} required min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Liter *</label>
              <input className="input-field" type="number" step="0.01" value={form.liters} onChange={e => setForm(f => ({ ...f, liters: e.target.value }))} required min="0" placeholder="45.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Gesamtkosten (€)</label>
              <input className="input-field" type="number" step="0.01" value={form.costTotal} onChange={e => setForm(f => ({ ...f, costTotal: e.target.value }))} min="0" placeholder="82.50" />
            </div>
          </div>
          {pricePerLiter && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <Fuel className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="font-semibold text-blue-700">Preis pro Liter: {pricePerLiter} €/L</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
            <div className="flex gap-2 items-center">
              <input className="input-field" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="z.B. Vollgetankt, AdBlue nachgefüllt..." />
              <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
            </div>
          </div>
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
