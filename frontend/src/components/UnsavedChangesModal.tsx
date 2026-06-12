import { useEffect, useState } from 'react';
import { AlertTriangle, Save, Trash2, X } from 'lucide-react';
import type { UnsavedGuardResult } from '../hooks/useUnsavedGuard';

interface Props {
  onSave: () => Promise<boolean>; // returns true if save succeeded
  onResolve: (result: UnsavedGuardResult) => void;
}

/**
 * UnsavedChangesModal
 *
 * Listens for the custom 'unsaved-guard-open' event (dispatched by useUnsavedGuard).
 * Shows a modal with three choices:
 *   - Speichern & verlassen  → calls onSave(), if ok → resolves 'save', else stays open with error
 *   - Verwerfen              → resolves 'discard'
 *   - Abbrechen              → resolves 'cancel'
 */
export default function UnsavedChangesModal({ onSave, onResolve }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = () => { setOpen(true); setError(''); };
    window.addEventListener('unsaved-guard-open', handler);
    return () => window.removeEventListener('unsaved-guard-open', handler);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const ok = await onSave();
      if (ok) {
        setOpen(false);
        onResolve('save');
      } else {
        setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      }
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setOpen(false);
    onResolve('discard');
  };

  const handleCancel = () => {
    setOpen(false);
    onResolve('cancel');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        {/* Icon + Title */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-ink text-base">Ungespeicherte Änderungen</h2>
            <p className="text-sm text-ink-muted mt-0.5">
              Möchtest du die Änderungen speichern, bevor du die Seite verlässt?
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird gespeichert...</>
              : <><Save className="w-4 h-4" /> Speichern &amp; verlassen</>
            }
          </button>

          <button
            onClick={handleDiscard}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Verwerfen
          </button>

          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-surface-200 text-ink-muted text-sm font-medium hover:bg-surface-50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
