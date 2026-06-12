import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

interface PermissionContextType {
  can: (area: string, action?: string) => boolean;
  loading: boolean;
  refresh: () => void;
}

const PermissionContext = createContext<PermissionContextType>({
  can: () => false,
  loading: true,
  refresh: () => {},
});

// WICHTIG: Muss synchron mit ROLE_BASE_PERMISSIONS in permissions.routes.ts gehalten werden
// Jeder Sidebar-Eintrag hat genau einen permArea-Key — 1:1 Mapping
const ROLE_BASE: Record<string, Record<string, string[]>> = {
  ADMIN: {}, // ADMIN hat immer alles — wird in can() direkt behandelt

  COMMANDER: {
    dashboard:              ['VIEW'],
    incidents:              ['VIEW','CREATE','EDIT','DELETE'],
    einsatzplaene:          ['VIEW','CREATE','EDIT','DELETE'],
    exercises:              ['VIEW','CREATE','EDIT','DELETE'],
    org_events:             ['VIEW','CREATE','EDIT','DELETE'],
    members:                ['VIEW','CREATE','EDIT','DELETE'],
    calendar:               ['VIEW','CREATE','EDIT','DELETE'],
    birthdays:              ['VIEW'],
    honors:                 ['VIEW','CREATE','EDIT','DELETE'],
    // Dokumentation Allgemein
    vehicles:               ['VIEW','CREATE','EDIT','DELETE'],
    equipment:              ['VIEW','CREATE','EDIT','DELETE'],
    documents_public:       ['VIEW','CREATE','EDIT','DELETE'],
    // Verwaltung Kommando
    calendar_command:       ['VIEW','CREATE','EDIT','DELETE'],
    kommando_termine:       ['VIEW','CREATE','EDIT','DELETE'],
    documents_command:      ['VIEW','CREATE','EDIT','DELETE'],
    protocols:              ['VIEW','CREATE','EDIT','DELETE'],
    reports:                ['VIEW','CREATE','EDIT','DELETE'],
    jahresbericht:          ['VIEW','CREATE','EDIT','DELETE'],
    berichte_kameradschaft: ['VIEW','CREATE','EDIT','DELETE'],
    berichte_kassier:       ['VIEW','CREATE','EDIT','DELETE'],
    schriftverkehr:         ['VIEW','CREATE','EDIT','DELETE'],
    administration:         ['VIEW'],
  },

  DEPUTY_COMMANDER: {
    dashboard:              ['VIEW'],
    incidents:              ['VIEW','CREATE','EDIT','DELETE'],
    einsatzplaene:          ['VIEW','CREATE','EDIT','DELETE'],
    exercises:              ['VIEW','CREATE','EDIT','DELETE'],
    org_events:             ['VIEW','CREATE','EDIT','DELETE'],
    members:                ['VIEW','CREATE','EDIT','DELETE'],
    calendar:               ['VIEW','CREATE','EDIT','DELETE'],
    birthdays:              ['VIEW'],
    honors:                 ['VIEW','CREATE','EDIT','DELETE'],
    vehicles:               ['VIEW','CREATE','EDIT','DELETE'],
    equipment:              ['VIEW','CREATE','EDIT','DELETE'],
    documents_public:       ['VIEW','CREATE','EDIT','DELETE'],
    calendar_command:       ['VIEW','CREATE','EDIT','DELETE'],
    kommando_termine:       ['VIEW','CREATE','EDIT','DELETE'],
    documents_command:      ['VIEW','CREATE','EDIT','DELETE'],
    protocols:              ['VIEW','CREATE','EDIT','DELETE'],
    reports:                ['VIEW','CREATE'],
    jahresbericht:          ['VIEW','CREATE'],
    berichte_kameradschaft: ['VIEW','CREATE'],
    berichte_kassier:       ['VIEW'],
    schriftverkehr:         ['VIEW','CREATE','EDIT','DELETE'],
    administration:         ['VIEW'],
  },

  SECRETARY: {
    dashboard:              ['VIEW'],
    incidents:              ['VIEW','CREATE','EDIT'],
    einsatzplaene:          ['VIEW','CREATE','EDIT','DELETE'],
    exercises:              ['VIEW','CREATE','EDIT'],
    org_events:             ['VIEW','CREATE','EDIT'],
    members:                ['VIEW','CREATE','EDIT'],
    calendar:               ['VIEW','CREATE'],
    birthdays:              ['VIEW'],
    honors:                 ['VIEW','CREATE','EDIT'],
    vehicles:               ['VIEW','CREATE','EDIT'],
    equipment:              ['VIEW','CREATE','EDIT'],
    documents_public:       ['VIEW','CREATE'],
    calendar_command:       ['VIEW','CREATE'],
    kommando_termine:       ['VIEW','CREATE'],
    documents_command:      ['VIEW','CREATE'],
    protocols:              ['VIEW','CREATE','EDIT','DELETE'],
    reports:                ['VIEW'],
    jahresbericht:          ['VIEW'],
    berichte_kameradschaft: ['VIEW'],
    berichte_kassier:       ['VIEW'],
    schriftverkehr:         ['VIEW','CREATE','EDIT'],
  },

  GROUP_COMMANDER: {
    dashboard:    ['VIEW'],
    einsatzplaene:['VIEW'],
    exercises:    ['VIEW','CREATE','EDIT'],
    org_events:   ['VIEW','CREATE','EDIT'],
    members:      ['VIEW'],
    calendar:     ['VIEW'],
    birthdays:    ['VIEW'],
  },

  MEMBER: {
    dashboard:    ['VIEW'],
    einsatzplaene:['VIEW'],
    exercises:    ['VIEW'],
    org_events:   ['VIEW'],
    members:      ['VIEW'],
    calendar:     ['VIEW'],
    birthdays:    ['VIEW'],
  },
};

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [directPerms, setDirectPerms] = useState<{area:string;action:string}[]>([]);
  const [groupPerms, setGroupPerms] = useState<{area:string;action:string}[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPerms = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    if (user.role === 'ADMIN') { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/permissions/me');
      setDirectPerms(res.data.direct || []);
      setGroupPerms(res.data.groupPerms || []);
    } catch {
      setDirectPerms([]);
      setGroupPerms([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => { loadPerms(); }, [loadPerms]);

  const can = useCallback((area: string, action: string = 'VIEW'): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (loading) return false;
    if (directPerms.some(p => p.area === area && p.action === action)) return true;
    if (groupPerms.some(p => p.area === area && p.action === action)) return true;
    const roleBase = ROLE_BASE[user.role] || {};
    return (roleBase[area] || []).includes(action);
  }, [user, loading, directPerms, groupPerms]);

  return (
    <PermissionContext.Provider value={{ can, loading, refresh: loadPerms }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  return useContext(PermissionContext);
}

export function RequirePermission({
  area, action = 'VIEW', children, fallback
}: {
  area: string;
  action?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, loading } = usePermission();
  if (loading) return null;
  if (!can(area, action)) {
    return fallback ? <>{fallback}</> : (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="text-5xl">🔒</div>
        <p className="text-lg font-semibold text-ink">Kein Zugriff</p>
        <p className="text-sm text-ink-muted">Du hast keine Berechtigung für diesen Bereich.</p>
      </div>
    );
  }
  return <>{children}</>;
}
