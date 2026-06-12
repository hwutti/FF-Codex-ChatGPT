import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import PwaInstallButton from '../components/PwaInstallButton';
import {
  LayoutDashboard, Users, Calendar, CalendarDays, Flame, Cake, Award, FileText, BookOpen, FolderOpen, Folder, Car, Wrench,
  Menu, X, LogOut, Settings, ChevronRight, ChevronDown, Shield, Bell, User, Mail, Download
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useEffect, useState, useRef } from 'react';
import api from '../api';
import { usePermission } from '../utils/PermissionContext';
import { useBranding } from '../utils/BrandingContext';
import UpdateBanner from '../components/UpdateBanner';
import { useEinsatzplaeneCacheStatus } from '../utils/EinsatzplaeneCacheContext';
import TopbarAvatar from '../components/TopbarAvatar';
import SidebarNav from '../components/SidebarNav';

const navItems = [
  { to: '/',                 icon: LayoutDashboard, label: 'Dashboard',           end: true, permArea: 'dashboard'        },
  { to: '/incidents',        icon: Flame,           label: 'Einsätze',                       permArea: 'incidents'        },
  { to: '/einsatzplaene',    icon: Folder,          label: 'Einsatzpläne',                   permArea: 'einsatzplaene',   folderColor: '#008B45' },
  { to: '/exercises',        icon: Calendar,        label: 'Übungen',                        permArea: 'events'           },
  { to: '/org-events',       icon: CalendarDays,    label: 'Ereignisse',                     permArea: 'events'           },
  { to: '/members',          icon: Users,           label: 'Kamerad:innen',                  permArea: 'members'          },
  { to: '/calendar',         icon: CalendarDays,    label: 'Kalender Allgemein',  end: true, permArea: 'calendar'         },
  { to: '/birthdays',        icon: Cake,            label: 'Geburtstage',                    permArea: 'birthdays'        },
  { to: '/honors',           icon: Award,           label: 'Ehrungen',                       permArea: 'honors'           },
];

const docsAllgemein = [
  { to: '/vehicles',          icon: Car,      label: 'Fahrtenbuch',          permArea: 'vehicles'          },
  { to: '/equipment',         icon: Wrench,   label: 'Gerätebuch',           permArea: 'equipment'         },
  { to: '/documents-public',  icon: FileText, label: 'Dokumente Allgemein',  permArea: 'documents_public'  },
];

const docsKommando = [
  { to: '/calendar-command',               icon: CalendarDays, label: 'Kalender Kommando',              permArea: 'calendar_command'       },
  { to: '/kommando-termine',               icon: Shield,       label: 'Kommandotermine',                permArea: 'calendar_command'       },
  { to: '/documents',                      icon: FileText,     label: 'Dokumente Kommando',             permArea: 'documents_command'      },
  { to: '/protocols',                      icon: BookOpen,     label: 'Protokolle',                     permArea: 'protocols'              },
  { to: '/reports',                        icon: FileText,     label: 'Berichte',                       permArea: 'reports'                },
  { to: '/jahresbericht',                  icon: BookOpen,     label: 'Jahresbericht',                  permArea: 'reports'                },
  { to: '/berichte/kameradschaftsfuehrer', icon: FileText,     label: 'Berichte Kameradschaftsführer',  permArea: 'berichte_kameradschaft' },
  { to: '/berichte/kassier',               icon: FileText,     label: 'Berichte Kassier',               permArea: 'berichte_kassier'       },
  { to: '/schriftverkehr',                 icon: Mail,         label: 'Schriftverkehr',                 permArea: 'schriftverkehr'         },
];

function UserAvatar({ name, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />;
  }
  const initials = (name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-full h-full rounded-xl bg-gradient-to-br from-fire-700 to-fire-900 flex items-center justify-center shadow-inner">
      <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-headings)' }}>{initials}</span>
    </div>
  );
}

function darkenHex(hex, factor) {
  const h = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(h.slice(0,2), 16) * factor));
  const g = Math.max(0, Math.round(parseInt(h.slice(2,4), 16) * factor));
  const b = Math.max(0, Math.round(parseInt(h.slice(4,6), 16) * factor));
  return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
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



export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { branding } = useBranding();

  const currentNav = navItems.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to));
  const pageTitle = currentNav?.label || '';

  const sidebarBg = 'linear-gradient(180deg, ' + darkenHex(branding.primaryColor || '#a82828', 0.55) + ' 0%, ' + darkenHex(branding.primaryColor || '#a82828', 0.35) + ' 60%, ' + darkenHex(branding.primaryColor || '#a82828', 0.25) + ' 100%)';

  return (
    <div className="flex h-screen bg-surface overflow-hidden w-screen max-w-full">
      <UpdateBanner />

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          background: sidebarBg,
          width: sidebarCollapsed ? '0px' : '240px',
          minWidth: sidebarCollapsed ? '0px' : '240px',
          opacity: sidebarCollapsed ? 0 : 1,
          transition: 'width 0.5s cubic-bezier(0.65,0,0.35,1), min-width 0.5s cubic-bezier(0.65,0,0.35,1), opacity 0.4s ease',
        }}
      >
        <SidebarNav />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col z-10 shadow-modal" style={{ background: sidebarBg }}>
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10">
              <X className="w-4 h-4" />
            </button>
            <SidebarNav onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-surface-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-[0_1px_3px_rgba(26,22,20,0.06)]">
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-100 rounded-xl transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <img src={branding.logoUrl || '/logo.png'} alt={branding.name} className="w-8 h-8 object-contain flex-shrink-0" />
            <span className="font-bold text-ink text-sm truncate" style={{ fontFamily: 'var(--font-headings)' }}>
              {branding.name}
            </span>
          </div>
          {/* Mobile: Install + Avatar */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <PwaInstallButton compact />
            <TopbarAvatar />
          </div>
        </header>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center px-6 py-4 bg-white border-b border-surface-200 flex-shrink-0 gap-3">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Seitenleiste einblenden' : 'Seitenleiste ausblenden'}
            className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-100 rounded-xl transition-all duration-200 flex-shrink-0 group"
          >
            <span className="flex flex-col gap-[5px] transition-all duration-300" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <span className="block h-0.5 w-4 bg-current rounded transition-all duration-300" />
              <span className="block h-0.5 w-3 bg-current rounded transition-all duration-300" />
              <span className="block h-0.5 w-4 bg-current rounded transition-all duration-300" />
            </span>
          </button>
          <div className="w-px h-5 bg-surface-200 flex-shrink-0" />
          <h1 className="text-xl font-bold text-ink flex-1" style={{ fontFamily: 'var(--font-headings)' }}>
            {pageTitle}
          </h1>
          {/* Desktop: Install + Avatar */}
          <div className="flex items-center gap-2">
            <PwaInstallButton />
            <div className="w-px h-5 bg-surface-200" />
            <TopbarAvatar />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 animate-fade-in-up w-full min-w-0 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
