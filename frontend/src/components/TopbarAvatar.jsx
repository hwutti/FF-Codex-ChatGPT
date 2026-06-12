import { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useNavigate } from 'react-router-dom';

function getRoleLabel(role, gender) {
  const female = gender === 'female';
  switch (role) {
    case 'ADMIN':             return female ? 'Administratorin' : 'Administrator';
    case 'COMMANDER':         return female ? 'Kommandantin' : 'Kommandant';
    case 'DEPUTY_COMMANDER':  return female ? 'Stv. Kommandantin' : 'Stv. Kommandant';
    case 'SECRETARY':         return female ? 'Schriftführerin' : 'Schriftführer';
    case 'GROUP_COMMANDER':   return female ? 'Gruppenkommandantin' : 'Gruppenkommandant';
    case 'MEMBER':            return female ? 'Kameradin' : 'Kamerad';
    default:                  return role;
  }
}

function AvatarImg({ name, avatarUrl }) {
  if (avatarUrl) return <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />;
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-full h-full rounded-lg bg-gradient-to-br from-fire-700 to-fire-900 flex items-center justify-center">
      <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-headings)' }}>{initials}</span>
    </div>
  );
}

export default function TopbarAvatar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const displayName = user?.member
    ? user.member.firstName + ' ' + user.member.lastName
    : user?.email?.split('@')[0] || 'Benutzer';
  const rankLabel = user?.member?.rankShort || user?.member?.rank || '';
  const roleLabel = getRoleLabel(user?.role || '', user?.member?.gender || '');
  const label = rankLabel ? rankLabel + ': ' + roleLabel : roleLabel;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-2 h-9 rounded-xl hover:bg-surface-100 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-surface-200">
          <AvatarImg name={displayName} avatarUrl={user?.avatarUrl} />
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <p className="text-xs font-semibold text-ink leading-none">{displayName}</p>
          <p className="text-[10px] text-ink-muted mt-0.5 leading-none">{label}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-modal border border-surface-200 overflow-hidden z-50 animate-fade-in-up">
          <div className="px-4 py-3 border-b border-surface-100">
            <p className="text-xs font-semibold text-ink truncate">{displayName}</p>
            <p className="text-[11px] text-ink-muted truncate">{label}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { navigate('/mein-profil'); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-ink hover:bg-surface-50 transition-colors"
            >
              <User className="w-4 h-4 text-ink-muted" />
              Mein Profil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
