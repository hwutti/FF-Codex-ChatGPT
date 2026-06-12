import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const AVAILABLE_FONTS = [
  { value: 'DM Sans',          label: 'DM Sans',          category: 'Modern' },
  { value: 'Outfit',           label: 'Outfit',            category: 'Modern' },
  { value: 'Inter',            label: 'Inter',             category: 'Modern' },
  { value: 'Nunito',           label: 'Nunito',            category: 'Freundlich' },
  { value: 'Oswald',           label: 'Oswald',            category: 'Feuerwehr/Bold' },
  { value: 'Bebas Neue',       label: 'Bebas Neue',        category: 'Feuerwehr/Bold' },
  { value: 'Rajdhani',         label: 'Rajdhani',          category: 'Feuerwehr/Bold' },
  { value: 'Playfair Display', label: 'Playfair Display',  category: 'Elegant/Serif' },
  { value: 'Merriweather',     label: 'Merriweather',      category: 'Elegant/Serif' },
  { value: 'Dancing Script',   label: 'Dancing Script',    category: 'Schlingenschrift' },
  { value: 'Caveat',           label: 'Caveat',            category: 'Handschrift' },
];

interface FontPickerProps {
  label: string;
  value: string;
  onChange: (font: string) => void;
}

export default function FontPicker({ label, value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-surface-200 bg-white hover:border-surface-300 transition-colors text-sm"
        >
          <span style={{ fontFamily: `'${value}', system-ui, sans-serif` }} className="text-ink">
            {value} — <span className="text-ink-muted text-xs">Aa Bb Cc 123</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto">
            {(() => {
              const categories = [...new Set(AVAILABLE_FONTS.map(f => f.category))];
              return categories.map(cat => (
                <div key={cat}>
                  <div className="px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                    <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{cat}</span>
                  </div>
                  {AVAILABLE_FONTS.filter(f => f.category === cat).map(font => (
                    <button
                      key={font.value}
                      type="button"
                      onClick={() => { onChange(font.value); setOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-surface-50 transition-colors flex items-center justify-between ${value === font.value ? 'bg-fire-50' : ''}`}
                    >
                      <span style={{ fontFamily: `'${font.value}', system-ui, sans-serif` }} className="text-sm text-ink">
                        {font.label}
                      </span>
                      <span style={{ fontFamily: `'${font.value}', system-ui, sans-serif` }} className="text-xs text-ink-muted">
                        Aa Bb 123
                      </span>
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
