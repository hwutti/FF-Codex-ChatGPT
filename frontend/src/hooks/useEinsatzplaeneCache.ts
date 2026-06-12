import { useEffect, useState } from 'react';
import api from '../api';

export interface CacheStatus {
  status: 'idle' | 'caching' | 'done' | 'error';
  cached: number;
  total: number;
  totalMB?: string;
  warning?: string;
}

const DB_NAME    = 'ff-einsatzplaene';
const DB_VERSION = 1;
const STORE_NAME = 'files';

// IndexedDB öffnen
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function getFileFromCache(url: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

async function saveFileToCache(url: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(blob, url);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function fileExistsInCache(url: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count(url);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror   = () => resolve(false);
    });
  } catch { return false; }
}

export function useEinsatzplaeneCache(enabled = true) {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({ status: 'idle', cached: 0, total: 0 });

  useEffect(() => {
    if (!enabled) return; // Warten bis User eingeloggt ist

    const startCaching = async () => {
      try {
        // 1) Ordnerstruktur cachen
        const foldersRes = await api.get('/einsatzplaene/folders');
        try { localStorage.setItem('ep_folders_cache', JSON.stringify(foldersRes.data)); } catch {}

        // 2) Alle Pläne laden (folderId jetzt im Select)
        const allPlansRes = await api.get('/einsatzplaene?all=1');
        const allPlans: any[] = allPlansRes.data;

        // 3) Pläne nach Ordner gruppieren → localStorage
        const byFolder: Record<string, any[]> = {};
        for (const plan of allPlans) {
          const key = plan.folderId || 'root';
          if (!byFolder[key]) byFolder[key] = [];
          byFolder[key].push(plan);
        }
        for (const [key, plans] of Object.entries(byFolder)) {
          try { localStorage.setItem(`ep_plans_cache_${key}_`, JSON.stringify(plans)); } catch {}
        }

        // 4) Dateien per Axios (mit Auth-Token) laden und in IndexedDB speichern
        const files = allPlans.filter((p: any) => p.fileUrl);
        if (files.length === 0) {
          setCacheStatus({ status: 'done', cached: 0, total: 0, totalMB: '0.0' });
          return;
        }

        setCacheStatus({ status: 'caching', cached: 0, total: files.length });

        let cached = 0;
        let totalBytes = 0;
        let errors = 0;

        for (const plan of files) {
          try {
            const absoluteUrl = plan.fileUrl.startsWith('http')
              ? plan.fileUrl
              : window.location.origin + plan.fileUrl;

            // Bereits gecacht? → Größe trotzdem aus IndexedDB lesen und zählen
            const existingBlob = await getFileFromCache(absoluteUrl);
            if (existingBlob) {
              totalBytes += existingBlob.size;
              cached++;
              setCacheStatus(prev => ({ ...prev, cached }));
              continue;
            }

            // fetch() direkt verwenden – api hat baseURL '/api', würde /api/uploads/... machen
            const token = localStorage.getItem('token');
            const response = await fetch(absoluteUrl, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!response.ok) { errors++; continue; }
            const blob = await response.blob();
            console.log(`[Cache] ${plan.title}: ${blob.size} bytes, type: ${blob.type}, url: ${absoluteUrl}`);
            if (blob.size === 0) { errors++; continue; } // 0-Byte Blob nicht speichern
            totalBytes += blob.size;

            await saveFileToCache(absoluteUrl, blob);
            cached++;
            setCacheStatus(prev => ({ ...prev, cached }));
          } catch {
            // Einzelne Datei-Fehler ignorieren
          }
        }

        setCacheStatus({
          status: 'done',
          cached,
          total: files.length,
          totalMB: (totalBytes / 1024 / 1024).toFixed(1),
        });
      } catch {
        // Offline – still scheitern
      }
    };

    const timer = setTimeout(startCaching, 3000);
    return () => clearTimeout(timer);
  }, [enabled]); // Re-sync wenn User einloggt

  return cacheStatus;
}
