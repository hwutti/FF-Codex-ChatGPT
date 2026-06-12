import React, { useState, useEffect, useRef } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Car, Plus, Fuel, Wrench, MapPin, Edit, Trash2, Camera, Save, X, AlertTriangle, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';
import { vehicleApi, memberApi } from '../api';

type Tab = 'trips' | 'fuel' | 'maintenance';

const TRIP_PURPOSES = ['Einsatzfahrt', 'Übungsfahrt', 'Verwaltungsfahrt', 'Transportfahrt', 'Kontrollfahrt', 'Sonstiges'];
const MAINTENANCE_TYPES = ['Inspektion', 'Hauptuntersuchung (HU)', 'Reifenwechsel', 'Ölwechsel', 'Bremsenwartung', 'Fahrzeugpflege', 'Reparatur', 'Sonstiges'];

function fmt(n?: number | null) { return n?.toLocaleString('de-AT') ?? '—'; }
function fmtDate(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('de-AT'); }
function fmtCost(n?: number | null) { if (!n) return '—'; return n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' }); }

// ── Trip Form ─────────────────────────────────────────────────────────────────
function TripForm({ trip, vehicleId, vehicleName, members, onSave, onClose }: any) {
  const [form, setForm] = useState({
    vehicleId, driverId: trip?.driverId || '',
    date: trip?.date ? new Date(trip.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    startKm: trip?.startKm || '', endKm: trip?.endKm || '',
    startLocation: trip?.startLocation || '', endLocation: trip?.endLocation || '',
    purpose: trip?.purpose || '', notes: trip?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const km = form.endKm && form.startKm ? parseInt(form.endKm as string) - parseInt(form.startKm as string) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (trip?.id) { await vehicleApi.updateTrip(trip.id, form); toast.success('Fahrt aktualisiert'); }
      else { await vehicleApi.createTrip(form); toast.success('Fahrt eingetragen'); }
      onSave();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="font-bold text-ink text-lg" style={{ fontFamily: 'var(--font-headings)' }}>{trip?.id ? 'Fahrt bearbeiten' : `Fahrt eintragen — ${vehicleName}`}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Fahrer</label>
              <select className="input-field" value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                <option value="">— Kein Fahrer —</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}{m.rank ? ` · ${m.rank}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Datum *</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Zweck</label>
              <select className="input-field" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}>
                <option value="">— Auswählen —</option>
                {TRIP_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">km-Start *</label>
              <input className="input-field" type="number" value={form.startKm} onChange={e => setForm(f => ({ ...f, startKm: e.target.value }))} required min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">km-Ende *</label>
              <input className="input-field" type="number" value={form.endKm} onChange={e => setForm(f => ({ ...f, endKm: e.target.value }))} required min="0" />
            </div>
            {km > 0 && <div className="col-span-2 bg-emerald-50 rounded-xl px-4 py-2 text-sm text-emerald-700 font-medium">✓ Gefahrene km: <strong>{km} km</strong></div>}
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Von</label>
              <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.startLocation} onChange={e => setForm(f => ({ ...f, startLocation: e.target.value }))} placeholder="Görtschach" /><DiktatButton onResult={text => setForm(f => ({ ...f, startLocation: text }))} /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Nach</label>
              <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.endLocation} onChange={e => setForm(f => ({ ...f, endLocation: e.target.value }))} placeholder="Klagenfurt" /><DiktatButton onResult={text => setForm(f => ({ ...f, endLocation: text }))} /></div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Zusatz / Freitext</label>
              <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /><DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fuel Form ─────────────────────────────────────────────────────────────────
function FuelForm({ entry, vehicleId, vehicleName, onSave, onClose }: any) {
  const [form, setForm] = useState({
    vehicleId,
    date: entry?.date ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    liters: entry?.liters || '', costTotal: entry?.costTotal || '', kmStand: entry?.kmStand || '', notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const pricePerLiter = form.liters && form.costTotal ? (parseFloat(form.costTotal as string) / parseFloat(form.liters as string)).toFixed(3) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (entry?.id) { await vehicleApi.updateFuel(entry.id, form); toast.success('Tankeintrag aktualisiert'); }
      else { await vehicleApi.createFuel(form); toast.success('Tankeintrag gespeichert'); }
      onSave();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="font-bold text-ink text-lg" style={{ fontFamily: 'var(--font-headings)' }}>{entry?.id ? 'Tankeintrag bearbeiten' : `Tanken — ${vehicleName}`}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Datum *</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">km-Stand *</label>
              <input className="input-field" type="number" value={form.kmStand} onChange={e => setForm(f => ({ ...f, kmStand: e.target.value }))} required min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Liter *</label>
              <input className="input-field" type="number" step="0.01" value={form.liters} onChange={e => setForm(f => ({ ...f, liters: e.target.value }))} required min="0" placeholder="45.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Gesamtkosten (€)</label>
              <input className="input-field" type="number" step="0.01" value={form.costTotal} onChange={e => setForm(f => ({ ...f, costTotal: e.target.value }))} min="0" placeholder="82.50" />
            </div>
          </div>
          {pricePerLiter && <div className="bg-blue-50 rounded-xl px-4 py-2 text-sm text-blue-700">Preis/Liter: <strong>{pricePerLiter} €/L</strong></div>}
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Notizen</label>
            <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /><DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Maintenance Form ──────────────────────────────────────────────────────────
function MaintenanceForm({ entry, vehicleId, vehicleName, onSave, onClose }: any) {
  const [form, setForm] = useState({
    vehicleId, type: entry?.type || '',
    date: entry?.date ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    kmStand: entry?.kmStand || '', cost: entry?.cost || '',
    nextDueDate: entry?.nextDueDate ? new Date(entry.nextDueDate).toISOString().split('T')[0] : '',
    nextDueKm: entry?.nextDueKm || '', performedBy: entry?.performedBy || '', notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (entry?.id) { await vehicleApi.updateMaintenance(entry.id, form); toast.success('Wartung aktualisiert'); }
      else { await vehicleApi.createMaintenance(form); toast.success('Wartung eingetragen'); }
      onSave();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="font-bold text-ink text-lg" style={{ fontFamily: 'var(--font-headings)' }}>{entry?.id ? 'Wartung bearbeiten' : `Wartung — ${vehicleName}`}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Art der Wartung *</label>
              <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required>
                <option value="">— Auswählen —</option>
                {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Datum *</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">km-Stand</label>
              <input className="input-field" type="number" value={form.kmStand} onChange={e => setForm(f => ({ ...f, kmStand: e.target.value }))} min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Kosten (€)</label>
              <input className="input-field" type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Durchgeführt von</label>
              <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.performedBy} onChange={e => setForm(f => ({ ...f, performedBy: e.target.value }))} placeholder="Werkstatt / Person" /><DiktatButton onResult={text => setForm(f => ({ ...f, performedBy: text }))} /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Nächste fällig (Datum)</label>
              <input className="input-field" type="date" value={form.nextDueDate} onChange={e => setForm(f => ({ ...f, nextDueDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Nächste fällig (km)</label>
              <input className="input-field" type="number" value={form.nextDueKm} onChange={e => setForm(f => ({ ...f, nextDueKm: e.target.value }))} min="0" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Notizen</label>
              <div className="flex gap-2 items-start">
<textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /><DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
<DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ── Jahres-Charts (Recharts) ──────────────────────────────────────────────────
function YearCharts({ trips, fuel, year }: { trips: any[], fuel: any[], year: string }) {
  const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const currentMonth = new Date().getFullYear().toString() === year ? new Date().getMonth() : -1;

  const data = MONTHS.map((month, i) => {
    const km = trips
      .filter(t => new Date(t.date).getFullYear().toString() === year && new Date(t.date).getMonth() === i)
      .reduce((s, t) => s + (t.endKm - t.startKm), 0);
    const liter = fuel
      .filter(f => new Date(f.date).getFullYear().toString() === year && new Date(f.date).getMonth() === i)
      .reduce((s, f) => s + (f.liters || 0), 0);
    return { month, km: km || null, liter: liter ? Math.round(liter * 10) / 10 : null, isCurrent: i === currentMonth };
  });

  const totalKm = data.reduce((s, d) => s + (d.km || 0), 0);
  const totalL = data.reduce((s, d) => s + (d.liter || 0), 0);

  if (totalKm === 0 && totalL === 0) return null;

  const CustomTooltipKm = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-surface-200 rounded-xl shadow-lg px-3 py-2">
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className="text-sm font-bold text-fire-700">{payload[0].value?.toLocaleString('de-AT')} km</p>
      </div>
    );
  };

  const CustomTooltipL = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-surface-200 rounded-xl shadow-lg px-3 py-2">
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className="text-sm font-bold text-amber-600">{payload[0].value?.toLocaleString('de-AT')} L</p>
      </div>
    );
  };

  // Custom bar shape to highlight current month
  const CustomBar = (color: string, activeColor: string) => (props: any) => {
    const { x, y, width, height, month } = props;
    const idx = MONTHS.indexOf(month);
    const fill = idx === currentMonth ? activeColor : color;
    if (!height || height <= 0) return null;
    return <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={fill} />;
  };

  return (
    <div className="flex gap-4 flex-1">
      {totalKm > 0 && (
        <div className="flex-1 bg-white rounded-xl border border-surface-200 shadow-card px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-ink-muted font-medium">Gefahrene km</p>
            <span className="text-xs font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{totalKm.toLocaleString('de-AT')} km</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data} barSize={10} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#c0bbb8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#c0bbb8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipKm />} cursor={{ fill: '#f9f7f5', radius: 4 }} />
              <Bar dataKey="km" shape={CustomBar('#93c5fd', '#2563eb')} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {totalL > 0 && (
        <div className="flex-1 bg-white rounded-xl border border-surface-200 shadow-card px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-ink-muted font-medium">Getankte Liter</p>
            <span className="text-xs font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{totalL.toFixed(0)} L</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data} barSize={10} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#c0bbb8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#c0bbb8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipL />} cursor={{ fill: '#fef9f0', radius: 4 }} />
              <Bar dataKey="liter" shape={CustomBar('#86efac', '#16a34a')} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Main Detail Page ──────────────────────────────────────────────────────────
export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('trips');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    try {
      const [v, t, f, m, mem] = await Promise.all([
        vehicleApi.getVehicle(id),
        vehicleApi.listTrips({ vehicleId: id }),
        vehicleApi.listFuel({ vehicleId: id }),
        vehicleApi.listMaintenance({ vehicleId: id }),
        memberApi.list({ status: 'ACTIVE', limit: '200' }),
      ]);
      setVehicle(v);
      setTrips(t?.trips || []);
      setFuel(f || []);
      setMaintenance(m || []);
      setMembers(mem?.members || []);
    } catch { toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      const res = await vehicleApi.uploadPhoto(id, file);
      setVehicle((v: any) => ({ ...v, photoUrl: res.photoUrl }));
      toast.success('Foto hochgeladen');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Fahrzeug und alle Einträge löschen?')) return;
    await vehicleApi.deleteVehicle(id!);
    toast.success('Fahrzeug gelöscht');
    navigate('/vehicles');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;
  if (!vehicle) return <div className="p-6"><p className="text-ink-muted">Fahrzeug nicht gefunden.</p></div>;

  const totalTripKm = trips.reduce((s, t) => s + (t.endKm - t.startKm), 0);
  const totalFuelLiters = fuel.reduce((s, f) => s + f.liters, 0);
  const totalFuelCost = fuel.reduce((s, f) => s + (f.costTotal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/vehicles')} className="text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate" style={{ fontFamily: 'var(--font-headings)' }}>{vehicle.name}</h1>
          <p className="text-sm text-ink-muted">{vehicle.type || 'Fahrzeug'}{vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/vehicles/${id}/edit`)} className="btn-secondary flex items-center gap-2">
            <Edit className="w-4 h-4" /> Bearbeiten
          </button>
          <button onClick={handleDelete} className="btn-danger p-2.5"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Fahrzeug-Info Card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          {/* Foto */}
          <div className="relative group flex-shrink-0">
            <div className="w-36 h-28 rounded-xl overflow-hidden bg-surface-100">
              {vehicle.photoUrl
                ? <img src={vehicle.photoUrl} alt={vehicle.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Car className="w-10 h-10 text-ink-faint" /></div>
              }
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'km-Stand', value: `${fmt(vehicle.currentKm)} km` },
                { label: 'Baujahr', value: vehicle.year || '—' },
                { label: 'Marke / Modell', value: [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '—' },
                { label: 'Status', value: vehicle.isActive ? 'Aktiv' : 'Inaktiv' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-xs text-ink-muted uppercase tracking-wider font-semibold">{item.label}</p>
                  <p className="font-semibold text-ink mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            {vehicle.notes && <p className="text-sm text-ink-muted mt-3 italic">{vehicle.notes}</p>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-shrink-0">
            {[
              { label: 'Fahrten', value: trips.length, icon: MapPin, color: 'text-fire-700', bg: 'bg-fire-50' },
              { label: `${fmt(totalTripKm)} km`, value: 'gefahren', icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: `${totalFuelLiters.toFixed(0)} L`, value: fmtCost(totalFuelCost), icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-xl p-3 text-center`}>
                <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
                <p className="font-bold text-ink text-sm">{s.label}</p>
                <p className="text-xs text-ink-muted">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs + Charts + Button */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1 bg-surface-100 p-1 rounded-xl flex-shrink-0">
          {[
            { id: 'trips', label: 'Fahrten', icon: MapPin, count: trips.length },
            { id: 'fuel', label: 'Tanken', icon: Fuel, count: fuel.length },
            { id: 'maintenance', label: 'Wartung', icon: Wrench, count: maintenance.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              <t.icon className="w-4 h-4" />{t.label}
              {t.count > 0 && <span className="text-xs bg-surface-200 px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
        {/* Charts inline — nur im Fahrten-Tab */}
        {tab === 'trips' && (
          <YearCharts trips={trips} fuel={fuel} year={yearFilter} />
        )}
        <button onClick={() => {
          if (tab === 'trips') { navigate(`/trips/new?vehicleId=${id}`); return; }
          if (tab === 'fuel') { navigate(`/fuel/new?vehicleId=${id}`); return; }
          if (tab === 'maintenance') { navigate(`/maintenance/new?vehicleId=${id}`); return; }
        }} className="btn-primary flex items-center gap-2 flex-shrink-0 ml-auto">
          <Plus className="w-4 h-4" />
          {tab === 'trips' ? 'Fahrt eintragen' : tab === 'fuel' ? 'Tanken' : 'Wartung eintragen'}
        </button>
      </div>

      {/* ── Fahrten ── */}
      {tab === 'trips' && (() => {
        const allYears = [...new Set(trips.map((t: any) => new Date(t.date).getFullYear().toString()))].sort((a, b) => Number(b) - Number(a));
        const activeYear = allYears.includes(yearFilter) ? yearFilter : (allYears[0] || yearFilter);
        const filtered = trips.filter((t: any) => new Date(t.date).getFullYear().toString() === activeYear);
        const yearKm = filtered.reduce((s: number, t: any) => s + (t.endKm - t.startKm), 0);
        return (
          <div className="space-y-4">
            {/* Jahres-Reiter */}
            {allYears.length > 0 && (
              <div className="flex items-center gap-3">
                <select value={activeYear} onChange={e => setYearFilter(e.target.value)} className="input-field w-32">
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {filtered.length > 0 && (
                  <span className="text-xs text-ink-muted">{filtered.length} Fahrten · {fmt(yearKm)} km</span>
                )}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="card text-center py-10"><MapPin className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Keine Fahrten in {activeYear}</p></div>
            ) : (
              <div className="space-y-3">
                {filtered.map((t: any) => {
                  const fuelOnTrip = t.fuelEntries || [];
                  const driverName = t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : null;
                  const driverInitials = driverName ? driverName.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() : null;
                  const driverAvatar = t.driver?.user?.avatarUrl;
                  return (
                    <div key={t.id} className="card flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden bg-fire-50">
                        {driverAvatar
                          ? <img src={driverAvatar} alt={driverName || ''} className="w-full h-full object-cover" />
                          : driverInitials
                          ? <span className="text-fire-700 font-bold text-xs" style={{ fontFamily: 'var(--font-headings)' }}>{driverInitials}</span>
                          : <MapPin className="w-5 h-5 text-fire-700" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink text-sm">{fmt(t.endKm - t.startKm)} km</span>
                          {t.purpose && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t.purpose}</span>}
                          {fuelOnTrip.length > 0 && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Fuel className="w-3 h-3" /> Getankt {fuelOnTrip[0].liters}L
                            </span>
                          )}
                        </div>
                        {driverName && (
                          <p className="text-xs text-ink mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3 text-ink-muted flex-shrink-0" />
                            <span className="font-medium">{driverName}</span>
                            {t.driver?.rank && <span className="text-ink-faint">· {t.driver.rank}</span>}
                          </p>
                        )}
                        <p className="text-xs text-ink-muted mt-0.5">
                          {fmtDate(t.date)}
                          {t.startLocation && t.endLocation && ` · ${t.startLocation} → ${t.endLocation}`}
                          {` · km ${fmt(t.startKm)} → ${fmt(t.endKm)}`}
                        </p>
                        {t.notes && <p className="text-xs text-ink-faint italic mt-0.5">{t.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => navigate(`/trips/${t.id}/edit`)} className="p-2 hover:bg-surface-100 rounded-lg"><Edit className="w-3.5 h-3.5 text-ink-muted" /></button>
                        <button onClick={async () => { if (!confirm('Fahrt löschen?')) return; await vehicleApi.deleteTrip(t.id); load(); }} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Tanken ── */}
      {tab === 'fuel' && (() => {
        const allYears = [...new Set(fuel.map((f: any) => new Date(f.date).getFullYear().toString()))].sort((a, b) => Number(b) - Number(a));
        const activeYear = allYears.includes(yearFilter) ? yearFilter : (allYears[0] || yearFilter);
        const filtered = fuel.filter((f: any) => new Date(f.date).getFullYear().toString() === activeYear);
        const yearLiters = filtered.reduce((s: number, f: any) => s + (f.liters || 0), 0);
        const yearCost = filtered.reduce((s: number, f: any) => s + (f.costTotal || 0), 0);
        return (
          <div className="space-y-4">
            {allYears.length > 0 && (
              <div className="flex items-center gap-3">
                <select value={activeYear} onChange={e => setYearFilter(e.target.value)} className="input-field w-32">
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {filtered.length > 0 && (
                  <span className="text-xs text-ink-muted">{filtered.length} Tankungen · {yearLiters.toFixed(0)} L{yearCost ? ` · ${fmtCost(yearCost)}` : ''}</span>
                )}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="card text-center py-10"><Fuel className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Keine Tankeinträge in {activeYear}</p></div>
            ) : (
              <div className="space-y-3">
                {filtered.map((f: any) => (
                  <div key={f.id} className="card flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Fuel className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-ink text-sm">{f.liters} L{f.costTotal ? ` · ${fmtCost(f.costTotal)}` : ''}</span>
                      <p className="text-xs text-ink-muted mt-0.5">{fmtDate(f.date)} · km-Stand: {fmt(f.kmStand)}{f.liters && f.costTotal ? ` · ${(f.costTotal / f.liters).toFixed(3)} €/L` : ''}</p>
                      {f.notes && <p className="text-xs text-ink-faint italic mt-0.5">{f.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => navigate(`/fuel/${f.id}/edit`)} className="p-2 hover:bg-surface-100 rounded-lg"><Edit className="w-3.5 h-3.5 text-ink-muted" /></button>
                      <button onClick={async () => { if (!confirm('Tankeintrag löschen?')) return; await vehicleApi.deleteFuel(f.id); load(); }} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Wartung ── */}
      {tab === 'maintenance' && (() => {
        const allYears = [...new Set(maintenance.map((m: any) => new Date(m.date).getFullYear().toString()))].sort((a, b) => Number(b) - Number(a));
        const activeYear = allYears.includes(yearFilter) ? yearFilter : (allYears[0] || yearFilter);
        const filtered = maintenance.filter((m: any) => new Date(m.date).getFullYear().toString() === activeYear);
        const yearCost = filtered.reduce((s: number, m: any) => s + (m.cost || 0), 0);
        return (
          <div className="space-y-4">
            {allYears.length > 0 && (
              <div className="flex items-center gap-3">
                <select value={activeYear} onChange={e => setYearFilter(e.target.value)} className="input-field w-32">
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {filtered.length > 0 && (
                  <span className="text-xs text-ink-muted">{filtered.length} Einträge{yearCost ? ` · ${fmtCost(yearCost)}` : ''}</span>
                )}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="card text-center py-10"><Wrench className="w-10 h-10 text-ink-faint mx-auto mb-2" /><p className="text-ink-muted">Keine Wartungseinträge in {activeYear}</p></div>
            ) : (
              <div className="space-y-3">
                {filtered.map((m: any) => {
                  const daysUntil = m.nextDueDate ? Math.ceil((new Date(m.nextDueDate).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={m.id} className="card flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${daysUntil !== null && daysUntil <= 30 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        <Wrench className={`w-5 h-5 ${daysUntil !== null && daysUntil <= 30 ? 'text-amber-600' : 'text-emerald-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink text-sm">{m.type}</span>
                          {m.cost && <span className="text-xs text-ink-muted">{fmtCost(m.cost)}</span>}
                        </div>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {fmtDate(m.date)}{m.kmStand ? ` · ${fmt(m.kmStand)} km` : ''}{m.performedBy ? ` · ${m.performedBy}` : ''}
                        </p>
                        {daysUntil !== null && (
                          <p className={`text-xs mt-0.5 flex items-center gap-1 ${daysUntil <= 0 ? 'text-red-600 font-medium' : daysUntil <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {daysUntil <= 0 ? 'Nächste Wartung überfällig!' : `Nächste in ${daysUntil} Tagen (${fmtDate(m.nextDueDate)})`}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/maintenance/${m.id}/edit`)} className="p-2 hover:bg-surface-100 rounded-lg"><Edit className="w-3.5 h-3.5 text-ink-muted" /></button>
                        <button onClick={async () => { if (!confirm('Wartung löschen?')) return; await vehicleApi.deleteMaintenance(m.id); load(); }} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Modals */}
      
    </div>
  );
}
