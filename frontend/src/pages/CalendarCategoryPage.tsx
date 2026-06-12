import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import ColorPicker from '../components/ColorPicker';

interface Props {
  isCommand?: boolean;
}

export default function CalendarCategoryPage({ isCommand = false }: Props) {
  const navigate = useNavigate();
  const backPath = isCommand ? '/calendar-command' : '/calendar';
  const apiBase = isCommand ? '/calendar-command' : '/calendar';
  const title = isCommand ? 'Kalender Kommando' : 'Kalender Allgemein';

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#a82828');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const r = await api.get(`${apiBase}/categories`);
      setCategories(r.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { toast.error('Name erforderlich'); return; }
    setSaving(true);
    try {
      await api.post(`${apiBase}/categories`, { name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#a82828');
      toast.success('Kategorie erstellt');
      loadCategories();
    } catch { toast.error('Fehler beim Erstellen'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Kategorie "${name}" löschen?`)) return;
    try {
      await api.delete(`${apiBase}/categories/${id}`);
      toast.success('Kategorie gelöscht');
      loadCategories();
    } catch { toast.error('Fehler beim Löschen'); }
  };

  return (
    <div className="max-w-lg mx-auto p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backPath)} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs text-ink-muted">{title}</p>
          <h1 className="text-xl font-bold text-ink-base">Kategorien verwalten</h1>
        </div>
      </div>

      {/* Bestehende Kategorien */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-base mb-4">Bestehende Kategorien</h2>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-4">Noch keine Kategorien vorhanden</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat: any) => (
              <div key={cat.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
                <div className="w-6 h-6 rounded-lg flex-shrink-0" style={{ background: cat.color }} />
                <span className="flex-1 text-sm font-medium text-ink-base">{cat.name}</span>
                <span className="text-xs text-ink-subtle font-mono">{cat.color}</span>
                <button onClick={() => handleDelete(cat.id, cat.name)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Neue Kategorie */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-base mb-4">Neue Kategorie</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="settings-label">Name *</label>
            <input className="input-field w-full mt-1" value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="z.B. Übung, Wartung, Sitzung..." required />
          </div>
          <div>
            <ColorPicker label="Farbe" value={newColor} onChange={setNewColor} />
          </div>
          <button type="submit" disabled={saving || !newName.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            {saving ? 'Erstellen...' : 'Kategorie erstellen'}
          </button>
        </form>
      </div>
    </div>
  );
}
