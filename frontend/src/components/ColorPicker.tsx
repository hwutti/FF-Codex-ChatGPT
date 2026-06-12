import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface Props {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  compact?: boolean; // Nur Farbkreis, kein HEX-Textfeld
}

export default function ColorPicker({ value, onChange, label, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setHex(value); }, [value]);

  // Außerhalb klicken → schließen
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleHexInput = (val: string) => {
    setHex(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) onChange(val);
  };

  const presets = [
    '#a82828', '#c0392b', '#1a3fa8', '#1a7a3a', '#e91e8c',
    '#f39c12', '#8e44ad', '#2c3e50', '#1a1a1a', '#ffffff',
    '#e8f5e9', '#e3f2fd', '#fce4ec', '#fff8e1', '#f3e5f5',
  ];

  return (
    <div ref={ref} className="relative">
      {label && <label className="settings-label mb-1.5 block">{label}</label>}
      <div className="flex items-center gap-2">
        {/* Farbvorschau-Button */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-10 h-10 rounded-xl border-2 border-surface-300 shadow-sm hover:scale-105 transition-transform flex-shrink-0"
          style={{ background: value }}
          title="Farbe wählen"
        />
        {/* HEX Eingabe — nur wenn nicht compact */}
        {!compact && (
          <input
            type="text"
            value={hex}
            onChange={e => handleHexInput(e.target.value)}
            onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(hex)) setHex(value); }}
            className="input-field flex-1 text-sm font-mono uppercase"
            placeholder="#000000"
            maxLength={7}
          />
        )}
      </div>

      {/* Picker Dropdown */}
      {open && (
        <div className="absolute left-0 top-12 z-50 bg-white rounded-2xl shadow-xl border border-surface-200 p-4 w-64">
          {/* Farbrad */}
          <HexColorPicker color={value} onChange={color => { onChange(color); setHex(color); }} />

          {/* Preset-Farben */}
          <div className="mt-3">
            <p className="text-xs text-ink-subtle mb-2">Schnellauswahl</p>
            <div className="grid grid-cols-5 gap-1.5">
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { onChange(p); setHex(p); }}
                  className="w-8 h-8 rounded-lg border-2 hover:scale-110 transition-transform"
                  style={{ background: p, borderColor: value === p ? '#666' : 'transparent' }}
                  title={p}
                />
              ))}
            </div>
          </div>

          {/* Aktueller HEX */}
          <div className="mt-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md border border-surface-200" style={{ background: value }} />
            <span className="text-sm font-mono text-ink-base uppercase">{value}</span>
            <button type="button" onClick={() => setOpen(false)}
              className="ml-auto text-xs px-3 py-1 bg-fire-700 text-white rounded-lg hover:bg-fire-800">
              ✓ OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
