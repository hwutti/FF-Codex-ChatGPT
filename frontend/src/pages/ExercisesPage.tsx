import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Dumbbell, MapPin, Users, ChevronRight } from 'lucide-react';
import { exerciseApi } from '../api';
import { ExerciseType, EXERCISE_TYPE_LABELS } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeColors: Record<ExerciseType, string> = {
  RADIO: 'bg-blue-100 text-blue-700',
  DISTRICT: 'bg-purple-100 text-purple-700',
  COMMUNITY: 'bg-green-100 text-green-700',
  DISASTER: 'bg-red-100 text-red-700',
  DRIVE: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

export default function ExercisesPage() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    exerciseApi.list({ limit: '200' })
      .then(data => setExercises(data.exercises || []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-fire-700" /> Übungen
          </h1>
          <p className="text-gray-500 text-sm mt-1">{exercises.length} Einträge</p>
        </div>
        <button onClick={() => navigate('/exercises/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Übung anlegen
        </button>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-64 gap-3">
          <Dumbbell className="w-12 h-12 text-gray-300" />
          <p className="text-gray-400">Noch keine Übungen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exercises.map(ex => (
            <div key={ex.id} className="card hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 bg-fire-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-fire-100">
                    <span className="text-lg font-bold text-fire-700 leading-none">{format(new Date(ex.date), 'd')}</span>
                    <span className="text-xs text-fire-600">{format(new Date(ex.date), 'MMM yyyy', { locale: de })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[ex.type as ExerciseType]}`}>
                        {EXERCISE_TYPE_LABELS[ex.type as ExerciseType]}
                      </span>
                      {ex.startTime && <span className="text-xs text-gray-400">{ex.startTime} Uhr</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{ex.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      {ex.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ex.location}</span>}
                      {ex.attendances && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ex.attendances.length} Teilnehmer</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to={`/exercises/${ex.id}`} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-1 justify-center">
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
