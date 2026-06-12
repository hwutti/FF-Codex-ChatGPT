import { useEffect, useRef, useCallback } from 'react';
import { useBeforeUnload } from 'react-router-dom';

/**
 * useUnsavedGuard
 *
 * Registers a beforeunload handler when `dirty` is true (browser tab close / reload).
 * Returns a `confirmNavigation` function that the component calls before any
 * programmatic navigate() — it opens the UnsavedChangesModal and resolves with
 * 'save' | 'discard' | 'cancel'.
 *
 * Usage:
 *   const { confirmNavigation } = useUnsavedGuard(isDirty, handleSave);
 *   <UnsavedChangesModal ref={modalRef} onSave={...} />
 */

export type UnsavedGuardResult = 'save' | 'discard' | 'cancel';

export function useUnsavedGuard(dirty: boolean) {
  // Warn on browser tab close / reload
  useBeforeUnload(
    useCallback(
      (e) => {
        if (dirty) {
          e.preventDefault();
        }
      },
      [dirty]
    )
  );

  // Expose a resolve ref so UnsavedChangesModal can call it
  const resolveRef = useRef<((r: UnsavedGuardResult) => void) | null>(null);

  const confirmNavigation = useCallback((): Promise<UnsavedGuardResult> => {
    if (!dirty) return Promise.resolve('discard');
    return new Promise<UnsavedGuardResult>((resolve) => {
      resolveRef.current = resolve;
      // Dispatch custom event → UnsavedChangesModal listens for this
      window.dispatchEvent(new CustomEvent('unsaved-guard-open'));
    });
  }, [dirty]);

  const resolve = useCallback((result: UnsavedGuardResult) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  return { confirmNavigation, resolve };
}
