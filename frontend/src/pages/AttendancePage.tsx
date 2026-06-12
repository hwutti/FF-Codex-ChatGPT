import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, X, AlertCircle, Users, Search } from 'lucide-react';
import { eventApi, memberApi } from '../api';
import { AttendanceStatus } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface AttendanceEntry {
  memberId: string;
  firstName: string;
  lastName: string;
  rank?: string;
  groupName?: string;
  memberNumber: string;
  status: AttendanceStatus;
  notes: string;
}

const STATUS_COLORS = {
  PRESENT: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-700', light: 'bg-green-50' },
  EXCUSED: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50' },
  ABSENT:  { bg: 'bg-gray-300',   border: 'border-gray-300',   text: 'text-gray-500',   light: 'bg-gray-50' },
};

export default function AttendancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [eventData, allMembers, attendanceData] = await Promise.all([
          eventApi.get(id!),
          memberApi.list({ status: 'ACTIVE', limit: '200' }),
          eventApi.getAttendance(id!),
        ]);
        setEvent(eventData);

        // Merge members with attendance
        const attendanceMap = new Map(attendanceData.map((a: any) => [a.memberId, a]));
        const merged: AttendanceEntry[] = allMembers.members.map((m: any) => {
          const att: any = attendanceMap.get(m.id);
          return {
            memberId: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            rank: m.rank,
            groupName: m.groupName,
            memberNumber: m.memberNumber,
            status: att?.status || 'ABSENT',
            notes: att?.notes || '',
          };
        });
        // Sort: present first, then by name
        merged.sort((a, b) => {
          if (a.status === 'PRESENT' && b.status !== 'PRESENT') return -1;
          if (b.status === 'PRESENT' && a.status !== 'PRESENT') return 1;
          return a.lastName.localeCompare(b.lastName);
        });
        setEntries(merged);
      } catch {
        toast.error('Fehler beim Laden');
        navigate('/events');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const setStatus = useCallback((memberId: string, status: AttendanceStatus) => {
    setEntries(prev => prev.map(e => e.memberId === memberId ? { ...e, status } : e));
  }, []);

  const cycleStatus = (memberId: string, current: AttendanceStatus) => {
    const next: Record<AttendanceStatus, AttendanceStatus> = {
      ABSENT: 'PRESENT',
      PRESENT: 'EXCUSED',
      EXCUSED: 'ABSENT',
    };
    setStatus(memberId, next[current]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await eventApi.saveAttendance(id!, entries.map(e => ({
        memberId: e.memberId,
        status: e.status,
        notes: e.notes,
      })));
      toast.success('Anwesenheit gespeichert');
      navigate(`/events/${id}`);
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(entries.map(e => e.groupName).filter(Boolean))];

  const filtered = entries.filter(e => {
    const matchSearch = !search || `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchGroup = !groupFilter || e.groupName === groupFilter;
    return matchSearch && matchGroup;
  });

  const presentCount = entries.filter(e => e.status === 'PRESENT').length;
  const excusedCount = entries.filter(e => e.status === 'EXCUSED').length;

  const markAll = (status: AttendanceStatus) => {
    setEntries(prev => prev.map(e => ({ ...e, status })));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
              <ArrowLeft className="w-4 h-4" />Zurück
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>

          {event && (
            <div className="mb-2">
              <h1 className="font-bold text-gray-900 truncate">{event.title}</h1>
              <p className="text-xs text-gray-500">{format(new Date(event.date), 'EEEE, d. MMMM yyyy', { locale: de })}</p>
            </div>
          )}

          {/* Summary */}
          <div className="flex gap-3 text-sm mb-2">
            <span className="flex items-center gap-1.5 text-green-700"><Check className="w-4 h-4" />{presentCount} anwesend</span>
            <span className="flex items-center gap-1.5 text-yellow-700"><AlertCircle className="w-4 h-4" />{excusedCount} entschuldigt</span>
            <span className="flex items-center gap-1.5 text-gray-500"><X className="w-4 h-4" />{entries.length - presentCount - excusedCount} abwesend</span>
          </div>

          {/* Search + filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)}
                className="input-field pl-8 text-sm py-2" />
            </div>
            {groups.length > 0 && (
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="input-field text-sm py-2 w-36">
                <option value="">Alle Gruppen</option>
                {groups.map(g => <option key={g} value={g!}>{g}</option>)}
              </select>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-2">
            <button onClick={() => markAll('PRESENT')} className="text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors">Alle anwesend</button>
            <button onClick={() => markAll('ABSENT')} className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition-colors">Alle abwesend</button>
          </div>
        </div>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
              <Users className="w-10 h-10" />
              <p>Keine Kamerad:innen gefunden</p>
            </div>
          ) : (
            <div className="space-y-1.5 pb-20">
              {filtered.map(entry => {
                const colors = STATUS_COLORS[entry.status];
                return (
                  <div
                    key={entry.memberId}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-95 ${
                      entry.status === 'PRESENT' ? 'border-green-400 bg-green-50' :
                      entry.status === 'EXCUSED' ? 'border-yellow-400 bg-yellow-50' :
                      'border-gray-200 bg-white'
                    }`}
                    onClick={() => cycleStatus(entry.memberId, entry.status)}
                  >
                    {/* Status indicator */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                      {entry.status === 'PRESENT' && <Check className="w-5 h-5 text-white" />}
                      {entry.status === 'EXCUSED' && <AlertCircle className="w-5 h-5 text-white" />}
                      {entry.status === 'ABSENT' && <X className="w-5 h-5 text-white opacity-50" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 leading-tight">{entry.lastName} {entry.firstName}</p>
                      <p className="text-xs text-gray-500">{entry.rank || entry.groupName || entry.memberNumber}</p>
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {(['PRESENT', 'EXCUSED', 'ABSENT'] as AttendanceStatus[]).map(s => (
                        <button
                          key={s}
                          onClick={() => setStatus(entry.memberId, s)}
                          className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                            entry.status === s
                              ? s === 'PRESENT' ? 'bg-green-500 text-white' : s === 'EXCUSED' ? 'bg-yellow-500 text-white' : 'bg-gray-400 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {s === 'PRESENT' ? '✓' : s === 'EXCUSED' ? '~' : '✗'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating save button on mobile */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <button onClick={handleSave} disabled={saving} className="btn-primary shadow-lg rounded-full px-6 py-3 text-base">
          {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
          Speichern ({presentCount})
        </button>
      </div>
    </div>
  );
}
