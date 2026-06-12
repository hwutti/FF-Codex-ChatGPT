import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, MapPin, Users, ChevronRight, Filter } from 'lucide-react';
import { eventApi } from '../api';
import { Event, EventType, EVENT_TYPE_LABELS } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const eventTypeColors: Record<string, string> = {
  MEETING: 'bg-blue-100 text-blue-700',
  EXERCISE: 'bg-green-100 text-green-700',
  TRAINING: 'bg-purple-100 text-purple-700',
  FUNERAL: 'bg-gray-100 text-gray-700',
  EVENT: 'bg-yellow-100 text-yellow-700',
  FIRE_INCIDENT: 'bg-red-100 text-red-700',
  TECHNICAL_INCIDENT: 'bg-orange-100 text-orange-700',
  INCIDENT: 'bg-red-100 text-red-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { page: page.toString(), limit: limit.toString() };
    if (typeFilter) params.type = typeFilter;
    eventApi.list(params)
      .then(data => { setEvents(data.events); setTotal(data.total); })
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, [typeFilter, page]);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-fire-700" />
            Ereignisse
          </h1>
          <p className="text-gray-500 text-sm mt-1">{total} Einträge</p>
        </div>
        <Link to="/events/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Übung / Ereignis anlegen
        </Link>
      </div>

      {/* Filter */}
      <div className="card p-4 mb-4">
        <div className="relative w-full sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="input-field pl-9 appearance-none">
            <option value="">Alle Ereignisarten</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-64 gap-3">
          <Calendar className="w-12 h-12 text-gray-300" />
          <p className="text-gray-400">Keine Ereignisse gefunden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="card hover:shadow-md transition-shadow">
              <div className="p-4">
                {/* Top row: Date + Type + Time + Buttons */}
                <div className="flex items-start gap-3">
                  {/* Date block */}
                  <div className="w-14 h-14 bg-fire-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-fire-100">
                    <span className="text-lg font-bold text-fire-700 leading-none">{format(new Date(event.date), 'd')}</span>
                    <span className="text-xs text-fire-600">{format(new Date(event.date), 'MMM yyyy', { locale: de })}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.type === 'OTHER' && (event as any).calendarCategoryColor ? '' : eventTypeColors[event.type]}`}
                        style={event.type === 'OTHER' && (event as any).calendarCategoryColor ? {
                          backgroundColor: (event as any).calendarCategoryColor + '22',
                          color: (event as any).calendarCategoryColor,
                        } : {}}>
                        {event.type === 'OTHER' && (event as any).calendarCategory
                          ? (event as any).calendarCategory
                          : EVENT_TYPE_LABELS[event.type]}
                      </span>
                      {event.startTime && <span className="text-xs text-gray-400">{event.startTime} Uhr</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                      {event._count && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event._count.attendances} Anwesenheiten</span>}
                      {event.responsiblePerson && (
                        <span>{event.responsiblePerson.firstName} {event.responsiblePerson.lastName}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons row — full width on mobile */}
                <div className="flex gap-2 mt-3">
                  <Link to={`/events/${event.id}/attendance`} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-1 justify-center">
                    <Users className="w-3.5 h-3.5" />
                    Anwesenheit
                  </Link>
                  <Link to={`/events/${event.id}`} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-1 justify-center">
                    <ChevronRight className="w-3.5 h-3.5" />
                    Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {Math.ceil(total / limit) > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-500">Seite {page} von {Math.ceil(total / limit)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm px-3 py-1.5">Zurück</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)} className="btn-secondary text-sm px-3 py-1.5">Weiter</button>
          </div>
        </div>
      )}
    </div>
  );
}
