import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Plus, Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import { incidentApi } from '../api';
import { Incident, INCIDENT_TYPE_LABELS } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeColors: Record<string, string> = {
  FIRE: 'bg-red-100 text-red-800 border-red-200',
  TECHNICAL: 'bg-blue-100 text-blue-800 border-blue-200',
  TRAFFIC_ACCIDENT: 'bg-orange-100 text-orange-800 border-orange-200',
  STORM: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  SEARCH: 'bg-purple-100 text-purple-800 border-purple-200',
  OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    incidentApi.list({ page: page.toString(), limit: limit.toString() })
      .then(data => { setIncidents(data.incidents); setTotal(data.total); })
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flame className="w-6 h-6 text-fire-700" />
            Einsätze
          </h1>
          <p className="text-gray-500 text-sm mt-1">{total} Einsätze dokumentiert</p>
        </div>
        <Link to="/incidents/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Neuer Einsatz
        </Link>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-64 gap-3">
          <Flame className="w-12 h-12 text-gray-300" />
          <p className="text-gray-400">Keine Einsätze erfasst</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(incident => (
            <div key={incident.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-fire-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{incident.incidentNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${typeColors[incident.type]}`}>
                      {INCIDENT_TYPE_LABELS[incident.type]}
                    </span>
                  </div>
                  {(incident as any).title && (
                    <p className="font-bold text-gray-900 text-sm mb-0.5">{(incident as any).title}</p>
                  )}
                  <p className="font-semibold text-gray-900 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {incident.location}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                    {incident.alarmTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(incident.alarmTime), 'dd.MM.yyyy HH:mm', { locale: de })} Uhr
                        <span className="text-gray-400">({formatDistanceToNow(new Date(incident.alarmTime), { locale: de, addSuffix: true })})</span>
                      </span>
                    )}
                    {incident._count && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {incident._count.members} Einsatzkräfte
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link to={`/incidents/${incident.id}/edit`}
                    className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Bearbeiten
                  </Link>
                  <Link to={`/incidents/${incident.id}/edit`}
                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5" /> Details
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">Zurück</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)} className="btn-secondary text-sm">Weiter</button>
          </div>
        </div>
      )}
    </div>
  );
}
