import ColorPicker from '../components/ColorPicker';
import DiktatButton from '../components/DiktatButton';
import React, { useState, useEffect } from 'react';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { useBranding } from '../utils/BrandingContext';
import api from '../api';
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2,
  MapPin, AlignLeft, Calendar, Clock, Link, Tag
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
  parseISO, addWeeks, subWeeks, startOfDay, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const calendarApi = {
  getCategories: () => api.get('/calendar/categories').then(r => r.data),
  createCategory: (data: any) => api.post('/calendar/categories', data).then(r => r.data),
  updateCategory: (id: string, data: any) => api.put(`/calendar/categories/${id}`, data).then(r => r.data),
  deleteCategory: (id: string) => api.delete(`/calendar/categories/${id}`),
  getEvents: (from: string, to: string) => api.get(`/calendar/events?from=${from}&to=${to}`).then(r => r.data),
  createEvent: (data: any) => api.post('/calendar/events', data).then(r => r.data),
  updateEvent: (id: string, data: any) => api.put(`/calendar/events/${id}`, data).then(r => r.data),
  deleteEvent: (id: string) => api.delete(`/calendar/events/${id}`),
};


// ── Österreichische Feiertage ─────────────────────────────────────────────────
function getAustrianHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const add = (m: number, d: number, name: string) =>
    holidays.set(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, name);

  // Fixes Feiertage
  add(1,  1,  'Neujahr');
  add(1,  6,  'Heilige Drei Könige');
  add(5,  1,  'Staatsfeiertag');
  add(8,  15, 'Mariä Himmelfahrt');
  add(10, 26, 'Nationalfeiertag');
  add(11, 1,  'Allerheiligen');
  add(12, 8,  'Mariä Empfängnis');
  add(12, 25, 'Christtag');
  add(12, 26, 'Stefanitag');

  // Bewegliche Feiertage (Osterformel)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d2 = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d2 - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m2 + 114) / 31);
  const day = ((h + l - 7 * m2 + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const addOffset = (offset: number, name: string) => {
    const d3 = new Date(easter);
    d3.setDate(d3.getDate() + offset);
    const key = `${d3.getFullYear()}-${String(d3.getMonth()+1).padStart(2,'0')}-${String(d3.getDate()).padStart(2,'0')}`;
    holidays.set(key, name);
  };

  addOffset(-2, 'Karfreitag');
  addOffset(1,  'Ostermontag');
  addOffset(39, 'Christi Himmelfahrt');
  addOffset(50, 'Pfingstmontag');
  addOffset(60, 'Fronleichnam');

  return holidays;
}

type View = 'month' | 'week' | 'list' | 'year';


const PRESET_COLORS = ['#a82828','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];

// ── Event Form Modal ──────────────────────────────────────────────────────────
function EventModal({ event, categories, onClose, onSave }: {
  event?: any; categories: any[]; onClose: () => void; onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    location: event?.location || '',
    allDay: event?.allDay ?? true,
    startDate: event?.startDate ? format(parseISO(event.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endDate: event?.endDate ? format(parseISO(event.endDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    startDateDay: event?.startDate ? format(parseISO(event.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    endDateDay: event?.endDate ? format(parseISO(event.endDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    categoryId: event?.categoryId || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Titel erforderlich'); return; }
    setSaving(true);
    try {
      const startDate = form.allDay ? `${form.startDateDay}T00:00:00` : form.startDate;
      const endDate = form.allDay ? `${form.endDateDay}T23:59:59` : form.endDate;
      await onSave({ ...form, startDate, endDate });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-16">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg flex flex-col" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900 text-lg" style={{ fontFamily: 'var(--font-headings)' }}>
            {event ? 'Termin bearbeiten' : 'Neuer Termin'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Titel *</label>
            <input type="text" className="input-field" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="z.B. Monatsübung" autoFocus required />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
            <input type="checkbox" id="allDay" checked={form.allDay}
              onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
              className="w-4 h-4 accent-fire-700" />
            <label htmlFor="allDay" className="text-sm font-medium text-gray-700">Ganztägig</label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {form.allDay ? 'Startdatum' : 'Beginn'}
              </label>
              {form.allDay
                ? <input type="date" className="input-field" value={form.startDateDay}
                    onChange={e => setForm(f => ({ ...f, startDateDay: e.target.value }))} required />
                : <input type="datetime-local" className="input-field" value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              }
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {form.allDay ? 'Enddatum' : 'Ende'}
              </label>
              {form.allDay
                ? <input type="date" className="input-field" value={form.endDateDay}
                    onChange={e => setForm(f => ({ ...f, endDateDay: e.target.value }))} required />
                : <input type="datetime-local" className="input-field" value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
              }
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kategorie</label>
            <select className="input-field" value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
              <option value="">— Keine Kategorie —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ort</label>
            <input type="text" className="input-field" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="z.B. Feuerwehrhaus Görtschach" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Beschreibung</label>
            <div className="flex gap-2 items-start">
<textarea className="input-field" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optionale Beschreibung..." />
<DiktatButton onResult={text => setForm(f => ({ ...f, description: text }))} /></div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-surface-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
          <button type="button" onClick={handleSubmit as any} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {event ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Manager ──────────────────────────────────────────────────────────
function CategoryManager({ categories, onClose, onRefresh }: {
  categories: any[]; onClose: () => void; onRefresh: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#a82828');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await calendarApi.createCategory({ name: newName.trim(), color: newColor });
      setNewName(''); onRefresh(); toast.success('Kategorie erstellt');
    } finally { setSaving(false); }
  };

  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);

  const handleDeleteCategory = async (id: string) => {
    await calendarApi.deleteCategory(id);
    onRefresh(); toast.success('Gelöscht');
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h3 className="font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>Kategorien</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Existing */}
          <div className="space-y-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="flex-1 text-sm font-medium">{c.name}</span>
                <button onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Noch keine Kategorien</p>}
          </div>
          {/* New */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <ColorPicker value={newColor} onChange={color => setNewColor(color)} compact />
            <input type="text" className="input-field flex-1" value={newName}
              onChange={e => setNewName(e.target.value)} placeholder="Neue Kategorie..." />
            <button type="submit" disabled={saving || !newName.trim()} className="btn-primary px-4">
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Calendar Page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuth();
  const { branding } = useBranding();
  const routerNavigate = useRouterNavigate();
  const isAdmin = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER'].includes(user?.role || '');
  const [view, setView] = useState<View>('month');
  const minYear = new Date().getFullYear() - 100;
  const maxYear = new Date().getFullYear() + 100;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const feedUrl = `${window.location.origin}/api/calendar/feed.ics`;

  const loadCategories = async () => {
    const cats = await calendarApi.getCategories();
    setCategories(cats);
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const from = format(subMonths(startOfMonth(currentDate), 1), 'yyyy-MM-dd');
      const to = format(addMonths(endOfMonth(currentDate), 1), 'yyyy-MM-dd');
      const evs = await calendarApi.getEvents(from, to);
      setEvents(evs);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadEvents(); }, [currentDate]);

  const handleSaveEvent = async (data: any) => {
    try {
      if (editEvent) {
        await calendarApi.updateEvent(editEvent.id, data);
        toast.success('Termin aktualisiert');
      } else {
        await calendarApi.createEvent(data);
        toast.success('Termin erstellt');
      }
      setShowEventModal(false);
      setEditEvent(null);
      loadEvents();
    } catch { toast.error('Fehler beim Speichern'); }
  };

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<any>(null);

  const handleDeleteEvent = (ev: any) => {
    setConfirmDeleteEvent(ev);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteEvent) return;
    await calendarApi.deleteEvent(confirmDeleteEvent.id);
    setConfirmDeleteEvent(null);
    setSelectedEvent(null);
    toast.success('Gelöscht');
    loadEvents();
  };

  const getEventsForDay = (day: Date) =>
    events.filter(ev => {
      const d = startOfDay(day);
      const start = startOfDay(parseISO(ev.startDate));
      // Für ganztägige Events: endDate einschließen
      // Für zeitbasierte Events: nur startDate-Tag verwenden (verhindert Multi-Day durch UTC-Offset)
      if (ev.allDay) {
        const end = startOfDay(parseISO(ev.endDate));
        return d >= start && d <= end;
      } else {
        // Nur am Tag des Starts anzeigen, außer Event geht wirklich über Mitternacht
        const endDay = startOfDay(parseISO(ev.endDate));
        const sameDay = start.getTime() === endDay.getTime();
        if (sameDay) return d.getTime() === start.getTime();
        // Echter Mehrtages-Event
        return d >= start && d <= endDay;
      }
    });

  const catColor = (ev: any) => ev.category?.color || '#a82828';


  // ── Year View ───────────────────────────────────────────────────────────────
  const renderYear = () => {
    const year = currentDate.getFullYear();
    const yearHolidays = getAustrianHolidays(year);

    return (
      <div className="flex-1 overflow-auto p-2 sm:p-4"><div className="min-w-[320px]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, mi) => {
            const monthDate = new Date(year, mi, 1);
            const mStart = startOfMonth(monthDate);
            const mEnd = endOfMonth(monthDate);
            const calS = startOfWeek(mStart, { weekStartsOn: 1 });
            const days: Date[] = [];
            let d = calS;
            while (d <= mEnd || days.length % 7 !== 0) {
              days.push(d); d = addDays(d, 1);
              if (days.length > 42) break;
            }
            const monthEvents = events.filter(ev => {
              const s = parseISO(ev.startDate);
              return s.getFullYear() === year && s.getMonth() === mi;
            });

            return (
              <div key={mi} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="px-3 py-2 bg-surface-50 border-b border-surface-100 flex items-center justify-between cursor-pointer hover:bg-surface-100"
                  onClick={() => { setCurrentDate(monthDate); setView('month'); }}>
                  <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>
                    {format(monthDate, 'MMMM', { locale: de })}
                  </p>
                  {monthEvents.length > 0 && (
                    <span className="text-xs bg-fire-100 text-fire-700 px-1.5 py-0.5 rounded-full font-medium">
                      {monthEvents.length}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="grid grid-cols-7 mb-1 min-w-[280px]">
                    {['M','D','M','D','F','S','S'].map((d2, i) => (
                      <div key={i} className={`text-center text-[9px] font-semibold py-0.5 ${i >= 5 ? 'text-blue-500' : 'text-gray-400'}`}>{d2}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {days.map((d2, i) => {
                      const inMonth = isSameMonth(d2, monthDate);
                      const isT = isToday(d2);
                      const dow = d2.getDay();
                      const isWe = dow === 0 || dow === 6;
                      const dKey = format(d2, 'yyyy-MM-dd');
                      const isHol = yearHolidays.has(dKey);
                      const hasEv = events.some(ev => isSameDay(parseISO(ev.startDate), d2));
                      return (
                        <div key={i}
                          onClick={() => { if (inMonth) { setCurrentDate(d2); setView('month'); } }}
                          className={`relative text-center text-[10px] py-0.5 rounded cursor-pointer transition-colors ${
                            !inMonth ? 'opacity-0' :
                            isT ? 'bg-fire-700 text-white font-bold' :
                            isHol ? 'text-red-600 font-bold' :
                            isWe ? 'text-blue-600 font-semibold' :
                            'text-gray-700 hover:bg-surface-100'
                          }`}>
                          {inMonth ? format(d2, 'd') : ''}
                          {hasEv && inMonth && !isT && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-fire-500" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    );
  };

  // ── Month View ──────────────────────────────────────────────────────────────
  const renderMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = [];
    let day = calStart;
    while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-surface-200">
          {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
            <div key={d} className="text-center py-2 text-xs font-semibold text-gray-500">{d}</div>
          ))}
        </div>
        {/* Days grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-auto">
          {days.map((d, i) => {
            const dayEvents = getEventsForDay(d);
            const isCurrentMonth = isSameMonth(d, currentDate);
            const isT = isToday(d);
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const dateKey = format(d, 'yyyy-MM-dd');
            const holiday = holidays.get(dateKey);
            return (
              <div key={i}
                className={`border-b border-r border-surface-100 p-1 min-h-[80px] cursor-pointer hover:bg-surface-50 transition-colors ${
                  !isCurrentMonth ? 'bg-surface-50/50' :
                  isWeekend ? 'bg-blue-50/30' : ''
                }`}
                onClick={() => { if (isAdmin) { routerNavigate(`/calendar/new?date=${format(d, 'yyyy-MM-dd')}`); } }}>
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-0.5 ${
                  isT ? 'bg-fire-700 text-white' :
                  isWeekend && isCurrentMonth ? 'text-blue-600 font-bold' :
                  isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {format(d, 'd')}
                </div>
                {holiday && isCurrentMonth && (
                  <div className="text-[9px] text-red-600 font-medium truncate leading-tight mb-0.5">{holiday}</div>
                )}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => (
                    <div key={ev.id}
                      onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                      className="text-xs px-1.5 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80"
                      style={{ background: catColor(ev) + '25', color: catColor(ev), borderLeft: `2px solid ${catColor(ev)}` }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 px-1">+{dayEvents.length - 3} mehr</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week View ───────────────────────────────────────────────────────────────
  const renderWeek = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b border-surface-200 sticky top-0 bg-white z-10">
          {days.map((d, i) => (
            <div key={i} className="text-center py-3 border-r border-surface-100 last:border-0">
              <p className="text-xs text-gray-500">{format(d, 'EEE', { locale: de })}</p>
              <p className={`text-lg font-bold mt-0.5 w-8 h-8 mx-auto flex items-center justify-center rounded-full ${
                isToday(d) ? 'bg-fire-700 text-white' : 'text-gray-900'
              }`}>{format(d, 'd')}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-96">
          {days.map((d, i) => {
            const dayEvents = getEventsForDay(d);
            return (
              <div key={i} className="border-r border-surface-100 last:border-0 p-2 space-y-1 min-h-32">
                {dayEvents.map(ev => (
                  <div key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="text-xs p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: catColor(ev) + '20', borderLeft: `3px solid ${catColor(ev)}` }}>
                    <p className="font-semibold truncate flex items-center gap-1" style={{ color: catColor(ev) }}>
                      {ev.eventId && <span title="Mit Ereignissen verknüpft">📋</span>}
                      {ev.title}
                    </p>
                    {!ev.allDay && (
                      <p className="text-gray-500 mt-0.5">{format(parseISO(ev.startDate), 'HH:mm')}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── List View ───────────────────────────────────────────────────────────────
  const renderList = () => {
    const sorted = [...events].sort((a, b) =>
      parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
    );
    if (sorted.length === 0) return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Keine Termine vorhanden</p>
      </div>
    );

    return (
      <div className="flex-1 overflow-auto space-y-2 p-4">
        {sorted.map(ev => (
          <div key={ev.id}
            onClick={() => setSelectedEvent(ev)}
            className="flex items-start gap-4 p-4 card cursor-pointer hover:shadow-card-hover transition-all"
            style={{ borderLeft: `4px solid ${catColor(ev)}` }}>
            <div className="flex-shrink-0 text-center min-w-[48px]">
              <p className="text-xs text-gray-500 uppercase">{format(parseISO(ev.startDate), 'MMM', { locale: de })}</p>
              <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>
                {format(parseISO(ev.startDate), 'd')}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                {ev.eventId && <span title="Mit Ereignissen verknüpft" className="text-sm">📋</span>}
                {ev.title}
              </p>
              {ev.category && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catColor(ev) + '20', color: catColor(ev) }}>
                  {ev.category.name}
                </span>
              )}
              {ev.location && <p className="text-xs text-gray-500 mt-1">📍 {ev.location}</p>}
              {!ev.allDay && (
                <p className="text-xs text-gray-500">🕐 {format(parseISO(ev.startDate), 'HH:mm')} – {format(parseISO(ev.endDate), 'HH:mm')}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const navigate = (dir: 1 | -1) => {
    if (view === 'month') {
      const next = dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
      if (next.getFullYear() >= minYear && next.getFullYear() <= maxYear) setCurrentDate(next);
    } else if (view === 'week') {
      const next = dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
      if (next.getFullYear() >= minYear && next.getFullYear() <= maxYear) setCurrentDate(next);
    } else if (view === 'year') {
      const next = new Date(currentDate);
      next.setFullYear(currentDate.getFullYear() + dir);
      if (next.getFullYear() >= minYear && next.getFullYear() <= maxYear) setCurrentDate(next);
    }
  };

  const holidays = getAustrianHolidays(currentDate.getFullYear());
  const title = view === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: de })
    : view === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd. MMM', { locale: de })} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd. MMM yyyy', { locale: de })}`
    : view === 'year' ? format(currentDate, 'yyyy')
    : 'Alle Termine';

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-surface-200 flex-shrink-0 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold text-gray-900 min-w-[160px] text-center" style={{ fontFamily: 'var(--font-headings)' }}>
            {title}
          </h2>
          <button onClick={() => navigate(1)} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-100 text-gray-600 hover:bg-surface-200 ml-1">
            Heute
          </button>
        </div>

        {/* View switcher */}
        <div className="flex bg-surface-100 rounded-xl p-0.5 ml-auto">
          {(['month','week','year','list'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {v === 'month' ? 'Monat' : v === 'week' ? 'Woche' : v === 'year' ? 'Jahr' : 'Liste'}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <button onClick={() => routerNavigate('/calendar/categories')}
                className="p-2 text-gray-500 hover:bg-surface-100 rounded-xl transition-colors" title="Kategorien">
                <Tag className="w-4 h-4" />
              </button>
              <button onClick={() => routerNavigate(`/calendar/new?date=${currentDate.toISOString().slice(0,10)}`)}
                className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3">
                <Plus className="w-4 h-4" /> Termin
              </button>
            </>
          )}
          <button
            onClick={() => { navigator.clipboard.writeText(feedUrl); toast.success('iCal-Feed URL kopiert!'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-100 text-gray-600 hover:bg-surface-200 transition-colors"
            title={feedUrl}>
            <Link className="w-3.5 h-3.5" /> iCal
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" />
        </div>
      ) : (
        view === 'month' ? renderMonth() :
        view === 'week' ? renderWeek() :
        view === 'year' ? renderYear() :
        renderList()
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-modal w-full sm:max-w-md">
            <div className="flex items-start gap-3 p-5 border-b border-surface-100">
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" style={{ background: catColor(selectedEvent) }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-lg">{selectedEvent.title}</h3>
                {selectedEvent.eventId && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    ✓ Ereignis verknüpft
                  </span>
                )}
              </div>
                {selectedEvent.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: catColor(selectedEvent) + '20', color: catColor(selectedEvent) }}>
                    {selectedEvent.category.name}
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1.5 hover:bg-surface-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>
                  {selectedEvent.allDay
                    ? format(parseISO(selectedEvent.startDate), 'd. MMMM yyyy', { locale: de })
                    : `${format(parseISO(selectedEvent.startDate), 'd. MMM yyyy, HH:mm', { locale: de })} – ${format(parseISO(selectedEvent.endDate), 'HH:mm')}`
                  }
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.description && (
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <AlignLeft className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{selectedEvent.description}</span>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => { routerNavigate(`/calendar/${selectedEvent.id}/edit`); setSelectedEvent(null); }}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Edit2 className="w-4 h-4" /> Bearbeiten
                </button>
                <button onClick={() => handleDeleteEvent(selectedEvent)}
                  className="btn-danger flex items-center justify-center gap-2 px-4">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}



      {/* Modals */}
      {showEventModal && (
        <EventModal event={editEvent} categories={categories}
          onClose={() => { setShowEventModal(false); setEditEvent(null); }}
          onSave={handleSaveEvent} />
      )}
      {showCatManager && (
        <CategoryManager categories={categories}
          onClose={() => setShowCatManager(false)}
          onRefresh={loadCategories} />
      )}

      {/* ── Bestätigungs-Dialog Termin löschen ── */}
      {confirmDeleteEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteEvent(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-ink">Termin löschen?</p>
                <p className="text-sm text-ink-muted mt-0.5">{confirmDeleteEvent.title}</p>
              </div>
            </div>
            <p className="text-sm text-ink-muted">Dieser Termin wird unwiderruflich gelöscht.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmDeleteEvent(null)}
                className="flex-1 py-2.5 border border-surface-200 rounded-xl text-sm font-semibold text-ink hover:bg-surface-50 transition-colors">
                Abbrechen
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold text-white transition-colors">
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
