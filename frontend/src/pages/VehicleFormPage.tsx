import React, { useState, useEffect, useRef } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Trash2, Save, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicleApi } from '../api';

const VEHICLE_TYPES = ['LF - Löschfahrzeug', 'TLF - Tanklöschfahrzeug', 'KLF - Kleinlöschfahrzeug', 'MTF - Mannschaftstransportfahrzeug', 'DL - Drehleiter', 'RW - Rüstwagen', 'GW - Gerätewagen', 'KdoW - Kommandowagen', 'Sonstiges'];

export default function VehicleFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', licensePlate: '', type: '', brand: '', model: '',
    year: '', currentKm: 0, notes: '', isActive: true,
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && id) {
      vehicleApi.getVehicle(id)
        .then(v => {
          setForm({ name: v.name || '', licensePlate: v.licensePlate || '', type: v.type || '',
            brand: v.brand || '', model: v.model || '', year: v.year || '',
            currentKm: v.currentKm || 0, notes: v.notes || '', isActive: v.isActive ?? true });
          setPhotoPreview(v.photoUrl || '');
        })
        .catch(() => { toast.error('Fahrzeug nicht gefunden'); navigate('/vehicles'); })
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name erforderlich'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const v = await vehicleApi.createVehicle(form);
        toast.success('Fahrzeug angelegt');
        navigate(`/vehicles/${v.id}`);
      } else {
        await vehicleApi.updateVehicle(id!, form);
        toast.success('Fahrzeug aktualisiert');
        navigate(`/vehicles/${id}`);
      }
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || isNew) return;
    setUploading(true);
    try {
      const res = await vehicleApi.uploadPhoto(id, file);
      setPhotoPreview(res.photoUrl);
      toast.success('Foto hochgeladen');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); }
  };

  const handleDeletePhoto = async () => {
    if (!id || isNew) return;
    await vehicleApi.deletePhoto(id);
    setPhotoPreview('');
    toast.success('Foto entfernt');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => isNew ? navigate('/vehicles') : navigate(`/vehicles/${id}`)} className="text-ink-muted hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
          {isNew ? 'Neues Fahrzeug' : 'Fahrzeug bearbeiten'}
        </h1>
      </div>

      {/* Foto */}
      {!isNew && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Fahrzeugfoto</h2>
          <div className="flex items-center gap-4">
            <div className="w-32 h-24 rounded-xl overflow-hidden bg-surface-100 flex-shrink-0">
              {photoPreview
                ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Car className="w-8 h-8 text-ink-faint" /></div>
              }
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="btn-secondary text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" />{uploading ? 'Lädt...' : 'Foto hochladen'}
              </button>
              {photoPreview && (
                <button type="button" onClick={handleDeletePhoto} className="btn-secondary text-sm flex items-center gap-2 !text-red-600 hover:!bg-red-50">
                  <Trash2 className="w-4 h-4" /> Entfernen
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
          {isNew && <p className="text-xs text-ink-faint">Foto kann nach dem Anlegen hochgeladen werden.</p>}
        </div>
      )}

      {/* Formular */}
      <form onSubmit={handleSubmit} className="card space-y-5">
        <h2 className="font-semibold text-ink">Fahrzeugdaten</h2>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Name *</label>
          <div className="flex gap-2 items-center">
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="z.B. KLF Görtschach" />
            <DiktatButton onResult={text => setForm(f => ({ ...f, name: text }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Kennzeichen</label>
            <div className="flex gap-2 items-center">
              <input className="input-field font-mono" value={form.licensePlate} onChange={e => setForm(f => ({ ...f, licensePlate: e.target.value }))} placeholder="HE-717.at" />
              <DiktatButton onResult={text => setForm(f => ({ ...f, licensePlate: text }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Fahrzeugtyp</label>
            <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="">— Typ wählen —</option>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Marke</label>
            <div className="flex gap-2 items-center">
              <input className="input-field" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="z.B. Mercedes" />
              <DiktatButton onResult={text => setForm(f => ({ ...f, brand: text }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Modell</label>
            <div className="flex gap-2 items-center">
              <input className="input-field" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="z.B. Atego 1328" />
              <DiktatButton onResult={text => setForm(f => ({ ...f, model: text }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Baujahr</label>
            <input className="input-field" type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2015" min="1950" max="2100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Aktueller km-Stand</label>
            <input className="input-field" type="number" value={form.currentKm} onChange={e => setForm(f => ({ ...f, currentKm: parseInt(e.target.value) || 0 }))} min="0" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Notizen</label>
          <div className="flex gap-2 items-start">
<div className="flex gap-2 items-center">
  <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Besonderheiten, Ausstattung, etc." />
  <DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} />
</div>
<DiktatButton onResult={text => setForm(f => ({ ...f, notes: text }))} /></div>
        </div>

        <label className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200 cursor-pointer hover:bg-surface-100 transition-colors">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-fire-700" />
          <div>
            <p className="text-sm font-medium text-ink">Fahrzeug aktiv</p>
            <p className="text-xs text-ink-muted">Inaktive Fahrzeuge werden in der Übersicht ausgeblendet</p>
          </div>
        </label>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => isNew ? navigate('/vehicles') : navigate(`/vehicles/${id}`)} className="btn-secondary flex-1">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
          </button>
        </div>
      </form>
    </div>
  );
}
