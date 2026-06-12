import { useEffect, useState } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, MapPin, Clock, Save, X } from 'lucide-react';
import { exerciseApi, memberApi } from '../api';
import { ExerciseType, EXERCISE_TYPE_LABELS, AttendanceStatus } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import EquipmentUsagePanel from '../components/EquipmentUsagePanel';
import AttendancePanel from '../components/AttendancePanel';


const EXERCISE_TYPES = Object.entries(EXERCISE_TYPE_LABELS) as [ExerciseType, string][];

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const isNew = id === 'new';

  useEffect(() => {
    memberApi.list({ status: 'ACTIVE', limit: '500' }).then(r => setMembers(r.members || []));
    if (!isNew) {
      exerciseApi.get(id!).then(e => {
        setExercise(e);
        setForm({ type: e.type, title: e.title, date: e.date?.slice(0,10), startTime: e.startTime||'', endTime: e.endTime||'', location: e.location||'', description: e.description||'', notes: e.notes||'', responsiblePersonId: e.responsiblePersonId||'' });
      }).catch(() => { toast.error('Nicht gefunden'); navigate('/exercises'); })
      .finally(() => setLoading(false));
    } else {
      setEditing(true);
      setForm({ type: 'RADIO', title: '', date: new Date().toISOString().slice(0,10), startTime: '', endTime: '', location: '', description: '', notes: '', responsiblePersonId: '' });
      setLoading(false);
    }
  }, [id]);

  const save = async () => {
    if (!form.title || !form.date) { toast.error('Titel und Datum erforderlich'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const ex = await exerciseApi.create(form);
        toast.success('Übung erstellt');
        navigate(`/exercises/${ex.id}`);
      } else {
        const ex = await exerciseApi.update(id!, form);
        setExercise(ex); setEditing(false);
        toast.success('Gespeichert');
      }
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const [deleteModal, setDeleteModal] = useState(false);

  const del = async () => {
    await exerciseApi.delete(id!);
    toast.success('Gelöscht');
    navigate('/exercises');
  };

  const toggleAttendance = async (memberId: string, nextStatus?: AttendanceStatus) => {
    if (nextStatus === undefined) {
      await exerciseApi.deleteAttendance(id!, memberId);
    } else {
      await exerciseApi.updateAttendance(id!, memberId, nextStatus);
    }
    exerciseApi.get(id!).then(setExercise);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/exercises')} className="p-2 hover:bg-surface-100 rounded-xl"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-bold">{isNew ? 'Neue Übung' : (exercise?.title || 'Übung')}</h1>
        </div>
        {!isNew && !editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm flex items-center gap-1.5"><Edit className="w-4 h-4" /> Bearbeiten</button>
            <button onClick={() => setDeleteModal(true)} className="p-2 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4 text-red-500" /></button>
          </div>
        )}
      </div>

      {/* Form */}
      {editing && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="settings-label">Übungsart *</label>
              <select className="input-field w-full mt-1" value={form.type} onChange={e => setForm((f: any) => ({...f, type: e.target.value}))}>
                {EXERCISE_TYPES.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="settings-label">Titel *</label>
              <div className="flex gap-2 items-center"><input className="input-field w-full mt-1" value={form.title} onChange={e => setForm((f: any) => ({...f, title: e.target.value}))} placeholder="z.B. Funkübung Görtschach" required /><DiktatButton onResult={text => setForm((f: any) => ({...f, title: text}))} /></div>
            </div>
            <div>
              <label className="settings-label">Datum *</label>
              <input type="date" className="input-field w-full mt-1" value={form.date} onChange={e => setForm((f: any) => ({...f, date: e.target.value}))} required />
            </div>
            <div>
              <label className="settings-label">Ort</label>
              <div className="flex gap-2 items-center"><input className="input-field w-full mt-1" value={form.location} onChange={e => setForm((f: any) => ({...f, location: e.target.value}))} placeholder="Görtschach" /><DiktatButton onResult={text => setForm((f: any) => ({...f, location: text}))} /></div>
            </div>
            <div>
              <label className="settings-label">Beginn</label>
              <input type="time" className="input-field w-full mt-1" value={form.startTime} onChange={e => setForm((f: any) => ({...f, startTime: e.target.value}))} />
            </div>
            <div>
              <label className="settings-label">Ende</label>
              <input type="time" className="input-field w-full mt-1" value={form.endTime} onChange={e => setForm((f: any) => ({...f, endTime: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="settings-label">Verantwortlich</label>
              <select className="input-field w-full mt-1" value={form.responsiblePersonId} onChange={e => setForm((f: any) => ({...f, responsiblePersonId: e.target.value}))}>
                <option value="">— Keine Person —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.rank || 'Mitglied'})</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="settings-label">Notizen</label>
              <div className="flex gap-2 items-start">
<textarea className="input-field w-full mt-1" rows={3} value={form.notes} onChange={e => setForm((f: any) => ({...f, notes: e.target.value}))} />
<DiktatButton onResult={text => setForm((f: any) => ({...f, notes: text}))} /></div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              <Save className="w-4 h-4" />{saving ? 'Speichern...' : 'Speichern'}
            </button>
            {!isNew && <button onClick={() => setEditing(false)} className="btn-secondary text-sm flex items-center gap-1.5"><X className="w-4 h-4" />Abbrechen</button>}
          </div>
        </div>
      )}

      {/* Info */}
      {!editing && exercise && (
        <div className="card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-ink-muted uppercase tracking-wider">Übungsart</p><p className="font-medium mt-1">{EXERCISE_TYPE_LABELS[exercise.type as ExerciseType]}</p></div>
            <div><p className="text-xs text-ink-muted uppercase tracking-wider">Datum</p><p className="font-medium mt-1">{format(new Date(exercise.date), 'd. MMMM yyyy', { locale: de })}</p></div>
            {exercise.location && <div><p className="text-xs text-ink-muted uppercase tracking-wider">Ort</p><p className="font-medium mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{exercise.location}</p></div>}
            {(exercise.startTime || exercise.endTime) && <div><p className="text-xs text-ink-muted uppercase tracking-wider">Zeit</p><p className="font-medium mt-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{exercise.startTime} {exercise.endTime ? `– ${exercise.endTime}` : ''}</p></div>}
            {exercise.notes && <div className="col-span-2"><p className="text-xs text-ink-muted uppercase tracking-wider">Notizen</p><p className="mt-1">{exercise.notes}</p></div>}
          </div>
        </div>
      )}

      {/* Anwesenheit */}
      {!isNew && exercise && (
        <div className="card p-5">
          <AttendancePanel
            members={members}
            attendances={exercise.attendances || []}
            onToggle={toggleAttendance}
          />
        </div>
      )}

      {/* Geräteeinsatz */}
      {!isNew && id && (
        <div className="card p-5">
          <EquipmentUsagePanel entityId={id} entityType="exercise" canEdit={true} />
        </div>
      )}

      {/* Löschen Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm overflow-hidden">
            <div className="bg-red-600 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Übung löschen</h3>
                <p className="text-red-100 text-xs mt-0.5 truncate">{exercise?.title}</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-ink-muted">Die Übung wird dauerhaft gelöscht. Anwesenheiten und Geräteeinsätze werden ebenfalls entfernt.</p>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => setDeleteModal(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={() => { setDeleteModal(false); del(); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
