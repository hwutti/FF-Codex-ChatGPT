import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Wrench, Plus, X, Clock } from 'lucide-react';

interface EquipmentUsage {
  id: string;
  equipmentId: string;
  durationMin?: number;
  notes?: string;
  equipment: { id: string; name: string; category?: string; serialNumber?: string };
}

interface Props {
  entityId: string;
  entityType: 'incident' | 'event' | 'exercise';
  canEdit: boolean;
}

export default function EquipmentUsagePanel({ entityId, entityType, canEdit }: Props) {
  const [usages, setUsages] = useState<EquipmentUsage[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const basePath = entityType === 'incident' ? '/incidents' : entityType === 'exercise' ? '/exercises' : '/events';

  useEffect(() => { load(); loadEquipment(); }, [entityId]);

  const load = async () => {
    try {
      const res = await api.get(`${basePath}/${entityId}/equipment`);
      // Normalize: EventEquipment uses hoursUsed+minutesUsed, IncidentEquipment uses durationMin
      const normalized = (res.data || []).map((e: any) => ({
        ...e,
        durationMin: e.durationMin ?? (e.hoursUsed != null || e.minutesUsed != null
          ? (e.hoursUsed || 0) * 60 + (e.minutesUsed || 0)
          : undefined),
      }));
      setUsages(normalized);
    } catch {}
  };

  const loadEquipment = async () => {
    try {
      const res = await api.get('/equipment');
      setAllEquipment(res.data?.equipment || res.data || []);
    } catch {}
  };

  const add = async () => {
    if (!selectedId) { toast.error('Bitte Gerät auswählen'); return; }
    setSaving(true);
    try {
      await api.post(`${basePath}/${entityId}/equipment`, {
        equipmentId: selectedId,
        durationMin: durationMin ? parseInt(durationMin) : null,
        notes: notes || null,
      });
      setShowAdd(false);
      setSelectedId('');
      setDurationMin('');
      setNotes('');
      await load();
      toast.success('Gerät hinzugefügt');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler');
    } finally { setSaving(false); }
  };

  const remove = async (equipmentId: string) => {
    try {
      await api.delete(`${basePath}/${entityId}/equipment/${equipmentId}`);
      setUsages(u => u.filter(x => x.equipmentId !== equipmentId));
      toast.success('Gerät entfernt');
    } catch {}
  };

  const formatDuration = (min?: number) => {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  // Geräte die noch nicht ausgewählt sind
  const available = allEquipment.filter(e => !usages.find(u => u.equipmentId === e.id));

  return (
    <div className="mt-6 border-t border-surface-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
          <Wrench className="w-4 h-4" /> Eingesetztes Gerät ({usages.length})
        </h3>
        {canEdit && !showAdd && available.length > 0 && (
          <button onClick={() => setShowAdd(true)}
            className="text-sm px-3 py-1.5 bg-fire-700 text-white rounded-lg hover:bg-fire-800 transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Gerät hinzufügen
          </button>
        )}
      </div>

      {/* Vorhandene Geräte */}
      {usages.length > 0 && (
        <div className="space-y-2 mb-4">
          {usages.map(u => (
            <div key={u.equipmentId} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-surface-200 bg-amber-50">
                {u.equipment.photoUrl
                  ? <img src={u.equipment.photoUrl} alt={u.equipment.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Wrench className="w-4 h-4 text-amber-600" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-base truncate">{u.equipment.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {u.equipment.category && <span className="text-xs text-ink-muted">{u.equipment.category}</span>}
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    <Clock className="w-3 h-3" /> {formatDuration(u.durationMin)}
                  </span>
                  {u.notes && <span className="text-xs text-ink-subtle">· {u.notes}</span>}
                </div>
              </div>
              {canEdit && (
                <button onClick={() => remove(u.equipmentId)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {usages.length === 0 && !showAdd && (
        <p className="text-xs text-ink-subtle text-center py-3">Kein Gerät erfasst</p>
      )}

      {/* Gerät hinzufügen */}
      {showAdd && (
        <div className="border border-surface-200 rounded-xl p-4 bg-surface-50 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Gerät *</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="input-field w-full mt-1 text-sm">
              <option value="">— Gerät auswählen —</option>
              {available.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.category ? ` (${e.category})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Dauer (Minuten)</label>
              <input type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)}
                placeholder="z.B. 90" min="0" className="input-field w-full mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Notizen</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional" className="input-field w-full mt-1 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={saving}
              className="flex-1 py-2 bg-fire-700 text-white rounded-lg text-sm font-medium hover:bg-fire-800 disabled:opacity-50">
              {saving ? 'Speichern...' : '✓ Hinzufügen'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm text-ink-muted hover:bg-surface-100">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
