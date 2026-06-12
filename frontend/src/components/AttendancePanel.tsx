import { Users } from 'lucide-react';
import { AttendanceStatus } from '../types';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  rank?: string;
}

interface Attendance {
  memberId?: string;
  member?: { id: string };
  status: string;
}

interface AttendancePanelProps {
  members: Member[];
  attendances: Attendance[];
  onToggle: (memberId: string, nextStatus?: AttendanceStatus) => void;
}

const BUTTONS = [
  {
    s: 'PRESENT' as AttendanceStatus,
    label: 'Anwesend',
    active: 'bg-green-500 text-white shadow-sm',
    idle:   'text-green-600 bg-green-50 border border-green-200 hover:bg-green-100',
  },
  {
    s: 'EXCUSED' as AttendanceStatus,
    label: 'Entschuldigt',
    active: 'bg-amber-400 text-white shadow-sm',
    idle:   'text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100',
  },
  {
    s: 'ABSENT' as AttendanceStatus,
    label: 'Abwesend',
    active: 'bg-red-500 text-white shadow-sm',
    idle:   'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100',
  },
] as const;

const STATUS_DOT: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-500',
  EXCUSED: 'bg-amber-400',
  ABSENT:  'bg-red-500',
};

export default function AttendancePanel({ members, attendances, onToggle }: AttendancePanelProps) {
  const countOf = (s: AttendanceStatus) =>
    members.filter(m => attendances?.find(a => (a.memberId === m.id || a.member?.id === m.id) && a.status === s)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2 text-ink-muted uppercase tracking-wider">
          <Users className="w-3.5 h-3.5" /> Anwesenheit
        </h2>
        <div className="flex gap-1.5 text-xs font-medium">
          <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />{countOf('PRESENT')}
          </span>
          <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{countOf('EXCUSED')}
          </span>
          <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{countOf('ABSENT')}
          </span>
        </div>
      </div>

      {/* Liste */}
      <div className="divide-y divide-surface-100">
        {members.map(m => {
          const att = attendances?.find(a => a.memberId === m.id || a.member?.id === m.id);
          const status = att?.status as AttendanceStatus | undefined;
          return (
            <div key={m.id} className="flex items-center justify-between py-2 gap-3">
              {/* Name + Status-Dot */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${status ? STATUS_DOT[status] : 'bg-surface-200'}`} />
                <span className="text-sm font-medium truncate">{m.firstName} {m.lastName}</span>
                {m.rank && <span className="text-xs text-ink-muted hidden sm:inline flex-shrink-0">{m.rank}</span>}
              </div>
              {/* Buttons */}
              <div className="flex gap-1 flex-shrink-0">
                {BUTTONS.map(({ s, label, active, idle }) => (
                  <button
                    key={s}
                    onClick={() => onToggle(m.id, status === s ? undefined : s)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all active:scale-95 ${status === s ? active : idle}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
