import { useState } from 'react';
import { Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function ClearCacheButton() {
  const [state, setState] = useState<'idle' | 'clearing' | 'done'>('idle');

  const clearAll = async () => {
    setState('clearing');
    try {
      // SW-Caches leeren
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      // IndexedDB löschen
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('ff-einsatzplaene');
        req.onsuccess = () => resolve();
        req.onerror   = () => resolve();
        req.onblocked = () => resolve();
      });
      // localStorage Einsatzpläne-Cache löschen
      Object.keys(localStorage)
        .filter(k => k.startsWith('ep_'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}

    setState('done');

    // Neu laden – SW holt index.html jetzt immer vom Netz (no-store)
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="space-y-3">
      {state === 'idle' && (
        <button onClick={clearAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl hover:bg-amber-100 transition-colors font-medium text-sm">
          <Trash2 className="w-4 h-4" />
          Cache leeren &amp; App neu starten
        </button>
      )}
      {state === 'clearing' && (
        <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-50 border border-surface-200 text-ink-muted rounded-xl text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cache wird geleert…
        </div>
      )}
      {state === 'done' && (
        <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Fertig — App lädt neu…
        </div>
      )}
      <p className="text-xs text-ink-faint">
        Löscht App-Cache und Einsatzpläne-Cache. Die App lädt danach frisch vom Server.
      </p>
    </div>
  );
}
