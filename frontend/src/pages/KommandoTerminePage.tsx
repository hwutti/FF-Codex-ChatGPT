import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Shield, MapPin, Users, ChevronRight } from 'lucide-react';
import { kommandoTerminApi } from '../api';
import { KommandoTerminType, KOMMANDO_TERMIN_TYPE_LABELS } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeColors: Record<KommandoTerminType, string> = {
  AUSSCHUSS: 'bg-blue-100 text-blue-700',
  KOMMANDO: 'bg-purple-100 text-purple-700',
};

export default function KommandoTerminePage() {
  const navigate = useNavigate();
  const [termine, setTermine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kommandoTerminApi.list()
      .then(d => setTermine(d.termine || []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-fire-700" /> Kommandotermine
          </h1>
          <p className="text-gray-500 text-sm mt-1">{termine.length} Einträge</p>
        </div>
        <button onClick={() => navigate('/kommando-termine/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Termin anlegen
        </button>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : termine.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-64 gap-3">
          <Shield className="w-12 h-12 text-gray-300" />
          <p className="text-gray-400">Noch keine Kommandotermine</p>
        </div>
      ) : (
        <div className="space-y-2">
          {termine.map(t => (
            <div key={t.id} className="card hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 bg-fire-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-fire-100">
                    <span className="text-lg font-bold text-fire-700 leading-none">{format(new Date(t.date), 'd')}</span>
                    <span className="text-xs text-fire-600">{format(new Date(t.date), 'MMM yyyy', { locale: de })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[t.type as KommandoTerminType]}`}>
                        {KOMMANDO_TERMIN_TYPE_LABELS[t.type as KommandoTerminType]}
                      </span>
                      {t.startTime && <span className="text-xs text-gray-400">{t.startTime} Uhr</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      {t.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.location}</span>}
                      {t.attendances && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.attendances.length} Teilnehmer</span>}
                    </div>
                  </div>
                  <button onClick={() => navigate(`/kommando-termine/${t.id}`)}
                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
                    <ChevronRight className="w-3.5 h-3.5" /> Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
