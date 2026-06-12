import React, { useState, useEffect } from 'react';
import { birthdayApi } from '../api';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Cake, Star } from 'lucide-react';

interface BirthdayEntry {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  age: number;
  daysUntil: number;
  isToday: boolean;
  isMilestone: boolean;
  status: string;
}

const MONTHS = [
  'Alle', 'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// ─── Außerhalb der Hauptkomponente ───────────────────────────────────────────
const BirthdayCard = ({ b, showDays }: { b: BirthdayEntry; showDays: boolean }) => {
  const formatBirthDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), 'd. MMMM', { locale: de }); }
    catch { return dateStr; }
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${b.isToday ? 'bg-fire-50 border-fire-200' : 'bg-white border-gray-200'}`}>
      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${b.isToday ? 'bg-fire-600 text-white' : b.isMilestone ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
        {b.isMilestone ? <Star className="h-5 w-5" /> : <Cake className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900">{b.firstName} {b.lastName}</span>
          {b.isToday && <span className="badge-success text-xs">Heute!</span>}
          {b.isMilestone && !b.isToday && <span className="badge bg-amber-100 text-amber-700 text-xs">Runder Geburtstag</span>}
        </div>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatBirthDate(b.birthDate)} · wird {(b as any).nextAge || b.age} Jahre
          {showDays && !b.isToday && <span className="ml-2 text-gray-400">in {b.daysUntil} Tagen</span>}
        </div>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const BirthdaysPage: React.FC = () => {
  const [upcoming, setUpcoming] = useState<BirthdayEntry[]>([]);
  const [byMonth, setByMonth] = useState<BirthdayEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [tab, setTab] = useState<'upcoming' | 'month'>('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      birthdayApi.upcoming(180),
      birthdayApi.list(selectedMonth > 0 ? selectedMonth : undefined),
    ]).then(([upRes, allRes]) => {
      // API returns array directly, not {birthdays:[]}
      setUpcoming(Array.isArray(upRes) ? upRes : (upRes.birthdays || []));
      setByMonth(Array.isArray(allRes) ? allRes : (allRes.birthdays || allRes || []));
    }).finally(() => setLoading(false));
  }, [selectedMonth]);

  const list = tab === 'upcoming' ? upcoming : byMonth;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Geburtstage</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setTab('upcoming')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'upcoming' ? 'border-fire-600 text-fire-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Nächste 6 Monate
        </button>
        <button onClick={() => setTab('month')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'month' ? 'border-fire-600 text-fire-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Nach Monat
        </button>
      </div>

      {tab === 'month' && (
        <div className="mb-4">
          <select className="input-field max-w-xs" value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fire-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Cake className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Keine Geburtstage gefunden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(b => <BirthdayCard key={b.id} b={b} showDays={tab === 'upcoming'} />)}
        </div>
      )}
    </div>
  );
};

export default BirthdaysPage;
