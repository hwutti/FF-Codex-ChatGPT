import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Users, MapPin, Clock, Calendar } from 'lucide-react';
import { eventApi } from '../api';
import { Event, EVENT_TYPE_LABELS, AttendanceStatus } from '../types';
import EquipmentUsagePanel from '../components/EquipmentUsagePanel';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventApi.get(id!)
      .then(setEvent)
      .catch(() => { toast.error('Ereignis nicht gefunden'); navigate('/events'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Ereignis wirklich löschen?')) return;
    try {
      await eventApi.delete(id!);
      toast.success('Ereignis gelöscht');
      navigate('/events');
    } catch { toast.error('Fehler beim Löschen'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!event) return null;

  const statusColors: Record<AttendanceStatus, string> = {
    PRESENT: 'bg-green-100 text-green-800',
    EXCUSED: 'bg-yellow-100 text-yellow-800',
    ABSENT: 'bg-red-100 text-red-700',
  };
  const statusLabels: Record<AttendanceStatus, string> = {
    PRESENT: 'Anwesend', EXCUSED: 'Entschuldigt', ABSENT: 'Abwesend',
  };

  const present = event.attendances?.filter(a => a.status === 'PRESENT') || [];
  const excused = event.attendances?.filter(a => a.status === 'EXCUSED') || [];
  const absent = event.attendances?.filter(a => a.status === 'ABSENT') || [];

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/events')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" />Zurück
        </button>
        <div className="flex gap-2">
          <Link to={`/events/${id}/attendance`} className="btn-primary text-sm">
            <Users className="w-4 h-4" />
            Anwesenheit
          </Link>
          <Link to={`/events/${id}/edit`} className="btn-secondary text-sm">
            <Edit className="w-4 h-4" />
          </Link>
          <button onClick={handleDelete} className="btn-danger text-sm">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="card p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-fire-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-fire-700">{format(new Date(event.date), 'd')}</span>
            <span className="text-xs text-fire-600">{format(new Date(event.date), 'MMM', { locale: de })}</span>
          </div>
          <div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${event.type === 'OTHER' && (event as any).calendarCategoryColor ? '' : 'bg-fire-100 text-fire-700'}`}
              style={event.type === 'OTHER' && (event as any).calendarCategoryColor ? {
                backgroundColor: (event as any).calendarCategoryColor + '22',
                color: (event as any).calendarCategoryColor,
              } : {}}>
              {event.type === 'OTHER' && (event as any).calendarCategory
                ? (event as any).calendarCategory
                : EVENT_TYPE_LABELS[event.type]}
            </span>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{event.title}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              {(event.startTime || event.endTime) && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {event.startTime}{event.endTime && ` – ${event.endTime}`} Uhr
                </span>
              )}
              {event.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(event.date), 'EEEE, d. MMMM yyyy', { locale: de })}
              </span>
            </div>
          </div>
        </div>
        {event.description && <p className="mt-4 text-gray-600 text-sm">{event.description}</p>}
        {event.responsiblePerson && (
          <p className="mt-2 text-sm text-gray-500">
            Verantwortlich: <span className="font-medium">{event.responsiblePerson.firstName} {event.responsiblePerson.lastName}</span>
          </p>
        )}
      </div>

      {/* Attendance summary */}
      {event.attendances && event.attendances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Anwesend', count: present.length, color: 'bg-green-50 border-green-200' },
            { label: 'Entschuldigt', count: excused.length, color: 'bg-yellow-50 border-yellow-200' },
            { label: 'Abwesend', count: absent.length, color: 'bg-red-50 border-red-200' },
          ].map(s => (
            <div key={s.label} className={`card p-4 border ${s.color} text-center`}>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Attendance list */}
      {event.attendances && event.attendances.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Anwesenheitsliste</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {event.attendances.map(att => (
              <div key={att.id} className="flex items-center px-5 py-3 gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                  {att.member?.firstName[0]}{att.member?.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{att.member?.lastName} {att.member?.firstName}</p>
                  <p className="text-xs text-gray-400">{att.member?.rank}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[att.status as AttendanceStatus]}`}>
                  {statusLabels[att.status as AttendanceStatus]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Eingesetztes Gerät */}
      {id && (
        <div className="bg-white rounded-2xl border border-surface-200 p-5">
          <EquipmentUsagePanel entityId={id} entityType="event" canEdit={true} />
        </div>
      )}
    </div>
  );
}
