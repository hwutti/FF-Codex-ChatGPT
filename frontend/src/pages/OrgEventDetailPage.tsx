import { useEffect, useState } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, MapPin, Clock, Save, X } from 'lucide-react';
import { orgEventApi, memberApi } from '../api';
import { OrgEventType, ORG_EVENT_TYPE_LABELS, AttendanceStatus } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import AttendancePanel from '../components/AttendancePanel';


const ORG_EVENT_TYPES = Object.entries(ORG_EVENT_TYPE_LABELS) as [OrgEventType, string][];

export default function OrgEventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const isNew = id === 'new';
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    memberApi.list({ status: 'ACTIVE', limit: '500' }).then(r => setMembers(r.members || []));
    if (!isNew) {
      orgEventApi.get(id!).then(e => {
        setEvent(e);
        setForm({ type: e.type, title: e.title, date: e.date?.slice(0,10), startTime: e.startTime||'', endTime: e.endTime||'', location: e.location||'', description: e.description||'', notes: e.notes||'', responsiblePersonId: e.responsiblePersonId||'' });
      }).catch(() => { toast.error('Nicht gefunden'); navigate('/org-events'); })
      .finally(() => setLoading(false));
    } else {
      setEditing(true);
      setForm({ type: 'MEETING', title: '', date: new Date().toISOString().slice(0,10), startTime: '', endTime: '', location: '', description: '', notes: '', responsiblePersonId: '' });
      setLoading(false);
    }
  }, [id]);

  const save = async () => {
    if (!form.title || !form.date) { toast.error('Titel und Datum erforderlich'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const ev = await orgEventApi.create(form);
        toast.success('Ereignis erstellt');
        navigate(`/org-events/${ev.id}`);
      } else {
        const ev = await orgEventApi.update(id!, form);
        setEvent(ev); setEditing(false);
        toast.success('Gespeichert');
      }
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    await orgEventApi.delete(id!);
    toast.success('Gelöscht');
    navigate('/org-events');
  };

  const toggleAttendance = async (memberId: string, nextStatus?: AttendanceStatus) => {
    if (nextStatus === undefined) {
      await orgEventApi.deleteAttendance(id!, memberId);
    } else {
      await orgEventApi.updateAttendance(id!, memberId, nextStatus);
    }
    orgEventApi.get(id!).then(setEvent);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/org-events')} className="p-2 hover:bg-surface-100 rounded-xl"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-bold">{isNew ? 'Neues Ereignis' : (event?.title || 'Ereignis')}</h1>
        </div>
        {!isNew && !editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm flex items-center gap-1.5"><Edit className="w-4 h-4" /> Bearbeiten</button>
            <button onClick={() => setDeleteModal(true)} className="p-2 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4 text-red-500" /></button>
          </div>
        )}
      </div>

      {editing && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="settings-label">Ereignisart *</label>
              <select className="input-field w-full mt-1" value={form.type} onChange={e => setForm((f: any) => ({...f, type: e.target.value}))}>
                {ORG_EVENT_TYPES.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="settings-label">Titel *</label>
              <div className="flex gap-2 items-center"><input className="input-field w-full mt-1" value={form.title} onChange={e => setForm((f: any) => ({...f, title: e.target.value}))} placeholder="z.B. Jahreshauptversammlung 2026" required /><DiktatButton onResult={text => setForm((f: any) => ({...f, title: text}))} /></div>
            </div>
            <div>
              <label className="settings-label">Datum *</label>
              <input type="date" className="input-field w-full mt-1" value={form.date} onChange={e => setForm((f: any) => ({...f, date: e.target.value}))} required />
            </div>
            <div>
              <label className="settings-label">Ort</label>
              <div className="flex gap-2 items-center"><input className="input-field w-full mt-1" value={form.location} onChange={e => setForm((f: any) => ({...f, location: e.target.value}))} /><DiktatButton onResult={text => setForm((f: any) => ({...f, location: text}))} /></div>
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

      {!editing && event && (
        <div className="card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-ink-muted uppercase tracking-wider">Ereignisart</p><p className="font-medium mt-1">{ORG_EVENT_TYPE_LABELS[event.type as OrgEventType]}</p></div>
            <div><p className="text-xs text-ink-muted uppercase tracking-wider">Datum</p><p className="font-medium mt-1">{format(new Date(event.date), 'd. MMMM yyyy', { locale: de })}</p></div>
            {event.location && <div><p className="text-xs text-ink-muted uppercase tracking-wider">Ort</p><p className="font-medium mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.location}</p></div>}
            {(event.startTime || event.endTime) && <div><p className="text-xs text-ink-muted uppercase tracking-wider">Zeit</p><p className="font-medium mt-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</p></div>}
            {event.notes && <div className="col-span-2"><p className="text-xs text-ink-muted uppercase tracking-wider">Notizen</p><p className="mt-1">{event.notes}</p></div>}
          </div>
        </div>
      )}

      {!isNew && event && (
        <div className="card p-5">
          <AttendancePanel
            members={members}
            attendances={event.attendances || []}
            onToggle={toggleAttendance}
          />
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
                <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Ereignis löschen</h3>
                <p className="text-red-100 text-xs mt-0.5 truncate">{event?.title}</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-ink-muted">Das Ereignis wird dauerhaft gelöscht. Anwesenheiten werden ebenfalls entfernt.</p>
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
