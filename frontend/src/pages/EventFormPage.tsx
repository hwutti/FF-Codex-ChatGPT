import { useEffect, useState } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Wrench } from 'lucide-react';
import { eventApi, memberApi } from '../api';
import api from '../api';
import { EventType, EVENT_TYPE_LABELS, EVENT_FORM_TYPES } from '../types';
import toast from 'react-hot-toast';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';

export default function EventFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { confirmNavigation, resolve: resolveGuard } = useUnsavedGuard(dirty);
  const guardedNavigate = async (path: string) => {
    const result = await confirmNavigation();
    if (result === 'cancel') return;
    navigate(path);
  };
  const [members, setMembers] = useState<any[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);

  // Geräte-Liste für dieses Ereignis
  const [eventEquipment, setEventEquipment] = useState<{
    equipmentId: string;
    hoursUsed: string;
    minutesUsed: string;
    notes: string;
  }[]>([]);

  const [form, setForm] = useState({
    type: 'EXERCISE' as EventType,
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    responsiblePersonId: '',
    notes: '',
    createAttendanceForAll: true,
  });

  useEffect(() => {
    memberApi.list({ status: 'ACTIVE', limit: '200' }).then(d => setMembers(d.members));
    // Alle aktiven Geräte laden
    api.get('/equipment?limit=200').then(r => setAllEquipment(r.data.equipment || r.data || [])).catch(() => {});
    if (isEdit) {
      eventApi.get(id!).then(e => setForm({
        type: e.type,
        title: e.title,
        date: e.date.split('T')[0],
        startTime: e.startTime || '',
        endTime: e.endTime || '',
        location: e.location || '',
        description: e.description || '',
        responsiblePersonId: e.responsiblePersonId || '',
        notes: e.notes || '',
        createAttendanceForAll: false,
      })).catch(() => { toast.error('Nicht gefunden'); navigate('/events'); });
      // Bestehende Geräte laden
      api.get(`/events/${id}/equipment`).then(r => {
        setEventEquipment((r.data || []).map((item: any) => ({
          equipmentId: item.equipmentId,
          hoursUsed: item.hoursUsed?.toString() || '',
          minutesUsed: item.minutesUsed?.toString() || '',
          notes: item.notes || '',
        })));
      }).catch(() => {});
    }
  }, [id]);

  const set = (field: string, value: any) => { setForm(f => ({ ...f, [field]: value })); setDirty(true); };

  const addEquipment = () => {
    setEventEquipment(prev => [...prev, { equipmentId: '', hoursUsed: '', minutesUsed: '', notes: '' }]);
  };

  const removeEquipment = (idx: number) => {
    setEventEquipment(prev => prev.filter((_, i) => i !== idx));
  };

  const updateEquipment = (idx: number, field: string, value: string) => {
    setEventEquipment(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      let eventId = id!;
      if (isEdit) {
        await eventApi.update(id!, form);
      } else {
        const event = await eventApi.create(form);
        eventId = event.id;
      }

      // Geräte speichern
      const validEquipment = eventEquipment.filter(eq => eq.equipmentId);
      for (const eq of validEquipment) {
        await api.post(`/events/${eventId}/equipment`, {
          equipmentId: eq.equipmentId,
          hoursUsed: eq.hoursUsed ? parseInt(eq.hoursUsed) : null,
          minutesUsed: eq.minutesUsed ? parseInt(eq.minutesUsed) : null,
          notes: eq.notes || null,
        });
      }

      toast.success(isEdit ? 'Ereignis aktualisiert' : 'Ereignis angelegt');
      navigate(isEdit ? `/events/${id}` : `/events/${eventId}/attendance`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  // Bereits ausgewählte Geräte-IDs
  const selectedIds = eventEquipment.map(eq => eq.equipmentId).filter(Boolean);

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => guardedNavigate('/events')} className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Ereignis bearbeiten' : 'Übung / Ereignis anlegen'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Grunddaten ── */}
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ereignisart *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field" required>
                {Object.entries(EVENT_FORM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Datum *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Titel *</label>
            <div className="flex gap-2 items-center">
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className="input-field" required />
              <DiktatButton onResult={text => set('title', text)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Beginn</label>
              <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ende</label>
              <input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ort</label>
            <div className="flex gap-2 items-center">
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className="input-field" />
              <DiktatButton onResult={text => set('location', text)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Verantwortliche Person</label>
            <select value={form.responsiblePersonId} onChange={e => set('responsiblePersonId', e.target.value)} className="input-field">
              <option value="">— Keine —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.lastName} {m.firstName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Beschreibung</label>
            <div className="flex gap-2 items-start">
<div className="flex gap-2 items-center">
  <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input-field resize-none" rows={3} />
  <DiktatButton onResult={text => set('description', text)} />
</div>
<DiktatButton onResult={text => set('description', text)} /></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bemerkungen</label>
            <div className="flex gap-2 items-start">
<div className="flex gap-2 items-center">
  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-none" rows={2} />
  <DiktatButton onResult={text => set('notes', text)} />
</div>
<DiktatButton onResult={text => set('notes', text)} /></div>
          </div>

          {!isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.createAttendanceForAll} onChange={e => set('createAttendanceForAll', e.target.checked)} className="w-4 h-4 accent-fire-700" />
              <span className="text-sm text-gray-700">Anwesenheitseinträge für alle aktiven Mitglieder anlegen</span>
            </label>
          )}
        </div>

        {/* ── Verwendete Geräte ── */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-ink-muted" />
              <h2 className="text-sm font-semibold text-gray-700">Verwendete Geräte</h2>
            </div>
            <button type="button" onClick={addEquipment}
              className="flex items-center gap-1.5 text-xs text-fire-700 hover:text-fire-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-fire-50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Gerät hinzufügen
            </button>
          </div>

          {eventEquipment.length === 0 && (
            <p className="text-xs text-ink-muted text-center py-3">Noch kein Gerät hinzugefügt</p>
          )}

          {eventEquipment.map((eq, idx) => (
            <div key={idx} className="bg-surface-50 rounded-xl p-3 space-y-3 border border-surface-200">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gerät *</label>
                  <select value={eq.equipmentId} onChange={e => updateEquipment(idx, 'equipmentId', e.target.value)}
                    className="input-field text-sm" required={eq.equipmentId !== '' || eventEquipment.some(e => e.equipmentId)}>
                    <option value="">— Gerät auswählen —</option>
                    {allEquipment
                      .filter(eq2 => eq2.isActive !== false)
                      .map(eq2 => (
                        <option key={eq2.id} value={eq2.id}
                          disabled={selectedIds.includes(eq2.id) && eq2.id !== eq.equipmentId}>
                          {eq2.name}{eq2.category ? ` (${eq2.category})` : ''}{eq2.location ? ` · ${eq2.location}` : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>
                <button type="button" onClick={() => removeEquipment(idx)}
                  className="mt-5 p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Betriebsdauer — Stunden</label>
                  <input type="number" min="0" max="99" placeholder="0"
                    value={eq.hoursUsed} onChange={e => updateEquipment(idx, 'hoursUsed', e.target.value)}
                    className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Minuten</label>
                  <input type="number" min="0" max="59" placeholder="0"
                    value={eq.minutesUsed} onChange={e => updateEquipment(idx, 'minutesUsed', e.target.value)}
                    className="input-field text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bemerkung (optional)</label>
                <input type="text" placeholder="z.B. Pumpe lief einwandfrei"
                  value={eq.notes} onChange={e => updateEquipment(idx, 'notes', e.target.value)}
                  className="input-field text-sm" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => guardedNavigate('/events')} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Speichern' : 'Anlegen & Anwesenheit erfassen'}
          </button>
        </div>
      </form>
      <UnsavedChangesModal
        onSave={async () => {
          try { await handleSubmit(); return true; } catch { return false; }
        }}
        onResolve={resolveGuard}
      />
    </div>
  );
}
