import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Bell, User, Settings, LogOut
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api';
import { usePermission } from '../utils/PermissionContext';
import { useBranding } from '../utils/BrandingContext';
import { useEinsatzplaeneCacheStatus } from '../utils/EinsatzplaeneCacheContext';
import { navItems, docsAllgemein, docsKommando } from '../config/navConfig';


function UserAvatar({ name, avatarUrl }) {
  if (avatarUrl) return <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />;
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fire-700 to-fire-900 flex items-center justify-center shadow-inner">
      <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-headings)' }}>{initials}</span>
    </div>
  );
}

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


// ── Sidebar ─────────────────────────────────────────────────────────────────
export default function SidebarNav({ onClose }) {
  const { user, logout } = useAuth();
  const epCache = useEinsatzplaeneCacheStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const [buildInfo, setBuildInfo] = useState(null);

  useEffect(() => {
    const loadUnread = () => {
      api.get('/push/inbox/unread-count').then(r => setUnreadCount(r.data.count || 0)).catch(() => {});
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    api.get('/update/version').then(r => setBuildInfo(r.data)).catch(() => {});
    return () => clearInterval(interval);
  }, []);

  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});
  const toggleGroup = (key) => setOpenGroups(g => ({ ...g, [key]: !g[key] }));
  const handleLogout = () => { logout(); navigate('/login'); };

  const displayName = user?.member
    ? user.member.firstName + ' ' + user.member.lastName
    : user?.email?.split('@')[0] || 'Benutzer';

  const navLinkClass = (isActive) =>
    'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ' + (
      isActive
        ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
        : 'text-fire-200 hover:bg-white/8 hover:text-white'
    );

  const subNavLinkClass = (isActive) =>
    'group flex items-center gap-3 pl-8 pr-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 relative ' + (
      isActive
        ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
        : 'text-fire-200 hover:bg-white/8 hover:text-white'
    );

  const isGroupActive = (items) => items.some(i => location.pathname.startsWith(i.to));
  const { can } = usePermission();

  const renderNavGroup = (key, label, items) => {
    const visibleItems = items.filter(item => !item.permArea || can(item.permArea, 'VIEW'));
    if (visibleItems.length === 0) return null;
    const isOpen = openGroups[key] ?? false;
    const isActive = isGroupActive(visibleItems);
    return (
      <div key={key}>
        <button
          onClick={() => toggleGroup(key)}
          className={'w-full group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ' + (
            isActive ? 'bg-white/8 text-white' : 'text-fire-200 hover:bg-white/8 hover:text-white'
          )}
        >
          <Folder className="flex-shrink-0" style={{ width: '18px', height: '18px', color: '#FFB900', fill: '#FFB900' }} />
          <span style={{ fontFamily: 'var(--font-sidebar)' }} className="flex-1 text-left">{label}</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-white/30" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
        </button>
        {isOpen && (
          <div className="mt-0.5 space-y-0.5">
            {visibleItems.map(item => (
              <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => subNavLinkClass(isActive)}>
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: branding.primaryColor || '#a82828' }} />}
                    {isActive
                      ? <FolderOpen style={{ width: '16px', height: '16px', color: '#FFB900', fill: 'none', stroke: '#FFB900', strokeWidth: 2.5, flexShrink: 0 }} />
                      : <Folder    style={{ width: '16px', height: '16px', color: '#FFB900', fill: '#FFB900', flexShrink: 0 }} />
                    }
                    <span style={{ fontFamily: 'var(--font-sidebar)' }}>{item.label}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/30" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3.5">
          <div className="relative flex-shrink-0">
            <img src={branding.logoUrl || '/logo.png'} alt={branding.name} className="w-[72px] h-[72px] object-contain drop-shadow-md" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight tracking-tight" style={{ fontFamily: 'var(--font-headings)' }}>{branding.name}</p>
            <p className="text-[11px] font-medium tracking-widest uppercase mt-0.5" style={{ color: (branding.primaryColor || '#a82828') + 'cc' }}>{branding.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => !item.permArea || can(item.permArea, 'VIEW')).map(item => (
          <NavLink
            key={item.to} to={item.to} end={item.end} onClick={onClose}
            className={({ isActive }) =>
              'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ' + (
                isActive
                  ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-fire-200 hover:bg-white/8 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: branding.primaryColor || '#a82828' }} />}
                <item.icon
                  className={'w-4.5 h-4.5 flex-shrink-0 transition-colors ' + (isActive ? '' : 'text-fire-400 group-hover:text-fire-200')}
                  style={{ width: '18px', height: '18px', color: item.folderColor || (isActive ? (branding.primaryColor || '#a82828') : undefined), fill: item.folderColor || undefined }}
                />
                <span style={{ fontFamily: 'var(--font-sidebar)' }}>{item.label}</span>
                {item.to === '/einsatzplaene' && epCache.status === 'caching' && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {epCache.cached}/{epCache.total}
                  </span>
                )}
                {item.to === '/einsatzplaene' && epCache.status === 'done' && !isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" title="Offline verfügbar" />
                )}
                {isActive && epCache.status !== 'caching' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/30" />}
                {isActive && epCache.status === 'caching' && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {epCache.cached}/{epCache.total}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
        {renderNavGroup('docs-allgemein', 'Dokumentation Allgemein', docsAllgemein)}
        {renderNavGroup('docs-kommando', 'Verwaltung Kommando', docsKommando)}
      </nav>

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-4 mb-4" />

      {/* User section */}
      <div className="px-3 pb-5 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-sidebar)' }}>{displayName}</p>
            <p className="text-fire-400 text-[11px] truncate">{getRoleLabel(user?.role || '', user?.member?.gender || '')}</p>
          </div>
          <button
            onClick={() => { navigate('/inbox'); setUnreadCount(0); onClose?.(); }}
            className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
          >
            <Bell className="w-4 h-4 text-fire-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {(user?.role === 'ADMIN' || can('administration', 'VIEW')) && (
          <button onClick={() => { navigate('/settings'); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3.5 py-2 text-fire-300 hover:text-white hover:bg-white/8 rounded-xl text-sm transition-all duration-150 group">
            <Settings className="w-4 h-4 flex-shrink-0 text-fire-500 group-hover:text-fire-300 transition-colors" />
            <span style={{ fontFamily: 'var(--font-sidebar)' }}>Administration</span>
          </button>
        )}
        {user?.role === 'ADMIN' && (
          <button onClick={() => { navigate('/notifications'); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3.5 py-2 text-fire-300 hover:text-white hover:bg-white/8 rounded-xl text-sm transition-all duration-150 group">
            <Bell className="w-4 h-4 flex-shrink-0 text-fire-500 group-hover:text-fire-300 transition-colors" />
            <span style={{ fontFamily: 'var(--font-sidebar)' }}>Push-Verwaltung</span>
          </button>
        )}
        <button onClick={() => { navigate('/mein-profil'); onClose?.(); }}
          className="flex items-center gap-3 w-full px-3.5 py-2 text-fire-300 hover:text-white hover:bg-white/8 rounded-xl text-sm transition-all duration-150 group">
          <User className="w-4 h-4 flex-shrink-0 text-fire-500 group-hover:text-fire-300 transition-colors" />
          <span style={{ fontFamily: 'var(--font-sidebar)' }}>Mein Profil</span>
        </button>
        <button onClick={() => { navigate('/inbox'); setUnreadCount(0); onClose?.(); }}
          className="flex items-center gap-3 w-full px-3.5 py-2 text-fire-300 hover:text-white hover:bg-white/8 rounded-xl text-sm transition-all duration-150 group">
          <div className="relative flex-shrink-0">
            <Bell className="w-4 h-4 text-fire-500 group-hover:text-fire-300 transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-sidebar)' }}>
            Benachrichtigungen{unreadCount > 0 ? ' (' + unreadCount + ')' : ''}
          </span>
        </button>
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3.5 py-2 text-fire-300 hover:text-red-300 hover:bg-red-500/10 rounded-xl text-sm transition-all duration-150 group mt-1">
          <LogOut className="w-4 h-4 flex-shrink-0 text-fire-500 group-hover:text-red-400 transition-colors" />
          <span style={{ fontFamily: 'var(--font-sidebar)' }}>Abmelden</span>
        </button>
      </div>

      {buildInfo && (
        <div className="px-5 py-3 border-t border-white/5">
          <p className="text-[13px] text-white/25 leading-tight mb-0.5" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}>
            Software Version
          </p>
          <p className="text-[10px] font-mono text-white/20 leading-tight">
            {buildInfo.currentCommit}
            {buildInfo.currentDate && buildInfo.currentDate !== 'unknown' && (
              <> · {new Date(buildInfo.currentDate).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ── AppLayout ────────────────────────────────────────────────────────────────
