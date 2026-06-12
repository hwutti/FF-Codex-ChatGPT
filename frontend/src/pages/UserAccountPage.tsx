import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Trash2, Eye, EyeOff, Save, ShieldCheck, AlertTriangle, Link2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../utils/AuthContext';
import api, { userApi, memberApi } from '../api';

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Bestätigen', danger = false, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm overflow-hidden">
        <div className={`px-6 py-5 flex items-start gap-4 ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className="font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{title}</p>
            <p className="text-sm text-ink-muted mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4">
          <button onClick={onCancel} className="btn-secondary flex-1">Abbrechen</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [modal, setModal] = useState<{ title: string; message: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((title: string, message: string, options?: { confirmLabel?: string; danger?: boolean }): Promise<boolean> => {
    return new Promise(resolve => setModal({ title, message, ...options, resolve }));
  }, []);

  const element = modal ? (
    <ConfirmModal
      title={modal.title} message={modal.message}
      confirmLabel={modal.confirmLabel} danger={modal.danger}
      onConfirm={() => { modal.resolve(true); setModal(null); }}
      onCancel={() => { modal.resolve(false); setModal(null); }}
    />
  ) : null;

  return { confirm, element };
}

const ROLES = [
  { value: 'ADMIN',            labelM: 'Administrator',       labelF: 'Administratorin' },
  { value: 'COMMANDER',        labelM: 'Kommandant',          labelF: 'Kommandantin' },
  { value: 'DEPUTY_COMMANDER', labelM: 'Stellvertreter',      labelF: 'Stellvertreterin' },
  { value: 'SECRETARY',        labelM: 'Schriftführer',       labelF: 'Schriftführerin' },
  { value: 'GROUP_COMMANDER',  labelM: 'Gruppenkommandant',   labelF: 'Gruppenkommandantin' },
  { value: 'MEMBER',           labelM: 'Mitglied',            labelF: 'Mitglied' },
];

function AvatarCircle({ url, name, size = 80 }: { url?: string; name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className="rounded-2xl object-cover" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-2xl bg-fire-100 flex items-center justify-center text-fire-700 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.3 }}>
      {initials}
    </div>
  );
}

function TrustedDevices({ userId }: { userId: string }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, element: confirmElement } = useConfirm();

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    api.get(`/auth/trusted-devices/${userId}`)
      .then(r => setDevices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const revoke = async (id: string) => {
    await api.delete(`/auth/trusted-devices/${id}`);
    setDevices(d => d.filter(x => x.id !== id));
    toast.success('Gerät widerrufen');
  };

  const revokeAll = async () => {
    const ok = await confirm('Alle Geräte widerrufen?', 'Dieser User muss sich beim nächsten Login wieder mit 2FA-Code anmelden.', { confirmLabel: 'Alle widerrufen', danger: true });
    if (!ok) return;
    await api.delete('/auth/trusted-devices', { data: { userId } });
    setDevices([]);
    toast.success('Alle Geräte widerrufen');
  };

  return (
    <>
      {confirmElement}
      <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Vertraute Geräte</h2>
        {devices.length > 0 && (
          <button onClick={revokeAll} className="text-sm text-red-600 hover:text-red-700 font-medium">Alle widerrufen</button>
        )}
      </div>
      {loading && <p className="text-sm text-ink-muted">Lädt...</p>}
      {!loading && devices.length === 0 && (
        <p className="text-sm text-ink-muted">Keine vertrauten Geräte — dieser User muss bei jedem Login den 2FA-Code eingeben.</p>
      )}
      {devices.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-4 p-3 bg-surface-50 rounded-xl border border-surface-100">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink text-sm">{d.deviceName || 'Unbekanntes Gerät'}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              Angemeldet: {new Date(d.createdAt).toLocaleString('de-AT')} · IP: {d.ipAddress || '—'} · Bis: {new Date(d.expiresAt).toLocaleDateString('de-AT')}
            </p>
          </div>
          <button onClick={() => revoke(d.id)} className="text-sm text-red-500 hover:text-red-700 font-medium flex-shrink-0">
            Widerrufen
          </button>
        </div>
      ))}
    </div>
    </>
  );
}

export default function UserAccountPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [member, setMember] = useState<any>(null);
  const [existingUser, setExistingUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [disabling2fa, setDisabling2fa] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'MEMBER', isActive: true });
  const { confirm, element: confirmElement } = useConfirm();

  useEffect(() => {
    if (!memberId) return;
    Promise.all([
      memberApi.get(memberId),
      api.get('/users').then(r => r.data),
    ]).then(([m, users]) => {
      setMember(m);
      const u = users.find((u: any) => u.memberId === memberId);
      if (u) {
        setExistingUser(u);
        setAvatarUrl(u.avatarUrl || '');
        setForm({ email: u.email, password: '', role: u.role, isActive: u.isActive });
      }
    }).catch(() => toast.error('Fehler beim Laden'))
    .finally(() => setLoading(false));
  }, [memberId]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (existingUser) {
      setUploading(true);
      try {
        const res = await userApi.uploadAvatar(file, existingUser.id);
        setAvatarUrl(res.avatarUrl);
        toast.success('Profilbild aktualisiert');
      } catch { toast.error('Fehler beim Upload'); }
      finally { setUploading(false); }
    } else {
      setPendingFile(file);
      setPendingPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarRemove = async () => {
    if (existingUser) {
      try { await userApi.deleteAvatar(existingUser.id); setAvatarUrl(''); toast.success('Entfernt'); }
      catch { toast.error('Fehler'); }
    } else { setPendingFile(null); setPendingPreview(''); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingUser && !form.password) { toast.error('Passwort erforderlich'); return; }
    setSaving(true);
    try {
      let userId = existingUser?.id;
      if (existingUser) {
        const payload: any = { email: form.email, role: form.role, isActive: form.isActive, memberId };
        if (form.password) payload.password = form.password;
        await userApi.update(existingUser.id, payload);
        toast.success('Account aktualisiert');
      } else {
        const created = await userApi.create({ email: form.email, password: form.password, role: form.role, isActive: form.isActive, memberId });
        userId = created.id;
        toast.success('Account erstellt');
      }
      if (pendingFile && userId) {
        try { await userApi.uploadAvatar(pendingFile, userId); } catch { toast.error('Bild konnte nicht hochgeladen werden'); }
      }
      navigate('/settings?section=members');
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!existingUser || existingUser.id === currentUser?.id) return;
    const ok = await confirm('Account löschen?', `Der Login-Account von ${member?.firstName} ${member?.lastName} wird unwiderruflich gelöscht.`, { confirmLabel: 'Account löschen', danger: true });
    if (!ok) return;
    try { await userApi.delete(existingUser.id); toast.success('Account gelöscht'); navigate('/settings?section=members'); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
  };

  const handleDisable2fa = async () => {
    if (!existingUser) return;
    const ok = await confirm('2FA deaktivieren?', 'Der User kann sich danach ohne zweiten Faktor anmelden. Alle vertrauten Geräte werden ebenfalls widerrufen.', { confirmLabel: '2FA deaktivieren', danger: true });
    if (!ok) return;
    setDisabling2fa(true);
    try {
      await userApi.disable2faForUser(existingUser.id);
      setExistingUser((u: any) => ({ ...u, twoFactorEnabled: false }));
      toast.success('2FA deaktiviert');
    } catch { toast.error('Fehler'); }
    finally { setDisabling2fa(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!member) return (
    <div className="p-6">
      <p className="text-ink-muted">Mitglied nicht gefunden.</p>
      <button onClick={() => navigate('/settings?section=members')} className="btn-primary mt-4">Zurück</button>
    </div>
  );

  const displaySrc = existingUser ? avatarUrl : pendingPreview;
  const fullName = `${member.firstName} ${member.lastName}`;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {confirmElement}
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/settings?section=members')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>
            {existingUser ? 'Account bearbeiten' : 'Login-Account anlegen'}
          </h1>
          <p className="text-sm text-ink-muted">{fullName} · {member.rank || 'Kein Dienstgrad'}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Profilbild */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink">Profilbild</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <AvatarCircle url={displaySrc} name={fullName} size={72} />
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />{uploading ? 'Lädt...' : 'Bild hochladen'}
              </button>
              {(avatarUrl || pendingPreview) && (
                <button type="button" onClick={handleAvatarRemove}
                  className="btn-secondary text-sm px-4 py-2 flex items-center gap-2 !text-red-600 hover:!bg-red-50">
                  <Trash2 className="w-4 h-4" /> Entfernen
                </button>
              )}
            </div>
            {!existingUser && pendingFile && <p className="text-xs text-emerald-600 w-full">✓ Wird beim Speichern hochgeladen</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Account-Formular */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold text-ink">Account-Daten</h2>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">E-Mail *</label>
            <input type="email" className="input-field" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder={`${member.firstName.toLowerCase()}.${member.lastName.toLowerCase()}@feuerwehr.at`} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              {existingUser ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}
            </label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input-field pr-10"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={existingUser ? 'Leer lassen für keine Änderung' : 'Mindestens 8 Zeichen'}
                required={!existingUser} minLength={existingUser ? 0 : 8} />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Rolle *</label>
            <select className="input-field" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{member.gender === 'female' ? r.labelF : r.labelM}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200 cursor-pointer hover:bg-surface-100 transition-colors">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-fire-700" />
            <div>
              <p className="text-sm font-medium text-ink">Zugang aktiv</p>
              <p className="text-xs text-ink-muted">Inaktive Benutzer können sich nicht anmelden</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            {existingUser && existingUser.id !== currentUser?.id && (
              <button type="button" onClick={handleDelete} className="btn-danger p-2.5" title="Account löschen">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => navigate('/settings?section=members')} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
            </button>
          </div>
        </form>

        {/* 2FA */}
        {existingUser && existingUser.id !== currentUser?.id && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-ink">Zwei-Faktor-Auth</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${existingUser.twoFactorEnabled ? 'bg-emerald-100' : 'bg-surface-200'}`}>
                  <ShieldCheck className={`w-5 h-5 ${existingUser.twoFactorEnabled ? 'text-emerald-600' : 'text-ink-faint'}`} />
                </div>
                <div>
                  <p className="font-medium text-ink text-sm">2FA ist {existingUser.twoFactorEnabled ? 'aktiviert ✓' : 'nicht aktiv'}</p>
                  <p className="text-xs text-ink-muted">{existingUser.twoFactorEnabled ? 'Admin kann 2FA deaktivieren' : 'Benutzer aktiviert 2FA selbst'}</p>
                </div>
              </div>
              {existingUser.twoFactorEnabled && (
                <button onClick={handleDisable2fa} disabled={disabling2fa} className="btn-danger text-sm px-4 py-2">
                  {disabling2fa ? '...' : 'Deaktivieren'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Vertraute Geräte */}
        {existingUser && <TrustedDevices userId={existingUser.id} />}

        {/* Admin Reset-Link */}
        {existingUser && <AdminResetLink userId={existingUser.id} userEmail={existingUser.email} />}
      </div>
    </div>
  );
}

// ── Admin Reset-Link Generator ────────────────────────────────────────────────
function AdminResetLink({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [generating, setGenerating] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/auth/admin-generate-reset-link', { userId });
      setResetUrl(res.data.resetUrl);
      setExpiresAt(res.data.expiresAt);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler beim Generieren');
    } finally { setGenerating(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    toast.success('Link kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Link2 className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="font-semibold text-ink text-sm">Passwort-Reset-Link generieren</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {userEmail ? `Gültig 24 Stunden — für Nutzer ohne E-Mail-Zugang` : 'Nutzer hat keine E-Mail — Link manuell weitergeben'}
          </p>
        </div>
      </div>

      {!resetUrl ? (
        <button onClick={generate} disabled={generating} className="btn-secondary flex items-center gap-2 text-sm">
          {generating ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Link2 className="w-4 h-4" />}
          Reset-Link generieren
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-xs font-mono text-slate-600 break-all">{resetUrl}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">
              Gültig bis: {new Date(expiresAt).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <button onClick={copy} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>
          <button onClick={generate} disabled={generating} className="text-xs text-ink-muted hover:text-ink transition-colors">
            Neuen Link generieren
          </button>
        </div>
      )}
    </div>
  );
}
