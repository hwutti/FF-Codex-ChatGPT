import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { memberApi } from '../api';
import { Member, MemberStatus, MEMBER_STATUS_LABELS } from '../types';
import { Search, Plus, ChevronRight, Users, LayoutList, LayoutGrid } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { hasAdvancedAccess } from '../utils/rankAccess';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'ACTIVE', label: 'Aktiv' },
  { value: 'RESERVE', label: 'Reservisten' },
  { value: 'YOUTH', label: 'Jugend' },
  { value: 'HONORARY', label: 'Ehrenmitglieder' },
  { value: 'EXITED', label: 'Ausgetreten' },
];

const statusBadge: Record<string, string> = {
  ACTIVE: 'badge-active',
  RESERVE: 'badge-reserve',
  YOUTH: 'badge-youth',
  HONORARY: 'badge-honorary',
  EXITED: 'badge-exited',
};

function MemberAvatar({ member, size = 'sm' }: { member: Member; size?: 'sm' | 'lg' }) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  const colors = ['bg-fire-50 text-fire-700', 'bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-700'];
  const color = colors[member.firstName.charCodeAt(0) % colors.length];
  const avatarUrl = (member as any).user?.avatarUrl;
  const sizeClass = size === 'lg' ? 'w-20 h-20 text-2xl rounded-2xl' : 'w-10 h-10 text-sm rounded-xl';
  return (
    <div className={`${sizeClass} flex items-center justify-center flex-shrink-0 font-bold overflow-hidden ${color}`}
      style={{ fontFamily: 'var(--font-headings)' }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : initials}
    </div>
  );
}

export default function MembersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasAdvancedAccess(user);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try { return (localStorage.getItem('members-view') as 'list' | 'grid') || 'list'; } catch { return 'list'; }
  });
  const limit = 20;

  const switchView = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    try { localStorage.setItem('members-view', mode); } catch {}
  };

  const load = useCallback(() => {
    setLoading(true);
    memberApi.list({ search, status, page: String(page), limit: String(limit) })
      .then(r => { setMembers(r.members || []); setTotal(r.total || 0); })
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { setPage(1); }, [search, status]);
  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Kamerad:innen</h1>
          <p className="text-ink-muted text-sm mt-0.5">{total} Einträge</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-white border border-surface-200 rounded-xl shadow-card overflow-hidden">
            <button onClick={() => switchView('list')}
              className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-fire-700 text-white' : 'text-ink-muted hover:text-ink hover:bg-surface-50'}`}
              title="Listenansicht">
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => switchView('grid')}
              className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-fire-700 text-white' : 'text-ink-muted hover:text-ink hover:bg-surface-50'}`}
              title="Kachelansicht">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {canCreate && (
            <Link to="/members/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Neue/r Kamerad:in
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="search"
            placeholder="Name oder Mitgliedsnummer suchen..."
            className="input-field pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value}
              onClick={() => setStatus(f.value)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                status === f.value
                  ? 'bg-fire-700 text-white shadow-btn'
                  : 'bg-white text-ink-muted border border-surface-200 hover:text-ink hover:border-surface-200 shadow-card'
              }`}
              style={{ fontFamily: 'var(--font-general)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-ink-faint">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">Keine Kamerad:innen gefunden</p>
        </div>
      ) : viewMode === 'list' ? (
        /* Listenansicht */
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
          {members.map((m) => (
            <Link key={m.id} to={`/members/${m.id}`}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors group">
              <MemberAvatar member={m} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{m.firstName} {m.lastName}</span>
                  <span className={statusBadge[m.status] || 'badge'}>{MEMBER_STATUS_LABELS[m.status] || m.status}</span>
                </div>
                <p className="text-xs text-ink-faint mt-0.5">
                  {m.memberNumber}{m.rank && ` · ${m.rank}`}{m.functionTitle && ` · ${m.functionTitle}`}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink-muted transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        /* Kachelansicht */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {members.map((m) => (
            <Link key={m.id} to={`/members/${m.id}`}
              className="bg-white rounded-2xl border border-surface-200 shadow-card p-4 flex flex-col items-center gap-3 hover:shadow-lg hover:border-surface-300 transition-all group">
              <MemberAvatar member={m} size="lg" />
              <div className="text-center min-w-0 w-full">
                <p className="font-semibold text-ink text-sm truncate">{m.firstName} {m.lastName}</p>
                {m.rank && <p className="text-xs text-ink-muted mt-0.5 truncate">{m.rank}</p>}
                {m.functionTitle && <p className="text-xs text-ink-faint truncate">{m.functionTitle}</p>}
                <div className="mt-2">
                  <span className={`${statusBadge[m.status] || 'badge'} text-xs`}>{MEMBER_STATUS_LABELS[m.status] || m.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm text-ink-muted">
            Seite {page} von {totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">
              ← Zurück
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
