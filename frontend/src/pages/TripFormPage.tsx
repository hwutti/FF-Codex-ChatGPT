import React, { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, MapPin, Fuel, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicleApi, memberApi, incidentApi, eventApi, exerciseApi } from '../api';
import api from '../api';
import TripSignaturePanel from '../components/TripSignaturePanel';
import InlineTripSignature, { PendingSignature } from '../components/InlineTripSignature';

const TRIP_PURPOSES = [
  'Brandeinsatz', 'Technischereinsatz', 'Katastrophenschutzeinsatz',
  'Übungsfahrt', 'Funkübung', 'Katastrophenschutzübung', 'Gemeindeübung', 'Abschnittsübung',
  'Transportfahrt', 'Kontrollfahrt', 'Feuerwache', 'Verwaltungsfahrt', 'Sonstiges',
];
export const EINSATZ_PURPOSES = ['Brandeinsatz', 'Technischereinsatz', 'Katastrophenschutzeinsatz'];
export const UEBUNG_PURPOSES = ['Übungsfahrt', 'Funkübung', 'Katastrophenschutzübung', 'Gemeindeübung', 'Abschnittsübung'];

export default function TripFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const preselectedVehicleId = searchParams.get('vehicleId') || '';

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTripId, setSavedTripId] = useState<string | null>(isNew ? null : id || null);
  const [pendingSignatures, setPendingSignatures] = useState<PendingSignature[]>([]);
  const [lastKm, setLastKm] = useState<number | null>(null); // letzter endKm aus DB

  const [form, setForm] = useState({
    vehicleId: preselectedVehicleId,
    driverId: '',
    date: new Date().toISOString().split('T')[0],
    startKm: '',
    endKm: '',
    startLocation: '',
    endLocation: '',
    purpose: '',
    notes: '',
  });

  // Betankung
  const [hasFuel, setHasFuel] = useState(false);
  const [fuelId, setFuelId] = useState<string | null>(null);
  const [fuelForm, setFuelForm] = useState({
    liters: '',
    costTotal: '',
    kmStand: '',
    notes: '',
  });

  const km = form.endKm && form.startKm ? parseInt(form.endKm as string) - parseInt(form.startKm as string) : 0;
  const pricePerLiter = fuelForm.liters && fuelForm.costTotal
    ? (parseFloat(fuelForm.costTotal) / parseFloat(fuelForm.liters)).toFixed(3) : null;

  useEffect(() => {
    Promise.all([
      vehicleApi.listVehicles(),
      memberApi.list({ status: 'ACTIVE', limit: '200' }),
      !isNew && id ? vehicleApi.listTrips().then((r: any) => r.trips?.find((t: any) => t.id === id)) : Promise.resolve(null),
    ]).then(([v, mem, trip]) => {
      setVehicles((v || []).filter((x: any) => x.isActive));
      setMembers(mem?.members || []);
      if (trip) {
        setForm({
          vehicleId: trip.vehicleId || preselectedVehicleId,
          driverId: trip.driverId || '',
          date: new Date(trip.date).toISOString().split('T')[0],
          startKm: trip.startKm || '',
          endKm: trip.endKm || '',
          startLocation: trip.startLocation || '',
          endLocation: trip.endLocation || '',
          purpose: trip.purpose || '',
          notes: trip.notes || '',
        });
        // Bestehende Betankung laden
        if (trip.fuelEntries?.length > 0) {
          const fe = trip.fuelEntries[0];
          setHasFuel(true);
          setFuelId(fe.id);
          setFuelForm({
            liters: fe.liters?.toString() || '',
            costTotal: fe.costTotal?.toString() || '',
            kmStand: fe.kmStand?.toString() || '',
            notes: fe.notes || '',
          });
        }
      } else if (preselectedVehicleId) {
        const vehicle = (v || []).find((x: any) => x.id === preselectedVehicleId);
        // Letzte Fahrt aus DB holen (ohne await — .then chain)
        vehicleApi.listTrips({ vehicleId: preselectedVehicleId, limit: '9999' })
          .then((tripRes: any) => {
            const allTrips = tripRes?.trips || tripRes || [];
            const maxEndKm = allTrips.length > 0
              ? Math.max(...allTrips.map((t: any) => t.endKm || 0))
              : 0;
            if (maxEndKm > 0) {
              setLastKm(maxEndKm);
              setForm(f => ({ ...f, startKm: maxEndKm.toString() }));
            } else if (vehicle?.currentKm) {
              setLastKm(vehicle.currentKm);
              setForm(f => ({ ...f, startKm: vehicle.currentKm.toString() }));
            }
          })
          .catch(() => {
            if (vehicle?.currentKm) {
              setLastKm(vehicle.currentKm);
              setForm(f => ({ ...f, startKm: vehicle.currentKm.toString() }));
            }
          });
      }
    }).catch(() => toast.error('Fehler beim Laden'))
    .finally(() => setLoading(false));
  }, [id, isNew, preselectedVehicleId]);

  // Wenn Fahrzeug gewechselt wird → letzten km-Stand aus DB holen
  const handleVehicleChange = async (vehicleId: string) => {
    const vehicle = vehicles.find((v: any) => v.id === vehicleId);
    let startKm = vehicle?.currentKm ? vehicle.currentKm.toString() : '';
    let fetchedLastKm: number | null = vehicle?.currentKm || null;

    try {
      // Letzte Fahrt für dieses Fahrzeug holen
      const res = await vehicleApi.listTrips({ vehicleId, limit: '9999' });
      const trips = res?.trips || res || [];
      const maxEndKm = trips.length > 0 ? Math.max(...trips.map((t: any) => t.endKm || 0)) : 0;
      if (maxEndKm > 0) {
        fetchedLastKm = maxEndKm;
        startKm = maxEndKm.toString();
      }
    } catch {}

    setLastKm(fetchedLastKm);
    setForm(f => ({ ...f, vehicleId, startKm }));
  };

  // Wenn endKm gesetzt wird → kmStand für Tanken vorausfüllen
  const handleEndKmChange = (val: string) => {
    setForm(f => ({ ...f, endKm: val }));
    if (val && !fuelForm.kmStand) {
      setFuelForm(f => ({ ...f, kmStand: val }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId) { toast.error('Fahrzeug erforderlich'); return; }
    if (km < 0) { toast.error('End-km muss größer als Start-km sein'); return; }
    if (hasFuel && (!fuelForm.liters || !fuelForm.kmStand)) {
      toast.error('Bei Betankung: Liter und km-Stand erforderlich'); return;
    }
    setSaving(true);
    try {
      let tripId: string;
      if (isNew) {
        const trip = await vehicleApi.createTrip(form);
        tripId = trip.id;
      } else {
        await vehicleApi.updateTrip(id!, form);
        tripId = id!;
      }

      // Betankung speichern
      if (hasFuel) {
        const fuelData = {
          vehicleId: form.vehicleId,
          tripId,
          date: form.date,
          liters: fuelForm.liters,
          costTotal: fuelForm.costTotal || null,
          kmStand: fuelForm.kmStand,
          notes: fuelForm.notes,
        };
        if (fuelId) {
          await vehicleApi.updateFuel(fuelId, fuelData);
        } else {
          await vehicleApi.createFuel(fuelData);
        }
      }

      // Punkt 6: Automatisch Einsatz anlegen
      if (isNew && ['Brandeinsatz', 'Technischereinsatz', 'Katastrophenschutzeinsatz'].includes(form.purpose)) {
        try {
          await incidentApi.create({
            title: form.purpose + (form.notes ? ' — ' + form.notes : ''),
            date: form.date,
            location: form.endLocation || form.startLocation || '',
            type: form.purpose === 'Brandeinsatz' ? 'FIRE' : form.purpose === 'Technischereinsatz' ? 'TECHNICAL' : 'OTHER',
            description: `Automatisch erstellt aus Fahrtenbucheintrag`,
          });
          toast.success('Fahrt eingetragen + Einsatz automatisch angelegt');
        } catch { toast.success('Fahrt eingetragen (Einsatz konnte nicht angelegt werden)'); }
      }
      // Punkt 7: Automatisch Übung anlegen — in neuer exercises Tabelle
      else if (isNew && ['Übungsfahrt', 'Funkübung', 'Katastrophenschutzübung', 'Gemeindeübung', 'Abschnittsübung'].includes(form.purpose)) {
        try {
          const typeMap: Record<string, string> = {
            'Funkübung': 'RADIO',
            'Abschnittsübung': 'DISTRICT',
            'Gemeindeübung': 'COMMUNITY',
            'Katastrophenschutzübung': 'DISASTER',
            'Übungsfahrt': 'DRIVE',
          };
          // Prüfen ob für dieses Datum bereits Übungen existieren
          const existing = await exerciseApi.list({ from: form.date, to: form.date, limit: '10' });
          const existingOnDay = (existing.exercises || []).filter((e: any) =>
            e.date?.slice(0, 10) === form.date
          );
          if (existingOnDay.length > 0) {
            // Dialog: Verknüpfen oder neu erstellen?
            const options = existingOnDay.map((e: any) => `"${e.title}"`).join('\n');
            const choice = window.confirm(
              `Es gibt bereits ${existingOnDay.length} Übung(en) am ${form.date}:\n${options}\n\nOK = Neue Übung erstellen\nAbbrechen = Nur Fahrt eintragen (keine neue Übung)`
            );
            if (choice) {
              await exerciseApi.create({
                title: form.purpose + (form.notes ? ' — ' + form.notes : ''),
                date: form.date,
                location: form.endLocation || form.startLocation || '',
                type: typeMap[form.purpose] || 'OTHER',
                notes: `Automatisch erstellt aus Fahrtenbucheintrag`,
              });
              toast.success('Fahrt eingetragen + neue Übung angelegt');
            } else {
              toast.success('Fahrt eingetragen (bestehende Übung bleibt unverändert)');
            }
          } else {
            await exerciseApi.create({
              title: form.purpose + (form.notes ? ' — ' + form.notes : ''),
              date: form.date,
              location: form.endLocation || form.startLocation || '',
              type: typeMap[form.purpose] || 'OTHER',
              notes: `Automatisch erstellt aus Fahrtenbucheintrag`,
            });
            toast.success('Fahrt eingetragen + Übung automatisch angelegt');
          }
        } catch { toast.success('Fahrt eingetragen (Übung konnte nicht angelegt werden)'); }
      } else {
        toast.success(isNew ? 'Fahrt eingetragen' : 'Fahrt aktualisiert');
      }
      setSavedTripId(tripId);

      // Unterschriften speichern falls vorhanden
      if (pendingSignatures.length > 0) {
        await Promise.all(pendingSignatures.map(sig =>
          api.post(`/trips/${tripId}/signatures`, sig).catch(() => {})
        ));
      }

      navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles')}
          className="text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
            {isNew ? 'Fahrt eintragen' : 'Fahrt bearbeiten'}
          </h1>
          {selectedVehicle && <p className="text-sm text-ink-muted">{selectedVehicle.name}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Fahrzeug & Fahrer */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Fahrzeug & Fahrer</h2>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fahrzeug *</label>
            <select className="input-field" value={form.vehicleId} onChange={e => handleVehicleChange(e.target.value)} required>
              <option value="">— Fahrzeug wählen —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.licensePlate ? ` (${v.licensePlate})` : ''} · {v.currentKm?.toLocaleString('de-AT')} km
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fahrer</label>
            <select className="input-field" value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
              <option value="">— Kein Fahrer ausgewählt —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}{m.rank ? ` · ${m.rank}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Datum & Zweck */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Datum & Zweck</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Datum *</label>
              <input className="input-field" type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fahrzweck</label>
              <select className="input-field" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}>
                <option value="">— Auswählen —</option>
                {TRIP_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Freitext / Zusatz</label>
            <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="z.B. Fahrt zur Übung Gruppe 2..." /><DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
          </div>
        </div>

        {/* km-Stand */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Kilometerstand</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                km-Stand Start *
                {lastKm !== null && <span className="ml-1 text-ink-faint font-normal normal-case">(letzter: {lastKm.toLocaleString('de-AT')} km)</span>}
              </label>
              <input className={`input-field ${lastKm !== null && form.startKm && parseInt(form.startKm) < lastKm ? 'border-amber-400 bg-amber-50' : ''}`}
                type="number" value={form.startKm}
                onChange={e => setForm(f => ({ ...f, startKm: e.target.value }))}
                required min="0" placeholder="12500" />
              {lastKm !== null && form.startKm && parseInt(form.startKm) < lastKm && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  ⚠ Wert liegt unter dem letzten km-Stand ({lastKm.toLocaleString('de-AT')} km)
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">km-Stand Ende *</label>
              <input className="input-field" type="number" value={form.endKm}
                onChange={e => handleEndKmChange(e.target.value)}
                required min="0" placeholder="12545" />
            </div>
          </div>
          {km > 0 && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="font-semibold text-emerald-700">Gefahrene Strecke: {km.toLocaleString('de-AT')} km</p>
            </div>
          )}
          {km < 0 && (
            <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
              ⚠ End-km muss größer als Start-km sein
            </div>
          )}
        </div>

        {/* Route */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Route (optional)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Von</label>
              <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.startLocation}
                onChange={e => setForm(f => ({ ...f, startLocation: e.target.value }))}
                placeholder="z.B. Görtschach" /><DiktatButton onResult={text => setForm(f => ({ ...f, startLocation: text }))} /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Nach</label>
              <div className="flex gap-2 items-center"><input className="input-field flex-1" value={form.endLocation}
                onChange={e => setForm(f => ({ ...f, endLocation: e.target.value }))}
                placeholder="z.B. Klagenfurt" /><DiktatButton onResult={text => setForm(f => ({ ...f, endLocation: text }))} /></div>
            </div>
          </div>
        </div>

        {/* Betankung */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${hasFuel ? 'bg-amber-50' : 'bg-surface-100'}`}>
                <Fuel className={`w-4 h-4 ${hasFuel ? 'text-amber-600' : 'text-ink-faint'}`} />
              </div>
              <h2 className="font-semibold text-ink">Betankung während der Fahrt</h2>
            </div>
            <button type="button" onClick={() => setHasFuel(h => !h)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                hasFuel
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-surface-100 text-ink-muted hover:bg-surface-200'
              }`}>
              {hasFuel ? <><X className="w-3.5 h-3.5" /> Entfernen</> : <><Plus className="w-3.5 h-3.5" /> Getankt</>}
            </button>
          </div>

          {hasFuel && (
            <div className="space-y-4 pt-2 border-t border-surface-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Liter *</label>
                  <input className="input-field" type="number" step="0.01" value={fuelForm.liters}
                    onChange={e => setFuelForm(f => ({ ...f, liters: e.target.value }))}
                    required={hasFuel} min="0" placeholder="45.00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Gesamtkosten (€)</label>
                  <input className="input-field" type="number" step="0.01" value={fuelForm.costTotal}
                    onChange={e => setFuelForm(f => ({ ...f, costTotal: e.target.value }))}
                    min="0" placeholder="82.50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">km-Stand beim Tanken *</label>
                  <input className="input-field" type="number" value={fuelForm.kmStand}
                    onChange={e => setFuelForm(f => ({ ...f, kmStand: e.target.value }))}
                    required={hasFuel} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
                  <div className="flex gap-2 items-center"><input className="input-field flex-1" value={fuelForm.notes}
                    onChange={e => setFuelForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="z.B. Vollgetankt" /><DiktatButton onResult={text => setFuelForm(f => ({ ...f, notes: text }))} /></div>
                </div>
              </div>
              {pricePerLiter && (
                <div className="bg-blue-50 rounded-xl px-4 py-2 text-sm text-blue-700">
                  Preis pro Liter: <strong>{pricePerLiter} €/L</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unterschriften — direkt im Formular */}
        <InlineTripSignature signatures={pendingSignatures} onChange={setPendingSignatures} />

        {/* Buttons */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(form.vehicleId ? `/vehicles/${form.vehicleId}` : '/vehicles')}
            className="btn-secondary flex-1">Abbrechen</button>
          <button type="submit" disabled={saving || km < 0} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
          </button>
        </div>
      </form>

      {/* Nachträgliche Unterschriften beim Bearbeiten */}
      {savedTripId && !isNew && (
        <div className="mt-4 bg-white rounded-2xl border border-surface-200 p-5">
          <TripSignaturePanel tripId={savedTripId} />
        </div>
      )}
    </div>
  );
}
