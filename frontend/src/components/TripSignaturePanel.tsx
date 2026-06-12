import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../utils/AuthContext';
import { usePermission } from '../utils/PermissionContext';
import toast from 'react-hot-toast';

interface Signature {
  id: string;
  signerName: string;
  signerRole?: string;
  signatureData: string;
  createdAt: string;
}

interface Props {
  tripId: string;
  compact?: boolean; // Kompakte Ansicht für das Formular
}

const COLORS = [
  { label: 'Schwarz', value: '#1a1a1a' },
  { label: 'Blau',    value: '#1a3fa8' },
  { label: 'Rot',     value: '#c0392b' },
  { label: 'Pink',    value: '#e91e8c' },
  { label: 'Grün',   value: '#1a7a3a' },
];

export default function TripSignaturePanel({ tripId, compact = false }: Props) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Canvas auf tatsächliche Containerbreite setzen — fixes Koordinaten-Versatz
  useEffect(() => {
    const resize = () => {
      if (sigCanvas.current && canvasContainerRef.current) {
        const w = canvasContainerRef.current.offsetWidth;
        const canvas = sigCanvas.current.getCanvas();
        const data = sigCanvas.current.toData();
        canvas.width = w;
        canvas.height = 160;
        sigCanvas.current.fromData(data);
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const { user } = useAuth() as any;
  const { can } = usePermission();
  const isAdmin = can('administration', 'VIEW');

  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [showPad, setShowPad] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [penColor, setPenColor] = useState('#1a1a1a');
  const [saving, setSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (tripId) loadSignatures();
  }, [tripId]);

  useEffect(() => {
    if (user?.member) {
      setSignerName(`${user.member.firstName} ${user.member.lastName}`);
      setSignerRole(user.member.rank || '');
    } else if (user?.email) {
      setSignerName(user.email);
    }
  }, [user]);

  const loadSignatures = async () => {
    try {
      const res = await api.get(`/trips/${tripId}/signatures`);
      setSignatures(res.data);
    } catch {}
  };

  const save = async () => {
    if (!signerName.trim()) { toast.error('Bitte Name eingeben'); return; }
    if (isEmpty) { toast.error('Bitte unterschreiben'); return; }
    setSaving(true);
    try {
      const srcCanvas = sigCanvas.current!.getCanvas();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 600;
      tempCanvas.height = 200;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.drawImage(srcCanvas, 0, 0, 600, 200);
      const signatureData = tempCanvas.toDataURL('image/png');
      await api.post(`/trips/${tripId}/signatures`, {
        signerName: signerName.trim(),
        signerRole: signerRole.trim() || null,
        signatureData,
      });
      setShowPad(false);
      sigCanvas.current?.clear();
      setIsEmpty(true);
      await loadSignatures();
      toast.success('Unterschrift gespeichert');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const deleteSignature = async (id: string) => {
    if (!confirm('Unterschrift löschen?')) return;
    try {
      await api.delete(`/trips/${tripId}/signatures/${id}`);
      setSignatures(s => s.filter(x => x.id !== id));
      toast.success('Unterschrift gelöscht');
    } catch {}
  };

  return (
    <div className={compact ? '' : 'mt-6 border-t border-surface-200 pt-6'}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wider">
          ✍️ Unterschriften ({signatures.length})
        </h3>
        {!showPad && (
          <button onClick={() => setShowPad(true)}
            className="text-sm px-3 py-1.5 bg-fire-700 text-white rounded-lg hover:bg-fire-800 transition-colors">
            + Unterschrift hinzufügen
          </button>
        )}
      </div>

      {/* Vorhandene Unterschriften */}
      {signatures.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {signatures.map(sig => (
            <div key={sig.id} className="border border-surface-200 rounded-xl p-3 bg-surface-50">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs text-ink-subtle">
                  Unterschrift vom: {format(new Date(sig.createdAt), 'd. MMM yyyy', { locale: de })} um {format(new Date(sig.createdAt), 'HH:mm', { locale: de })} Uhr
                </p>
                {isAdmin && (
                  <button onClick={() => deleteSignature(sig.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">✕</button>
                )}
              </div>
              <div className="bg-white rounded-lg border border-surface-200 p-1" style={{ minHeight: 48 }}>
                <img src={sig.signatureData} alt="Unterschrift" className="w-full object-contain" style={{ height: 48 }} />
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-surface-200">
                <p className="text-xs font-semibold text-ink-base">{sig.signerName}</p>
                {sig.signerRole && <p className="text-xs text-ink-muted">{sig.signerRole}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unterschriften-Pad */}
      {showPad && (
        <div className="border border-surface-200 rounded-xl p-4 bg-surface-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Name *</label>
              <input value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="Max Mustermann" className="input-field w-full mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Dienstgrad / Funktion</label>
              <input value={signerRole} onChange={e => setSignerRole(e.target.value)}
                placeholder="Löschmeister" className="input-field w-full mt-1 text-sm" />
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Unterschrift</label>
            <div className="flex gap-1.5 items-center">
              <span className="text-xs text-ink-subtle">Farbe:</span>
              {COLORS.map(c => (
                <button key={c.value} onClick={() => setPenColor(c.value)} title={c.label}
                  style={{ background: c.value, width: 18, height: 18, borderRadius: '50%',
                    border: penColor === c.value ? '2px solid #666' : '2px solid transparent' }} />
              ))}
            </div>
          </div>

          <div ref={canvasContainerRef} className="border-2 border-dashed border-surface-300 rounded-xl bg-white overflow-hidden touch-none">
            <SignatureCanvas ref={sigCanvas} penColor={penColor} minWidth={2} maxWidth={4} dotSize={3}
              canvasProps={{ className: 'w-full', height: 160 }}
              onBegin={() => setIsEmpty(false)} />
          </div>
          <p className="text-xs text-ink-subtle mt-1">Mit Finger oder Stift unterschreiben</p>

          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 bg-fire-700 text-white rounded-lg text-sm font-medium hover:bg-fire-800 disabled:opacity-50">
              {saving ? 'Speichern...' : '✓ Unterschrift speichern'}
            </button>
            <button onClick={() => { sigCanvas.current?.clear(); setIsEmpty(true); }}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm text-ink-muted hover:bg-surface-100">
              Löschen
            </button>
            <button onClick={() => { setShowPad(false); setIsEmpty(true); }}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm text-ink-muted hover:bg-surface-100">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
