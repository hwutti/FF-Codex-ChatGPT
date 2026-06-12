import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { memberApi } from '../api';
import { ArrowLeft } from 'lucide-react';
import { sortByRank } from '../utils/rankOrder';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktive Kamerad:innen',
  YOUTH: 'Jugend',
  RESERVE: 'Reservisten',
  HONORARY: 'Ehrenmitglieder',
};

export default function MemberListPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status') || 'ACTIVE';
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    memberApi.list({ status, limit: '200' })
      .then(r => setMembers(sortByRank(r.members || [])))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>
            {STATUS_LABELS[status] || status}
          </h1>
          <p className="text-sm text-gray-500">{members.length} Einträge</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-black/10 border-t-fire-700 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-black/10  overflow-hidden">
          {members.map(m => {
            const initials = `${m.firstName[0]}${m.lastName[0]}`.toUpperCase();
            const colors = ['bg-gold-400/10 text-gold-400','bg-blue-50 text-blue-700','bg-emerald-50 text-emerald-700','bg-violet-50 text-violet-700','bg-amber-50 text-amber-700'];
            const color = colors[m.firstName.charCodeAt(0) % colors.length];
            const avatarUrl = m.user?.avatarUrl;
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4 border-b border-black/10 last:border-0 hover:bg-black/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/members/${m.id}`)}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold overflow-hidden ${color}`}
                  style={{ fontFamily: 'var(--font-headings)' }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{m.firstName} {m.lastName}</p>
                  <p className="text-sm text-gray-500">{m.rank || '—'}</p>
                </div>
                {m.memberNumber && <p className="text-xs text-gray-400">#{m.memberNumber}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
