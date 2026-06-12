import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, Mic, Loader, ThumbsUp, X, MapPin, Clock, Star, Maximize2, Minimize2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const HISTORY_KEY = 'ff_nav_history';
const QUICK_PLACES_KEY = 'ff_nav_quick_places';

const DEFAULT_QUICK_PLACES = [
  { label: 'Feuerwehrhaus Görtschach', address: 'Görtschach 26, 9620 Hermagor-Pressegger See' },
  { label: 'Krankenhaus Hermagor', address: 'Möderndorf 1, 9620 Hermagor' },
  { label: 'Feuerwehrhaus Förolach', address: 'Förolach 42, 9620 Hermagor-Pressegger See' },
];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// Parse coordinates from string like "46.72, 13.45" or "46.7234°N 13.4521°E"
function parseCoords(str) {
  const m = str.match(/(-?\d+\.?\d*)[°\s,]+(-?\d+\.?\d*)/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

function openGoogleMaps(address) {
  const encoded = encodeURIComponent(address.trim());
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isIos) {
    window.open('comgooglemaps://?daddr=' + encoded + '&directionsmode=driving', '_blank');
    setTimeout(() => window.open('maps://maps.apple.com/?daddr=' + encoded + '&dirflg=d', '_blank'), 500);
  } else if (isAndroid) {
    window.open('google.navigation:q=' + encoded, '_blank');
  } else {
    window.open('https://www.google.com/maps/dir/?api=1&destination=' + encoded + '&travelmode=driving', '_blank');
  }
}

import LeafletMap from './LeafletMap';

// ── Main Widget ────────────────────────────────────────────────────────────
// Whisper-basierte Aufnahme (funktioniert in allen Browsern inkl. Firefox)

export default function EinsatzNavigationWidget({ nextEventLocation = '' }) {
  const [address, setAddress] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [history, setHistory] = useState(() => load(HISTORY_KEY, []));
  const [quickPlaces, setQuickPlaces] = useState(DEFAULT_QUICK_PLACES);
  const [nextExercises, setNextExercises] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [targetPos, setTargetPos] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null); // { distance, duration }
  const [geoError, setGeoError] = useState('');
  const [diktatState, setDiktatState] = useState('idle'); // idle | recording | transcribing
  const [diktatDuration, setDiktatDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef(null);
  const watchIdRef = useRef(null);
  const fmt = (s) => String(Math.floor(s / 60)).padStart(1,'0') + ':' + String(s % 60).padStart(2,'0');

  // GPS-Standort kontinuierlich verfolgen
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError('GPS nicht verfügbar'); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('GPS-Zugriff verweigert'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // Schnellwahl aus DB laden
  useEffect(() => {
    const viteUrl = import.meta.env.VITE_API_URL || '';
    const baseUrl = viteUrl.endsWith('/api') ? viteUrl.slice(0, -4) : viteUrl;
    fetch(baseUrl + '/api/settings/nav-quick-places', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setQuickPlaces(data); })
      .catch(() => {});
  }, []);

  // Nächste 3 Übungen laden
  useEffect(() => {
    const viteUrl = import.meta.env.VITE_API_URL || '';
    const baseUrl = viteUrl.endsWith('/api') ? viteUrl.slice(0, -4) : viteUrl;
    const today = new Date().toISOString().split('T')[0];
    fetch(baseUrl + '/api/exercises?from=' + today + '&limit=3', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data.exercises) ? data.exercises : [];
        // Sortierung aufsteigend nach Datum (API liefert desc)
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        setNextExercises(list.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  // Adresse geocodieren (OpenStreetMap Nominatim, kostenlos)
  const geocodeAddress = useCallback(async (addr) => {
    const coords = parseCoords(addr);
    if (coords) { setTargetPos(coords); return; }
    // Viewbox: Kärnten/Gailtal-Region (lon_min,lat_max,lon_max,lat_min)
    const viewbox = '12.5,47.1,15.0,46.3';
    try {
      // 1. Versuch: auf Österreich + Viewbox eingeschränkt
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=at&viewbox=' + viewbox + '&bounded=0&q=' + encodeURIComponent(addr),
        { headers: { 'Accept-Language': 'de' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setTargetPos({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        return;
      }
      // 2. Fallback: global suchen
      const res2 = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(addr),
        { headers: { 'Accept-Language': 'de' } }
      );
      const data2 = await res2.json();
      if (data2.length > 0) setTargetPos({ lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) });
    } catch {}
  }, []);

  // ── OSRM Routenberechnung ────────────────────────────────────────
  const fetchRoute = useCallback(async (from, to) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRouteCoords(coords);
        const dist = (data.routes[0].distance / 1000).toFixed(1);
        const dur = Math.round(data.routes[0].duration / 60);
        setRouteInfo({ distance: dist, duration: dur });
      }
    } catch {}
  }, []);

  // Route neu berechnen wenn userPos oder targetPos sich ändert
  useEffect(() => {
    if (userPos && targetPos) {
      fetchRoute(userPos, targetPos);
    } else {
      setRouteCoords(null);
      setRouteInfo(null);
    }
  }, [userPos, targetPos, fetchRoute]);

  // ── Diktat-Logik (gleich wie DiktatButton) ────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      cancelledRef.current = false;

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (cancelledRef.current) {
          cancelledRef.current = false;
          audioChunksRef.current = [];
          setDiktatState('idle');
          setDiktatDuration(0);
          return;
        }
        const totalSize = audioChunksRef.current.reduce((sum, c) => sum + c.size, 0);
        if (totalSize < 1000) {
          toast.error('Aufnahme zu kurz');
          setDiktatState('idle');
          setDiktatDuration(0);
          return;
        }
        setDiktatState('transcribing');
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
        const form = new FormData();
        form.append('audio', blob, 'recording.' + ext);
        try {
          const res = await fetch('/api/whisper/transcribe', {
            method: 'POST',
            credentials: 'include',
            body: form,
          });
          if (!res.ok) throw new Error((await res.json()).error);
          const data = await res.json();
          if (data.text) { setAddress(data.text); geocodeAddress(data.text); }
          toast.success('Adresse übernommen');
        } catch (e) {
          toast.error(e.message || 'Transkriptionsfehler');
        } finally {
          setDiktatState('idle');
          setDiktatDuration(0);
          audioChunksRef.current = [];
        }
      };

      mediaRecorderRef.current.start(100);
      setDiktatState('recording');
      setDiktatDuration(0);
      timerRef.current = setInterval(() => setDiktatDuration(d => d + 1), 1000);
    } catch {
      toast.error('Mikrofon-Zugriff verweigert');
    }
  };

  const confirmRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && diktatState === 'recording') {
      cancelledRef.current = false;
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cancelledRef.current = true;
    if (mediaRecorderRef.current && diktatState === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setDiktatState('idle');
      setDiktatDuration(0);
    }
  };

  const startNavigation = () => {
    const dest = address.trim();
    if (!dest) return;
    openGoogleMaps(dest);
    const newH = [dest, ...history.filter(h => h !== dest)].slice(0, 5);
    setHistory(newH); save(HISTORY_KEY, newH);
  };

  const setDest = (addr) => {
    setAddress(addr);
    setShowHistory(false);
    geocodeAddress(addr);
  };

  const mapHeight = fullscreen ? 'calc(100vh - 320px)' : '200px';

  const inner = (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Einsatz-Navigation</p>
            <p className="text-xs text-ink-muted">
              {userPos ? '📍 Standort aktiv' : geoError || 'Standort wird ermittelt...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userPos && (
            <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg">
              📍 {userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}
            </span>
          )}
          <button onClick={() => setFullscreen(f => !f)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-100 hover:bg-surface-200 text-ink border border-surface-200 transition-colors"
            title={fullscreen ? 'Verkleinern' : 'Vollbild'}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Karte */}
      <div className="rounded-xl overflow-hidden border border-surface-200" style={{ height: mapHeight, transition: 'height 0.3s ease' }}>
        <LeafletMap
          userPos={userPos}
          targetPos={targetPos}
          routeCoords={routeCoords}
          onMapClick={(lat, lng) => {
            const addr = lat.toFixed(5) + ', ' + lng.toFixed(5);
            setAddress(addr);
            setTargetPos({ lat, lng });
          }}
        />
      </div>

      {/* Routeninfo */}
      {routeInfo && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
          <span className="text-xs font-semibold text-red-700">🛣 {routeInfo.distance} km</span>
          <span className="text-xs text-red-500">·</span>
          <span className="text-xs font-semibold text-red-700">⏱ ca. {routeInfo.duration} min</span>
        </div>
      )}

      {/* Nächster Termin */}
      {nextEventLocation && (
        <button onClick={() => setDest(nextEventLocation)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors text-left">
          <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">Nächster Termin → direkt navigieren</p>
            <p className="text-xs text-emerald-600 truncate">{nextEventLocation}</p>
          </div>
        </button>
      )}

      {/* Adresseingabe */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input ref={inputRef} type="text" value={address}
              onChange={e => { setAddress(e.target.value); if (!e.target.value) { setTargetPos(null); setRouteCoords(null); setRouteInfo(null); } }}
              onKeyDown={e => { if (e.key === 'Enter') { geocodeAddress(address); } }}
              onFocus={() => setShowHistory(true)}
              placeholder="Adresse oder Koordinaten eingeben..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
            />
            {address && (
              <button onClick={() => { setAddress(''); setTargetPos(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {diktatState === 'idle' && (
            <button type="button" onClick={startRecording} title="Diktat starten"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-100 text-ink-muted hover:bg-surface-200 hover:text-fire-700 transition-colors flex-shrink-0">
              <Mic className="w-4 h-4" />
            </button>
          )}
          {diktatState === 'recording' && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="relative flex items-center justify-center w-8 h-8">
                <span className="absolute inset-0 rounded-full bg-red-400 opacity-40 animate-ping" />
                <span className="relative z-10 text-red-600"><Mic className="w-4 h-4" /></span>
              </div>
              <span className="text-xs font-mono text-red-500 font-bold min-w-[28px]">{fmt(diktatDuration)}</span>
              <button type="button" onClick={cancelRecording} title="Verwerfen"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button type="button" onClick={confirmRecording} title="Bestätigen"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
                <ThumbsUp className="w-4 h-4" />
              </button>
            </div>
          )}
          {diktatState === 'transcribing' && (
            <button type="button" disabled title="Transkribiere..."
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-100 text-fire-700 flex-shrink-0">
              <Loader className="w-4 h-4 animate-spin" />
            </button>
          )}
        </div>

        {/* Verlauf */}
        {showHistory && history.length > 0 && (
          <div className="absolute top-full left-0 right-12 mt-1 bg-white rounded-xl shadow-lg border border-surface-200 z-[1000] overflow-hidden">
            {history.map((h, i) => (
              <button key={i} onClick={() => setDest(h)}
                className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-surface-50 text-left transition-colors">
                <Clock className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" />
                <span className="text-sm text-ink truncate">{h}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Button */}
      <button onClick={startNavigation} disabled={!address.trim()}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all disabled:opacity-40 shadow-sm">
        <Navigation className="w-4 h-4" />
        Navigation starten (Google Maps)
      </button>

      {/* Schnellwahl + Übungen — 2-spaltig, auf Mobile untereinander */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Linke Spalte: Schnellwahl */}
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1">
            <Star className="w-3 h-3" /> Schnellwahl
          </p>
          <div className="space-y-1.5">
            {quickPlaces.map((place, i) => (
              <button key={i} onClick={() => setDest(place.address)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 transition-all text-left group w-full">
                <MapPin className="w-3.5 h-3.5 text-fire-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{place.label}</p>
                  <p className="text-xs text-ink-muted truncate">{place.address}</p>
                </div>
                <Navigation className="w-3.5 h-3.5 text-ink-muted group-hover:text-fire-600 flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Rechte Spalte: Nächste Übungen */}
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Nächste Übungen
          </p>
          <div className="space-y-1.5">
            {nextExercises.length === 0 && (
              <p className="text-xs text-ink-muted py-2">Keine bevorstehenden Übungen</p>
            )}
            {nextExercises.map((ex, i) => {
              const hasLocation = !!(ex.location && ex.location.trim());
              const dateStr = new Date(ex.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
              return (
                <div key={i}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left w-full ${
                    hasLocation
                      ? 'bg-surface-50 hover:bg-surface-100 border-surface-200 hover:border-surface-300 cursor-pointer group'
                      : 'bg-surface-50 border-surface-200 opacity-60 cursor-default'
                  }`}
                  onClick={() => hasLocation && setDest(ex.location)}
                  role={hasLocation ? 'button' : undefined}
                >
                  <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${hasLocation ? 'text-amber-500' : 'text-ink-muted'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{ex.title}</p>
                    <p className="text-xs text-ink-muted truncate">
                      {dateStr}{ex.startTime ? ' · ' + ex.startTime + ' Uhr' : ''}
                      {hasLocation ? ' · ' + ex.location : ' · Kein Übungsort eingetragen'}
                    </p>
                  </div>
                  {hasLocation && (
                    <Navigation className="w-3.5 h-3.5 text-ink-muted group-hover:text-amber-500 flex-shrink-0 transition-colors" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <p className="text-xs text-ink-muted text-center">💡 Auf die Karte klicken um einen Punkt als Ziel zu setzen</p>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[500] bg-white overflow-y-auto p-4" onClick={() => { setShowHistory(false); }}>
        <div className="max-w-2xl mx-auto">{inner}</div>
      </div>
    );
  }

  return (
    <div className="card p-4" onClick={() => setShowHistory(false)}>
      {inner}
    </div>
  );
}




