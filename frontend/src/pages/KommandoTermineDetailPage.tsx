import { useEffect, useState } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, MapPin, Clock, Save, X, Shield } from 'lucide-react';
import { kommandoTerminApi, memberApi } from '../api';
import { KommandoTerminType, KOMMANDO_TERMIN_TYPE_LABELS, AttendanceStatus } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import AttendancePanel from '../components/AttendancePanel';

const TYPES = Object.entries(KOMMANDO_TERMIN_TYPE_LABELS) as [KommandoTerminType, string][];

export default function KommandoTermineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [termin, setTermin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const isNew = id === 'new';

  useEffect(() => {
    memberApi.list({ status: 'ACTIVE', limit: '500' }).then(r => setMembers(r.members || []));
    if (!isNew) {
      kommandoTerminApi.get(id!).then(t => {
        setTermin(t);
        setForm({
          type: t.type, title: t.title,
          date: t.date?.slice(0, 10) || '',
          startTime: t.startTime || '', endTime: t.endTime || '',
          location: t.location || '', description: t.description || '',
          notes: t.notes || '',
        });
      }).catch(() => { toast.error('Nicht gefunden'); navigate('/kommando-termine'); })
      .finally(() => setLoading(false));
    } else {
      setEditing(true);
      setForm({ type: 'KOMMANDO', title: '', date: new Date().toISOString().slice(0, 10), startTime: '', endTime: '', location: '', description: '', notes: '' });
      setLoading(false);
    }
  }, [id]);

  const save = async () => {
    if (!form.title || !form.date) { toast.error('Titel und Datum erforderlich'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const t = await kommandoTerminApi.create(form);
        toast.success('Termin erstellt + Kalender synchronisiert');
        navigate(`/kommando-termine/${t.id}`);
      } else {
        const t = await kommandoTerminApi.update(id!, form);
        setTermin(t); setEditing(false);
        toast.success('Gespeichert + Kalender synchronisiert');
      }
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm('Termin und verknüpften Kalender-Eintrag löschen?')) return;
    await kommandoTerminApi.delete(id!);
    toast.success('Gelöscht');
    navigate('/kommando-termine');
  };

  const toggleAttendance = async (memberId: string, nextStatus?: AttendanceStatus) => {
    if (nextStatus === undefined) {
      await kommandoTerminApi.deleteAttendance(id!, memberId);
    } else {
      await kommandoTerminApi.updateAttendance(id!, memberId, nextStatus);
    }
    kommandoTerminApi.get(id!).then(setTermin);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/kommando-termine')} className="p-2 hover:bg-surface-100 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs text-ink-muted">Kommandotermine</p>
            <h1 className="text-xl font-bold">{isNew ? 'Neuer Termin' : (termin?.title || 'Termin')}</h1>
          </div>
        </div>
        {!isNew && !editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Edit className="w-4 h-4" /> Bearbeiten
            </button>
            <button onClick={del} className="p-2 hover:bg-red-50 rounded-xl">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="settings-label">Art *</label>
              <select className="input-field w-full mt-1" value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}>
                {TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="settings-label">Titel *</label>
              <div className="flex gap-2 items-center"><input className="input-field w-full mt-1" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} required /><DiktatButton onResult={text => setForm((f: any) => ({ ...f, title: text }))} /></div>
            </div>
            <div>
              <label className="settings-label">Datum *</label>
              <input type="date" className="input-field w-full mt-1" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="settings-label">Ort</label>
              <div className="flex gap-2 items-center"><input className="input-field w-full mt-1" value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} /><DiktatButton onResult={text => setForm((f: any) => ({ ...f, location: text }))} /></div>
            </div>
            <div>
              <label className="settings-label">Beginn</label>
              <input type="time" className="input-field w-full mt-1" value={form.startTime} onChange={e => setForm((f: any) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <label className="settings-label">Ende</label>
              <input type="time" className="input-field w-full mt-1" value={form.endTime} onChange={e => setForm((f: any) => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="settings-label">Notizen</label>
              <div className="flex gap-2 items-start">
<textarea className="input-field w-full mt-1" rows={3} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
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

      {!editing && termin && (
        <div className="card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-ink-muted uppercase tracking-wider">Art</p><p className="font-medium mt-1">{KOMMANDO_TERMIN_TYPE_LABELS[termin.type as KommandoTerminType]}</p></div>
            <div><p className="text-xs text-ink-muted uppercase tracking-wider">Datum</p><p className="font-medium mt-1">{format(new Date(termin.date), 'd. MMMM yyyy', { locale: de })}</p></div>
            {termin.location && <div><p className="text-xs text-ink-muted uppercase tracking-wider">Ort</p><p className="font-medium mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{termin.location}</p></div>}
            {(termin.startTime || termin.endTime) && <div><p className="text-xs text-ink-muted uppercase tracking-wider">Zeit</p><p className="font-medium mt-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{termin.startTime}{termin.endTime ? ` – ${termin.endTime}` : ''}</p></div>}
            {termin.notes && <div className="col-span-2"><p className="text-xs text-ink-muted uppercase tracking-wider">Notizen</p><p className="mt-1">{termin.notes}</p></div>}
            {termin.calendarEventId && <div className="col-span-2"><p className="text-xs text-emerald-600 flex items-center gap-1">✓ Im Kalender Kommando synchronisiert</p></div>}
          </div>
        </div>
      )}

      {!isNew && termin && (
        <div className="card p-5">
          <AttendancePanel
            members={members}
            attendances={termin.attendances || []}
            onToggle={toggleAttendance}
          />
        </div>
      )}
    </div>
  );
}
