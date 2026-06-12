import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Plus, ChevronRight, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { equipmentApi } from '../api';

function fmtDate(d?: string | null) { if (!d) return null; return new Date(d).toLocaleDateString('de-AT'); }

const CATEGORY_ICONS: Record<string, string> = {
  'Atemschutzgeräte': '😷',
  'Pumpen': '💧',
  'Motorsägen': '🪚',
  'Stromerzeuger': '⚡',
  'Beleuchtung': '💡',
  'Werkzeug': '🔧',
  'Funkgeräte': '📻',
  'Sonstiges': '📦',
};

export default function EquipmentPage() {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([equipmentApi.list(), equipmentApi.getStats()])
      .then(([e, s]) => { setEquipment(e || []); setStats(s); })
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = equipment.filter(e =>
    !filter || e.name.toLowerCase().includes(filter.toLowerCase()) ||
    e.category?.toLowerCase().includes(filter.toLowerCase()) ||
    e.location?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Gerätebuch</h1>
          <p className="text-sm text-ink-muted mt-0.5">Geräte, Prüfungen, Reparaturen & Ausgaben</p>
        </div>
        <button onClick={() => navigate('/equipment/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Gerät anlegen
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Geräte gesamt', value: stats.total, color: 'text-ink', bg: 'bg-surface-100' },
            { label: 'Aktiv', value: stats.active, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Prüfung fällig', value: stats.dueChecks, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Offene Defekte', value: stats.openDefects, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Ausgegeben', value: stats.activeLoans, color: 'text-blue-700', bg: 'bg-blue-50' },
          ].map((s, i) => (
            <div key={i} className={`card ${s.bg} text-center`}>
              <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: 'var(--font-headings)' }}>{s.value}</p>
              <p className="text-xs text-ink-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Suche */}
      <input className="input-field" placeholder="Suche nach Name, Kategorie, Standort..." value={filter} onChange={e => setFilter(e.target.value)} />

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Wrench className="w-14 h-14 text-ink-faint mx-auto mb-4" />
          <p className="font-semibold text-ink mb-1">{filter ? 'Keine Geräte gefunden' : 'Noch keine Geräte angelegt'}</p>
          {!filter && <button onClick={() => navigate('/equipment/new')} className="btn-primary mt-4 mx-auto">Erstes Gerät anlegen</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const openDefects = e.defects?.filter((d: any) => d.status !== 'Behoben') || [];
            const activeLoan = e.loans?.[0];
            const daysUntilCheck = e.nextCheckDate
              ? Math.ceil((new Date(e.nextCheckDate).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <div key={e.id} onClick={() => navigate(`/equipment/${e.id}`)}
                className="card hover:shadow-md transition-all cursor-pointer group flex items-center gap-4">
                {/* Foto */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0">
                  {e.photoUrl
                    ? <img src={e.photoUrl} alt={e.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">
                        {CATEGORY_ICONS[e.category] || '📦'}
                      </div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{e.name}</h3>
                    {!e.isActive && <span className="text-xs bg-surface-200 text-ink-muted px-2 py-0.5 rounded-full">Inaktiv</span>}
                    {openDefects.length > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠ {openDefects.length} Defekt{openDefects.length > 1 ? 'e' : ''}</span>}
                    {activeLoan && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📤 Ausgegeben</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {e.category && <span className="text-xs text-ink-muted">{e.category}</span>}
                    {e.location && <span className="text-xs text-ink-faint">📍 {e.location}</span>}
                    {e.serialNumber && <span className="text-xs text-ink-faint font-mono">S/N: {e.serialNumber}</span>}
                  </div>
                  {daysUntilCheck !== null && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${
                      daysUntilCheck <= 0 ? 'text-red-600 font-medium' :
                      daysUntilCheck <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      <Shield className="w-3 h-3" />
                      {daysUntilCheck <= 0 ? 'Prüfung überfällig!' :
                       daysUntilCheck <= 30 ? `Prüfung in ${daysUntilCheck} Tagen` :
                       `Nächste Prüfung: ${fmtDate(e.nextCheckDate)}`}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-ink-faint flex-shrink-0 group-hover:text-fire-700 transition-colors" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
