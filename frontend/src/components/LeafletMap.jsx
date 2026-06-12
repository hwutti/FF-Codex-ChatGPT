import { useEffect, useRef, useState } from 'react';

// Leaflet wird dynamisch geladen (Vite 6 + ESM Fix: verhindert "Illegal constructor")
let _L = null;
async function getL() {
  if (_L) return _L;
  await import('leaflet/dist/leaflet.css');
  const mod = await import('leaflet');
  _L = mod.default;
  return _L;
}

export default function LeafletMap({ userPos, targetPos, routeCoords, onMapClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const routeLineRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Karte initialisieren (einmalig)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = await getL();
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: userPos ? [userPos.lat, userPos.lng] : [46.75, 13.40],
        zoom: userPos ? 13 : 10,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);
      map.on('click', (e) => onMapClick && onMapClick(e.latlng.lat, e.latlng.lng));
      mapInstanceRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
        targetMarkerRef.current = null;
        lineRef.current = null;
        routeLineRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Benutzer-Position
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = await getL();
      const map = mapInstanceRef.current;
      if (!map || !userPos) return;
      const icon = L.divIcon({
        html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px rgba(59,130,246,0.3)"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8], className: '',
      });
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
      } else {
        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: 1000 })
          .bindPopup('Mein Standort').addTo(map);
      }
      if (!targetPos) map.setView([userPos.lat, userPos.lng], 13);
    })();
  }, [userPos, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ziel-Position
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = await getL();
      const map = mapInstanceRef.current;
      if (!map) return;
      if (targetMarkerRef.current) { targetMarkerRef.current.remove(); targetMarkerRef.current = null; }
      if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
      if (!targetPos) return;
      const icon = L.divIcon({
        html: '<div style="width:20px;height:20px;background:#dc2626;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
        iconSize: [20, 20], iconAnchor: [10, 20], className: '',
      });
      targetMarkerRef.current = L.marker([targetPos.lat, targetPos.lng], { icon })
        .bindPopup('Einsatzort').addTo(map);
      if (userPos && !routeCoords) {
        lineRef.current = L.polyline(
          [[userPos.lat, userPos.lng], [targetPos.lat, targetPos.lng]],
          { color: '#dc2626', weight: 2, dashArray: '6,6', opacity: 0.5 }
        ).addTo(map);
        map.fitBounds([[userPos.lat, userPos.lng], [targetPos.lat, targetPos.lng]], { padding: [40, 40] });
      } else if (!userPos) {
        map.setView([targetPos.lat, targetPos.lng], 14);
      }
    })();
  }, [targetPos, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = await getL();
      const map = mapInstanceRef.current;
      if (!map) return;
      if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }
      if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
      if (!routeCoords || routeCoords.length < 2) return;
      routeLineRef.current = L.polyline(routeCoords, {
        color: '#dc2626', weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round',
      }).addTo(map);
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [40, 40] });
    })();
  }, [routeCoords, ready]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
