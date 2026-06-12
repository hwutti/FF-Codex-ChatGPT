import { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Calendar, MapPin, Clock } from 'lucide-react';
import api from '../api';
import { memberApi, exerciseApi, orgEventApi, kommandoTerminApi } from '../api';
import toast from 'react-hot-toast';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import ColorPicker from '../components/ColorPicker';
import { EXERCISE_TYPE_LABELS, ExerciseType, ORG_EVENT_TYPE_LABELS, OrgEventType, KOMMANDO_TERMIN_TYPE_LABELS, KommandoTerminType } from '../types';

const STATUS_OPTIONS = [
  { value: 'PLANNED', label: 'Geplant' },
  { value: 'CONFIRMED', label: 'Bestätigt' },
  { value: 'CANCELLED', label: 'Abgesagt' },
];

// Nur für Kalender Allgemein
const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Nur Kalender (keine Verknüpfung)' },
  { value: 'EXERCISE', label: '🏋️ Übung anlegen' },
  { value: 'ORG_EVENT', label: '📅 Ereignis anlegen' },
];

// Nur für Kalender Kommando
const SOURCE_TYPE_COMMAND_OPTIONS = [
  { value: '', label: 'Nur Kalender (keine Verknüpfung)' },
  { value: 'KOMMANDO_TERMIN', label: '🛡️ Kommandotermin anlegen' },
];

interface Props {
  isCommand?: boolean;
}

export default function CalendarEventFormPage({ isCommand = false }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  const { resolveGuard } = useUnsavedGuard(() => navigate(-1));
  const backPath = isCommand ? '/calendar-command' : '/calendar';
  const apiBase = isCommand ? '/calendar-command' : '/calendar';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState(''); // EXERCISE | ORG_EVENT | KOMMANDO_TERMIN | ''
  const [exerciseType, setExerciseType] = useState<ExerciseType>('RADIO');
  const [orgEventType, setOrgEventType] = useState<OrgEventType>('MEETING');
  const [kommandoTerminType, setKommandoTerminType] = useState<KommandoTerminType>('KOMMANDO');
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    trainingLocation: '',
    commanderId: '',
    status: 'PLANNED',
    allDay: false,
    startDate: searchParams.get('date') || new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endDate: searchParams.get('date') || new Date().toISOString().slice(0, 10),
    endTime: '10:00',
    categoryId: '',
  });

  useEffect(() => {
    memberApi.list({ status: 'ACTIVE', limit: '500' }).then(r => setMembers(r.members || []));
    api.get(`${apiBase}/categories`).then(r => setCategories(r.data || []));

    if (!isNew) {
      api.get(`${apiBase}/events/${id}`).then(r => {
        const e = r.data;
        const start = new Date(e.startDate);
        const end = new Date(e.endDate);
        setForm({
          title: e.title || '',
          description: e.description || '',
          location: e.location || '',
          trainingLocation: e.trainingLocation || '',
          commanderId: e.commanderId || '',
          status: e.status || 'PLANNED',
          allDay: e.allDay || false,
          startDate: start.toISOString().slice(0, 10),
          startTime: start.toTimeString().slice(0, 5),
          endDate: end.toISOString().slice(0, 10),
          endTime: end.toTimeString().slice(0, 5),
          categoryId: e.categoryId || '',
        });
      }).catch(() => { toast.error('Termin nicht gefunden'); navigate(backPath); })
      .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.title) { toast.error('Titel erforderlich'); return; }
    setSaving(true);
    try {
      const startDate = form.allDay
        ? new Date(form.startDate).toISOString()
        : new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const endDate = form.allDay
        ? new Date(form.endDate).toISOString()
        : new Date(`${form.endDate}T${form.endTime}`).toISOString();

      if (isNew && !isCommand && sourceType === 'EXERCISE') {
        // Übung anlegen → sync erstellt automatisch Kalender-Eintrag
        await exerciseApi.create({
          title: form.title,
          type: exerciseType,
          date: form.startDate,
          startTime: form.allDay ? null : form.startTime,
          endTime: form.allDay ? null : form.endTime,
          location: form.location || null,
          description: form.description || null,
        });
        toast.success('Übung angelegt + im Kalender eingetragen');
        navigate('/exercises');
        return;
      }

      if (isNew && !isCommand && sourceType === 'ORG_EVENT') {
        // Ereignis anlegen → sync erstellt automatisch Kalender-Eintrag
        await orgEventApi.create({
          title: form.title,
          type: orgEventType,
          date: form.startDate,
          startTime: form.allDay ? null : form.startTime,
          endTime: form.allDay ? null : form.endTime,
          location: form.location || null,
          description: form.description || null,
        });
        toast.success('Ereignis angelegt + im Kalender eingetragen');
        navigate('/org-events');
        return;
      }

      if (isNew && isCommand && sourceType === 'KOMMANDO_TERMIN') {
        // Kommandotermin anlegen → sync erstellt automatisch Kalender-Kommando-Eintrag
        await kommandoTerminApi.create({
          title: form.title,
          type: kommandoTerminType,
          date: form.startDate,
          startTime: form.allDay ? null : form.startTime,
          endTime: form.allDay ? null : form.endTime,
          location: form.location || null,
          description: form.description || null,
        });
        toast.success('Kommandotermin angelegt + im Kalender eingetragen');
        navigate('/kommando-termine');
        return;
      }

      // Normaler Kalender-Eintrag
      const payload = { ...form, startDate, endDate };
      if (isNew) {
        await api.post(`${apiBase}/events`, payload);
        toast.success('Termin erstellt');
      } else {
        await api.put(`${apiBase}/events/${id}`, payload);
        toast.success('Termin aktualisiert');
      }
      navigate(backPath);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  const title = isCommand ? 'Kalender Kommando' : 'Kalender Allgemein';

  return (
    <>
    <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backPath)} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs text-ink-muted">{title}</p>
          <h1 className="text-xl font-bold text-ink-base">{isNew ? 'Neuer Termin' : 'Termin bearbeiten'}</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Grunddaten */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-ink-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-fire-700" /> Grunddaten
          </h2>

          {/* Art-Auswahl nur für Kalender Allgemein bei neuen Terminen */}
          {!isCommand && isNew && (
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
              <div>
                <label className="settings-label">Art des Eintrags</label>
                <select className="input-field w-full mt-1" value={sourceType}
                  onChange={e => setSourceType(e.target.value)}>
                  {SOURCE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {sourceType === 'EXERCISE' && (
                <div>
                  <label className="settings-label">Übungsart</label>
                  <select className="input-field w-full mt-1" value={exerciseType}
                    onChange={e => setExerciseType(e.target.value as ExerciseType)}>
                    {Object.entries(EXERCISE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              {sourceType === 'ORG_EVENT' && (
                <div>
                  <label className="settings-label">Ereignisart</label>
                  <select className="input-field w-full mt-1" value={orgEventType}
                    onChange={e => setOrgEventType(e.target.value as OrgEventType)}>
                    {Object.entries(ORG_EVENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              {sourceType && (
                <p className="text-xs text-emerald-600">
                  ✓ Wird automatisch auch unter {sourceType === 'EXERCISE' ? 'Übungen' : 'Ereignisse'} eingetragen
                </p>
              )}
            </div>
          )}

          {/* Art-Auswahl für Kalender Kommando bei neuen Terminen */}
          {isCommand && isNew && (
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
              <div>
                <label className="settings-label">Art des Eintrags</label>
                <select className="input-field w-full mt-1" value={sourceType}
                  onChange={e => setSourceType(e.target.value)}>
                  {SOURCE_TYPE_COMMAND_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {sourceType === 'KOMMANDO_TERMIN' && (
                <div>
                  <label className="settings-label">Art des Termins</label>
                  <select className="input-field w-full mt-1" value={kommandoTerminType}
                    onChange={e => setKommandoTerminType(e.target.value as KommandoTerminType)}>
                    {Object.entries(KOMMANDO_TERMIN_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              {sourceType === 'KOMMANDO_TERMIN' && (
                <p className="text-xs text-emerald-600">
                  ✓ Wird automatisch auch unter Kommandotermine eingetragen
                </p>
              )}
            </div>
          )}

          <div>
            <label className="settings-label">Titel *</label>
            <input className="input-field w-full mt-1" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="z.B. Jahreshauptübung 2026" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="settings-label">Kategorie</label>
              <select className="input-field w-full mt-1" value={form.categoryId}
                onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">— Keine Kategorie —</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="settings-label">Status</label>
              <select className="input-field w-full mt-1" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="settings-label">Beschreibung</label>
            <div className="flex gap-2 items-start">
<textarea className="input-field w-full mt-1" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optionale Beschreibung..." />
<DiktatButton onResult={text => setForm(f => ({ ...f, description: text }))} /></div>
          </div>
        </div>

        {/* Datum & Zeit */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-ink-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-fire-700" /> Datum & Zeit
          </h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.allDay}
              onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm font-medium text-ink-base">Ganztägig</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="settings-label">Startdatum *</label>
              <input type="date" className="input-field w-full mt-1" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </div>
            {!form.allDay && (
              <div>
                <label className="settings-label">Startzeit</label>
                <input type="time" className="input-field w-full mt-1" value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="settings-label">Enddatum *</label>
              <input type="date" className="input-field w-full mt-1" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
            </div>
            {!form.allDay && (
              <div>
                <label className="settings-label">Endzeit</label>
                <input type="time" className="input-field w-full mt-1" value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            )}
          </div>
        </div>

        {/* Ort & Kommandant */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-ink-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fire-700" /> Ort & Verantwortliche
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="settings-label">Ort</label>
              <input className="input-field w-full mt-1" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="z.B. Feuerwehrhaus Görtschach" />
            </div>
            <div>
              <label className="settings-label">Übungsort</label>
              <input className="input-field w-full mt-1" value={form.trainingLocation}
                onChange={e => setForm(f => ({ ...f, trainingLocation: e.target.value }))}
                placeholder="z.B. Waldgebiet Radnig" />
            </div>
          </div>

          <div>
            <label className="settings-label">Kommandant</label>
            <select className="input-field w-full mt-1" value={form.commanderId}
              onChange={e => setForm(f => ({ ...f, commanderId: e.target.value }))}>
              <option value="">— Kein Kommandant ausgewählt —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}{m.rank ? ` · ${m.rank}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(backPath)} className="btn-secondary flex-1">
            Abbrechen
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
      <UnsavedChangesModal
        onSave={async () => { try { await handleSave(); return true; } catch { return false; } }}
        onResolve={resolveGuard}
      />
    </>
  );
}
