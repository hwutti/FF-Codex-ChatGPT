import { useState, useEffect, useRef } from 'react';
import api from '../api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export interface PushSettings {
  hasSubscription: boolean;
  pushNewEvent: boolean;
  pushNewExercise: boolean;
  pushNewIncident: boolean;
  pushBirthday: boolean;
  pushUpdate: boolean;
  pushReminder7: boolean;
  pushReminder3: boolean;
  pushReminder1: boolean;
}

export function usePush() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const isUnsubscribingRef = useRef(false);

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(isSupported);
    // Permission immer live vom Browser lesen
    if (isSupported) {
      setPermission(Notification.permission);
    }
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/push/settings');

      // Permission-State aktualisieren (kann sich geändert haben)
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }

      // Auto-resubscribe: nur wenn nicht gerade deaktiviert wird
      if (isUnsubscribingRef.current) {
        setSettings(res.data);
        return;
      }

      // Prüfe ob Browser wirklich eine lokale Subscription hat
      let hasBrowserSub = false;
      let browserEndpoint = '';
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          const sub = await reg.pushManager.getSubscription().catch(() => null);
          if (sub) {
            hasBrowserSub = true;
            browserEndpoint = sub.endpoint;
            break;
          }
        }
      }

      // Server sagt aktiv aber Browser hat keine Subscription → Server bereinigen
      if (res.data.hasSubscription && !hasBrowserSub) {
        console.log('[Push] Server hat Subscription aber Browser nicht → bereinigen');
        await api.delete('/push/subscribe', { data: { endpoint: '' } }).catch(() => {});
        localStorage.removeItem('push_was_subscribed');
        setSettings({ ...res.data, hasSubscription: false });
        return;
      }

      // Browser hat keine Subscription → Flag löschen
      if (!hasBrowserSub) {
        localStorage.removeItem('push_was_subscribed');
      }

      setSettings(res.data);
    } catch {}
  };

  const subscribe = async () => {
    setLoading(true);
    try {
      // Berechtigung anfragen
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      // VAPID Public Key laden
      const { data } = await api.get('/push/vapid-public-key');
      if (!data.publicKey) {
        console.error('[Push] Kein VAPID Key vom Server – Push-Benachrichtigungen nicht konfiguriert');
        return false;
      }

      // Service Worker registrieren/abrufen
      let reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      await navigator.serviceWorker.ready;

      // Eventuell bestehende Subscription löschen (Domainwechsel-Fix)
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe().catch(() => {});
      }

      // Push Subscription erstellen
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      // Subscription am Server speichern
      await api.post('/push/subscribe', sub.toJSON());
      localStorage.setItem('push_was_subscribed', 'true');
      await loadSettings();
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    isUnsubscribingRef.current = true;
    setLoading(true);
    try {
      // Nur dieses Gerät abmelden – immer Endpoint mitschicken
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
          await sub.unsubscribe();
        }
      }
      localStorage.removeItem('push_was_subscribed');
      // Sofort lokal auf false setzen — kein loadSettings danach (würde evtl. überschreiben)
      setSettings(prev => prev ? { ...prev, hasSubscription: false } : null);
      setPermission(prev => prev); // trigger re-render
    } catch (e) {
      console.error('Push unsubscribe error:', e);
    } finally {
      setLoading(false);
      setTimeout(() => { isUnsubscribingRef.current = false; }, 1000);
    }
  };

  const updateSettings = async (newSettings: Partial<PushSettings>) => {
    try {
      await api.put('/push/settings', newSettings);
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
    } catch {}
  };

  return { supported, permission, settings, loading, subscribe, unsubscribe, updateSettings };
}
