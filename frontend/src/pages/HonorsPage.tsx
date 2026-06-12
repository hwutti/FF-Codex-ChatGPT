import React, { useState, useEffect } from 'react';
import DiktatButton from '../components/DiktatButton';
import { honorApi, memberApi } from '../api';
import { Honor, Member } from '../types';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Award, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface HonorForm {
  memberId: string;
  title: string;
  honorDate: string;
  reason: string;
  awardedBy: string;
  notes: string;
}

const emptyForm: HonorForm = {
  memberId: '', title: '', honorDate: '', reason: '', awardedBy: '', notes: '',
};

const HonorsPage: React.FC = () => {
  const [honors, setHonors] = useState<Honor[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<HonorForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadHonors = () => {
    setLoading(true);
    honorApi.list().then(r => setHonors(r.honors || r || [])).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHonors();
    memberApi.list({ limit: '200' }).then(r => setMembers(r.members || []));
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (h: Honor) => {
    setEditId(h.id);
    setForm({
      memberId: h.memberId,
      title: h.title,
      honorDate: h.honorDate ? h.honorDate.slice(0, 10) : '',
      reason: h.reason || '',
      awardedBy: h.awardedBy || '',
      notes: h.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, honorDate: form.honorDate ? new Date(form.honorDate).toISOString() : undefined };
      if (editId) {
        await honorApi.update(editId, payload);
        toast.success('Ehrung aktualisiert');
      } else {
        await honorApi.create(payload);
        toast.success('Ehrung angelegt');
      }
      setShowModal(false);
      loadHonors();
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ehrung wirklich löschen?')) return;
    try {
      await honorApi.delete(id);
      toast.success('Ehrung gelöscht');
      loadHonors();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  const getMemberName = (memberId: string) => {
    const m = members.find(m => m.id === memberId);
    return m ? `${m.firstName} ${m.lastName}` : 'Unbekannt';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ehrungen</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Neue Ehrung
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fire-600" />
        </div>
      ) : honors.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Award className="h-14 w-14 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Noch keine Ehrungen erfasst</p>
          <button onClick={openCreate} className="mt-4 btn-primary">Erste Ehrung anlegen</button>
        </div>
      ) : (
        <div className="space-y-3">
          {honors.map(h => (
            <div key={h.id} className="card flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{h.title}</p>
                    <p className="text-sm text-fire-600 font-medium">{getMemberName(h.memberId)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(h)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(h.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  {h.honorDate && <span>{format(parseISO(h.honorDate), 'd. MMMM yyyy', { locale: de })}</span>}
                  {h.awardedBy && <span>Verliehen durch: {h.awardedBy}</span>}
                  {h.reason && <span className="truncate max-w-xs">{h.reason}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editId ? 'Ehrung bearbeiten' : 'Neue Ehrung'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kamerad:in *</label>
                <select className="input-field" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} required>
                  <option value="">-- Kamerad:in wählen --</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
                <div className="flex gap-2 items-center">
                  <input type="text" className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Verdienstmedaille in Bronze" required />
                  <DiktatButton onResult={text => setForm(f => ({ ...f, title: text }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum der Verleihung</label>
                <input type="date" className="input-field" value={form.honorDate} onChange={e => setForm(f => ({ ...f, honorDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anlass</label>
                <div className="flex gap-2 items-center">
                  <input type="text" className="input-field" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Anlass der Verleihung" />
                  <DiktatButton onResult={text => setForm(f => ({ ...f, reason: text }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verliehen durch</label>
                <div className="flex gap-2 items-center">
                  <input type="text" className="input-field" value={form.awardedBy} onChange={e => setForm(f => ({ ...f, awardedBy: e.target.value }))} placeholder="z.B. Landesfeuerwehrverband" />
                  <DiktatButton onResult={text => setForm(f => ({ ...f, awardedBy: text }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bemerkungen</label>
                <div className="flex gap-2 items-center">
                  <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Abbrechen</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /> {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HonorsPage;
