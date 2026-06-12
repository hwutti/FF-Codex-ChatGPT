import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, MapPin, Users, ChevronRight } from 'lucide-react';
import { orgEventApi } from '../api';
import { OrgEventType, ORG_EVENT_TYPE_LABELS } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeColors: Record<OrgEventType, string> = {
  MEETING: 'bg-blue-100 text-blue-700',
  FUNERAL: 'bg-gray-100 text-gray-700',
  EVENT: 'bg-yellow-100 text-yellow-700',
  TRAINING: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

export default function OrgEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orgEventApi.list({ limit: '200' })
      .then(data => setEvents(data.orgEvents || []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-fire-700" /> Ereignisse
          </h1>
          <p className="text-gray-500 text-sm mt-1">{events.length} Einträge</p>
        </div>
        <button onClick={() => navigate('/org-events/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ereignis anlegen
        </button>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-64 gap-3">
          <CalendarDays className="w-12 h-12 text-gray-300" />
          <p className="text-gray-400">Noch keine Ereignisse</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="card hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 bg-fire-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-fire-100">
                    <span className="text-lg font-bold text-fire-700 leading-none">{format(new Date(ev.date), 'd')}</span>
                    <span className="text-xs text-fire-600">{format(new Date(ev.date), 'MMM yyyy', { locale: de })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[ev.type as OrgEventType]}`}>
                        {ORG_EVENT_TYPE_LABELS[ev.type as OrgEventType]}
                      </span>
                      {ev.startTime && <span className="text-xs text-gray-400">{ev.startTime} Uhr</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{ev.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      {ev.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</span>}
                      {ev.attendances && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ev.attendances.length} Teilnehmer</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to={`/org-events/${ev.id}`} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-1 justify-center">
                    <ChevronRight className="w-3.5 h-3.5" /> Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
