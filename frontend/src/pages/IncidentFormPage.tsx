import React, { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams } from 'react-router-dom';
import { incidentApi, memberApi } from '../api';
import { Member, Incident, IncidentType, INCIDENT_TYPE_LABELS } from '../types';
import toast from 'react-hot-toast';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import EquipmentUsagePanel from '../components/EquipmentUsagePanel';
import { ArrowLeft, Save } from 'lucide-react';

const IncidentFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { confirmNavigation, resolve: resolveGuard } = useUnsavedGuard(() => navigate(-1));
  const guardedNavigate = async (path: string) => {
    const result = await confirmNavigation();
    if (result === 'cancel') return;
    navigate(path);
  };

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    type: 'FIRE' as IncidentType,
    alarmTime: '',
    departureTime: '',
    endTime: '',
    location: '',
    shortReport: '',
    actions: '',
    specialOccurrences: '',
    commanderId: '',
    memberIds: [] as string[],
  });

  useEffect(() => {
    memberApi.list({ status: 'ACTIVE', limit: '200' }).then(r => setMembers(r.members || []));
    if (isEdit) {
      setLoading(true);
      incidentApi.get(id!).then(r => {
        const inc: Incident = r;
        setForm({
          title: (inc as any).title || '',
          type: inc.type,
          alarmTime: inc.alarmTime ? inc.alarmTime.slice(0, 16) : '',
          departureTime: inc.departureTime ? inc.departureTime.slice(0, 16) : '',
          endTime: inc.endTime ? inc.endTime.slice(0, 16) : '',
          location: inc.location || '',
          shortReport: inc.shortReport || '',
          actions: inc.actions || '',
          specialOccurrences: inc.specialOccurrences || '',
          commanderId: inc.commanderId || '',
          memberIds: (inc as any).members?.map((m: any) => m.memberId || m.id) || [],
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        alarmTime: form.alarmTime ? new Date(form.alarmTime).toISOString() : undefined,
        departureTime: form.departureTime ? new Date(form.departureTime).toISOString() : undefined,
        endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
        commanderId: form.commanderId || undefined,
      };
      if (isEdit) {
        await incidentApi.update(id!, payload);
        toast.success('Einsatz aktualisiert');
      } else {
        await incidentApi.create(payload);
        toast.success('Einsatz angelegt');
      }
      guardedNavigate('/incidents');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(memberId)
        ? f.memberIds.filter(id => id !== memberId)
        : [...f.memberIds, memberId],
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fire-600" /></div>;

  return (
    <>
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => guardedNavigate('/incidents')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grunddaten */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Einsatzdaten</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
              <div className="flex gap-2 items-center">
              <input
                className="input-field flex-1"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Wohnhausbrand Hauptstraße 5"
                required
              />
              <DiktatButton onResult={text => setForm(f => ({ ...f, title: text }))} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Einsatzart *</label>
              <select
                className="input-field"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as IncidentType }))}
                required
              >
                {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alarmierungszeit *</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.alarmTime}
                onChange={e => setForm(f => ({ ...f, alarmTime: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ausrückezeit</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.departureTime}
                onChange={e => setForm(f => ({ ...f, departureTime: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einsatzende</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einsatzort *</label>
              <input
                type="text"
                className="input-field"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="z.B. Hauptstraße 12, Musterdorf"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Einsatzleiter</label>
              <select
                className="input-field"
                value={form.commanderId}
                onChange={e => setForm(f => ({ ...f, commanderId: e.target.value }))}
              >
                <option value="">-- kein Einsatzleiter ausgewählt --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kurzbericht</label>
              <div className="flex gap-2 items-start">
<textarea
                className="input-field"
                rows={4}
                value={form.shortReport}
                onChange={e => setForm(f => ({ ...f, shortReport: e.target.value }))}
                placeholder="Kurze Beschreibung des Einsatzes..."
              />
<DiktatButton onResult={text => setForm(f => ({ ...f, shortReport: text }))} /></div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Maßnahmen</label>
              <div className="flex gap-2 items-start">
<textarea
                className="input-field"
                rows={3}
                value={form.actions}
                onChange={e => setForm(f => ({ ...f, actions: e.target.value }))}
                placeholder="Ergriffene Maßnahmen..."
              />
<DiktatButton onResult={text => setForm(f => ({ ...f, actions: text }))} /></div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Besondere Vorkommnisse</label>
              <div className="flex gap-2 items-start">
<textarea
                className="input-field"
                rows={2}
                value={form.specialOccurrences}
                onChange={e => setForm(f => ({ ...f, specialOccurrences: e.target.value }))}
                placeholder="Besondere Vorkommnisse..."
              />
<DiktatButton onResult={text => setForm(f => ({ ...f, specialOccurrences: text }))} /></div>
            </div>
          </div>
        </div>

        {/* Teilnehmende Mitglieder */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Teilnehmende Mitglieder
            <span className="ml-2 text-sm font-normal text-gray-500">({form.memberIds.length} ausgewählt)</span>
          </h2>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-3 py-2 px-1 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.memberIds.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                  className="h-4 w-4 text-fire-600 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">{m.firstName} {m.lastName}</span>
                {m.rank && <span className="text-xs text-gray-500">{m.rank}</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => guardedNavigate('/incidents')} className="btn-secondary flex-1 sm:flex-none">
            Abbrechen
          </button>
          {isEdit && (
            <button type="button" onClick={async () => {
              if (!confirm('Einsatz wirklich löschen?')) return;
              try {
                await incidentApi.delete(id!);
                toast.success('Einsatz gelöscht');
                guardedNavigate('/incidents');
              } catch { toast.error('Fehler beim Löschen'); }
            }} className="btn-danger flex-shrink-0">
              Löschen
            </button>
          )}
          <button type="submit" disabled={saving} className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </form>
      {/* Eingesetztes Gerät — nur beim Bearbeiten */}
      {id && (
        <div className="bg-white rounded-2xl border border-surface-200 p-5 mt-4">
          <EquipmentUsagePanel entityId={id} entityType="incident" canEdit={true} />
        </div>
      )}
    </div>
      <UnsavedChangesModal
        onSave={async () => { try { await handleSubmit(); return true; } catch { return false; } }}
        onResolve={resolveGuard}
      />
    </>
  );
};

export default IncidentFormPage;
