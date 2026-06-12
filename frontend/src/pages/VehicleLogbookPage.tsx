import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Plus, Wrench, MapPin, Fuel, AlertTriangle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicleApi } from '../api';

function fmt(n?: number | null) { return n?.toLocaleString('de-AT') ?? '—'; }
function fmtCost(n?: number | null) {
  if (!n) return '—';
  return n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' });
}

export default function VehicleLogbookPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([vehicleApi.listVehicles(), vehicleApi.getStats()])
      .then(([v, s]) => { setVehicles(v || []); setStats(s || []); })
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  const getStats = (id: string) => stats.find((s: any) => s.vehicle.id === id);

  const totalKm = stats.reduce((s: number, v: any) => s + (v.drivenKm || 0), 0);
  const totalCost = stats.reduce((s: number, v: any) => s + (v.totalFuelCost || 0), 0);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Fahrtenbuch</h1>
          <p className="text-sm text-ink-muted mt-0.5">Fahrzeuge, Fahrten, Tankeinträge & Wartung</p>
        </div>
        <button onClick={() => navigate('/vehicles/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Fahrzeug
        </button>
      </div>

      {/* Gesamt-Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Fahrzeuge', value: vehicles.filter(v => v.isActive).length, icon: Car, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Fahrten gesamt', value: stats.reduce((s: number, v: any) => s + (v.totalTrips || 0), 0), icon: MapPin, color: 'text-fire-700', bg: 'bg-fire-50' },
            { label: 'km gesamt', value: fmt(totalKm), icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Kraftstoff', value: fmtCost(totalCost), icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((s, i) => (
            <div key={i} className="card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-ink truncate" style={{ fontFamily: 'var(--font-headings)' }}>{s.value}</p>
                <p className="text-xs text-ink-muted">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fahrzeuge */}
      {vehicles.length === 0 ? (
        <div className="card text-center py-16">
          <Car className="w-14 h-14 text-ink-faint mx-auto mb-4" />
          <p className="font-semibold text-ink mb-1">Noch keine Fahrzeuge angelegt</p>
          <p className="text-sm text-ink-muted mb-6">Lege dein erstes Fahrzeug an um zu beginnen</p>
          <button onClick={() => navigate('/vehicles/new')} className="btn-primary mx-auto">
            Erstes Fahrzeug anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map(v => {
            const s = getStats(v.id);
            const nextMaint = v.maintenances?.[0];
            const daysUntil = nextMaint?.nextDueDate
              ? Math.ceil((new Date(nextMaint.nextDueDate).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <div key={v.id} onClick={() => navigate(`/vehicles/${v.id}`)}
                className="card hover:shadow-lg transition-all cursor-pointer group">
                {/* Foto */}
                <div className="w-full h-40 rounded-xl overflow-hidden bg-surface-100 mb-4">
                  {v.photoUrl
                    ? <img src={v.photoUrl} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Car className="w-10 h-10 text-ink-faint" />
                        <p className="text-xs text-ink-faint">Kein Foto</p>
                      </div>
                  }
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{v.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {v.licensePlate && <span className="text-xs font-mono bg-surface-100 px-2 py-0.5 rounded text-ink-muted">{v.licensePlate}</span>}
                      {v.type && <span className="text-xs text-ink-faint">{v.type.split(' - ')[0]}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-faint flex-shrink-0 mt-0.5 group-hover:text-fire-700 transition-colors" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-surface-100">
                  <div className="text-center">
                    <p className="text-sm font-bold text-ink">{fmt(v.currentKm)}</p>
                    <p className="text-xs text-ink-faint">km-Stand</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-ink">{s?.totalTrips ?? 0}</p>
                    <p className="text-xs text-ink-faint">Fahrten</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-ink">{fmt(s?.drivenKm)}</p>
                    <p className="text-xs text-ink-faint">km gesamt</p>
                  </div>
                </div>

                {daysUntil !== null && (
                  <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
                    daysUntil <= 0 ? 'bg-red-50 text-red-600' :
                    daysUntil <= 30 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {daysUntil <= 0 ? 'Wartung überfällig!' :
                     daysUntil <= 30 ? `Wartung in ${daysUntil} Tagen fällig` :
                     `Nächste Wartung in ${daysUntil} Tagen`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
