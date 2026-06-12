import React, { useState, useEffect, useRef } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Camera, Trash2, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { equipmentApi } from '../api';

const CATEGORIES = ['Atemschutzgeräte', 'Pumpen', 'Motorsägen', 'Stromerzeuger', 'Beleuchtung', 'Werkzeug', 'Funkgeräte', 'Sonstiges'];
const CHECK_INTERVALS = ['Monatlich', 'Quartalsweise', 'Halbjährlich', 'Jährlich', '2-jährlich', '5-jährlich'];

export default function EquipmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', category: '', customCategory: '', serialNumber: '',
    manufacturer: '', purchaseDate: '', purchasePrice: '',
    location: '', notes: '', isActive: true,
    checkInterval: '', nextCheckDate: '',
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && id) {
      equipmentApi.get(id)
        .then(e => {
          setForm({
            name: e.name || '', category: e.category || '', customCategory: e.customCategory || '',
            serialNumber: e.serialNumber || '', manufacturer: e.manufacturer || '',
            purchaseDate: e.purchaseDate ? new Date(e.purchaseDate).toISOString().split('T')[0] : '',
            purchasePrice: e.purchasePrice || '', location: e.location || '',
            notes: e.notes || '', isActive: e.isActive ?? true,
            checkInterval: e.checkInterval || '',
            nextCheckDate: e.nextCheckDate ? new Date(e.nextCheckDate).toISOString().split('T')[0] : '',
          });
          setPhotoPreview(e.photoUrl || '');
        })
        .catch(() => { toast.error('Gerät nicht gefunden'); navigate('/equipment'); })
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name erforderlich'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const eq = await equipmentApi.create(form);
        toast.success('Gerät angelegt');
        navigate(`/equipment/${eq.id}`);
      } else {
        await equipmentApi.update(id!, form);
        toast.success('Gerät aktualisiert');
        navigate(`/equipment/${id}`);
      }
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || isNew) return;
    setUploading(true);
    try {
      const res = await equipmentApi.uploadPhoto(id, file);
      setPhotoPreview(res.photoUrl);
      toast.success('Foto hochgeladen');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full">
      <div className="flex items-center gap-4">
        <button onClick={() => isNew ? navigate('/equipment') : navigate(`/equipment/${id}`)} className="text-ink-muted hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
          {isNew ? 'Neues Gerät' : 'Gerät bearbeiten'}
        </h1>
      </div>

      {/* Foto */}
      {!isNew && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Foto</h2>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0 flex items-center justify-center">
              {photoPreview ? <img src={photoPreview} alt="" className="w-full h-full object-cover" /> : <Wrench className="w-8 h-8 text-ink-faint" />}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" />{uploading ? 'Lädt...' : 'Foto hochladen'}
              </button>
              {photoPreview && (
                <button type="button" onClick={async () => { await equipmentApi.deletePhoto(id!); setPhotoPreview(''); toast.success('Entfernt'); }}
                  className="btn-secondary text-sm flex items-center gap-2 !text-red-600">
                  <Trash2 className="w-4 h-4" /> Entfernen
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basisdaten */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Gerätedaten</h2>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Name *</label>
            <div className="flex gap-2 items-center">
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="z.B. Atemschutzgerät 1" />
              <DiktatButton onResult={text => setForm(f => ({ ...f, name: text }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Kategorie</label>
              <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">— Auswählen —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Eigene Kategorie</label>
              <div className="flex gap-2 items-center">
                <input className="input-field" value={form.customCategory} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} placeholder="z.B. Spezialgerät" />
                <DiktatButton onResult={text => setForm(f => ({ ...f, customCategory: text }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Seriennummer</label>
              <div className="flex gap-2 items-center">
                <input className="input-field font-mono" value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
                <DiktatButton onResult={text => setForm(f => ({ ...f, serialNumber: text }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Hersteller</label>
              <div className="flex gap-2 items-center">
                <input className="input-field" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
                <DiktatButton onResult={text => setForm(f => ({ ...f, manufacturer: text }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Anschaffungsdatum</label>
              <input className="input-field" type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Anschaffungspreis (€)</label>
              <input className="input-field" type="number" step="0.01" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} min="0" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Standort / Lagerort</label>
              <div className="flex gap-2 items-center">
                <input className="input-field" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="z.B. Fach 3, LF Görtschach, Gerätehaus" />
                <DiktatButton onResult={text => setForm(f => ({ ...f, location: text }))} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
            <div className="flex gap-2 items-center">
              <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-fire-700" />
            <div>
              <p className="text-sm font-medium text-ink">Gerät aktiv / einsatzbereit</p>
              <p className="text-xs text-ink-muted">Inaktive Geräte werden als außer Betrieb markiert</p>
            </div>
          </label>
        </div>

        {/* Prüfintervall */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Prüfintervall</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Prüfintervall</label>
              <select className="input-field" value={form.checkInterval} onChange={e => setForm(f => ({ ...f, checkInterval: e.target.value }))}>
                <option value="">— Kein Intervall —</option>
                {CHECK_INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Nächste Prüfung fällig</label>
              <input className="input-field" type="date" value={form.nextCheckDate} onChange={e => setForm(f => ({ ...f, nextCheckDate: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => isNew ? navigate('/equipment') : navigate(`/equipment/${id}`)} className="btn-secondary flex-1">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
          </button>
        </div>
      </form>
    </div>
  );
}
