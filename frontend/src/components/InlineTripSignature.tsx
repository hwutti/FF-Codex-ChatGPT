import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';

export interface PendingSignature {
  signerName: string;
  signerRole?: string;
  signatureData: string;
}

interface Props {
  signatures: PendingSignature[];
  onChange: (signatures: PendingSignature[]) => void;
}

const COLORS = [
  { label: 'Schwarz', value: '#1a1a1a' },
  { label: 'Blau',    value: '#1a3fa8' },
  { label: 'Rot',     value: '#c0392b' },
  { label: 'Pink',    value: '#e91e8c' },
  { label: 'Grün',   value: '#1a7a3a' },
];

export default function InlineTripSignature({ signatures, onChange }: Props) {
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
  const [showPad, setShowPad] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [penColor, setPenColor] = useState('#1a1a1a');
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (user?.member) {
      setSignerName(`${user.member.firstName} ${user.member.lastName}`);
      setSignerRole(user.member.rank || '');
    } else if (user?.email) {
      setSignerName(user.email);
    }
  }, [user]);

  const add = () => {
    if (!signerName.trim()) { toast.error('Bitte Name eingeben'); return; }
    if (isEmpty) { toast.error('Bitte unterschreiben'); return; }
    const srcCanvas = sigCanvas.current!.getCanvas();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 600;
    tempCanvas.height = 200;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.drawImage(srcCanvas, 0, 0, 600, 200);
    const signatureData = tempCanvas.toDataURL('image/png');
    onChange([...signatures, { signerName: signerName.trim(), signerRole: signerRole.trim() || undefined, signatureData }]);
    sigCanvas.current?.clear();
    setIsEmpty(true);
    setShowPad(false);
    toast.success('Unterschrift hinzugefügt');
  };

  const remove = (index: number) => {
    onChange(signatures.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-ink-base flex items-center gap-2">
          ✍️ Unterschriften
          {signatures.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{signatures.length}</span>
          )}
        </h3>
        {!showPad && (
          <button type="button" onClick={() => setShowPad(true)}
            className="text-sm px-3 py-1.5 bg-fire-700 text-white rounded-lg hover:bg-fire-800 transition-colors">
            + Unterschrift
          </button>
        )}
      </div>

      {/* Vorhandene Unterschriften */}
      {signatures.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {signatures.map((sig, i) => (
            <div key={i} className="border border-surface-200 rounded-xl p-2 bg-surface-50 relative">
              <button type="button" onClick={() => remove(i)}
                className="absolute top-1.5 right-1.5 text-red-400 hover:text-red-600 text-xs">✕</button>
              <div className="bg-white rounded-lg border border-surface-100 p-1" style={{ minHeight: 40 }}>
                <img src={sig.signatureData} alt="Unterschrift" className="w-full object-contain" style={{ height: 40 }} />
              </div>
              <div className="mt-1">
                <p className="text-xs font-semibold text-ink-base">{sig.signerName}</p>
                {sig.signerRole && <p className="text-xs text-ink-muted">{sig.signerRole}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showPad && signatures.length === 0 && (
        <p className="text-xs text-ink-subtle text-center py-2">Optional — Unterschriften können auch nachträglich hinzugefügt werden</p>
      )}

      {/* Unterschriften-Pad */}
      {showPad && (
        <div className="border border-surface-200 rounded-xl p-3 bg-surface-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Name *</label>
              <input value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="Max Mustermann" className="input-field w-full mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Dienstgrad</label>
              <input value={signerRole} onChange={e => setSignerRole(e.target.value)}
                placeholder="Löschmeister" className="input-field w-full mt-1 text-sm" />
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">Unterschrift</label>
            <div className="flex gap-1.5 items-center">
              {COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setPenColor(c.value)} title={c.label}
                  style={{ background: c.value, width: 16, height: 16, borderRadius: '50%',
                    border: penColor === c.value ? '2px solid #666' : '2px solid transparent' }} />
              ))}
            </div>
          </div>

          <div ref={canvasContainerRef} className="border-2 border-dashed border-surface-300 rounded-xl bg-white overflow-hidden touch-none">
            <SignatureCanvas ref={sigCanvas} penColor={penColor} minWidth={2} maxWidth={4} dotSize={3}
              canvasProps={{ className: 'w-full', height: 160 }}
              onBegin={() => setIsEmpty(false)} />
          </div>

          <div className="flex gap-2 mt-2">
            <button type="button" onClick={add}
              className="flex-1 py-2 bg-fire-700 text-white rounded-lg text-sm font-medium hover:bg-fire-800">
              ✓ Hinzufügen
            </button>
            <button type="button" onClick={() => { sigCanvas.current?.clear(); setIsEmpty(true); }}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm text-ink-muted hover:bg-surface-100">
              Löschen
            </button>
            <button type="button" onClick={() => { setShowPad(false); setIsEmpty(true); }}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm text-ink-muted hover:bg-surface-100">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
