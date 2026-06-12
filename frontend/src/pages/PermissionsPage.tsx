import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Save, Users, User, ChevronDown, ChevronUp, Check, X, Loader } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const AREAS = [
  // Hauptmenü
  { key: 'dashboard',              label: 'Dashboard' },
  { key: 'incidents',              label: 'Einsätze' },
  { key: 'einsatzplaene',          label: 'Einsatzpläne' },
  { key: 'exercises',              label: 'Übungen' },
  { key: 'org_events',             label: 'Ereignisse' },
  { key: 'members',                label: 'Kamerad:innen' },
  { key: 'calendar',               label: 'Kalender Allgemein' },
  { key: 'birthdays',              label: 'Geburtstage' },
  { key: 'honors',                 label: 'Ehrungen' },
  // Dokumentation Allgemein
  { key: 'vehicles',               label: 'Fahrtenbuch' },
  { key: 'equipment',              label: 'Gerätebuch' },
  { key: 'documents_public',       label: 'Dokumente Allgemein' },
  // Verwaltung Kommando
  { key: 'calendar_command',       label: 'Kalender Kommando' },
  { key: 'kommando_termine',       label: 'Kommandotermine' },
  { key: 'documents_command',      label: 'Verwaltung Kommando' },
  { key: 'protocols',              label: 'Protokolle' },
  { key: 'reports',                label: 'Berichte' },
  { key: 'jahresbericht',          label: 'Jahresbericht' },
  { key: 'berichte_kameradschaft', label: 'Berichte Kameradschaftsführer' },
  { key: 'berichte_kassier',       label: 'Berichte Kassier' },
  { key: 'schriftverkehr',         label: 'Schriftverkehr' },
  { key: 'administration',         label: 'Administration' },
];
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];
const ACTION_LABELS: Record<string,string> = { VIEW: 'Anzeigen', CREATE: 'Erstellen', EDIT: 'Bearbeiten', DELETE: 'Löschen' };

type Perm = { area: string; action: string };
type Group = { id: string; name: string; description: string; permissions: Perm[]; members: any[] };

export default function PermissionsPage() {
  const [tab, setTab] = useState<'groups' | 'users'>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userPerms, setUserPerms] = useState<Record<string, Perm[]>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [gRes, uRes] = await Promise.all([
        api.get('/permissions/groups'),
        api.get('/users'),
      ]);
      setGroups(gRes.data);
      setUsers((uRes.data.users || uRes.data || []).filter((u: any) => u.role !== 'ADMIN'));
    } catch { toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  };

  const loadUserPerms = async (userId: string) => {
    if (userPerms[userId]) return;
    try {
      const r = await api.get(`/permissions/users/${userId}`);
      setUserPerms(prev => ({ ...prev, [userId]: r.data }));
    } catch {}
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setSaving(true);
    try {
      await api.post('/permissions/groups', { name: newGroupName, description: newGroupDesc, permissions: [] });
      toast.success('Gruppe erstellt');
      setNewGroupName(''); setNewGroupDesc(''); setShowNewGroup(false);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const saveGroup = async (group: Group) => {
    setSaving(true);
    try {
      await api.put(`/permissions/groups/${group.id}`, group);
      toast.success('Gruppe gespeichert');
      setEditingGroup(null);
      load();
    } catch { toast.error('Fehler'); }
    finally { setSaving(false); }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Gruppe löschen?')) return;
    try {
      await api.delete(`/permissions/groups/${id}`);
      toast.success('Gruppe gelöscht');
      load();
    } catch { toast.error('Fehler'); }
  };

  const addMember = async (groupId: string, userId: string) => {
    try {
      await api.post(`/permissions/groups/${groupId}/members`, { userId });
      toast.success('Mitglied hinzugefügt');
      load();
    } catch { toast.error('Fehler'); }
  };

  const removeMember = async (groupId: string, userId: string) => {
    try {
      await api.delete(`/permissions/groups/${groupId}/members/${userId}`);
      toast.success('Mitglied entfernt');
      load();
    } catch { toast.error('Fehler'); }
  };

  const togglePerm = (perms: Perm[], area: string, action: string): Perm[] => {
    const exists = perms.some(p => p.area === area && p.action === action);
    if (exists) return perms.filter(p => !(p.area === area && p.action === action));
    return [...perms, { area, action }];
  };

  const hasPerm = (perms: Perm[], area: string, action: string) =>
    perms.some(p => p.area === area && p.action === action);

  const saveUserPerms = async (userId: string) => {
    setSaving(true);
    try {
      await api.put(`/permissions/users/${userId}`, { permissions: userPerms[userId] || [] });
      toast.success('Berechtigungen gespeichert');
    } catch { toast.error('Fehler'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader className="w-8 h-8 animate-spin text-fire-700" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-fire-700" />
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Berechtigungen</h1>
          <p className="text-sm text-ink-muted">Gruppen und individuelle Berechtigungen verwalten</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-200">
        {[['groups','Gruppen'], ['users','Individuelle Rechte']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-fire-700 text-fire-700' : 'border-transparent text-ink-muted hover:text-ink'
            }`}>{l}</button>
        ))}
      </div>

      {/* ── GRUPPEN TAB ── */}
      {tab === 'groups' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewGroup(true)}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Neue Gruppe
            </button>
          </div>

          {showNewGroup && (
            <div className="card p-4 space-y-3 border-fire-200">
              <p className="font-semibold text-ink text-sm">Neue Berechtigungsgruppe</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Name *</label>
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    className="input-field" placeholder="z.B. Kassier" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Beschreibung</label>
                  <input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)}
                    className="input-field" placeholder="Kurze Beschreibung" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewGroup(false)} className="btn-secondary text-sm">Abbrechen</button>
                <button onClick={createGroup} disabled={saving || !newGroupName}
                  className="btn-primary text-sm flex items-center gap-2">
                  {saving && <Loader className="w-3.5 h-3.5 animate-spin" />}
                  Erstellen
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="card p-10 text-center text-ink-muted">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Noch keine Gruppen — erstelle die erste Gruppe</p>
            </div>
          ) : (
            groups.map(group => {
              const isEditing = editingGroup?.id === group.id;
              const current = isEditing ? editingGroup! : group;
              return (
                <div key={group.id} className="card overflow-hidden">
                  {/* Group Header */}
                  <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
                    {/* Zeile 1: Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-fire-50 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-fire-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink text-sm">{group.name}</p>
                        {group.description && <p className="text-xs text-ink-muted">{group.description}</p>}
                      </div>
                      <span className="text-xs text-ink-muted bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        {group.members.length} Mitglied{group.members.length !== 1 ? 'er' : ''}
                      </span>
                    </div>
                    {/* Zeile 2: Buttons */}
                    <div className="flex gap-2 justify-end">
                      {isEditing ? (
                        <>
                          <button onClick={() => setEditingGroup(null)} className="btn-secondary text-xs py-1 px-2">Abbrechen</button>
                          <button onClick={() => saveGroup(editingGroup!)} disabled={saving}
                            className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                            {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Speichern
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingGroup({ ...group, permissions: group.permissions || [] })}
                            className="btn-secondary text-xs py-1.5 px-3">Bearbeiten</button>
                          <button onClick={() => deleteGroup(group.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Permissions Matrix */}
                  {isEditing && (
                    <div className="p-4">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Berechtigungen</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              <th className="text-left py-1.5 pr-4 text-ink-muted font-medium">Bereich</th>
                              {ACTIONS.map(a => <th key={a} className="text-center py-1.5 px-2 text-ink-muted font-medium w-20">{ACTION_LABELS[a]}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {AREAS.map((area, i) => (
                              <tr key={area.key} className={i % 2 === 0 ? 'bg-surface-50' : ''}>
                                <td className="py-1.5 pr-4 text-ink font-medium">{area.label}</td>
                                {ACTIONS.map(action => (
                                  <td key={action} className="text-center py-1.5 px-2">
                                    <button
                                      onClick={() => setEditingGroup(prev => prev ? {
                                        ...prev,
                                        permissions: togglePerm(prev.permissions || [], area.key, action)
                                      } : null)}
                                      className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                                        hasPerm(editingGroup?.permissions || [], area.key, action)
                                          ? 'bg-emerald-500 text-white'
                                          : 'bg-surface-200 text-transparent hover:bg-surface-300'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Members */}
                      <div className="mt-4 pt-4 border-t border-surface-200">
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Mitglieder in dieser Gruppe</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {group.members.map(m => (
                            <span key={m.userId} className="flex items-center gap-1.5 text-xs bg-surface-100 border border-surface-200 px-2 py-1 rounded-lg">
                              {m.user?.member ? `${m.user.member.firstName} ${m.user.member.lastName}` : m.user?.email}
                              <button onClick={() => removeMember(group.id, m.userId)} className="text-red-400 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          {group.members.length === 0 && <p className="text-xs text-ink-muted">Noch keine Mitglieder</p>}
                        </div>
                        <select onChange={e => { if (e.target.value) addMember(group.id, e.target.value); e.target.value = ''; }}
                          className="input-field text-sm w-auto">
                          <option value="">+ Benutzer hinzufügen...</option>
                          {users.filter(u => !group.members.some(m => m.userId === u.id)).map(u => (
                            <option key={u.id} value={u.id}>
                              {u.member ? `${u.member.firstName} ${u.member.lastName}` : u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── INDIVIDUELLE RECHTE TAB ── */}
      {tab === 'users' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Individuelle Berechtigungen überschreiben Gruppen-Rechte. ADMIN hat immer alle Rechte.</p>
          {users.map(u => {
            const name = u.member ? `${u.member.firstName} ${u.member.lastName}` : u.email;
            const isExpanded = expandedUser === u.id;
            const perms = userPerms[u.id] || [];
            return (
              <div key={u.id} className="card overflow-hidden">
                <button
                  onClick={async () => {
                    if (!isExpanded) { await loadUserPerms(u.id); }
                    setExpandedUser(isExpanded ? null : u.id);
                  }}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-ink text-sm">{name}</p>
                      <p className="text-xs text-ink-muted">{u.email} · {u.role}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-muted" /> : <ChevronDown className="w-4 h-4 text-ink-muted" />}
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-surface-200">
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="text-left py-1.5 pr-4 text-ink-muted font-medium">Bereich</th>
                            {ACTIONS.map(a => <th key={a} className="text-center py-1.5 px-2 text-ink-muted font-medium w-20">{ACTION_LABELS[a]}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {AREAS.map((area, i) => (
                            <tr key={area.key} className={i % 2 === 0 ? 'bg-surface-50' : ''}>
                              <td className="py-1.5 pr-4 text-ink font-medium">{area.label}</td>
                              {ACTIONS.map(action => (
                                <td key={action} className="text-center py-1.5 px-2">
                                  <button
                                    onClick={() => setUserPerms(prev => ({
                                      ...prev,
                                      [u.id]: togglePerm(prev[u.id] || [], area.key, action)
                                    }))}
                                    className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                                      hasPerm(perms, area.key, action)
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-surface-200 text-transparent hover:bg-surface-300'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={() => saveUserPerms(u.id)} disabled={saving}
                      className="btn-primary text-sm flex items-center gap-2">
                      {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Berechtigungen speichern
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
