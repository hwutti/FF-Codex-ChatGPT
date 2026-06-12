import ColorPicker from '../components/ColorPicker';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { FileText, FolderOpen, BookOpen, ScrollText, GraduationCap, ClipboardList, ClipboardCheck, FileSearch, FilePlus, FileStack, Shield, ShieldCheck, Flame, Truck, AlertTriangle, Users, UserCheck, BadgeCheck, Award, Star, Wrench, Settings, Hammer, HardHat, Map, MapPin, Building, Home, Flag, Layers } from 'lucide-react';

const ICON_MAP: Record<string, any> = { FileText: FileText, FolderOpen: FolderOpen, BookOpen: BookOpen, ScrollText: ScrollText, GraduationCap: GraduationCap, ClipboardList: ClipboardList, ClipboardCheck: ClipboardCheck, FileSearch: FileSearch, FilePlus: FilePlus, FileStack: FileStack, Shield: Shield, ShieldCheck: ShieldCheck, Flame: Flame, Truck: Truck, AlertTriangle: AlertTriangle, Users: Users, UserCheck: UserCheck, BadgeCheck: BadgeCheck, Award: Award, Star: Star, Wrench: Wrench, Settings: Settings, Hammer: Hammer, HardHat: HardHat, Map: Map, MapPin: MapPin, Building: Building, Home: Home, Flag: Flag, Layers: Layers };
import toast from 'react-hot-toast';

const PRESET_COLORS = [
  '#ef4444','#f97316','#f59e0b','#84cc16','#10b981',
  '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899',
  '#a82828','#166534','#1e3a5f','#713f12','#4a044e',
];

// 30 passende Icons für Feuerwehr/Verwaltung
const AVAILABLE_ICONS = [
  'FileText','FolderOpen','BookOpen','ScrollText','GraduationCap',
  'ClipboardList','ClipboardCheck','FileSearch','FilePlus','FileStack',
  'Shield','ShieldCheck','Flame','Truck','AlertTriangle',
  'Users','UserCheck','BadgeCheck','Award','Star',
  'Wrench','Settings','Layers','Hammer','HardHat',
  'Map','MapPin','Building','Home','Flag',
];

function DynIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] || FileText;
  return <Icon className={className} style={style} />;
}

const STORAGE_KEY = 'fw_document_public_categories';

export default function CategoryCreatePublicPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // Load existing if editing
  const existing = React.useMemo(() => {
    if (!editId) return null;
    try {
      const cats = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify([{ id: 'public_general', label: 'Allgemein', icon: 'FolderOpen', color: '#3b82f6', description: 'Allgemeine Dokumente für alle Mitglieder' }, { id: 'public_notices', label: 'Bekanntmachungen', icon: 'Flag', color: '#f59e0b', description: 'Informationen und Bekanntmachungen' }, { id: 'public_calendar', label: 'Termine & Pläne', icon: 'Map', color: '#10b981', description: 'Dienstpläne, Termine und Übersichten' }]));
      return cats.find((c: any) => c.id === editId) || null;
    } catch { return null; }
  }, [editId]);

  const [label, setLabel] = useState(existing?.label || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [icon, setIcon] = useState(existing?.icon || 'FolderOpen');
  const [color, setColor] = useState(existing?.color || '#3b82f6');

  const handleSave = () => {
    if (!label.trim()) { toast.error('Name erforderlich'); return; }
    try {
      const cats = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify([{ id: 'public_general', label: 'Allgemein', icon: 'FolderOpen', color: '#3b82f6', description: 'Allgemeine Dokumente für alle Mitglieder' }, { id: 'public_notices', label: 'Bekanntmachungen', icon: 'Flag', color: '#f59e0b', description: 'Informationen und Bekanntmachungen' }, { id: 'public_calendar', label: 'Termine & Pläne', icon: 'Map', color: '#10b981', description: 'Dienstpläne, Termine und Übersichten' }]));
      const newCat = {
        id: existing?.id || `cat_${Date.now()}`,
        label: label.trim(),
        description: description.trim(),
        icon,
        color,
      };
      const updated = existing
        ? cats.map((c: any) => c.id === existing.id ? newCat : c)
        : [...cats, newCat];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success(existing ? 'Kategorie gespeichert' : 'Kategorie erstellt');
      navigate('/documents-public');
    } catch { toast.error('Fehler'); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/documents-public')}
          className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>
            {existing ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
          </h1>
          <p className="text-sm text-gray-500">Wähle Icon, Farbe und Namen</p>
        </div>
      </div>

      {/* Live Preview */}
      <div className="card p-5 mb-6 flex items-center gap-4 transition-all duration-200"
        style={{ borderColor: color + '40', borderWidth: '1.5px' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '20' }}>
          <DynIcon name={icon} className="w-7 h-7" style={{ color }} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg leading-tight" style={{ fontFamily: 'var(--font-headings)' }}>
            {label || 'Kategorie-Name'}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">{description || 'Beschreibung'}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Name & Description */}
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Name *</label>
            <input type="text" className="input-field" value={label}
              onChange={e => setLabel(e.target.value)} placeholder="z.B. Einsatzpläne" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Beschreibung</label>
            <input type="text" className="input-field" value={description}
              onChange={e => setDescription(e.target.value)} placeholder="Kurze Beschreibung der Kategorie" />
          </div>
        </div>

        {/* Icon Selection */}
        <div className="card p-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Icon wählen</label>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {AVAILABLE_ICONS.map(name => {
              const selected = icon === name;
              return (
                <button key={name} type="button" onClick={() => setIcon(name)}
                  title={name}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl transition-all hover:scale-110 relative"
                  style={{
                    background: selected ? color + '20' : 'transparent',
                    border: selected ? `2px solid ${color}` : '2px solid transparent',
                  }}>
                  <DynIcon name={name} className="w-6 h-6"
                    style={{ color: selected ? color : '#6b7280' }} />
                  {selected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: color }}>
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Selection */}
        <div className="card p-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Farbe wählen</label>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="h-12 rounded-xl transition-all hover:scale-105 relative flex items-center justify-center"
                style={{ background: c, boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none' }}>
                {color === c && <Check className="w-5 h-5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200">
            <ColorPicker value={color} onChange={color => setColor(color)} />
            <div>
              <p className="text-sm font-medium text-gray-700">Eigene Farbe</p>
              <p className="text-xs text-gray-400 font-mono">{color}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button onClick={() => navigate('/documents-public')} className="btn-secondary flex-1">Abbrechen</button>
          <button onClick={handleSave} className="btn-primary flex-1">
            {existing ? 'Änderungen speichern' : '+ Kategorie erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
