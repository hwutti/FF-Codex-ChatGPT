import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Flame, Calendar, Cake, Award, ChevronRight, Clock, AlertCircle, CloudSun, Wind, Droplets, Plus, Car, Dumbbell, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { dashboardApi, exerciseApi } from '../api';
import api from '../api';
import { DashboardData, EVENT_TYPE_LABELS, INCIDENT_TYPE_LABELS, EXERCISE_TYPE_LABELS } from '../types';
import { format, formatDistanceToNow, parseISO, differenceInHours, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../utils/AuthContext';
import { useBranding } from '../utils/BrandingContext';
import EinsatzNavigationWidget from '../components/EinsatzNavigationWidget';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

function WeatherWidget() {
  const [weather, setWeather] = useState<any>(null);
  useEffect(() => {
    // Open-Meteo API — kostenlos, kein Key nötig — Görtschach Koordinaten
    fetch('https://api.open-meteo.com/v1/forecast?latitude=46.62&longitude=13.22&current=temperature_2m,weathercode,windspeed_10m,precipitation,apparent_temperature&timezone=Europe/Vienna&forecast_days=1')
      .then(r => r.json())
      .then(d => setWeather(d.current))
      .catch(() => {});
  }, []);

  const weatherDescriptions: Record<number, { label: string; icon: string }> = {
    0: { label: 'Sonnig', icon: '☀️' }, 1: { label: 'Überwiegend klar', icon: '🌤️' },
    2: { label: 'Teils bewölkt', icon: '⛅' }, 3: { label: 'Bedeckt', icon: '☁️' },
    45: { label: 'Nebel', icon: '🌫️' }, 48: { label: 'Raureif-Nebel', icon: '🌫️' },
    51: { label: 'Leichter Nieselregen', icon: '🌦️' }, 53: { label: 'Nieselregen', icon: '🌦️' },
    61: { label: 'Leichter Regen', icon: '🌧️' }, 63: { label: 'Regen', icon: '🌧️' },
    65: { label: 'Starker Regen', icon: '🌧️' }, 71: { label: 'Leichter Schneefall', icon: '🌨️' },
    73: { label: 'Schneefall', icon: '❄️' }, 80: { label: 'Regenschauer', icon: '🌦️' },
    95: { label: 'Gewitter', icon: '⛈️' }, 96: { label: 'Gewitter mit Hagel', icon: '⛈️' },
  };

  const isWarning = weather && (weather.weathercode >= 95 || weather.windspeed_10m > 60 || weather.precipitation > 10);

  if (!weather) return (
    <div className="card p-4 flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 bg-surface-200 rounded-xl" />
      <div className="flex-1 space-y-2"><div className="h-4 bg-surface-200 rounded w-24" /><div className="h-3 bg-surface-200 rounded w-32" /></div>
    </div>
  );

  const wDesc = weatherDescriptions[weather.weathercode] || { label: 'Unbekannt', icon: '🌡️' };

  return (
    <div className={`card p-4 ${isWarning ? 'border-orange-200 bg-orange-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{wDesc.icon}</span>
          <div>
            <p className="font-bold text-2xl text-ink">{Math.round(weather.temperature_2m)}°C</p>
            <p className="text-xs text-ink-muted">{wDesc.label} · Görtschach</p>
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-ink-muted flex items-center gap-1 justify-end"><Wind className="w-3 h-3" />{Math.round(weather.windspeed_10m)} km/h</p>
          <p className="text-xs text-ink-muted flex items-center gap-1 justify-end"><Droplets className="w-3 h-3" />{weather.precipitation} mm</p>
          <p className="text-xs text-ink-muted">Gefühlt {Math.round(weather.apparent_temperature)}°C</p>
        </div>
      </div>
      {isWarning && <p className="text-xs text-orange-700 font-medium mt-2">⚠️ Unwetterwarnung — Vorsicht bei Einsätzen!</p>}
    </div>
  );
}

function NextExerciseCard() {
  const navigate = useNavigate();
  const [next, setNext] = useState<any>(null);

  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Beide Quellen abfragen: exercises Tabelle + Kalender-Ereignisse
    Promise.allSettled([
      exerciseApi.list({ from: today, limit: '10' }),
      api.get('/calendar/events', { params: { from: today, limit: '20' } }),
      api.get('/calendar-command/events', { params: { from: today, limit: '20' } }),
    ]).then(([exRes, calRes, calCmdRes]) => {
      const candidates: any[] = [];

      // Aus exercises Tabelle
      if (exRes.status === 'fulfilled') {
        (exRes.value.exercises || [])
          .filter((e: any) => new Date(e.date) >= now)
          .forEach((e: any) => candidates.push({
            ...e,
            _date: new Date(e.date),
            _source: 'exercise',
            _nav: `/exercises/${e.id}`,
            _typeLabel: EXERCISE_TYPE_LABELS[e.type as keyof typeof EXERCISE_TYPE_LABELS] || e.type,
          }));
      }

      // Aus Kalender Allgemein
      if (calRes.status === 'fulfilled') {
        (calRes.value.data || [])
          .filter((e: any) => new Date(e.startDate) >= now)
          .forEach((e: any) => candidates.push({
            ...e,
            date: e.startDate,
            startTime: e.startDate ? format(new Date(e.startDate), 'HH:mm') : null,
            _date: new Date(e.startDate),
            _source: 'calendar',
            _nav: `/calendar`,
            _typeLabel: 'Kalender',
          }));
      }

      // Aus Kalender Kommando
      if (calCmdRes.status === 'fulfilled') {
        (calCmdRes.value.data || [])
          .filter((e: any) => new Date(e.startDate) >= now)
          .forEach((e: any) => candidates.push({
            ...e,
            date: e.startDate,
            startTime: e.startDate ? format(new Date(e.startDate), 'HH:mm') : null,
            _date: new Date(e.startDate),
            _source: 'calendar-command',
            _nav: `/calendar-command`,
            _typeLabel: 'Kalender Kommando',
          }));
      }

      // Nächsten Termin finden
      candidates.sort((a, b) => a._date.getTime() - b._date.getTime());
      if (candidates.length > 0) setNext(candidates[0]);
    });
  }, []);

  if (!next) return null;

  const date = new Date(next._date || next.date);
  const hours = differenceInHours(date, new Date());
  const days = differenceInDays(date, new Date());

  return (
    <div className="card p-4 border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(next._nav || '/exercises')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Nächster Termin</p>
          <p className="font-bold text-ink">{next.title}</p>
          <p className="text-xs text-ink-muted mt-1">{next._typeLabel}</p>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <p className="font-bold text-fire-700">{days === 0 ? 'Heute' : days < 0 ? 'Läuft' : `in ${days} Tag${days !== 1 ? 'en' : ''}`}</p>
          <p className="text-xs text-ink-muted">{format(date, 'd. MMM yyyy', { locale: de })}</p>
          {next.startTime && <p className="text-xs text-ink-muted">{next.startTime} Uhr</p>}
          <p className="text-xs text-ink-subtle">({Math.max(0, hours)}h)</p>
        </div>
      </div>
      {next.location && <p className="text-xs text-ink-muted mt-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{next.location}</p>}
    </div>
  );
}

function RadarMapWidget() {
  const { branding } = useBranding();
  const {
    radarLat, radarLng, radarZoom, radarLayer,
    radarOpacity, radarSpeed, radarHeight, radarLabels, radarDarkMap, radarTitle,
  } = branding;

  // RainViewer URL — layer: radar/satellite/snow
  // Für Satellit: Animation deaktivieren (oAP=0), sonst aktiviert (oAP=1)
  const isSatellite = radarLayer === 'satellite';
  const src = `https://www.rainviewer.com/map.html?loc=${radarLat},${radarLng},${radarZoom}&oFa=0&oC=0&oU=0&oCS=1&oF=0&oAP=${isSatellite ? 0 : 1}&rmt=${radarSpeed}&c=${(radarDarkMap || isSatellite) ? 2 : 1}&o=${radarOpacity}&lm=${radarLabels ? 1 : 0}&layer=${radarLayer}&sm=1&sn=1`;

  return (
    <div className="card overflow-hidden p-0 flex flex-col h-full" style={{ minHeight: radarHeight }}>
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between flex-shrink-0">
        <p className="text-sm font-semibold text-ink-base">🌧️ {radarTitle}</p>
        <a href="https://www.rainviewer.com" target="_blank" rel="noreferrer"
          className="text-xs text-ink-muted hover:text-ink-base">RainViewer</a>
      </div>
      <iframe
        src={src}
        key={src}
        style={{ width: '100%', flex: '1 1 auto', border: 'none', display: 'block', minHeight: radarHeight }}
        title="Regenradar"
      />
    </div>
  );
}

function AttendanceCard({ userId }: { userId?: string }) {
  const [stats, setStats] = useState<{ present: number; excused: number; absent: number; total: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Load recent exercises attendance for this user
    exerciseApi.list({ limit: '50' }).then(d => {
      const exercises = d.exercises || [];
      let present = 0, excused = 0, absent = 0, total = 0;
      exercises.forEach((ex: any) => {
        const att = ex.attendances?.find((a: any) => a.memberId === userId || a.member?.id === userId);
        if (att) {
          total++;
          if (att.status === 'PRESENT') present++;
          else if (att.status === 'EXCUSED') excused++;
          else absent++;
        }
      });
      if (total > 0) setStats({ present, excused, absent, total });
    }).catch(() => {});
  }, [userId]);

  if (!stats) return null;

  const pct = Math.round((stats.present / stats.total) * 100);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Meine Anwesenheit (Übungen)</p>
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#16a34a" strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">{pct}%</span>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm"><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-ink-muted">Anwesend:</span> <strong>{stats.present}</strong></p>
          <p className="flex items-center gap-1.5 text-sm"><MinusCircle className="w-3.5 h-3.5 text-yellow-500" /><span className="text-ink-muted">Entschuldigt:</span> <strong>{stats.excused}</strong></p>
          <p className="flex items-center gap-1.5 text-sm"><XCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-ink-muted">Abwesend:</span> <strong>{stats.absent}</strong></p>
        </div>
      </div>
    </div>
  );
}

const incidentColors: Record<string, string> = {
  FIRE: 'bg-red-50 text-red-700 ring-red-100',
  TECHNICAL: 'bg-blue-50 text-blue-700 ring-blue-100',
  TRAFFIC_ACCIDENT: 'bg-orange-50 text-orange-700 ring-orange-100',
  STORM: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  SEARCH: 'bg-purple-50 text-purple-700 ring-purple-100',
  OTHER: 'bg-surface-100 text-ink-muted ring-surface-200',
};

const eventColors: Record<string, string> = {
  MEETING: 'bg-blue-50 text-blue-700',
  EXERCISE: 'bg-emerald-50 text-emerald-700',
  TRAINING: 'bg-violet-50 text-violet-700',
  FUNERAL: 'bg-surface-100 text-ink-muted',
  EVENT: 'bg-amber-50 text-amber-700',
  OTHER: 'bg-surface-100 text-ink-muted',
};

function StatCard({ title, value, icon: Icon, bgColor, iconColor, trend, to }: {
  title: string; value: number; icon: any; bgColor: string; iconColor: string; trend?: string; to?: string;
}) {
  const navigate = useNavigate();
  return (
    <div onClick={() => to && navigate(to)}
      className={`card hover:shadow-card-hover transition-shadow duration-200 animate-fade-in-up ${to ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-ink-muted text-sm font-medium mb-2">{title}</p>
          <p className="text-4xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{value}</p>
          {trend && <p className="text-xs text-ink-faint mt-2">{trend}</p>}
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${bgColor}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{title}</h2>
      <Link to={linkTo} className="text-xs font-semibold text-fire-700 hover:text-fire-800 flex items-center gap-1 transition-colors">
        {linkLabel} <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth() as any;
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [clock, setClock] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setClock(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const [loading, setLoading] = useState(true);

  const firstName = user?.member?.firstName || '';
  const memberId = user?.member?.id || user?.memberId;

  useEffect(() => {
    dashboardApi.get().then(d => {
      if (d.stats && !d.memberStats) {
        d.memberStats = {
          active: d.stats.activeMembers || 0,
          reserve: d.stats.reserveMembers || 0,
          youth: d.stats.youthMembers || 0,
          honorary: d.stats.honoraryMembers || 0,
        };
        d.totalIncidents = d.stats.totalIncidents || (d.recentIncidents?.length || 0);
        d.totalHonors = d.stats.totalHonors || (d.recentHonors?.length || 0);
        d.totalEvents = d.stats.totalEvents || 0;
      }
      setData(d);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-64 gap-3 text-ink-muted">
      <AlertCircle className="w-5 h-5" /> Fehler beim Laden
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Hero Header mit Begrüßung + Schnellzugriff ── */}
      {(() => {
        const bgStyle: React.CSSProperties = branding.dashboardBgImage
          ? { backgroundImage: `url(${branding.dashboardBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: branding.dashboardBgColor || '#2d2724' };
        const textColor = branding.dashboardTextColor || '#ffffff';
        const isDark = textColor === '#ffffff' || textColor.startsWith('#f');
        return (
          <div className="rounded-2xl overflow-hidden relative" style={bgStyle}>
            {branding.dashboardBgImage && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative z-10 p-6">
              {/* Begrüßung */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-headings)', color: textColor }}>
                  {getGreeting()}{firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.75 }}>
                  {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })} · {clock}
                </p>
              </div>
              {/* Schnellzugriff */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Einsatz eintragen', icon: Flame, path: '/incidents/new', bg: isDark ? 'bg-white/15' : 'bg-black/10' },
                  { label: 'Übung anlegen', icon: Dumbbell, path: '/exercises/new', bg: isDark ? 'bg-white/15' : 'bg-black/10' },
                  { label: 'Fahrt eintragen', icon: Car, path: '/vehicles', bg: isDark ? 'bg-white/15' : 'bg-black/10' },
                ].map(({ label, icon: Icon, path: p, bg }) => (
                  <button key={p} onClick={() => navigate(p)}
                    className={`${bg} backdrop-blur-sm rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/25 transition-all text-center`}>
                    <Icon className="w-5 h-5" style={{ color: textColor }} />
                    <p className="text-xs font-semibold" style={{ color: textColor }}>{label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Regenradar + Nächste Übung ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:items-stretch">
        <div className="flex flex-col flex-1">
          <RadarMapWidget />
        </div>
        <div className="flex flex-col gap-4">
          <NextExerciseCard />
          <EinsatzNavigationWidget />
        </div>
      </div>

      {/* ── Meine Anwesenheit ── */}
      {memberId && <AttendanceCard userId={memberId} />}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard title="Aktive Kamerad:innen" value={data.memberStats.active}
          icon={Users} bgColor="bg-fire-50" iconColor="text-fire-700"
          to="/members/list?status=ACTIVE" />
        <StatCard title="Jugend" value={data.memberStats.youth}
          icon={Users} bgColor="bg-violet-50" iconColor="text-violet-600"
          to="/members/list?status=YOUTH" />
        <StatCard title="Reservisten" value={data.memberStats.reserve}
          icon={Users} bgColor="bg-blue-50" iconColor="text-blue-600"
          to="/members/list?status=RESERVE" />
        <StatCard title="Ehrenmitglieder" value={data.memberStats.honorary}
          icon={Award} bgColor="bg-amber-50" iconColor="text-amber-600"
          to="/members/list?status=HONORARY" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Einsätze gesamt" value={data.totalIncidents}
          icon={Flame} bgColor="bg-orange-50" iconColor="text-orange-600"
          to="/incidents" />
        <StatCard title="Ehrungen gesamt" value={data.totalHonors}
          icon={Award} bgColor="bg-gold-50" iconColor="text-gold-600"
          to="/honors" />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Events */}
        <div>
          <SectionHeader title="Nächste Ereignisse" linkTo="/events" linkLabel="Alle Ereignisse" />
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
            {data.upcomingEvents.length === 0 ? (
              <div className="py-10 text-center text-ink-faint text-sm">Keine bevorstehenden Ereignisse</div>
            ) : (
              data.upcomingEvents.slice(0, 4).map((ev, i) => (
                <Link key={ev.id} to={`/events/${ev.id}`}
                  className="flex items-center gap-4 px-5 py-4 border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors group">
                  {/* Date block */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-xs font-semibold text-ink-muted uppercase">
                      {ev.date ? format(parseISO(ev.date), 'MMM', { locale: de }) : ''}
                    </p>
                    <p className="text-2xl font-bold text-ink leading-none" style={{ fontFamily: 'var(--font-headings)' }}>
                      {ev.date ? format(parseISO(ev.date), 'd') : ''}
                    </p>
                  </div>
                  <div className="w-px h-10 bg-surface-200 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{ev.title}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium mt-1 ${eventColors[ev.type] || eventColors.OTHER}`}>
                      {ev.type === 'OTHER' && (ev as any).calendarCategory ? (ev as any).calendarCategory : EVENT_TYPE_LABELS[ev.type] || ev.type}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink-muted transition-colors flex-shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Incidents */}
        <div>
          <SectionHeader title="Letzte Einsätze" linkTo="/incidents" linkLabel="Alle Einsätze" />
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
            {data.recentIncidents.length === 0 ? (
              <div className="py-10 text-center text-ink-faint text-sm">Keine Einsätze erfasst</div>
            ) : (
              data.recentIncidents.slice(0, 4).map(inc => (
                <Link key={inc.id} to={`/incidents`}
                  className="flex items-center gap-4 px-5 py-4 border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${incidentColors[inc.type] || incidentColors.OTHER}`}>
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{inc.location}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-ink-faint">{INCIDENT_TYPE_LABELS[inc.type] || inc.type}</span>
                      <span className="text-ink-faint/50">·</span>
                      <span className="text-xs text-ink-faint flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {inc.alarmTime ? formatDistanceToNow(parseISO(inc.alarmTime), { addSuffix: true, locale: de }) : ''}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink-muted transition-colors flex-shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Birthdays */}
        <div>
          <SectionHeader title="Bevorstehende Geburtstage" linkTo="/birthdays" linkLabel="Alle Geburtstage" />
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
            {data.upcomingBirthdays.length === 0 ? (
              <div className="py-10 text-center text-ink-faint text-sm">Keine Geburtstage in den nächsten 6 Monaten</div>
            ) : (
              data.upcomingBirthdays.slice(0, 6).map(b => (
                <div key={b.id} className={`flex items-center gap-4 px-5 py-4 border-b border-surface-100 last:border-0 ${(b as any).isToday ? 'bg-fire-50' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${(b as any).isToday ? 'bg-fire-50 ring-1 ring-fire-200' : 'bg-surface-100'}`}>
                    <Cake className={`w-4 h-4 ${(b as any).isToday ? 'text-fire-600' : 'text-ink-faint'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm">
                      {b.firstName} {b.lastName}
                      {(b as any).isToday && <span className="ml-2 text-fire-600 font-bold">🎂 Heute!</span>}
                    </p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      wird {(b as any).nextAge} Jahre
                      {b.birthDate && !isNaN(new Date(b.birthDate).getTime()) && <span className="ml-1.5">· {format(parseISO(b.birthDate), 'd. MMMM', { locale: de })}</span>}
                      {!(b as any).isToday && (b as any).daysUntil > 0 &&
                        <span className="ml-1.5">· in {(b as any).daysUntil} Tagen</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Honors */}
        <div>
          <SectionHeader title="Letzte Ehrungen" linkTo="/honors" linkLabel="Alle Ehrungen" />
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
            {data.recentHonors.length === 0 ? (
              <div className="py-10 text-center text-ink-faint text-sm">Keine Ehrungen erfasst</div>
            ) : (
              data.recentHonors.slice(0, 4).map(h => (
                <div key={h.id} className="flex items-center gap-4 px-5 py-4 border-b border-surface-100 last:border-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{h.title}</p>
                    <p className="text-xs text-ink-faint mt-0.5 truncate">
                      {h.member ? `${h.member.firstName} ${h.member.lastName}` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
