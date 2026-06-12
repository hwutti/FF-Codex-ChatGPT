import ColorPicker from '../components/ColorPicker';
import FontPicker from '../components/FontPicker';
import PushOverviewPage from './PushOverviewPage';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../utils/AuthContext';
import DiktatSection from '../components/DiktatSection';
import { usePush } from '../hooks/usePush';
import { useBranding } from '../utils/BrandingContext';
import { useNavigate } from 'react-router-dom';
import api, { authApi, userApi, memberApi, dataApi, settingsApi } from '../api';
import { sortByRank } from '../utils/rankOrder';
import {
  User, KeyRound, ShieldCheck, Users, Download, Upload,
  Camera, Trash2, Plus, X, Save, Eye, EyeOff,
  CheckCircle, XCircle, AlertCircle, Shield, RefreshCw, ChevronRight, Search, Palette, Bot, Check, Loader, ChevronDown, ChevronUp, Mic, Activity, Power,
  Bell, Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Section = 'profile' | 'password' | 'twofactor' | 'notifications' | 'members' | 'data' | 'branding' | 'security' | 'update' | 'ai' | 'permissions' | 'diktat' | 'status' | 'papierkorb' | 'push-overview' | 'nav';

const ROLES = [
  { value: 'ADMIN',            labelM: 'Administrator',       labelF: 'Administratorin' },
  { value: 'COMMANDER',        labelM: 'Kommandant',          labelF: 'Kommandantin' },
  { value: 'DEPUTY_COMMANDER', labelM: 'Stellvertreter',      labelF: 'Stellvertreterin' },
  { value: 'SECRETARY',        labelM: 'Schriftführer',       labelF: 'Schriftführerin' },
  { value: 'GROUP_COMMANDER',  labelM: 'Gruppenkommandant',   labelF: 'Gruppenkommandantin' },
  { value: 'MEMBER',           labelM: 'Mitglied',            labelF: 'Mitglied' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-active', RESERVE: 'badge-reserve',
  YOUTH: 'badge-youth', HONORARY: 'badge-honorary', EXITED: 'badge-exited',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktiv', RESERVE: 'Reservist', YOUTH: 'Jugend',
  HONORARY: 'Ehrenmitglied', EXITED: 'Ausgetreten',
};

// ── Avatar Display ────────────────────────────────────────────────────────────
function AvatarDisplay({ avatarUrl, name, size = 'md', preview = '' }: {
  avatarUrl?: string; name: string; size?: 'sm' | 'md' | 'lg'; preview?: string;
}) {
  const initials = (name || 'U').split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const sizes = { sm: 'w-9 h-9 text-xs', md: 'w-24 h-24 text-2xl', lg: 'w-16 h-16 text-lg' };
  const [imgError, setImgError] = useState(false);
  const src = preview || avatarUrl;
  useEffect(() => { setImgError(false); }, [src]);
  return (
    <div className={`${sizes[size]} rounded-xl overflow-hidden bg-gradient-to-br from-fire-700 to-fire-900 flex items-center justify-center flex-shrink-0`}>
      {src && !imgError
        ? <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        : <span className="text-white font-bold" style={{ fontFamily: 'var(--font-headings)' }}>{initials}</span>
      }
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileSection() {
  const { user, login } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = user?.member
    ? `${user.member.firstName} ${user.member.lastName}`
    : user?.email?.split('@')[0] || 'Benutzer';

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await userApi.uploadAvatar(file);
      login(token || '', result.user ? result.user : { ...user, avatarUrl: result.avatarUrl });
      toast.success('Profilbild aktualisiert');
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler beim Upload'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  };

  const handleRemove = async () => {
    try {
      const result = await userApi.deleteAvatar();
      login(token || '', result.user ? result.user : { ...user, avatarUrl: null });
      toast.success('Profilbild entfernt');
    } catch { toast.error('Fehler'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Profil</h2>
        <p className="text-sm text-ink-muted">Dein Profilbild und Kontoinformationen</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <AvatarDisplay avatarUrl={user?.avatarUrl} name={displayName} size="md" />
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-fire-700 hover:bg-fire-800 text-white rounded-xl flex items-center justify-center shadow-btn transition-colors">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-ink text-lg leading-tight" style={{ fontFamily: 'var(--font-headings)' }}>{displayName}</p>
            <p className="text-ink-muted text-sm mt-0.5 truncate">{user?.email}</p>
            <p className="text-ink-faint text-xs mt-0.5">{ROLES.find(r => r.value === user?.role)?.[user?.member?.gender === 'female' ? 'labelF' : 'labelM']}</p>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
            <Camera className="w-3.5 h-3.5" />{uploading ? 'Lädt...' : 'Bild ändern'}
          </button>
          {user?.avatarUrl && (
            <button onClick={handleRemove}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 !text-red-600 hover:!bg-red-50 flex-1 sm:flex-none justify-center">
              <Trash2 className="w-3.5 h-3.5" /> Entfernen
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleUpload} />
      </div>
      <div className="divider" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'E-Mail', value: user?.email },
          { label: 'Rolle', value: ROLES.find(r => r.value === user?.role)?.[user?.member?.gender === 'female' ? 'labelF' : 'labelM'] },
          { label: 'Mitglied', value: user?.member ? `${user.member.firstName} ${user.member.lastName}` : '—' },
          { label: 'Dienstgrad', value: (user?.member as any)?.rank || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-50 border border-surface-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-medium text-ink">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Password ──────────────────────────────────────────────────────────────────
function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { toast.error('Passwörter stimmen nicht überein'); return; }
    if (form.newPassword.length < 8) { toast.error('Mindestens 8 Zeichen'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(form.currentPassword, form.newPassword);
      toast.success('Passwort erfolgreich geändert');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Falsches aktuelles Passwort'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Passwort ändern</h2>
        <p className="text-sm text-ink-muted">Mindestens 8 Zeichen.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {([
          { label: 'Aktuelles Passwort', field: 'currentPassword' as const, key: 'current' as const },
          { label: 'Neues Passwort',     field: 'newPassword'     as const, key: 'new'     as const },
          { label: 'Bestätigung',        field: 'confirmPassword' as const, key: 'confirm' as const },
        ]).map(({ label, field, key }) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">{label}</label>
            <div className="relative">
              <input type={show[key] ? 'text' : 'password'} className="input-field pr-10"
                value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} required />
              <button type="button" onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted">
                {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
        {form.confirmPassword && form.newPassword !== form.confirmPassword && (
          <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Passwörter stimmen nicht überein</p>
        )}
        <button type="submit" disabled={saving || form.newPassword !== form.confirmPassword || form.newPassword.length < 8} className="btn-primary w-full">
          {saving ? 'Speichern...' : 'Passwort ändern'}
        </button>
      </form>
    </div>
  );
}

// ── Eigene vertraute Geräte ───────────────────────────────────────────────────
function OwnTrustedDevices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const res = await api.get('/auth/trusted-devices'); setDevices(res.data); }
    catch { setDevices([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    await api.delete(`/auth/trusted-devices/${id}`);
    setDevices(d => d.filter(x => x.id !== id));
    toast.success('Gerät widerrufen');
  };

  if (loading || devices.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Vertraute Geräte</p>
      <p className="text-xs text-ink-faint">Diese Geräte müssen für 30 Tage keinen 2FA-Code eingeben.</p>
      {devices.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-3 p-3 bg-surface-50 rounded-xl border border-surface-100">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">{d.deviceName || 'Unbekannt'}</p>
            <p className="text-xs text-ink-muted">Angemeldet: {new Date(d.createdAt).toLocaleString('de-AT')} · Bis: {new Date(d.expiresAt).toLocaleDateString('de-AT')}</p>
          </div>
          <button onClick={() => revoke(d.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Widerrufen</button>
        </div>
      ))}
    </div>
  );
}

// ── 2FA ───────────────────────────────────────────────────────────────────────
function TwoFactorSection() {
  const { user, login } = useAuth();
  const [step, setStep] = useState<'info' | 'qr' | 'verify' | 'disable'>('info');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const is2faEnabled = user?.twoFactorEnabled;

  const refreshUser = async () => {
    const me = await authApi.me();
    login(token || '', me);
  };

  const startSetup = async () => {
    setLoading(true);
    try { const d = await authApi.setup2fa(); setQrCode(d.qrCode); setSecret(d.secret); setStep('qr'); }
    catch { toast.error('Fehler'); } finally { setLoading(false); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await authApi.verify2fa(code); await refreshUser(); toast.success('2FA aktiviert!'); setStep('info'); setCode(''); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Ungültiger Code'); } finally { setLoading(false); }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await authApi.disable2fa(code); await refreshUser(); toast.success('2FA deaktiviert'); setStep('info'); setCode(''); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Ungültiger Code'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Zwei-Faktor-Authentifizierung</h2>
        <p className="text-sm text-ink-muted">Schütze deinen Account mit einem zweiten Faktor.</p>
      </div>
      <div className={`card flex items-center gap-4 ${is2faEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-50'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${is2faEnabled ? 'bg-emerald-100' : 'bg-surface-200'}`}>
          <ShieldCheck className={`w-6 h-6 ${is2faEnabled ? 'text-emerald-600' : 'text-ink-faint'}`} />
        </div>
        <div>
          <p className="font-semibold text-ink">2FA ist {is2faEnabled ? 'aktiviert ✓' : 'deaktiviert'}</p>
          <p className="text-xs text-ink-muted mt-0.5">{is2faEnabled ? 'Dein Konto ist durch einen zweiten Faktor geschützt.' : 'Aktiviere 2FA für zusätzliche Sicherheit.'}</p>
        </div>
      </div>
      {step === 'info' && !is2faEnabled && <button onClick={startSetup} disabled={loading} className="btn-primary w-full">{loading ? 'Wird eingerichtet...' : '2FA einrichten'}</button>}
      {step === 'qr' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Scanne diesen QR-Code mit <strong>Google Authenticator</strong>, <strong>Authy</strong> oder <strong>Microsoft Authenticator</strong>.</p>
          {qrCode && <div className="flex justify-center"><img src={qrCode} alt="QR" className="w-52 h-52 rounded-xl border-4 border-white shadow-card" /></div>}
          <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
            <p className="text-xs text-ink-faint mb-1">Manueller Schlüssel:</p>
            <p className="text-xs font-mono break-all text-ink select-all">{secret}</p>
          </div>
          <button onClick={() => setStep('verify')} className="btn-primary w-full">Weiter → Code eingeben</button>
          <button onClick={() => setStep('info')} className="btn-secondary w-full">Abbrechen</button>
        </div>
      )}
      {step === 'verify' && (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-ink-muted">Gib den 6-stelligen Code aus der App ein:</p>
          <input type="text" inputMode="numeric" className="input-field text-center text-2xl tracking-widest font-mono"
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoFocus />
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full">2FA aktivieren</button>
          <button type="button" onClick={() => { setStep('qr'); setCode(''); }} className="btn-secondary w-full">← Zurück</button>
        </form>
      )}
      {is2faEnabled && step === 'info' && <button onClick={() => setStep('disable')} className="btn-danger w-full">2FA deaktivieren</button>}
      {step === 'disable' && (
        <form onSubmit={disable} className="space-y-4">
          <p className="text-sm text-ink-muted">Gib deinen Authenticator-Code ein:</p>
          <input type="text" inputMode="numeric" className="input-field text-center text-2xl tracking-widest font-mono"
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoFocus />
          <button type="submit" disabled={loading || code.length !== 6} className="btn-danger w-full">Deaktivieren</button>
          <button type="button" onClick={() => { setStep('info'); setCode(''); }} className="btn-secondary w-full">Abbrechen</button>
        </form>
      )}

      {/* Eigene vertraute Geräte */}
      {is2faEnabled && user && <OwnTrustedDevices />}
    </div>
  );
}

// ── Password Reset Modal ──────────────────────────────────────────────────────
function PasswordResetModal({ user: targetUser, memberName, onClose }: {
  user: any; memberName: string; onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Passwort muss mindestens 6 Zeichen haben'); return; }
    setSaving(true);
    try {
      await userApi.update(targetUser.id, { password: newPassword });
      toast.success(`Passwort für ${memberName} wurde zurückgesetzt`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler beim Zurücksetzen');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-1" style={{ fontFamily: 'var(--font-headings)' }}>
          Passwort zurücksetzen
        </h3>
        <p className="text-sm text-gray-500 mb-5">Neues Passwort für <strong>{memberName}</strong></p>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Neues Passwort</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input-field pr-10"
                placeholder="Mindestens 6 Zeichen"
                autoFocus
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving || newPassword.length < 6} className="btn-primary flex-1">
              {saving ? 'Speichern...' : 'Passwort setzen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── User Account Modal ────────────────────────────────────────────────────────
function TrustedDevicesAdmin({ userId }: { userId: string; isSelf?: boolean }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    api.get(`/auth/trusted-devices/${userId}`)
      .then(res => setDevices(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const revoke = async (id: string) => {
    await api.delete(`/auth/trusted-devices/${id}`);
    setDevices(d => d.filter(x => x.id !== id));
    toast.success('Gerät widerrufen');
  };

  const revokeAll = async () => {
    if (!confirm('Alle vertrauten Geräte widerrufen?')) return;
    await api.delete('/auth/trusted-devices', { data: { userId } });
    setDevices([]);
    toast.success('Alle Geräte widerrufen');
  };

  return (
    <div className="bg-surface-50 rounded-2xl p-4 border border-surface-200 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          Vertraute Geräte {!loading && devices.length > 0 && `(${devices.length})`}
        </p>
        {devices.length > 0 && (
          <button onClick={revokeAll} className="text-xs text-red-600 hover:text-red-700 font-medium">Alle widerrufen</button>
        )}
      </div>
      {loading && <p className="text-xs text-ink-faint">Lädt...</p>}
      {!loading && devices.length === 0 && <p className="text-xs text-ink-faint">Keine vertrauten Geräte</p>}
      {devices.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-surface-100">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{d.deviceName || 'Unbekanntes Gerät'}</p>
            <p className="text-xs text-ink-muted">
              {d.ipAddress} · Angemeldet: {new Date(d.createdAt).toLocaleString('de-AT')} · Bis: {new Date(d.expiresAt).toLocaleDateString('de-AT')}
            </p>
          </div>
          <button onClick={() => revoke(d.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 font-medium">Widerrufen</button>
        </div>
      ))}
    </div>
  );
}


function UserAccountModal({ member, existingUser, onClose, onSave }: {
  member: any; existingUser: any; onClose: () => void; onSave: () => void;
}) {
  const { user: currentUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ email: existingUser?.email || '', password: '', role: existingUser?.role || 'MEMBER', isActive: existingUser?.isActive ?? true });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(existingUser?.avatarUrl || (member as any).user?.avatarUrl || '');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [disabling2fa, setDisabling2fa] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(existingUser?.twoFactorEnabled || false);
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  const displaySrc = existingUser ? avatarUrl : pendingPreview;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (existingUser) {
      setUploading(true);
      try {
        const res = await userApi.uploadAvatar(file, existingUser.id);
        setAvatarUrl(res.avatarUrl);
        toast.success('Profilbild aktualisiert');
      } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
      finally { setUploading(false); }
    } else {
      setPendingFile(file);
      const reader = new FileReader();
      reader.onload = ev => setPendingPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleAvatarRemove = async () => {
    if (!existingUser) { setPendingFile(null); setPendingPreview(''); return; }
    try { await userApi.deleteAvatar(existingUser.id); setAvatarUrl(''); toast.success('Entfernt'); }
    catch { toast.error('Fehler'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingUser && !form.password) { toast.error('Passwort erforderlich'); return; }
    setSaving(true);
    try {
      let userId = existingUser?.id;
      if (existingUser) {
        const payload: any = { email: form.email, role: form.role, isActive: form.isActive, memberId: member.id };
        if (form.password) payload.password = form.password;
        await userApi.update(existingUser.id, payload);
        toast.success('Account aktualisiert');
      } else {
        const created = await userApi.create({ email: form.email, password: form.password, role: form.role, isActive: form.isActive, memberId: member.id });
        userId = created.id;
        toast.success('Account erstellt');
      }
      if (pendingFile && userId) {
        try { await userApi.uploadAvatar(pendingFile, userId); } catch { toast.error('Bild konnte nicht hochgeladen werden'); }
      }
      onSave();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!existingUser || existingUser.id === currentUser?.id) return;
    if (!confirm('Account wirklich löschen?')) return;
    try { await userApi.delete(existingUser.id); toast.success('Account gelöscht'); onSave(); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Fehler'); }
  };

  const handleDisable2fa = async () => {
    if (!existingUser || !confirm('2FA deaktivieren?')) return;
    setDisabling2fa(true);
    try { await userApi.disable2faForUser(existingUser.id); setTwoFactorEnabled(false); toast.success('2FA deaktiviert'); }
    catch { toast.error('Fehler'); } finally { setDisabling2fa(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-modal w-full max-w-lg my-4 flex flex-col" style={{maxHeight: 'calc(100vh - 2rem)'}}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-ink text-lg" style={{ fontFamily: 'var(--font-headings)' }}>
              {existingUser ? 'Account bearbeiten' : 'Login-Account anlegen'}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">{member.firstName} {member.lastName} · {member.rank || 'Kein Dienstgrad'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Profilbild - immer sichtbar */}
          <div className="bg-surface-50 rounded-2xl p-4 border border-surface-200">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Profilbild</p>
            <div className="flex items-center gap-4 flex-wrap">
              <AvatarDisplay avatarUrl={displaySrc} name={`${member.firstName} ${member.lastName}`} size="lg" />
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />{uploading ? 'Lädt...' : 'Bild hochladen'}
                </button>
                {(avatarUrl || pendingPreview) && (
                  <button type="button" onClick={handleAvatarRemove}
                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 !text-red-600 hover:!bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Entfernen
                  </button>
                )}
              </div>
              {!existingUser && pendingFile && <p className="text-xs text-emerald-600 w-full">✓ Wird beim Speichern hochgeladen</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Formular */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="pt-1">
              {/* Buttons im sticky Footer unten */}
            </div>
          </form>

          {/* 2FA */}
          {existingUser && existingUser.id !== currentUser?.id && (
            <div className="bg-surface-50 rounded-2xl p-4 border border-surface-200">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Zwei-Faktor-Auth</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${twoFactorEnabled ? 'bg-emerald-100' : 'bg-surface-200'}`}>
                    <ShieldCheck className={`w-4 h-4 ${twoFactorEnabled ? 'text-emerald-600' : 'text-ink-faint'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">2FA ist {twoFactorEnabled ? 'aktiviert' : 'nicht aktiv'}</p>
                    <p className="text-xs text-ink-muted">{twoFactorEnabled ? 'Admin kann 2FA deaktivieren' : 'Benutzer aktiviert 2FA selbst'}</p>
                  </div>
                </div>
                {twoFactorEnabled && (
                  <button onClick={handleDisable2fa} disabled={disabling2fa} className="btn-danger text-xs px-3 py-2">
                    {disabling2fa ? '...' : 'Deaktivieren'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vertraute Geräte (Admin) */}
          {existingUser?.id ? (
            <TrustedDevicesAdmin userId={existingUser.id} isSelf={existingUser.id === currentUser?.id} />
          ) : (
            <div className="bg-surface-50 rounded-2xl p-4 border border-surface-200">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Vertraute Geräte</p>
              <p className="text-xs text-ink-faint mt-1">Kein User-Account verknüpft</p>
            </div>
          )}
        </div>

        {/* Sticky Footer mit Speichern/Abbrechen */}
        <div className="flex gap-3 px-6 py-4 border-t border-surface-100 flex-shrink-0 bg-white rounded-b-3xl">
          {existingUser && existingUser.id !== currentUser?.id && (
            <button type="button" onClick={handleDelete} className="btn-danger p-2.5" title="Account löschen"><Trash2 className="w-4 h-4" /></button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
          <button type="button" onClick={(e) => handleSubmit(e as any)} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Speichern</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Members Section ───────────────────────────────────────────────────────────
function MembersSection() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [modal, setModal] = useState<{ member: any; user: any } | null>(null);
  const [resetModal, setResetModal] = useState<{ user: any; name: string } | null>(null);
  const isAdmin = currentUser?.role === 'ADMIN';

  const load = useCallback(() => {
    setLoading(true);
    const calls: Promise<any>[] = [memberApi.list({ search, status, limit: '200' })];
    if (isAdmin) calls.push(userApi.list());
    Promise.all(calls).then(([m, u]) => {
      setMembers(sortByRank(m.members || []));
      setTotal(m.total || 0);
      if (u) setUsers(u);
    }).finally(() => setLoading(false));
  }, [search, status, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const getUserForMember = (memberId: string) => users.find(u => u.memberId === memberId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Mitglieder & Accounts</h2>
          <p className="text-sm text-ink-muted">{total} Einträge</p>
        </div>
        {isAdmin && (
          <button onClick={() => navigate('/members/new')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Neue/r Kamerad:in
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input type="search" placeholder="Name oder Mitgliedsnummer..." className="input-field pl-10"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ value: 'ACTIVE', label: 'Aktiv' }, { value: 'RESERVE', label: 'Reservisten' }, { value: 'YOUTH', label: 'Jugend' }, { value: 'HONORARY', label: 'Ehrenmitglieder' }, { value: '', label: 'Alle' }].map(f => (
            <button key={f.value} onClick={() => setStatus(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${status === f.value ? 'bg-fire-700 text-white shadow-btn' : 'bg-white text-ink-muted border border-surface-200 hover:text-ink shadow-card'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" /></div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-ink-faint gap-2">
          <Users className="w-10 h-10 opacity-20" /><p className="text-sm">Keine Mitglieder gefunden</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
          {members.map(m => {
            const memberUser = getUserForMember(m.id);
            const colors = ['bg-fire-50 text-fire-700','bg-blue-50 text-blue-700','bg-emerald-50 text-emerald-700','bg-violet-50 text-violet-700','bg-amber-50 text-amber-700'];
            const color = colors[m.firstName.charCodeAt(0) % colors.length];
            const initials = `${m.firstName[0]}${m.lastName[0]}`.toUpperCase();
            return (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors">
                {/* Row 1: Avatar + Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/members/${m.id}`)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs overflow-hidden ${color}`}
                    style={{ fontFamily: 'var(--font-headings)' }}>
                    {(m as any).user?.avatarUrl
                      ? <img src={(m as any).user.avatarUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                      : initials
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-ink text-sm">{m.firstName} {m.lastName}</span>
                      <span className={`badge ${STATUS_BADGE[m.status] || 'badge'} text-[10px]`}>{STATUS_LABEL[m.status] || m.status}</span>
                      {memberUser && (
                        <span className={`badge text-[10px] ${memberUser.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'badge-exited'}`}>
                          🔑 {memberUser.isActive ? 'Login aktiv' : 'Login inaktiv'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5 truncate">
                      {m.memberNumber}{m.rank && ` · ${m.rank}`}{memberUser && ` · ${memberUser.email}`}
                    </p>
                  </div>
                </div>
                {/* Row 2 (mobile) / Right side (desktop): Buttons */}
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {memberUser && (
                      <button onClick={() => setResetModal({ user: memberUser, name: `${m.firstName} ${m.lastName}` })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 flex-1 sm:flex-none justify-center">
                        <KeyRound className="w-3.5 h-3.5" />
                        Passwort
                      </button>
                    )}
                    <button onClick={() => navigate(`/members/${m.id}/account`)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex-1 sm:flex-none justify-center ${
                        memberUser
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-fire-50 text-fire-700 hover:bg-fire-100 border border-fire-200'
                      }`}>
                      <KeyRound className="w-3.5 h-3.5" />
                      {memberUser ? 'Account' : 'Kein Account'}
                    </button>
                    <button onClick={() => navigate(`/members/${m.id}`)}
                      className="p-2 text-ink-faint hover:text-ink hover:bg-surface-100 rounded-xl transition-colors flex-shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <UserAccountModal
          member={modal.member} existingUser={modal.user}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {resetModal && (
        <PasswordResetModal
          user={resetModal.user}
          memberName={resetModal.name}
          onClose={() => setResetModal(null)}
        />
      )}
    </div>
  );
}

// ── Branding ──────────────────────────────────────────────────────────────────
function BrandingSection() {
  const { user } = useAuth();
  const { branding, reload } = useBranding();
  const logoRef = useRef<HTMLInputElement>(null);

  const DEFAULTS = {
    name: 'Feuerwehr Görtschach',
    subtitle: 'Verwaltung',
    foundedYear: '1888',
    primaryColor: '#a82828',
    loginTitle: 'Mitglieder & Einsatzverwaltung',
    loginSubtitle: 'Professionelle Verwaltung für die Freiwillige Feuerwehr',
    loginColor: '#a82828',
    loginBadge: 'VERWALTUNGSSYSTEM',
    loginWelcomeTitle: 'Willkommen zurück',
    loginWelcomeSubtitle: 'Bitte melde dich an um fortzufahren.',
    loginBgColor: '#1a0a05',
  };

  const [form, setForm] = useState({
    name: branding.name,
    subtitle: branding.subtitle,
    foundedYear: branding.foundedYear,
    primaryColor: branding.primaryColor,
    loginTitle: branding.loginTitle,
    loginSubtitle: branding.loginSubtitle,
    loginColor: branding.loginColor,
    loginBadge: branding.loginBadge,
    loginWelcomeTitle: branding.loginWelcomeTitle,
    loginWelcomeSubtitle: branding.loginWelcomeSubtitle,
    loginBgColor: branding.loginBgColor,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [logoPreview, setLogoPreview] = useState(branding.logoUrl || '');
  const [bgPreview, setBgPreview] = useState(branding.loginBgImage || '');
  const bgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      name: branding.name,
      subtitle: branding.subtitle,
      foundedYear: branding.foundedYear,
      primaryColor: branding.primaryColor,
      loginTitle: branding.loginTitle,
      loginSubtitle: branding.loginSubtitle,
      loginColor: branding.loginColor,
      loginBadge: branding.loginBadge,
      loginWelcomeTitle: branding.loginWelcomeTitle,
      loginWelcomeSubtitle: branding.loginWelcomeSubtitle,
      loginBgColor: branding.loginBgColor,
    });
    setLogoPreview(branding.logoUrl || '');
    setBgPreview(branding.loginBgImage || '');
  }, [branding]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(form);
      reload();
      toast.success('Branding gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const resetGeneral = async () => {
    const defaults = { name: DEFAULTS.name, subtitle: DEFAULTS.subtitle, foundedYear: DEFAULTS.foundedYear, primaryColor: DEFAULTS.primaryColor };
    setForm(f => ({ ...f, ...defaults }));
    try { await settingsApi.update({ ...form, ...defaults }); reload(); toast.success('Allgemein auf Standard zurückgesetzt'); }
    catch { toast.error('Fehler beim Zurücksetzen'); }
  };

  const resetLoginLeft = async () => {
    const defaults = { loginBadge: DEFAULTS.loginBadge, loginTitle: DEFAULTS.loginTitle, loginSubtitle: DEFAULTS.loginSubtitle, loginColor: DEFAULTS.loginColor };
    setForm(f => ({ ...f, ...defaults }));
    try { await settingsApi.update({ ...form, ...defaults }); reload(); toast.success('Linke Seite auf Standard zurückgesetzt'); }
    catch { toast.error('Fehler beim Zurücksetzen'); }
  };

  const resetLoginBox = async () => {
    const defaults = { loginWelcomeTitle: DEFAULTS.loginWelcomeTitle, loginWelcomeSubtitle: DEFAULTS.loginWelcomeSubtitle };
    setForm(f => ({ ...f, ...defaults }));
    try { await settingsApi.update({ ...form, ...defaults }); reload(); toast.success('Login-Box auf Standard zurückgesetzt'); }
    catch { toast.error('Fehler beim Zurücksetzen'); }
  };

  const resetBackground = async () => {
    setForm(f => ({ ...f, loginBgColor: DEFAULTS.loginBgColor }));
    // Hintergrundbild löschen falls vorhanden
    if (bgPreview) {
      await fetch('/api/settings/login-bg', { method: 'DELETE', credentials: 'include' });
      setBgPreview('');
    }
    try { await settingsApi.update({ ...form, loginBgColor: DEFAULTS.loginBgColor }); reload(); toast.success('Hintergrund auf Standard zurückgesetzt'); }
    catch { toast.error('Fehler beim Zurücksetzen'); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await settingsApi.uploadLogo(file);
      setLogoPreview(result.logoUrl);
      reload();
      toast.success('Logo hochgeladen');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  };

  const handleLogoRemove = async () => {
    try {
      await settingsApi.deleteLogo();
      setLogoPreview('');
      reload();
      toast.success('Logo entfernt');
    } catch { toast.error('Fehler'); }
  };

  // Preview style based on current primaryColor
  const previewBg = `linear-gradient(180deg, ${form.primaryColor}cc 0%, ${form.primaryColor}ff 100%)`;

  if (user?.role !== 'ADMIN') return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-muted gap-3">
      <Shield className="w-12 h-12 opacity-20" /><p className="font-medium">Nur Administratoren haben Zugriff</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Branding & Erscheinungsbild</h2>
        <p className="text-sm text-ink-muted">Passe Logo, Farben und Name der App an deine Feuerwehr an.</p>
      </div>

      {/* Live Preview */}
      <div className="rounded-2xl overflow-hidden border border-surface-200 shadow-card">
        <div className="px-4 py-2 bg-surface-50 border-b border-surface-200">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Vorschau</p>
        </div>
        <div className="flex items-center gap-4 px-6 py-5" style={{ background: previewBg }}>
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
              : <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
            }
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight" style={{ fontFamily: 'var(--font-headings)' }}>{form.name || 'Feuerwehr Name'}</p>
            <p className="text-white/60 text-xs font-medium tracking-widest uppercase mt-0.5">{form.subtitle || 'Verwaltung'}</p>
            <p className="text-white/30 text-xs mt-1">EST. {form.foundedYear}</p>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Logo</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border-2 border-surface-200 overflow-hidden bg-surface-50 flex items-center justify-center flex-shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
              : <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-1 opacity-40" />
            }
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => logoRef.current?.click()} disabled={uploading}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />{uploading ? 'Lädt...' : 'Logo hochladen'}
            </button>
            {logoPreview && logoPreview !== '/logo.png' && (
              <button type="button" onClick={handleLogoRemove}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 !text-red-600 hover:!bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> Standard
              </button>
            )}
          </div>
          <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
        </div>
        <p className="text-xs text-ink-faint">Empfohlen: quadratisches PNG oder SVG, min. 200×200px</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Name der Feuerwehr</label>
            <input type="text" className="input-field" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="z.B. Feuerwehr Görtschach" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Untertitel</label>
            <input type="text" className="input-field" value={form.subtitle}
              onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
              placeholder="z.B. Verwaltung" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Gründungsjahr</label>
            <input type="text" className="input-field" value={form.foundedYear}
              onChange={e => setForm(f => ({ ...f, foundedYear: e.target.value }))}
              placeholder="z.B. 1888" maxLength={4} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Primärfarbe (Sidebar & Buttons)</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ColorPicker value={form.primaryColor} onChange={color => setForm(f => ({ ...f, primaryColor: color }))} />
                <input type="text" className="input-field font-mono flex-1 min-w-0" value={form.primaryColor}
                  onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                  placeholder="#a82828" maxLength={7} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['#a82828','#1a5276','#1e8449','#7d3c98','#d35400','#2c3e50'].map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, primaryColor: c }))}
                    className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: form.primaryColor === c ? 'white' : 'transparent', boxShadow: form.primaryColor === c ? '0 0 0 2px ' + c : 'none' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Branding speichern</>}
          </button>
          <button type="button" onClick={resetGeneral} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 text-sm flex items-center gap-2 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Standard
          </button>
        </div>
      </form>

      {/* Login-Seite */}
      <div className="divider" />
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Login-Seite — Linke Seite</p>
          <button type="button" onClick={resetLoginLeft} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" /> Standard
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Badge-Text (klein oben)</label>
            <input type="text" className="input-field" value={form.loginBadge}
              onChange={e => setForm(f => ({ ...f, loginBadge: e.target.value }))}
              placeholder="VERWALTUNGSSYSTEM" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Hauptüberschrift</label>
            <input type="text" className="input-field" value={form.loginTitle}
              onChange={e => setForm(f => ({ ...f, loginTitle: e.target.value }))}
              placeholder="Mitglieder & Einsatzverwaltung" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Beschreibungstext</label>
            <textarea className="input-field" rows={2} value={form.loginSubtitle}
              onChange={e => setForm(f => ({ ...f, loginSubtitle: e.target.value }))}
              placeholder="Professionelle Verwaltung für die Freiwillige Feuerwehr" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Farbe der Hauptüberschrift</label>
            <div className="flex items-center gap-2 flex-wrap">
              <ColorPicker value={form.loginColor} onChange={color => setForm(f => ({ ...f, loginColor: color }))} />
              <div className="flex gap-2 flex-wrap">
                {['#a82828','#d4af37','#1e3a8a','#166534','#6d28d9','#ffffff'].map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, loginColor: c }))}
                    className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: form.loginColor === c ? 'white' : 'transparent' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login-Box rechts */}
      <div className="divider" />
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Login-Seite — Login-Box (rechts)</p>
          <button type="button" onClick={resetLoginBox} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" /> Standard
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Willkommenstitel</label>
            <input type="text" className="input-field" value={form.loginWelcomeTitle}
              onChange={e => setForm(f => ({ ...f, loginWelcomeTitle: e.target.value }))}
              placeholder="Willkommen zurück" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Willkommens-Untertitel</label>
            <input type="text" className="input-field" value={form.loginWelcomeSubtitle}
              onChange={e => setForm(f => ({ ...f, loginWelcomeSubtitle: e.target.value }))}
              placeholder="Bitte melde dich an um fortzufahren." />
          </div>
        </div>
      </div>

      {/* Hintergrund */}
      <div className="divider" />
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Login-Seite — Hintergrund</p>
          <button type="button" onClick={resetBackground} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" /> Standard
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Hintergrundfarbe</label>
            <div className="flex items-center gap-3">
              <ColorPicker value={form.loginBgColor} onChange={color => setForm(f => ({ ...f, loginBgColor: color }))} />
              <div className="flex gap-2 flex-wrap">
                {['#1a0a05','#0f172a','#1a1a2e','#0d1b2a','#1a0a1a','#000000'].map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, loginBgColor: c }))}
                    className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: form.loginBgColor === c ? 'white' : 'transparent' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hintergrundbild */}
      <div className="divider" />
      <div>
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Login-Seite — Hintergrundbild</p>
        <div className="space-y-3">
          {bgPreview && (
            <div className="relative rounded-xl overflow-hidden" style={{ height: '120px' }}>
              <img src={bgPreview} alt="Hintergrund" className="w-full h-full object-cover" />
              <button type="button" onClick={async () => {
                await fetch('/api/settings/login-bg', { method: 'DELETE', credentials: 'include' });
                setBgPreview(''); reload(); toast.success('Hintergrundbild entfernt');
              }} className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg text-white hover:bg-red-700">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button type="button" onClick={() => bgRef.current?.click()} disabled={uploadingBg}
            className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center gap-2">
            {uploadingBg
              ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Hochladen...</>
              : <><Camera className="w-4 h-4" /> Hintergrundbild hochladen</>}
          </button>
          <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            setUploadingBg(true);
            try {
              const fd = new FormData(); fd.append('image', file);
              const res = await fetch('/api/settings/login-bg', { method: 'POST', credentials: 'include', body: fd });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              setBgPreview(data.loginBgImage); reload(); toast.success('Hintergrundbild gespeichert');
            } catch (err: any) { toast.error(err.message); }
            finally { setUploadingBg(false); if (e.target) e.target.value = ''; }
          }} />
          <p className="text-xs text-gray-400">Empfehlung: 1920×1080px, JPG/PNG — überschreibt die Hintergrundfarbe</p>
        </div>
      </div>

      {/* Speichern */}
      <div className="divider" />
      <div>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? 'Speichern...' : <><Save className="w-4 h-4" /> Login-Branding speichern</>}
        </button>
      </div>

      {/* PWA / App Branding */}
      <PwaBrandingCard />

      {/* Schriftarten */}
      <FontSettingsCard />

      {/* Splash-Screen */}
      <SplashScreenCard />

      {/* Dashboard Header */}
      <DashboardBrandingCard />

      {/* Datenschutz Branding */}
      <PrivacyBrandingCard />

      {/* E-Mail Branding */}
      <EmailBrandingCard />

      {/* Regenradar */}
      <RadarSettingsCard />
    </div>
  );
}

// ── PWA Branding Card ────────────────────────────────────────────────────────
function PwaBrandingCard() {
  const [pwaName, setPwaName] = useState('');
  const [pwaShortName, setPwaShortName] = useState('');
  const [pwaIcon, setPwaIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const iconRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.pwaName) setPwaName(r.data.pwaName);
      if (r.data.pwaShortName) setPwaShortName(r.data.pwaShortName);
      if (r.data.pwaIcon) setPwaIcon(r.data.pwaIcon);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/settings/pwa', { pwaName, pwaShortName });
      toast.success('PWA-Branding gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const uploadIcon = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('icon', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/pwa-icon', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (data.iconUrl) { setPwaIcon(data.iconUrl); toast.success('PWA-Icon hochgeladen!'); }
      else toast.error('Fehler beim Upload');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); }
  };

  const removeIcon = async () => {
    try {
      await api.delete('/settings/pwa-icon');
      setPwaIcon(null);
      toast.success('PWA-Icon entfernt');
    } catch { toast.error('Fehler'); }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg">📱</div>
        <div>
          <p className="font-semibold text-ink text-sm">App (iOS/Android Homescreen)</p>
          <p className="text-xs text-ink-muted">Icon und Name für den Homescreen</p>
        </div>
      </div>

      {/* PWA Icon Upload */}
      <div>
        <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">App-Icon</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl border-2 border-surface-200 bg-surface-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {pwaIcon
              ? <img src={pwaIcon} alt="PWA Icon" className="w-full h-full object-cover" />
              : <span className="text-2xl">📱</span>}
          </div>
          <div className="space-y-2">
            <input ref={iconRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadIcon(f); }} />
            <button onClick={() => iconRef.current?.click()} disabled={uploading}
              className="btn-secondary flex items-center gap-2 text-sm">
              {uploading
                ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Camera className="w-3.5 h-3.5" />}
              {pwaIcon ? 'Icon ändern' : 'Icon hochladen'}
            </button>
            {pwaIcon && (
              <button onClick={removeIcon} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700">
                <Trash2 className="w-3 h-3" /> Icon entfernen
              </button>
            )}
            <p className="text-xs text-ink-muted">PNG, JPG — beliebige Größe, wird automatisch skaliert</p>
          </div>
        </div>
      </div>

      {/* App Namen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">App-Name (lang)</label>
          <input type="text" value={pwaName} onChange={e => setPwaName(e.target.value)}
            className="input-field" placeholder="Feuerwehr Görtschach Verwaltung" />
          <p className="text-xs text-ink-muted mt-1">Vollständiger Name</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">App-Name (kurz)</label>
          <input type="text" value={pwaShortName} onChange={e => setPwaShortName(e.target.value)}
            className="input-field" placeholder="FF Görtschach" maxLength={12} />
          <p className="text-xs text-ink-muted mt-1">Max. 12 Zeichen (unter Icon)</p>
        </div>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs text-blue-700">
          <strong>Hinweis:</strong> Nach dem Speichern die App aus dem Browser entfernen und neu zum Homescreen hinzufügen damit Icon und Name aktualisiert werden.
        </p>
      </div>
      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        PWA-Branding speichern
      </button>
    </div>
  );
}

// ── Splash-Screen ─────────────────────────────────────────────────────────────
// ── Schriftarten Card ─────────────────────────────────────────────────────────
function FontSettingsCard() {
  const { branding, reload } = useBranding();
  const [fonts, setFonts] = useState({
    fontGeneral: branding.fontGeneral || 'DM Sans',
    fontHeadings: branding.fontHeadings || 'Outfit',
    fontLogin: branding.fontLogin || 'Outfit',
    fontSidebar: branding.fontSidebar || 'DM Sans',
    fontDashboard: branding.fontDashboard || 'Outfit',
    fontPrivacy: branding.fontPrivacy || 'DM Sans',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { ...fonts });
      reload();
      toast.success('Schriftarten gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const DEFAULT_FONTS = {
    fontGeneral: 'DM Sans',
    fontHeadings: 'Outfit',
    fontLogin: 'Outfit',
    fontSidebar: 'DM Sans',
    fontDashboard: 'Outfit',
    fontPrivacy: 'DM Sans',
  };

  const resetToDefaults = async () => {
    setFonts(DEFAULT_FONTS);
    setSaving(true);
    try {
      await api.put('/settings', { ...DEFAULT_FONTS });
      reload();
      toast.success('Schriftarten auf Standard zurückgesetzt');
    } catch {
      toast.error('Fehler beim Zurücksetzen');
    } finally { setSaving(false); }
  };

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink text-base" style={{ fontFamily: 'var(--font-headings)' }}>Schriftarten</h3>
          <p className="text-xs text-ink-muted mt-1">Schriftart pro Bereich — lokal eingebettet, datenschutzkonform</p>
        </div>
        <button onClick={resetToDefaults} disabled={saving} className="text-xs text-ink-muted hover:text-ink border border-surface-200 hover:border-surface-300 px-3 py-1.5 rounded-lg transition-colors">
          Zurück auf Standard
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FontPicker label="Allgemein (Fließtext)" value={fonts.fontGeneral} onChange={v => setFonts(p => ({ ...p, fontGeneral: v }))} />
        <FontPicker label="Überschriften" value={fonts.fontHeadings} onChange={v => setFonts(p => ({ ...p, fontHeadings: v }))} />
        <FontPicker label="Login-Seite" value={fonts.fontLogin} onChange={v => setFonts(p => ({ ...p, fontLogin: v }))} />
        <FontPicker label="Sidebar / Navigation" value={fonts.fontSidebar} onChange={v => setFonts(p => ({ ...p, fontSidebar: v }))} />
        <FontPicker label="Dashboard" value={fonts.fontDashboard} onChange={v => setFonts(p => ({ ...p, fontDashboard: v }))} />
        <FontPicker label="Datenschutz-Modal" value={fonts.fontPrivacy} onChange={v => setFonts(p => ({ ...p, fontPrivacy: v }))} />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Schriftarten speichern
      </button>
    </div>
  );
}

function SplashScreenCard() {
  const [bgType, setBgType] = useState<'color' | 'image'>('color');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#333333');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.splashBgColor) { setBgColor(r.data.splashBgColor); setBgType('color'); }
      if (r.data.splashBgImage) { setBgImage(r.data.splashBgImage); setBgType('image'); }
      if (r.data.splashTextColor) setTextColor(r.data.splashTextColor);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/settings/splash', {
        splashBgColor: bgType === 'color' ? bgColor : null,
        splashTextColor: textColor,
      });
      toast.success('Splash-Screen gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post('/settings/splash-bg', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBgImage(r.data.splashBgImage);
      setBgType('image');
      toast.success('Hintergrundbild hochgeladen');
    } catch { toast.error('Fehler beim Hochladen'); }
    finally { setUploading(false); }
  };

  const removeImage = async () => {
    try {
      await api.delete('/settings/splash-bg');
      setBgImage(null);
      setBgType('color');
      toast.success('Hintergrundbild entfernt');
    } catch { toast.error('Fehler'); }
  };

  // Vorschau-Hintergrund
  const previewStyle: React.CSSProperties = bgType === 'image' && bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bgColor };

  return (
    <div className="settings-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-lg">🌅</div>
        <div>
          <h3 className="font-semibold text-ink-base">Splash-Screen</h3>
          <p className="text-xs text-ink-muted">Ladebildschirm beim App-Start</p>
        </div>
      </div>

      {/* Vorschau */}
      <div className="mb-5">
        <label className="settings-label">Vorschau</label>
        <div className="relative rounded-2xl overflow-hidden border border-surface-200 flex items-center justify-center" style={{ height: 200, ...previewStyle }}>
          {bgType === 'image' && bgImage && <div className="absolute inset-0 bg-black/35" />}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🛡️</div>
            <p style={{ color: textColor, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>Feuerwehr Görtschach</p>
            <div style={{ width: 18, height: 18, border: `2px solid ${textColor}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
          </div>
        </div>
      </div>

      {/* Typ-Auswahl */}
      <div className="mb-4">
        <label className="settings-label">Hintergrund</label>
        <div className="flex gap-2 mt-1.5">
          <button onClick={() => setBgType('color')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${bgType === 'color' ? 'bg-fire-700 text-white border-fire-700' : 'border-surface-300 text-ink-muted hover:bg-surface-100'}`}>
            🎨 Farbe
          </button>
          <button onClick={() => setBgType('image')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${bgType === 'image' ? 'bg-fire-700 text-white border-fire-700' : 'border-surface-300 text-ink-muted hover:bg-surface-100'}`}>
            🖼️ Bild
          </button>
        </div>
      </div>

      {bgType === 'color' && (
        <div className="mb-4">
          <label className="settings-label">Hintergrundfarbe</label>
          <div className="flex items-center gap-3 mt-1.5">
            <ColorPicker value={bgColor} onChange={color => setBgColor(color)} />
            <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)}
              className="input-field flex-1 text-sm font-mono" placeholder="#ffffff" />
          </div>
        </div>
      )}

      {bgType === 'image' && (
        <div className="mb-4">
          <label className="settings-label">Hintergrundbild</label>
          {bgImage ? (
            <div className="flex items-center gap-3 mt-1.5">
              <img src={bgImage} className="w-16 h-10 object-cover rounded-lg border border-surface-200" />
              <button onClick={removeImage} className="text-sm text-red-500 hover:text-red-700">🗑️ Entfernen</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-1.5 w-full py-3 border-2 border-dashed border-surface-300 rounded-xl text-sm text-ink-muted hover:bg-surface-50 disabled:opacity-50">
              {uploading ? '⏳ Wird hochgeladen...' : '📁 Bild auswählen (JPG, PNG)'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          <p className="text-xs text-ink-subtle mt-1">Empfohlen: min. 1080×1920px, max. 10 MB</p>
        </div>
      )}

      {/* Textfarbe */}
      <div className="mb-5">
        <label className="settings-label">Text- & Spinner-Farbe</label>
        <div className="flex items-center gap-3 mt-1.5">
          <ColorPicker value={textColor} onChange={color => setTextColor(color)} />
          <input type="text" value={textColor} onChange={e => setTextColor(e.target.value)}
            className="input-field flex-1 text-sm font-mono" placeholder="#333333" />
          <div className="flex gap-1.5">
            <button onClick={() => setTextColor('#ffffff')} className="text-xs px-2 py-1 bg-gray-800 text-white rounded-lg">Weiß</button>
            <button onClick={() => setTextColor('#1a1a1a')} className="text-xs px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded-lg">Schwarz</button>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Splash-Screen speichern
      </button>
    </div>
  );
}

// ── Dashboard Header ─────────────────────────────────────────────────────────
function DashboardBrandingCard() {
  const [bgType, setBgType] = useState<'color' | 'image'>('color');
  const [bgColor, setBgColor] = useState('#2d2724');
  const [textColor, setTextColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.dashboardBgColor) { setBgColor(r.data.dashboardBgColor); }
      if (r.data.dashboardBgImage) { setBgImage(r.data.dashboardBgImage); setBgType('image'); }
      if (r.data.dashboardTextColor) setTextColor(r.data.dashboardTextColor);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/settings/dashboard', {
        dashboardBgColor: bgType === 'color' ? bgColor : null,
        dashboardTextColor: textColor,
      });
      toast.success('Dashboard-Header gespeichert');
    } catch { toast.error('Fehler'); } finally { setSaving(false); }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post('/settings/dashboard-bg', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBgImage(r.data.dashboardBgImage);
      setBgType('image');
      toast.success('Hintergrundbild hochgeladen');
    } catch { toast.error('Fehler'); } finally { setUploading(false); }
  };

  const removeImage = async () => {
    try {
      await api.delete('/settings/dashboard-bg');
      setBgImage(null); setBgType('color');
      toast.success('Bild entfernt');
    } catch {}
  };

  const previewStyle: React.CSSProperties = bgType === 'image' && bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bgColor };

  return (
    <div className="settings-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg">🏠</div>
        <div>
          <h3 className="font-semibold text-ink-base">Dashboard Header</h3>
          <p className="text-xs text-ink-muted">Hintergrund des Begrüßungsbereichs</p>
        </div>
      </div>

      {/* Vorschau */}
      <div className="mb-5">
        <label className="settings-label">Vorschau</label>
        <div className="relative rounded-2xl overflow-hidden border border-surface-200 p-5 mt-1.5" style={{ ...previewStyle, minHeight: 100 }}>
          {bgType === 'image' && bgImage && <div className="absolute inset-0 bg-black/40" />}
          <div className="relative z-10">
            <p className="font-bold text-lg" style={{ color: textColor, fontFamily: 'var(--font-headings)' }}>Guten Morgen, Herbert 👋</p>
            <p className="text-sm mt-0.5" style={{ color: textColor, opacity: 0.75 }}>Donnerstag, 28. Mai 2026</p>
          </div>
        </div>
      </div>

      {/* Typ */}
      <div className="mb-4">
        <label className="settings-label">Hintergrund</label>
        <div className="flex gap-2 mt-1.5">
          <button onClick={() => setBgType('color')} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${bgType === 'color' ? 'bg-fire-700 text-white border-fire-700' : 'border-surface-300 text-ink-muted hover:bg-surface-100'}`}>🎨 Farbe</button>
          <button onClick={() => setBgType('image')} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${bgType === 'image' ? 'bg-fire-700 text-white border-fire-700' : 'border-surface-300 text-ink-muted hover:bg-surface-100'}`}>🖼️ Bild</button>
        </div>
      </div>

      {bgType === 'color' && (
        <div className="mb-4">
          <ColorPicker label="Hintergrundfarbe" value={bgColor} onChange={setBgColor} />
        </div>
      )}

      {bgType === 'image' && (
        <div className="mb-4">
          <label className="settings-label">Hintergrundbild</label>
          {bgImage ? (
            <div className="flex items-center gap-3 mt-1.5">
              <img src={bgImage} className="w-16 h-10 object-cover rounded-lg border border-surface-200" />
              <button onClick={removeImage} className="text-sm text-red-500 hover:text-red-700">🗑️ Entfernen</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-1.5 w-full py-3 border-2 border-dashed border-surface-300 rounded-xl text-sm text-ink-muted hover:bg-surface-50 disabled:opacity-50">
              {uploading ? '⏳ Wird hochgeladen...' : '📁 Bild auswählen'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        </div>
      )}

      <div className="mb-5">
        <ColorPicker label="Textfarbe" value={textColor} onChange={setTextColor} />
        <div className="flex gap-2 mt-2">
          <button onClick={() => setTextColor('#ffffff')} className="text-xs px-2 py-1 bg-gray-800 text-white rounded-lg">Weiß</button>
          <button onClick={() => setTextColor('#1a1a1a')} className="text-xs px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded-lg">Schwarz</button>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Dashboard-Header speichern
      </button>
    </div>
  );
}

// ── Datenschutz Branding Card ─────────────────────────────────────────────────
function PrivacyBrandingCard() {
  const [colors, setColors] = useState({
    privacyHeaderBg: '#1e293b',
    privacyHeaderText: '#ffffff',
    privacyPageBg: '#f1f5f9',
    privacyButtonBg: '#16a34a',
    privacyContentText: '#374151',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/privacy').then((r: any) => {
      setColors({
        privacyHeaderBg: r.data.privacyHeaderBg || '#1e293b',
        privacyHeaderText: r.data.privacyHeaderText || '#ffffff',
        privacyPageBg: r.data.privacyPageBg || '#f1f5f9',
        privacyButtonBg: r.data.privacyButtonBg || '#16a34a',
        privacyContentText: r.data.privacyContentText || '#374151',
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/privacy', colors);
      toast.success('Datenschutz-Design gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  return (
    <div className="card p-5 space-y-5">
      <div>
        <h3 className="font-bold text-ink text-base" style={{ fontFamily: 'var(--font-headings)' }}>Datenschutz-Design</h3>
        <p className="text-xs text-ink-muted mt-1">Farben des Datenschutz-Modals beim Login</p>
      </div>

      {/* Vorschau */}
      <div className="rounded-xl overflow-hidden border border-surface-200 text-xs">
        <div className="px-4 py-3 flex items-center gap-2" style={{ background: colors.privacyHeaderBg }}>
          <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5" style={{ color: colors.privacyHeaderText }} />
          </div>
          <span className="font-bold" style={{ color: colors.privacyHeaderText }}>Datenschutzinformation</span>
        </div>
        <div className="px-4 py-3" style={{ background: colors.privacyPageBg }}>
          <p className="mb-2" style={{ color: colors.privacyContentText }}>Vorschau des Datenschutztextes...</p>
          <div className="px-3 py-1.5 rounded-lg text-white text-center text-xs font-semibold" style={{ background: colors.privacyButtonBg }}>
            Ich habe gelesen und bestätige
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ColorPicker label="Header-Hintergrund" value={colors.privacyHeaderBg} onChange={c => setColors(p => ({ ...p, privacyHeaderBg: c }))} />
        <ColorPicker label="Header-Textfarbe" value={colors.privacyHeaderText} onChange={c => setColors(p => ({ ...p, privacyHeaderText: c }))} />
        <ColorPicker label="Seiten-Hintergrund" value={colors.privacyPageBg} onChange={c => setColors(p => ({ ...p, privacyPageBg: c }))} />
        <ColorPicker label="Button-Farbe" value={colors.privacyButtonBg} onChange={c => setColors(p => ({ ...p, privacyButtonBg: c }))} />
        <ColorPicker label="Textfarbe Inhalt" value={colors.privacyContentText} onChange={c => setColors(p => ({ ...p, privacyContentText: c }))} />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Datenschutz-Design speichern
      </button>
    </div>
  );
}

// ── E-Mail Branding Card ──────────────────────────────────────────────────────
function EmailBrandingCard() {
  const DEFAULT_BODY = `Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button um ein neues Passwort zu vergeben.\n\nAnleitung:\n1. Klicke auf den Button "Passwort zurücksetzen"\n2. Du wirst zur App weitergeleitet\n3. Gib dein neues Passwort zweimal ein\n4. Bestätige — du wirst danach automatisch zur Anmeldung weitergeleitet\n\nFalls du keine Anfrage gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.`;

  const [form, setForm] = useState({
    emailHeaderBg: '#a82828', emailButtonBg: '#a82828',
    emailFooterText: '', emailSubject: 'Passwort zurücksetzen — {{name}}',
    emailHeadline: 'Passwort zurücksetzen', emailBodyText: DEFAULT_BODY,
    emailButtonText: 'Passwort zurücksetzen →', emailHeaderImage: null as string | null,
    emailFont: 'Arial',
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings/email-branding').then((r: any) => {
      setForm(prev => ({ ...prev, ...r.data }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings/email-branding', form);
      toast.success('E-Mail Design gespeichert');
      setPreviewKey(k => k + 1);
    } catch { toast.error('Fehler beim Speichern'); } finally { setSaving(false); }
  };

  const uploadHeaderImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const r = await api.post('/settings/email-header-image', fd);
      setForm(p => ({ ...p, emailHeaderImage: r.data.imageUrl }));
      toast.success('Headerbild hochgeladen');
    } catch { toast.error('Upload fehlgeschlagen'); } finally { setUploadingImg(false); }
  };

  const removeHeaderImage = async () => {
    setForm(p => ({ ...p, emailHeaderImage: null }));
    await api.put('/settings/email-branding', { ...form, emailHeaderImage: null }).catch(() => {});
  };

  return (
    <div className="card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink text-base" style={{ fontFamily: 'var(--font-headings)' }}>E-Mail Design</h3>
          <p className="text-xs text-ink-muted mt-1">Aussehen und Texte der automatischen E-Mails (Passwort-Reset etc.)</p>
        </div>
        <button onClick={() => { setPreviewKey(k => k+1); setShowPreview(v => !v); }} className="text-xs text-fire-700 hover:underline border border-fire-200 px-3 py-1.5 rounded-lg">
          {showPreview ? 'Vorschau schließen' : '👁 Vorschau'}
        </button>
      </div>

      {/* Design */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Design</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorPicker label="Header-Hintergrundfarbe" value={form.emailHeaderBg} onChange={c => setForm(p => ({ ...p, emailHeaderBg: c }))} />
          <ColorPicker label="Button-Farbe" value={form.emailButtonBg} onChange={c => setForm(p => ({ ...p, emailButtonBg: c }))} />
        </div>

        {/* Schriftart */}
        <div className="space-y-1.5 mt-4">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Schriftart</label>
          <select value={form.emailFont} onChange={e => setForm(p => ({ ...p, emailFont: e.target.value }))} className="input w-full">
            {[
              { value: 'Arial', label: 'Arial — Modern, sauber' },
              { value: 'Georgia', label: 'Georgia — Elegant, Serif' },
              { value: 'Times New Roman', label: 'Times New Roman — Klassisch' },
              { value: 'Verdana', label: 'Verdana — Gut lesbar' },
              { value: 'Trebuchet MS', label: 'Trebuchet MS — Freundlich' },
              { value: 'Courier New', label: 'Courier New — Technisch' },
            ].map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">System-Fonts — funktionieren in allen E-Mail-Clients (Gmail, Outlook, Apple Mail)</p>
        </div>

        {/* Header-Bild */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Header-Hintergrundbild (optional — überlagert Farbe)</label>
          {form.emailHeaderImage ? (
            <div className="flex items-center gap-3">
              <img src={form.emailHeaderImage} className="h-16 w-32 object-cover rounded-lg border border-surface-200" alt="Header" />
              <button onClick={removeHeaderImage} className="text-xs text-red-600 hover:underline flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Entfernen</button>
            </div>
          ) : (
            <button onClick={() => imgRef.current?.click()} disabled={uploadingImg}
              className="btn-secondary text-sm flex items-center gap-2">
              {uploadingImg ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Camera className="w-4 h-4" />}
              Bild hochladen
            </button>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadHeaderImage(e.target.files[0])} />
        </div>
      </div>

      {/* Texte */}
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Texte</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Betreff</label>
            <input type="text" value={form.emailSubject} onChange={e => setForm(p => ({ ...p, emailSubject: e.target.value }))} className="input w-full" placeholder="Passwort zurücksetzen — {{name}}" />
            <p className="text-xs text-ink-muted">{'{{'+'name'+'}}' } wird durch den Feuerwehr-Namen ersetzt</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Überschrift</label>
            <input type="text" value={form.emailHeadline} onChange={e => setForm(p => ({ ...p, emailHeadline: e.target.value }))} className="input w-full" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Text / Anleitung</label>
            <textarea value={form.emailBodyText} onChange={e => setForm(p => ({ ...p, emailBodyText: e.target.value }))} className="input w-full min-h-40 text-sm resize-y" />
            <p className="text-xs text-ink-muted">Zeilenumbrüche werden übernommen. Zeilen mit "1. 2. 3." werden als nummerierte Liste formatiert.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Button-Text</label>
            <input type="text" value={form.emailButtonText} onChange={e => setForm(p => ({ ...p, emailButtonText: e.target.value }))} className="input w-full" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Fußzeile</label>
            <input type="text" value={form.emailFooterText} onChange={e => setForm(p => ({ ...p, emailFooterText: e.target.value }))} className="input w-full" placeholder="Feuerwehr XY — Internes Verwaltungssystem" />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        E-Mail Design speichern
      </button>

      {/* Vorschau */}
      {showPreview && (
        <div className="border border-surface-200 rounded-xl overflow-hidden">
          <div className="bg-surface-50 px-4 py-2 border-b border-surface-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">Vorschau: Passwort-Reset E-Mail</span>
            <button onClick={() => setShowPreview(false)} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
          </div>
          <iframe key={previewKey} src="/api/settings/email-preview" className="w-full border-0" style={{ height: '650px' }} title="E-Mail Vorschau" />
        </div>
      )}
    </div>
  );
}

// ── Regenradar Einstellungen ──────────────────────────────────────────────────
function RadarSettingsCard() {
  const { branding, reload } = useBranding();
  const [form, setForm] = useState({
    radarLat: branding.radarLat,
    radarLng: branding.radarLng,
    radarZoom: branding.radarZoom,
    radarLayer: branding.radarLayer,
    radarOpacity: branding.radarOpacity,
    radarSpeed: branding.radarSpeed,
    radarHeight: branding.radarHeight,
    radarLabels: branding.radarLabels,
    radarDarkMap: branding.radarDarkMap,
    radarTitle: branding.radarTitle,
  });
  const [saving, setSaving] = useState(false);

  // Vorschau-URL
  const isSatellitePreview = form.radarLayer === 'satellite';
  const previewSrc = `https://www.rainviewer.com/map.html?loc=${form.radarLat},${form.radarLng},${form.radarZoom}&oFa=0&oC=0&oU=0&oCS=1&oF=0&oAP=${isSatellitePreview ? 0 : 1}&rmt=${form.radarSpeed}&c=${(form.radarDarkMap || isSatellitePreview) ? 2 : 1}&o=${form.radarOpacity}&lm=${form.radarLabels ? 1 : 0}&layer=${form.radarLayer}&sm=1&sn=1`;

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/settings/radar', form);
      reload();
      toast.success('Radar-Einstellungen gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const f = (field: string) => (e: any) => setForm(p => ({ ...p, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="settings-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg">🌧️</div>
        <div>
          <h3 className="font-semibold text-ink-base">Regenradar Widget</h3>
          <p className="text-xs text-ink-muted">Kartenansicht auf dem Dashboard konfigurieren</p>
        </div>
      </div>

      {/* Vorschau */}
      <div className="mb-5">
        <label className="settings-label">Vorschau</label>
        <div className="mt-1.5 rounded-xl overflow-hidden border border-surface-200">
          <div className="px-4 py-2 border-b border-surface-100 bg-white text-sm font-semibold text-ink-base">
            🌧️ {(form as any).radarTitle || 'Regenradar — Görtschach'}
          </div>
          <iframe key={previewSrc} src={previewSrc} style={{ width: '100%', height: form.radarHeight, border: 'none', display: 'block' }} title="Radar Vorschau" />
        </div>
      </div>

      <div className="mb-4">
        <label className="settings-label">Titel des Widgets</label>
        <input className="input-field w-full mt-1" value={(form as any).radarTitle || ''} placeholder="z.B. Regenradar — Görtschach"
          onChange={e => setForm(p => ({ ...p, radarTitle: e.target.value }))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Ort */}
        <div>
          <label className="settings-label">Breitengrad (Lat)</label>
          <input type="number" step="0.01" className="input-field w-full mt-1" value={form.radarLat} onChange={f('radarLat')} />
        </div>
        <div>
          <label className="settings-label">Längengrad (Lng)</label>
          <input type="number" step="0.01" className="input-field w-full mt-1" value={form.radarLng} onChange={f('radarLng')} />
        </div>

        {/* Zoom */}
        <div>
          <label className="settings-label">Zoom ({form.radarZoom})</label>
          <input type="range" min="5" max="14" className="w-full mt-1" value={form.radarZoom} onChange={f('radarZoom')} />
          <div className="flex justify-between text-xs text-ink-muted"><span>Weit</span><span>Nah</span></div>
        </div>

        {/* Höhe */}
        <div>
          <label className="settings-label">Widget-Höhe ({form.radarHeight}px)</label>
          <input type="range" min="150" max="500" step="10" className="w-full mt-1" value={form.radarHeight} onChange={f('radarHeight')} />
          <div className="flex justify-between text-xs text-ink-muted"><span>Klein</span><span>Groß</span></div>
        </div>

        {/* Layer */}
        <div>
          <label className="settings-label">Kartentyp</label>
          <select className="input-field w-full mt-1" value={form.radarLayer} onChange={f('radarLayer')}>
            <option value="radar">🌧️ Regenradar</option>
            <option value="satellite">🛰️ Satellitenbild</option>
            <option value="snow">❄️ Schneeradar</option>
          </select>
        </div>

        {/* Geschwindigkeit */}
        <div>
          <label className="settings-label">Animationsgeschwindigkeit</label>
          <select className="input-field w-full mt-1" value={form.radarSpeed} onChange={f('radarSpeed')}>
            <option value="1">Sehr schnell</option>
            <option value="2">Schnell</option>
            <option value="4">Normal</option>
            <option value="6">Langsam</option>
            <option value="8">Sehr langsam</option>
          </select>
        </div>

        {/* Deckkraft */}
        <div className="col-span-1 sm:col-span-2">
          <label className="settings-label">Radar-Deckkraft ({form.radarOpacity}%)</label>
          <input type="range" min="20" max="100" className="w-full mt-1" value={form.radarOpacity} onChange={f('radarOpacity')} />
          <div className="flex justify-between text-xs text-ink-muted"><span>Transparent</span><span>Undurchsichtig</span></div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2 mb-5">
        <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface-50 rounded-xl">
          <input type="checkbox" checked={form.radarLabels} onChange={f('radarLabels')} className="w-4 h-4 rounded" />
          <div>
            <p className="text-sm font-medium text-ink-base">Stadtbeschriftungen</p>
            <p className="text-xs text-ink-muted">Ortsnamen auf der Karte anzeigen</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface-50 rounded-xl">
          <input type="checkbox" checked={form.radarDarkMap} onChange={f('radarDarkMap')} className="w-4 h-4 rounded" />
          <div>
            <p className="text-sm font-medium text-ink-base">Dunkle / Satelliten-Hintergrundkarte</p>
            <p className="text-xs text-ink-muted">Dunklere Kartendarstellung statt heller Standard-Karte</p>
          </div>
        </label>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Radar-Einstellungen speichern
      </button>
    </div>
  );
}

// ── Backup & Wiederherstellung ───────────────────────────────────────────────
function DataSection() {
  const { user } = useAuth();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [serverBacking, setServerBacking] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showServerRestoreConfirm, setShowServerRestoreConfirm] = useState<string | null>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showBackupPasswordModal, setShowBackupPasswordModal] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [showRestorePasswordModal, setShowRestorePasswordModal] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePasswordVisible, setShowRestorePasswordVisible] = useState(false);

  const loadList = () => {
    setLoadingList(true);
    fetch('/api/backup/list', {
      credentials: 'include',
    }).then(r => r.json()).then(data => {
      setServerBackups(Array.isArray(data) ? data : []);
    }).catch(() => setServerBackups([]))
    .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    loadList();
  }, [user]);

  if (user?.role !== 'ADMIN') return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-muted gap-3">
      <Shield className="w-12 h-12 opacity-20" /><p className="font-medium">Nur Administratoren haben Zugriff</p>
    </div>
  );

  // Manuelles Download-Backup
  const handleFullBackup = async (password?: string) => {
    setBackingUp(true);
    setShowBackupPasswordModal(false);
    try {
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;

      let res: Response;
      if (password) {
        res = await fetch('/api/backup/create-encrypted', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
      } else {
        res = await fetch('/api/backup/create', { credentials: 'include' });
      }
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || (password ? `backup-verschluesselt-${ts}.zip` : `backup-${ts}.zip`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success(password ? '✅ Verschlüsseltes Backup heruntergeladen' : '✅ Backup heruntergeladen');
    } catch (err: any) { toast.error(err.message || 'Fehler beim Backup');
    } finally { setBackingUp(false); setBackupPassword(''); }
  };

  // Server-Backup triggern
  const handleServerBackup = async () => {
    setServerBacking(true);
    try {
      const res = await fetch('/api/backup/server-create', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast.success('✅ Server-Backup erstellt');
      loadList();
    } catch (err: any) { toast.error(err.message || 'Fehler');
    } finally { setServerBacking(false); }
  };

  // Upload-Restore
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) { toast.error('Bitte eine .zip Datei wählen'); return; }
    setPendingRestoreFile(file);
    setShowRestorePasswordModal(true);
    if (e.target) e.target.value = '';
  };

  const executeRestore = async () => {
    if (!pendingRestoreFile) return;
    setShowRestoreConfirm(false);
    setRestoring(true);
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('backup', pendingRestoreFile);
      if (restorePassword) form.append('password', restorePassword);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('✅ Backup wiederhergestellt — bitte neu anmelden');
      setTimeout(() => { localStorage.clear(); window.location.href = '/login'; }, 3000);
    } catch (err: any) { toast.error(err.message || 'Fehler beim Restore');
    } finally { setRestoring(false); setPendingRestoreFile(null); setRestorePassword(''); }
  };

  // Server-Backup herunterladen
  const handleServerDownload = (filename: string) => {
    const url = `/api/backup/server-download/${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    // Auth header via fetch+blob
    fetch(url, { credentials: 'include' })
      .then(r => r.blob()).then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(blobUrl);
      });
  };

  // Server-Backup löschen
  const handleServerDelete = async (filename: string) => {
    await fetch(`/api/backup/server-delete/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    toast.success('Gelöscht');
    loadList();
  };

  // Server-Backup wiederherstellen
  const executeServerRestore = async (filename: string) => {
    setShowServerRestoreConfirm(null);
    setRestoring(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/backup/server-restore/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('✅ Backup wiederhergestellt — bitte neu anmelden');
      setTimeout(() => { localStorage.clear(); window.location.href = '/login'; }, 3000);
    } catch (err: any) { toast.error(err.message || 'Fehler beim Restore');
    } finally { setRestoring(false); }
  };

  const formatSize = (bytes: number) => bytes < 1024*1024 ? `${(bytes/1024).toFixed(0)} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Backup & Wiederherstellung</h2>
        <p className="text-sm text-ink-muted">Vollständige Datensicherung inkl. aller Dateien, Passwörter und Konfiguration</p>
      </div>

      {/* Download + Upload Backup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-ink">Backup herunterladen</p>
              <p className="text-xs text-ink-muted mt-1">Datenbank + Dateien + Konfiguration als ZIP</p>
            </div>
          </div>
          <button onClick={() => setShowBackupPasswordModal(true)} disabled={backingUp} className="btn-primary w-full flex items-center justify-center gap-2">
            {backingUp ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Erstelle...</> : <><Download className="w-4 h-4" /> Backup herunterladen</>}
          </button>
        </div>

        <div className="card space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-ink">Backup wiederherstellen</p>
              <p className="text-xs text-ink-muted mt-1">ZIP-Backup hochladen und einspielen</p>
            </div>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={restoring}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
            {restoring ? <><div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" /> Stelle wieder her...</> : <><Upload className="w-4 h-4" /> ZIP-Backup wählen</>}
          </button>
          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleRestore} />
        </div>
      </div>

      {/* Server Backups */}
      <div className="card space-y-3">
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <p className="font-semibold text-ink text-sm">Server-Backups</p>
            <span className="text-xs text-ink-muted">Retention Time 14 Tage</span>
          </div>
          <button onClick={handleServerBackup} disabled={serverBacking}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-medium transition-colors w-full">
            {serverBacking ? <><div className="w-3 h-3 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /> Erstelle...</> : <><Plus className="w-3 h-3" /> Jetzt erstellen</>}
          </button>
        </div>

        {loadingList ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" /></div>
        ) : serverBackups.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-3">Noch keine Server-Backups vorhanden — klicke "Jetzt erstellen"</p>
        ) : (
          <div className="space-y-2">
            {serverBackups.map((b: any) => (
              <div key={b.name} className="flex items-center gap-2 py-2 px-3 rounded-xl bg-surface-50 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="font-mono text-xs text-ink-muted flex-1 min-w-0 truncate">{b.name}</span>
                <span className="text-xs text-ink-muted flex-shrink-0">{formatSize(b.size)}</span>
                <span className="text-xs text-ink-muted flex-shrink-0 hidden sm:block">{new Date(b.createdAt).toLocaleString('de-AT')}</span>
                {/* Aktionen */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleServerDownload(b.name)}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Herunterladen">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowServerRestoreConfirm(b.name)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Wiederherstellen">
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleServerDelete(b.name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Löschen">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disaster Recovery Hinweis */}
      <div className="card bg-amber-50 border-amber-200">
        <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Disaster Recovery</p>
        <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
          <li>App neu installieren (fresh install)</li>
          <li>Mit admin@feuerwehr.local / admin123 anmelden</li>
          <li>Einstellungen → Backup & Wiederherstellung öffnen</li>
          <li>ZIP-Backup hochladen → alles wird automatisch wiederhergestellt</li>
          <li>System startet neu → mit alten Zugangsdaten anmelden</li>
        </ol>
        <p className="text-xs text-amber-600 mt-3 font-medium">
          ✅ Backup enthält: Datenbank · Alle Dateien · Protokolle · Dokumente · Profilbilder · Logo · 2FA · Passwörter
        </p>
      </div>

      {/* Upload-Restore Confirm Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden">
            <div className="bg-red-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Backup wiederherstellen</h3>
                  <p className="text-red-100 text-xs mt-0.5">{pendingRestoreFile?.name}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="font-semibold text-red-800 text-sm">Alle aktuellen Daten werden überschrieben!</p>
                  <p className="text-red-700 text-xs mt-1">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                </div>
              </div>
              <ul className="text-sm text-ink-muted space-y-1">
                {['Datenbank wird vollständig wiederhergestellt','Alle Dateien werden wiederhergestellt','Konfiguration wird wiederhergestellt','System startet automatisch neu','Anmeldung mit alten Zugangsdaten'].map(item => (
                  <li key={item} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-fire-500 flex-shrink-0" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => { setShowRestoreConfirm(false); setPendingRestoreFile(null); }} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={executeRestore}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Jetzt wiederherstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server-Restore Confirm Modal */}
      {showServerRestoreConfirm && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden">
            <div className="bg-red-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Backup wiederherstellen</h3>
                  <p className="text-red-100 text-xs mt-0.5 truncate">{showServerRestoreConfirm}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="font-semibold text-red-800 text-sm">Alle aktuellen Daten werden überschrieben!</p>
                  <p className="text-red-700 text-xs mt-1">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                </div>
              </div>
              <ul className="text-sm text-ink-muted space-y-1">
                {['Datenbank wird vollständig wiederhergestellt','Alle Dateien werden wiederhergestellt','Konfiguration wird wiederhergestellt','System startet automatisch neu','Anmeldung mit alten Zugangsdaten'].map(item => (
                  <li key={item} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-fire-500 flex-shrink-0" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => setShowServerRestoreConfirm(null)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={() => executeServerRestore(showServerRestoreConfirm!)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Jetzt wiederherstellen
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Backup Passwort Modal ── */}
      {showBackupPasswordModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm overflow-hidden">
            <div className="bg-emerald-600 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Backup herunterladen</h3>
                <p className="text-emerald-100 text-xs mt-0.5">Optionales Passwort für verschlüsseltes ZIP</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-ink-muted">Ohne Passwort wird ein unverschlüsseltes Backup erstellt. Mit Passwort wird das ZIP mit AES-256 verschlüsselt.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Passwort (optional)</label>
                <div className="relative">
                  <input
                    type={showBackupPassword ? 'text' : 'password'}
                    value={backupPassword}
                    onChange={e => setBackupPassword(e.target.value)}
                    placeholder="Leer lassen für unverschlüsselt"
                    className="input w-full pr-10"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleFullBackup(backupPassword || undefined)}
                  />
                  <button type="button" onClick={() => setShowBackupPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                    {showBackupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => { setShowBackupPasswordModal(false); setBackupPassword(''); }} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={() => handleFullBackup(backupPassword || undefined)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> {backupPassword ? 'Verschlüsselt herunterladen' : 'Herunterladen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore Passwort Modal ── */}
      {showRestorePasswordModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm overflow-hidden">
            <div className="bg-red-600 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Backup wiederherstellen</h3>
                <p className="text-red-100 text-xs mt-0.5 truncate">{pendingRestoreFile?.name}</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-ink-muted">Falls das Backup verschlüsselt ist, bitte das Passwort eingeben. Bei unverschlüsselten Backups leer lassen.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Passwort (falls verschlüsselt)</label>
                <div className="relative">
                  <input
                    type={showRestorePasswordVisible ? 'text' : 'password'}
                    value={restorePassword}
                    onChange={e => setRestorePassword(e.target.value)}
                    placeholder="Leer lassen wenn nicht verschlüsselt"
                    className="input w-full pr-10"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && (setShowRestorePasswordModal(false), setShowRestoreConfirm(true))}
                  />
                  <button type="button" onClick={() => setShowRestorePasswordVisible(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                    {showRestorePasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => { setShowRestorePasswordModal(false); setPendingRestoreFile(null); setRestorePassword(''); }} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={() => { setShowRestorePasswordModal(false); setShowRestoreConfirm(true); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Weiter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ── E-Mail SMTP Section ───────────────────────────────────────────────────────
function EmailSection() {
  const [form, setForm] = useState({ smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '', smtpSecure: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [testLogs, setTestLogs] = useState<{ msg: string; type: string; ts: string }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/settings/smtp').then((r: any) => {
      setForm({ smtpHost: r.data.smtpHost || '', smtpPort: String(r.data.smtpPort || 587), smtpUser: r.data.smtpUser || '', smtpPass: '', smtpFrom: r.data.smtpFrom || '', smtpSecure: r.data.smtpSecure || false });
      setConfigured(r.data.configured || false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/smtp', form);
      toast.success('SMTP-Einstellungen gespeichert');
      setConfigured(!!(form.smtpHost && form.smtpUser && form.smtpPass));
    } catch { toast.error('Fehler beim Speichern'); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestLogs([]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, smtpPort: parseInt(form.smtpPort), testEmail }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setTestLogs(prev => [...prev, data]);
              setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setTestLogs(prev => [...prev, { msg: 'Verbindungsfehler: ' + e.message, type: 'error', ts: '' }]);
    } finally { setTesting(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-fire-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>E-Mail (SMTP)</h2>
        <p className="text-sm text-ink-muted">SMTP-Konfiguration für automatische E-Mails (z.B. Passwort zurücksetzen).</p>
      </div>

      <div className={`card p-4 flex items-center gap-3 ${configured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <Mail className={`w-5 h-5 flex-shrink-0 ${configured ? 'text-green-600' : 'text-amber-600'}`} />
        <p className="text-sm font-semibold text-ink">{configured ? 'SMTP konfiguriert — E-Mails können gesendet werden' : 'Noch nicht konfiguriert — Passwort-Reset funktioniert nicht'}</p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">SMTP-Server (Host)</label>
            <input type="text" value={form.smtpHost} onChange={e => setForm(p => ({ ...p, smtpHost: e.target.value }))} className="input w-full" placeholder="smtp.gmail.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Port</label>
            <input type="number" value={form.smtpPort} onChange={e => setForm(p => ({ ...p, smtpPort: e.target.value }))} className="input w-full" placeholder="587" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Verschlüsselung</label>
            <label className="flex items-center gap-2 h-10 cursor-pointer">
              <input type="checkbox" checked={form.smtpSecure} onChange={e => setForm(p => ({ ...p, smtpSecure: e.target.checked }))} className="rounded" />
              <span className="text-sm text-ink">SSL/TLS (Port 465)</span>
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Benutzername</label>
            <input type="text" value={form.smtpUser} onChange={e => setForm(p => ({ ...p, smtpUser: e.target.value }))} className="input w-full" placeholder="user@gmail.com" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Passwort / App-Passwort</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.smtpPass} onChange={e => setForm(p => ({ ...p, smtpPass: e.target.value }))} className="input w-full pr-10" placeholder={configured ? 'Gesetzt (leer lassen zum Beibehalten)' : 'App-Passwort eingeben'} autoComplete="new-password" />
              {form.smtpPass && (
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Absender-Adresse (Von)</label>
            <input type="email" value={form.smtpFrom} onChange={e => setForm(p => ({ ...p, smtpFrom: e.target.value }))} className="input w-full" placeholder="noreply@feuerwehr.at" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Speichern
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm">Verbindung testen</h3>
        <div className="flex gap-3">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="input flex-1" placeholder="Test-E-Mail senden an (optional)" />
          <button onClick={handleTest} disabled={testing || !form.smtpHost} className="btn-secondary flex items-center gap-2 flex-shrink-0">
            {testing ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
            Testen
          </button>
        </div>
        <p className="text-xs text-ink-muted">Testet die SMTP-Verbindung. Optional: E-Mail-Adresse eingeben um eine Test-Mail zu erhalten.</p>

        {/* Log-Fenster */}
        {testLogs.length > 0 && (
          <div className="bg-gray-950 rounded-xl p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
            {testLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">{log.ts}</span>
                <span className={
                  log.type === 'ok' ? 'text-emerald-400' :
                  log.type === 'error' ? 'text-red-400' :
                  'text-gray-300'
                }>
                  {log.type === 'ok' ? '✓' : log.type === 'error' ? '✗' : '›'} {log.msg}
                </span>
              </div>
            ))}
            {testing && (
              <div className="flex items-center gap-2 text-gray-500">
                <span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                <span>Warte auf Antwort...</span>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Security Section ──────────────────────────────────────────────────────────
function SecuritySection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/auth/blocked', {
      credentials: 'include',
    }).then(r => r.json()).then(setData).catch(() => setData(null))
    .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUnblock = async (ip: string) => {
    await fetch('/api/auth/unblock', {
      method: 'POST',
      credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    toast.success(`${ip} entsperrt`);
    load();
  };

  const formatRemaining = (ms: number) => {
    const sec = Math.ceil(ms / 1000);
    return sec < 60 ? `${sec}s` : `${Math.ceil(sec / 60)}min`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Sicherheit</h2>
        <p className="text-sm text-ink-muted">Login-Schutz und gesperrte IP-Adressen</p>
      </div>

      {/* Rate Limit Info */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-ink">Login-Schutz aktiv</p>
            <p className="text-xs text-ink-muted">Nach 10 Fehlversuchen wird die IP für 3 Minuten gesperrt</p>
          </div>
        </div>
      </div>

      {/* Currently Blocked */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink text-sm">Aktuell gesperrte IPs</p>
          <button onClick={load} className="text-xs text-fire-700 hover:text-fire-800 font-medium">Aktualisieren</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" /></div>
        ) : data?.currentlyBlocked?.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">Keine gesperrten IPs</p>
        ) : (
          <div className="space-y-2">
            {data?.currentlyBlocked?.map((b: any) => (
              <div key={b.ip} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-red-800">{b.ip}</p>
                  <p className="text-xs text-red-600">{b.email} · {b.attempts} Versuche · noch {formatRemaining(b.remainingMs)}</p>
                </div>
                <button onClick={() => handleUnblock(b.ip)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 font-medium flex-shrink-0">
                  Entsperren
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Blocks History */}
      <div className="card space-y-3">
        <p className="font-semibold text-ink text-sm">Letzte Sperrungen</p>
        {loading ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" /></div>
        ) : data?.recentBlocks?.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">Keine Sperrungen in der Historie</p>
        ) : (
          <div className="space-y-1">
            {data?.recentBlocks?.slice(0, 10).map((b: any, i: number) => {
              const details = typeof b.details === 'string' ? JSON.parse(b.details) : b.details;
              return (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-surface-50 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="font-mono text-xs text-ink-muted flex-shrink-0">{details?.ip || b.entityId}</span>
                  <span className="text-xs text-ink-muted flex-shrink-0 truncate">{details?.email || '—'}</span>
                  <span className="text-xs text-ink-muted ml-auto flex-shrink-0">
                    {new Date(b.createdAt).toLocaleString('de-AT')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Update Section ────────────────────────────────────────────────────────────
function UpdateSection() {
  const [versionInfo, setVersionInfo] = useState<any>(null);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [updateDone, setUpdateDone] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [githubConfig, setGithubConfig] = useState<{ hasToken: boolean; maskedToken: string; repo: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);
  const updatingRef = useRef(false);

  const { token } = useAuth();
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const getToken = () => tokenRef.current || '';

  // Startet den Status-Polling Loop
  const startStatusPolling = useCallback(() => {
    if (pollRef.current) return;
    updatingRef.current = true;
    setUpdating(true);
    setUpdateLog('');
    setUpdateDone(false);
    setAnnounced(false);
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const sr = await fetch('/api/update/status', { headers: { Authorization: `Bearer ${getToken()}` } });
        const status = await sr.json();
        setUpdateLog(status.log || '');
        if (!status.running && status.done) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          updatingRef.current = false;
          setUpdateDone(true);
          setUpdating(false);
          if (status.exitCode === 0 || status.exitCode === null || status.exitCode === undefined) {
            toast.success('Update erfolgreich — App wird neu geladen...');
            setTimeout(() => { localStorage.clear(); window.location.href = '/login'; }, 5000);
          } else {
            toast.error('Update fehlgeschlagen — siehe Log');
          }
        }
      } catch {}
    }, 2000);
  }, []);

  // Master-Polling: prüft alle 3s den Gesamt-Status (Announce + Update laufend)
  useEffect(() => {
    fetch('/api/update/version', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(setVersionInfo).catch(() => {});

    // GitHub-Config laden
    fetch('/api/settings/github-config', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(setGithubConfig).catch(() => {});

    const masterPoll = setInterval(async () => {
      if (updatingRef.current) return; // Update läuft bereits, kein Doppel-Start
      try {
        // Prüfe ob Update gerade läuft
        const sr = await fetch('/api/update/status', { headers: { Authorization: `Bearer ${getToken()}` } });
        const status = await sr.json();
        if (status.running) {
          startStatusPolling();
          return;
        }
        // Prüfe Announce-Status
        const ar = await fetch('/api/update/announce-status', { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await ar.json();
        if (data.announced) {
          const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
          const remaining = (data.countdown || 300) - elapsed;
          if (remaining > 0) {
            setAnnounced(true);
            setCountdown(remaining);
          } else {
            // Countdown abgelaufen aber Update noch nicht gestartet → sofort Polling starten
            startStatusPolling();
          }
        } else {
          // Kein Announce mehr aktiv
          setAnnounced(false);
        }
      } catch {}
    }, 3000);

    // Sofort beim Mount einmal prüfen
    (async () => {
      try {
        const sr = await fetch('/api/update/status', { headers: { Authorization: `Bearer ${getToken()}` } });
        const status = await sr.json();
        if (status.running) { startStatusPolling(); return; }
        const ar = await fetch('/api/update/announce-status', { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await ar.json();
        if (data.announced) {
          const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
          const remaining = (data.countdown || 300) - elapsed;
          if (remaining > 0) { setAnnounced(true); setCountdown(remaining); }
          else { startStatusPolling(); }
        }
      } catch {}
    })();

    return () => clearInterval(masterPoll);
  }, [startStatusPolling]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [updateLog]);

  useEffect(() => {
    if (announced && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(countdownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [announced]);

  const handleCheck = async () => {
    setChecking(true); setCheckResult(null);
    try {
      const res = await fetch('/api/update/check', { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCheckResult(data);
    } catch (err: any) { toast.error(err.message || 'Prüfung fehlgeschlagen'); }
    finally { setChecking(false); }
  };

  const announceUpdate = async () => {
    setShowConfirm(false);
    try {
      const res = await fetch('/api/update/announce', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setAnnounced(true);
      setCountdown(300);
      toast.success('Update in 5 Minuten angekündigt — alle User wurden benachrichtigt');
    } catch (err: any) { toast.error(err.message); }
  };

  const cancelUpdate = async () => {
    try {
      await fetch('/api/update/cancel', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      setAnnounced(false);
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
      toast.success('Update abgebrochen');
    } catch (err: any) { toast.error(err.message); }
  };

  const startUpdateNow = async () => {
    setShowConfirm(false);
    try {
      const res = await fetch('/api/update/start', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      startStatusPolling();
    } catch (err: any) { toast.error(err.message); setUpdating(false); }
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Update</h2>
        <p className="text-sm text-ink-muted">Softwarestand prüfen und aktualisieren</p>
      </div>

      {/* Current Version */}
      <div className="card space-y-3">
        <p className="font-semibold text-ink text-sm">Installierte Version</p>
        {versionInfo ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-ink font-mono" style={{ fontFamily: 'monospace' }}>{versionInfo.currentCommit}</p>
              <p className="text-xs text-ink-muted font-mono">{versionInfo.currentDate ? new Date(versionInfo.currentDate).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 border-surface-200 border-t-fire-700 rounded-full animate-spin" /></div>
        )}
      </div>

      {/* Countdown Banner */}
      {announced && countdown > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 overflow-hidden shadow-lg">
          {/* Animierter Top-Balken */}
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" style={{ backgroundSize: '200%', animation: 'shimmer 2s infinite' }} />
          <div className="bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-4">
              {/* Großer Countdown */}
              <div className="w-20 h-20 rounded-2xl bg-amber-100 border-2 border-amber-300 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-amber-700 font-mono leading-none">{formatCountdown(countdown)}</span>
                <span className="text-xs text-amber-600 mt-1">verbleibend</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="font-bold text-amber-900 text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Update angekündigt!</p>
                </div>
                <p className="text-sm text-amber-800">Alle User wurden benachrichtigt. Das System startet in <strong>{formatCountdown(countdown)}</strong> automatisch neu.</p>
                <p className="text-xs text-amber-600 mt-1">⚠ Bitte alle offenen Eingaben speichern!</p>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-amber-500 to-orange-500"
                style={{ width: `${(countdown / 300) * 100}%` }} />
            </div>
            <div className="flex gap-3">
              <button onClick={cancelUpdate} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-red-300 text-red-700 hover:bg-red-50 font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                <X className="w-4 h-4" /> Update abbrechen
              </button>
              <button onClick={startUpdateNow} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                <Download className="w-4 h-4" /> Jetzt sofort starten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check + Update Buttons */}
      {!announced && !updating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleCheck} disabled={checking}
            className="btn-secondary flex items-center justify-center gap-2">
            {checking
              ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Prüfe...</>
              : <><RefreshCw className="w-4 h-4" /> Auf Update prüfen</>}
          </button>
          {githubConfig && !githubConfig.hasToken ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                <span>⚠️</span> Kein GitHub-Token konfiguriert
              </p>
              <p className="text-xs text-amber-600">Bitte unten unter "GitHub Verbindung" einrichten</p>
            </div>
          ) : (
            <button onClick={() => setShowConfirm(true)} disabled={checking}
              className="btn-primary flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Update installieren
            </button>
          )}
        </div>
      )}

      {/* Check Result */}
      {checkResult && (
        <div className={`card space-y-3 ${checkResult.upToDate ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-3">
            {checkResult.upToDate
              ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
            <div className="flex-1">
              <p className="font-semibold text-ink text-sm">
                {checkResult.upToDate ? '✅ App ist aktuell' : '🆕 Update verfügbar'}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                Installiert: <span className="font-mono">{checkResult.currentCommit}</span>
                {!checkResult.upToDate && <> · Verfügbar: <span className="font-mono">{checkResult.remoteCommit}</span> (v{checkResult.remoteVersion})</>}
              </p>
            </div>
          </div>
          {!checkResult.upToDate && checkResult.changelog.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-800">Änderungen:</p>
              {checkResult.changelog.map((c: string, i: number) => (
                <p key={i} className="text-xs text-amber-700 font-mono pl-2 truncate">{c}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Log */}
      {(updating || updateDone) && (
        <div className="card space-y-2">
          <div className="flex items-center gap-2">
            {updating && <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
            {updateDone && <div className="w-3 h-3 rounded-full bg-emerald-400" />}
            <p className="font-semibold text-ink text-sm">{updating ? 'Update läuft...' : 'Update abgeschlossen'}</p>
          </div>
          <div ref={logRef} className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-64 whitespace-pre-wrap">
            {updateLog || 'Warte auf Output...'}
          </div>
          {updateDone && <p className="text-xs text-ink-muted text-center">App wird in 5 Sekunden neu geladen...</p>}
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden">
            <div className="bg-fire-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-headings)' }}>Update installieren</h3>
                  <p className="text-fire-100 text-xs mt-0.5">
                    {checkResult && !checkResult.upToDate ? `${versionInfo?.currentCommit} → ${checkResult.remoteCommit}` : 'Neueste Version installieren'}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">App ist kurz nicht erreichbar!</p>
                  <p className="text-amber-700 text-xs mt-1">Der Server startet nach dem Update automatisch neu.</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-ink">Wie soll das Update gestartet werden?</p>
              <div className="space-y-3">
                <button onClick={announceUpdate}
                  className="w-full px-4 py-3 rounded-xl border-2 border-fire-200 bg-fire-50 hover:bg-fire-100 text-fire-800 font-semibold text-sm flex items-center gap-3 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-fire-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-fire-700 font-bold text-xs">5 min</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">In 5 Minuten starten</p>
                    <p className="text-xs text-fire-600 font-normal mt-0.5">Alle User werden benachrichtigt und haben Zeit zu speichern</p>
                  </div>
                </button>
                <button onClick={startUpdateNow}
                  className="w-full px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-sm flex items-center gap-3 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Sofort starten (Notfall)</p>
                    <p className="text-xs text-red-600 font-normal mt-0.5">Update startet ohne Vorwarnung — ungespeicherte Daten gehen verloren</p>
                  </div>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary w-full">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Betriebssystem-Update */}
      <OsUpdateSection />

      {/* App neu starten */}
      <AppRestartSection />

      {/* Server neu starten */}
      <RebootSection />

      {/* GitHub Verbindung */}
      <GitHubSection onConfigChange={setGithubConfig} />

    </div>
  );
}

// ── GitHub Verbindung Section ─────────────────────────────────────────────────
function GitHubSection({ onConfigChange }: { onConfigChange: (cfg: any) => void }) {
  const [config, setConfig] = useState<{ hasToken: boolean; maskedToken: string; repo: string } | null>(null);
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { token: authToken } = useAuth();

  useEffect(() => {
    fetch('/api/settings/github-config', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json()).then(cfg => {
        setConfig(cfg);
        setRepo(cfg.repo || '');
      }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!token.trim() || !repo.trim()) { toast.error('Token und Repo sind erforderlich'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/settings/github-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token: token.trim(), repo: repo.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const newCfg = { hasToken: true, maskedToken: d.maskedToken, repo: d.repo };
      setConfig(newCfg);
      onConfigChange(newCfg);
      setToken('');
      setTestResult(null);
      toast.success('GitHub-Token gespeichert');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/settings/github-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTestResult(d);
    } catch (e: any) { setTestResult({ error: e.message }); }
    finally { setTesting(false); }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </div>
        <div>
          <p className="font-semibold text-ink text-sm">GitHub Verbindung</p>
          <p className="text-xs text-ink-muted">Privates Repository — Token für Updates</p>
        </div>
      </div>

      {/* Aktueller Status */}
      {config && (
        <div className={`flex items-center gap-3 p-3 rounded-xl ${config.hasToken ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.hasToken ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <div className="flex-1 min-w-0">
            {config.hasToken ? (
              <>
                <p className="text-xs font-semibold text-emerald-700">Token hinterlegt</p>
                <p className="text-xs text-emerald-600 font-mono">{config.maskedToken} · {config.repo}</p>
              </>
            ) : (
              <p className="text-xs font-semibold text-amber-700">Kein Token hinterlegt — Updates gesperrt</p>
            )}
          </div>
        </div>
      )}

      {/* Eingabe */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-ink-muted mb-1 block">Repository (owner/repo)</label>
          <input
            type="text"
            value={repo}
            onChange={e => setRepo(e.target.value)}
            placeholder="hwutti/ff-goertschach"
            className="input-field w-full font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-muted mb-1 block">GitHub Personal Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={config?.hasToken ? 'Neuen Token eingeben um zu ersetzen' : 'ghp_...'}
              className="input-field w-full font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
            >
              {showToken
                ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving || (!token.trim())}
          className="btn-primary flex items-center gap-2 flex-1">
          {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Speichern...</> : '💾 Speichern'}
        </button>
        <button onClick={handleTest} disabled={testing || !config?.hasToken}
          className="btn-secondary flex items-center gap-2">
          {testing ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Teste...</> : '🔗 Verbindung testen'}
        </button>
      </div>

      {/* Test-Ergebnis */}
      {testResult && (
        <div className={`rounded-xl p-4 space-y-2 text-sm ${testResult.error ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          {testResult.error ? (
            <p className="text-red-700 font-semibold">❌ {testResult.error}</p>
          ) : (
            <>
              <p className="font-semibold text-emerald-700">✅ Verbindung erfolgreich</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-ink-muted">Repository</span>
                <span className="font-mono font-semibold text-ink">{testResult.repoName}</span>
                <span className="text-ink-muted">Sichtbarkeit</span>
                <span className="font-semibold text-ink">{testResult.isPrivate ? '🔒 Privat' : '🌐 Öffentlich'}</span>
                {testResult.lastCommit && (
                  <>
                    <span className="text-ink-muted">Letzter Commit</span>
                    <span className="font-mono text-ink">{testResult.lastCommit.sha} · {testResult.lastCommit.author}</span>
                    <span className="text-ink-muted">Commit-Nachricht</span>
                    <span className="text-ink truncate">{testResult.lastCommit.message}</span>
                    <span className="text-ink-muted">Datum</span>
                    <span className="text-ink">{new Date(testResult.lastCommit.date).toLocaleString('de-AT')}</span>
                  </>
                )}
                <span className="text-ink-muted">Stand</span>
                <span className={`font-semibold ${testResult.upToDate === null ? 'text-ink-muted' : testResult.upToDate ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {testResult.upToDate === null ? 'Unbekannt' : testResult.upToDate ? '✅ Aktuell' : `⚠️ Veraltet (lokal: ${testResult.localSha})`}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Betriebssystem-Update Section ────────────────────────────────────────────
function SudoPasswordModal({ onConfirm, onCancel, title, description }: {
  onConfirm: (user: string, pass: string) => void;
  onCancel: () => void;
  title: string;
  description: string;
}) {
  const [user, setUser] = useState('hwutti');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const valid = user.trim() && pass;
  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-bold text-ink">{title}</h3>
              <p className="text-xs text-ink-muted">{description}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Benutzername (sudo)</label>
              <input type="text" value={user}
                onChange={e => setUser(e.target.value)}
                className="input-field w-full" placeholder="z.B. hwutti" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Passwort</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && valid && onConfirm(user, pass)}
                  className="input-field w-full pr-10" placeholder="Passwort eingeben..." />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Abbrechen</button>
          <button onClick={() => valid && onConfirm(user, pass)} disabled={!valid} className="btn-primary flex-1">Bestätigen</button>
        </div>
      </div>
    </div>
  );
}

// ── App Neustart Section ──────────────────────────────────────────────────────
function AppRestartSection() {
  const [confirmed, setConfirmed] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const countdownRef = useRef<any>(null);
  const { token } = useAuth();

  const announceRestart = async () => {
    setConfirmed(false);
    try {
      await fetch('/api/update/restart-announce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnnounced(true);
      setCountdown(300);
      countdownRef.current = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(countdownRef.current); return 0; } return c - 1; });
      }, 1000);
      toast.success('Neustart in 5 Minuten angekündigt');
    } catch { toast.error('Fehler'); }
  };

  const restartNow = async () => {
    setConfirmed(false);
    setRestarting(true);
    try {
      await fetch('/api/update/restart-now', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('App wird neu gestartet...');
      setTimeout(() => { localStorage.clear(); window.location.href = '/login'; }, 4000);
    } catch { toast.error('Fehler'); setRestarting(false); }
  };

  const cancelRestart = async () => {
    clearInterval(countdownRef.current);
    setAnnounced(false);
    setCountdown(0);
    try {
      await fetch('/api/update/restart-cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Neustart abgebrochen');
    } catch {}
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>App neu starten</h2>
        <p className="text-sm text-ink-muted">Startet nur den App-Prozess neu — kein Server-Neustart. Alle User werden vorgewarnt.</p>
      </div>

      <div className="card p-5 space-y-4">
        {!confirmed && !announced && !restarting && (
          <button onClick={() => setConfirmed(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold text-sm transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-left">
              <p className="font-bold">App neu starten</p>
              <p className="text-xs text-blue-600 font-normal mt-0.5">Alle User werden benachrichtigt bevor die App neu startet</p>
            </div>
          </button>
        )}

        {confirmed && !announced && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Wie soll der Neustart erfolgen?</p>
            <div className="space-y-2">
              <button onClick={announceRestart}
                className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold text-sm flex items-center gap-3 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-xs">5 min</span>
                </div>
                <div className="text-left">
                  <p className="font-bold">In 5 Minuten starten</p>
                  <p className="text-xs text-blue-600 font-normal mt-0.5">Alle User werden benachrichtigt und haben Zeit zu speichern</p>
                </div>
              </button>
              <button onClick={restartNow}
                className="w-full px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-sm flex items-center gap-3 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold">Sofort starten</p>
                  <p className="text-xs text-red-600 font-normal mt-0.5">Ohne Vorwarnung — ungespeicherte Daten gehen verloren</p>
                </div>
              </button>
            </div>
            <button onClick={() => setConfirmed(false)} className="btn-secondary w-full">Abbrechen</button>
          </div>
        )}

        {announced && countdown > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-blue-700 font-mono">{formatTime(countdown)}</span>
              </div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">Neustart angekündigt</p>
                <p className="text-xs text-blue-700">Alle User wurden benachrichtigt</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelRestart} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Abbrechen
              </button>
              <button onClick={restartNow} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Jetzt sofort
              </button>
            </div>
          </div>
        )}

        {restarting && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm font-semibold text-blue-800">App wird neu gestartet...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OsUpdateSection() {
  const [osInfo, setOsInfo] = useState<{ total: number; security: number; packages: string[]; upToDate: boolean; held: number } | null>(null);
  const [distLog, setDistLog] = useState<string[]>([]);
  const [distInstalling, setDistInstalling] = useState(false);
  const [distDone, setDistDone] = useState(false);
  const [distSuccess, setDistSuccess] = useState(false);
  const [showRebootHint, setShowRebootHint] = useState(false);
  const distLogRef = useRef<HTMLDivElement>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sudoModal, setSudoModal] = useState<{ action: 'check' | 'install' | 'dist' } | null>(null);
  const [sudoPass, setSudoPass] = useState('');
  const [sudoUser, setSudoUser] = useState('hwutti');
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);
  useEffect(() => {
    if (distLogRef.current) distLogRef.current.scrollTop = distLogRef.current.scrollHeight;
  }, [distLog]);

  const checkUpdates = async (pass?: string, user?: string) => {
    setChecking(true);
    setSudoModal(null);
    try {
      const r = await api.get('/update/os-check', { params: pass ? { sudoPass: pass, sudoUser: user || sudoUser } : {} });
      setOsInfo(r.data);
      if (pass) setSudoPass(pass);
      if (user) setSudoUser(user);
    } catch { }
    finally { setChecking(false); }
  };

  const installUpdates = async (pass?: string, user?: string) => {
    setShowConfirm(false);
    setSudoModal(null);
    const usePass = pass || sudoPass;
    const useUser = user || sudoUser;
    setInstalling(true);
    setLog([]);
    setDone(false);
    try {
      await api.post('/update/os-install', { sudoPass: usePass, sudoUser: useUser });
      // SSE Stream via EventSource mit Token als Query-Parameter
      const token = localStorage.getItem('token');
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/update/os-log?auth=${encodeURIComponent(token || '')}`);
        es.onmessage = (e) => {
          try {
            const json = JSON.parse(e.data);
            if (json.line) setLog(prev => [...prev, json.line]);
            if (json.done) {
              setDone(true); setSuccess(json.success); setInstalling(false);
              es.close(); resolve();
            }
          } catch {}
        };
        es.onerror = () => { es.close(); setInstalling(false); resolve(); };
      });
    } catch { setInstalling(false); }
  };

  const installDistUpgrade = async (pass?: string, user?: string) => {
    setSudoModal(null);
    setDistInstalling(true);
    setDistLog([]);
    setDistDone(false);
    const usePass2 = pass || sudoPass;
    const useUser2 = user || sudoUser;
    try {
      await api.post('/update/os-dist-upgrade', { sudoPass: usePass2, sudoUser: useUser2 });
      const token = localStorage.getItem('token');
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/update/os-dist-log?auth=${encodeURIComponent(token || '')}`);
        es.onmessage = (e) => {
          try {
            const json = JSON.parse(e.data);
            if (json.line) setDistLog(prev => [...prev, json.line]);
            if (json.done) {
              setDistDone(true); setDistSuccess(json.success); setDistInstalling(false);
              if (json.success) setShowRebootHint(true);
              es.close(); resolve();
            }
          } catch {}
        };
        es.onerror = () => { es.close(); setDistInstalling(false); resolve(); };
      });
        } catch { setDistInstalling(false); }
  };

  // Fortschritt berechnen
  const progress = log.length > 0 ? Math.min(100, Math.round((log.length / Math.max(osInfo?.total || 20, 20)) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Betriebssystem-Updates</h2>
        <p className="text-sm text-ink-muted">Ubuntu-Pakete auf Sicherheits- und System-Updates prüfen und einspielen.</p>
      </div>

      <div className="card p-5 space-y-4">
        {!osInfo && !installing && (
          <button onClick={() => setSudoModal({ action: 'check' })} disabled={checking}
            className="btn-secondary flex items-center gap-2 w-full justify-center">
            {checking ? <><RefreshCw className="w-4 h-4 animate-spin" /> Wird geprüft...</> : <><RefreshCw className="w-4 h-4" /> Auf Updates prüfen</>}
          </button>
        )}

        {sudoModal && (
          <SudoPasswordModal
            title={sudoModal.action === 'check' ? 'Updates prüfen' : sudoModal.action === 'dist' ? 'Kernel-Update' : 'System-Update'}
            description="sudo-Passwort des Servers eingeben"
            onConfirm={(user, pass) => {
              if (sudoModal.action === 'check') checkUpdates(pass, user);
              else if (sudoModal.action === 'install') installUpdates(pass, user);
              else if (sudoModal.action === 'dist') installDistUpgrade(pass, user);
            }}
            onCancel={() => setSudoModal(null)}
          />
        )}

        {osInfo && !installing && !done && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-3 rounded-xl ${osInfo.upToDate ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${osInfo.upToDate ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div>
                <p className={`font-semibold text-sm ${osInfo.upToDate ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {osInfo.upToDate ? 'System ist aktuell' : `${osInfo.total} Update${osInfo.total !== 1 ? 's' : ''} verfügbar`}
                </p>
                {!osInfo.upToDate && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    {osInfo.security > 0 && <span className="font-semibold text-red-700">⚠ {osInfo.security} Sicherheits-Update{osInfo.security !== 1 ? 's' : ''} · </span>}
                    {osInfo.total - osInfo.security} weitere Pakete
                  </p>
                )}
              </div>
            </div>
            {osInfo.packages.length > 0 && (
              <div className="bg-surface-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Verfügbare Pakete</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {osInfo.packages.map((pkg, i) => (
                    <p key={i} className="text-xs font-mono text-ink-muted">{pkg}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={checkUpdates} disabled={checking} className="btn-secondary flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> Neu prüfen
              </button>
              {!osInfo.upToDate && (
                <button onClick={() => setSudoModal({ action: 'install' })} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                  <Download className="w-4 h-4" /> {osInfo.total} Pakete updaten
                </button>
              )}
            </div>

            {/* Zurückgehaltene Pakete (Kernel-Updates) */}
            {osInfo.held > 0 && !distInstalling && !distDone && (
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-amber-50">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-amber-900">{osInfo.held} Kernel-Update{osInfo.held !== 1 ? 's' : ''} zurückgehalten</p>
                    <p className="text-xs text-amber-700 mt-0.5">Kernel-Updates benötigen dist-upgrade + Server-Neustart</p>
                  </div>
                  <button onClick={() => setSudoModal({ action: 'dist' })}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition-colors font-medium flex-shrink-0">
                    <Download className="w-3.5 h-3.5" /> Kernel updaten
                  </button>
                </div>
              </div>
            )}

            {/* Kernel-Update Terminal */}
            {(distInstalling || distDone) && (
              <div className="border border-surface-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-50 border-b border-surface-200">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
                    {distInstalling && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />}
                    {distDone && (distSuccess ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />)}
                    Kernel-Update
                  </p>
                </div>
                <div ref={distLogRef} className="bg-gray-950 p-4 h-48 overflow-y-auto font-mono text-xs space-y-0.5">
                  {distLog.map((line, i) => (
                    <div key={i} className={`leading-relaxed ${line.startsWith('✓') ? 'text-emerald-400' : line.startsWith('✗') ? 'text-red-400' : 'text-gray-300'}`}>
                      {line}
                    </div>
                  ))}
                </div>
                {showRebootHint && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border-t border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <p className="text-sm text-amber-800 font-medium flex-1">Kernel-Update abgeschlossen — Server-Neustart erforderlich!</p>
                    <button onClick={() => { setShowRebootHint(false); document.getElementById('reboot-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                      className="text-xs px-3 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 font-medium flex-shrink-0">
                      Zum Neustart
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Terminal-Fenster während Update */}
        {installing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-fire-700" /> Update läuft...
              </p>
              <span className="text-xs text-ink-muted">{log.length} Zeilen</span>
            </div>
            {/* Fortschrittsbalken */}
            <div className="w-full bg-surface-100 rounded-full h-2">
              <div className="bg-fire-700 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.max(5, progress)}%` }} />
            </div>
            {/* Log */}
            <div ref={logRef} className="bg-gray-950 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs space-y-0.5">
              {log.map((line, i) => (
                <div key={i} className={`leading-relaxed ${line.startsWith('✓') ? 'text-emerald-400' : line.startsWith('✗') ? 'text-red-400' : line.includes('Err') || line.includes('error') ? 'text-red-300' : 'text-gray-300'}`}>
                  {line}
                </div>
              ))}
              {log.length === 0 && <div className="text-gray-500">Warte auf Output...</div>}
            </div>
          </div>
        )}

        {/* Ergebnis */}
        {done && (
          <div className="space-y-3">
            <div className={`flex items-center gap-3 p-3 rounded-xl ${success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              {success ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
              <p className={`font-semibold text-sm ${success ? 'text-emerald-800' : 'text-red-800'}`}>
                {success ? 'Update erfolgreich abgeschlossen!' : 'Update fehlgeschlagen'}
              </p>
            </div>
            <div ref={logRef} className="bg-gray-950 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              {log.map((line, i) => (
                <div key={i} className={`leading-relaxed ${line.startsWith('✓') ? 'text-emerald-400' : line.startsWith('✗') ? 'text-red-400' : 'text-gray-300'}`}>
                  {line}
                </div>
              ))}
            </div>
            <button onClick={() => { setDone(false); setOsInfo(null); setLog([]); }} className="btn-secondary w-full">
              Neu prüfen
            </button>
          </div>
        )}
      </div>

      {/* Bestätigungs-Modal */}
      {showConfirm && osInfo && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Download className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-lg" style={{ fontFamily: 'var(--font-headings)' }}>
                    Betriebssystem updaten
                  </h3>
                  <p className="text-sm text-ink-muted">{osInfo.total} Pakete werden aktualisiert</p>
                </div>
              </div>
              {osInfo.security > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">
                    {osInfo.security} Sicherheits-Update{osInfo.security !== 1 ? 's' : ''} enthalten
                  </p>
                </div>
              )}
              <p className="text-sm text-ink-muted">
                Der Update-Vorgang läuft im Hintergrund und kann einige Minuten dauern. 
                Die App bleibt während des Updates erreichbar.
              </p>
            </div>
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">
                Abbrechen
              </button>
              <button onClick={() => installUpdates(sudoPass)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Jetzt updaten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Server-Neustart Section ───────────────────────────────────────────────────
function RebootSection() {
  const [countdown, setCountdown] = useState(60);
  const [rebooting, setRebooting] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [warnedUsers, setWarnedUsers] = useState<number>(0);
  const [log, setLog] = useState<string[]>([]);
  const [sudoModal, setSudoModal] = useState<false | 'normal' | 'sofort'>(false);
  const [sudoPass, setSudoPass] = useState('');
  const [sudoUser, setSudoUser] = useState('hwutti');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const startReboot = async (immediateCountdown?: number, pass?: string, user?: string) => {
    const actualCountdown = immediateCountdown ?? countdown;
    const usePass = pass || sudoPass;
    const useUser = user || sudoUser;
    setSudoModal(false);
    setRebooting(true);
    setLog([]);
    try {
      const r = await api.post('/update/reboot', { countdown: actualCountdown, sudoPass: usePass, sudoUser: useUser });
      const warned = r.data.warned || 0;
      setWarnedUsers(warned);
      setLog([
        actualCountdown === 0 ? '⚠ Sofortiger Server-Neustart!' : `⚠ Server-Neustart in ${actualCountdown} Sekunden`,
        `📱 ${warned} User per Push benachrichtigt`,
        `⏳ Countdown läuft...`,
      ]);

      let remaining = actualCountdown;
      setTimer(remaining);
      if (remaining === 0) {
        setTimer(null);
        setLog(prev => [...prev, '🔄 Server startet sofort neu...', '⏳ Warte auf Server...']);
      }
      const t = window.setInterval(() => {
        remaining--;
        setTimer(remaining);
        if (remaining % 10 === 0 || remaining <= 10) {
          setLog(prev => [...prev, `⏱ Noch ${remaining} Sekunden...`]);
        }
        if (remaining <= 0) {
          clearInterval(t);
          setTimer(null);
          setLog(prev => [...prev, '🔄 Server startet jetzt neu...', '⏳ Warte auf Server...']);
          // Nach Reboot: alle 5 Sek prüfen ob Server wieder erreichbar
          let attempts = 0;
          const reconnect = window.setInterval(async () => {
            attempts++;
            try {
              const resp = await fetch('/api/health', { cache: 'no-store' });
              if (resp.ok) {
                clearInterval(reconnect);
                setLog(prev => [...prev, '✓ Server wieder erreichbar!', '🔐 Weiterleitung zur Anmeldung...']);
                setTimeout(() => { window.location.href = '/login'; }, 1500);
              }
            } catch {
              // Server noch nicht erreichbar — weiter warten
              if (attempts % 4 === 0) {
                setLog(prev => [...prev, `⏳ Warte auf Server... (${attempts * 5}s)`]);
              }
              if (attempts >= 60) { // max 5 Min warten
                clearInterval(reconnect);
                setLog(prev => [...prev, '✗ Timeout – bitte Seite manuell neu laden']);
              }
            }
          }, 5000);
        }
      }, 1000);
    } catch {
      setRebooting(false);
    }
  };

  const cancelReboot = async () => {
    await api.delete('/update/reboot');
    setRebooting(false);
    setTimer(null);
    setConfirmed(false);
    setLog([]);
  };

  // Countdown-Ring berechnen
  const pct = timer !== null ? (timer / countdown) * 100 : 0;
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div id="reboot-section" className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Server neu starten</h2>
        <p className="text-sm text-ink-muted">Alle User werden per Push gewarnt. Nach dem Countdown wird der Server neu gestartet.</p>
      </div>

      <div className="card p-5 space-y-4">
        {!rebooting && !confirmed && (
          <button onClick={() => setConfirmed(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-sm transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Power className="w-5 h-5 text-amber-700" />
            </div>
            <div className="text-left">
              <p className="font-bold">Server neu starten</p>
              <p className="text-xs text-amber-700 font-normal mt-0.5">Alle User werden per Push gewarnt bevor der Server neu startet</p>
            </div>
          </button>
        )}

        {confirmed && !rebooting && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Countdown bis zum Neustart:</p>
            <div className="flex gap-2 flex-wrap">
              {[30, 60, 120, 300].map(s => (
                <button key={s} onClick={() => setCountdown(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${countdown === s ? 'bg-fire-700 text-white border-fire-700' : 'bg-surface-50 border-surface-200 text-ink-muted hover:border-fire-300'}`}>
                  {s < 60 ? `${s}s` : `${s/60} Min`}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2 flex-wrap">
              <button onClick={() => setConfirmed(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={() => setSudoModal('normal')}
                className="btn-danger flex items-center gap-2 flex-1 justify-center">
                <Power className="w-4 h-4" /> In {countdown < 60 ? countdown + 's' : countdown/60 + ' Min'} neu starten
              </button>
              <button onClick={() => setSudoModal('sofort')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-400 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                <Power className="w-4 h-4" /> Sofort
              </button>
            </div>

            {sudoModal && (
              <SudoPasswordModal
                title={sudoModal === 'sofort' ? 'Sofort neu starten' : 'Server neu starten'}
                description="sudo-Passwort des Servers eingeben um den Neustart zu bestätigen"
                onConfirm={(user, pass) => {
                  setSudoPass(pass); setSudoUser(user);
                  startReboot(sudoModal === 'sofort' ? 0 : countdown, pass, user);
                }}
                onCancel={() => setSudoModal(false)}
              />
            )}
          </div>
        )}

        {rebooting && (
          <div className="space-y-4">
            {/* Countdown-Ring + Timer */}
            <div className="flex items-center gap-6">
              {timer !== null && (
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#fee2e2" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#ef4444" strokeWidth="8"
                      strokeDasharray={circumference} strokeDashoffset={dashOffset}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-red-600" style={{ fontFamily: 'var(--font-headings)' }}>{timer}</span>
                    <span className="text-xs text-red-500 font-medium">Sek</span>
                  </div>
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm">
                  {timer !== null ? `Server startet in ${timer} Sekunden neu` : '🔄 Server startet jetzt neu...'}
                </p>
                <p className="text-xs text-ink-muted mt-1">📱 {warnedUsers} User per Push gewarnt</p>
                {timer !== null && (
                  <button onClick={cancelReboot} className="mt-3 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors font-medium">
                    <XCircle className="w-3.5 h-3.5" /> Neustart abbrechen
                  </button>
                )}
              </div>
            </div>

            {/* Terminal-Log */}
            <div ref={logRef} className="bg-gray-950 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              {log.map((line, i) => (
                <div key={i} className={`leading-relaxed ${line.startsWith('⚠') ? 'text-amber-400' : line.startsWith('📱') ? 'text-blue-400' : line.startsWith('🔄') || line.startsWith('⏳') ? 'text-emerald-400' : line.startsWith('⏱') ? 'text-gray-400' : 'text-gray-300'}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Benachrichtigungen Section ───────────────────────────────────────────────
function NotificationsSection() {
  const { supported, permission, settings, loading, subscribe, unsubscribe, updateSettings } = usePush();

  if (!supported) return (
    <div className="text-center py-10 text-ink-muted">
      <p className="text-2xl mb-2">🔔</p>
      <p className="font-medium">Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.</p>
      <p className="text-sm mt-1">Bitte verwende Chrome, Firefox oder Safari auf iOS 16.4+.</p>
    </div>
  );

  const isGranted = permission === 'granted' && settings?.hasSubscription;

  const NOTIF_ITEMS = [
    { key: 'pushNewEvent',    label: 'Neue Ereignisse',     desc: 'Übungen, Sitzungen, Einsätze', emoji: '📅' },
    { key: 'pushNewExercise', label: 'Neue Übungen',        desc: 'Abschnitts- und Eigenübungen',  emoji: '🧯' },
    { key: 'pushNewIncident', label: 'Neue Einsätze',       desc: 'Sofort wenn ein Einsatz eingetragen wird', emoji: '🚨' },
    { key: 'pushBirthday',   label: 'Geburtstage',         desc: 'Am Geburtstag eines Kameraden', emoji: '🎂' },
    { key: 'pushUpdate',     label: 'App-Updates',         desc: 'Wenn eine neue Version verfügbar ist', emoji: '🔄' },
  ] as const;

  return (
    <div>
      <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Benachrichtigungen</h2>
      <p className="text-sm text-ink-muted mb-6">Erhalte Push-Benachrichtigungen direkt auf deinem Gerät.</p>

      {/* Aktivieren/Deaktivieren */}
      <div className={`rounded-xl p-4 mb-6 flex items-center justify-between gap-4 ${isGranted ? 'bg-green-50 border border-green-200' : 'bg-surface-50 border border-surface-200'}`}>
        <div>
          <p className="font-semibold text-sm">{isGranted ? '🔔 Benachrichtigungen aktiv' : '🔕 Benachrichtigungen deaktiviert'}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {isGranted
              ? 'Du erhältst Push-Benachrichtigungen auf diesem Gerät.'
              : permission === 'denied'
                ? 'Berechtigung verweigert — bitte in den Browser-Einstellungen erlauben.'
                : 'Aktiviere Benachrichtigungen um keine Ereignisse zu verpassen.'}
          </p>
        </div>
        {permission !== 'denied' && (
          <button
            onClick={isGranted ? unsubscribe : subscribe}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
              isGranted
                ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                : 'bg-fire-700 text-white hover:bg-fire-800'
            } disabled:opacity-50`}
          >
            {loading ? '...' : isGranted ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        )}
      </div>

      {/* iOS Hinweis */}
      {/iphone|ipad/i.test(navigator.userAgent) && !isGranted && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <p className="font-semibold mb-1">📱 iPhone / iPad</p>
          <p>Füge die App zuerst zum Home-Bildschirm hinzu: Safari → Teilen → „Zum Home-Bildschirm". Danach funktionieren Push-Benachrichtigungen.</p>
        </div>
      )}

      {/* Einstellungen pro Typ */}
      {isGranted && settings && (
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Was möchtest du erhalten?</p>
          <div className="divide-y divide-surface-100">
            {NOTIF_ITEMS.map(({ key, label, desc, emoji }) => (
              <div key={key} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-ink-muted">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ [key]: !settings[key] })}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings[key] ? 'bg-fire-700' : 'bg-surface-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Einsatz-Navigation Section ────────────────────────────────────────────────
function NavSection() {
  const [places, setPlaces] = useState<{ label: string; address: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');

  useEffect(() => {
    api.get('/settings/nav-quick-places')
      .then((r: any) => setPlaces(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (updated: { label: string; address: string }[]) => {
    setSaving(true);
    try {
      await api.put('/settings/nav-quick-places', { places: updated });
      setPlaces(updated);
      toast.success('Schnellwahl gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditLabel(places[i].label);
    setEditAddress(places[i].address);
  };

  const confirmEdit = () => {
    if (!editLabel.trim() || !editAddress.trim()) return;
    const updated = places.map((p, i) => i === editIdx ? { label: editLabel.trim(), address: editAddress.trim() } : p);
    save(updated);
    setEditIdx(null);
  };

  const remove = (i: number) => {
    const updated = places.filter((_, idx) => idx !== i);
    save(updated);
  };

  const addPlace = () => {
    if (!newLabel.trim() || !newAddress.trim()) { toast.error('Name und Adresse erforderlich'); return; }
    const updated = [...places, { label: newLabel.trim(), address: newAddress.trim() }];
    save(updated);
    setNewLabel(''); setNewAddress(''); setShowAdd(false);
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const updated = [...places];
    [updated[i - 1], updated[i]] = [updated[i], updated[i - 1]];
    save(updated);
  };

  const moveDown = (i: number) => {
    if (i === places.length - 1) return;
    const updated = [...places];
    [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
    save(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Einsatz-Navigation</h2>
        <p className="text-sm text-ink-muted">Schnellwahl-Ziele für das Navigations-Widget auf dem Dashboard.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted text-sm"><Loader className="w-4 h-4 animate-spin" /> Wird geladen...</div>
      ) : (
        <div className="space-y-2">
          {places.map((p, i) => (
            <div key={i} className="border border-surface-200 rounded-xl overflow-hidden">
              {editIdx === i ? (
                <div className="p-4 space-y-3 bg-fire-50 border-l-4 border-l-fire-600">
                  <div>
                    <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-1">Name</label>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      className="input-field w-full text-sm" placeholder="z.B. Krankenhaus Hermagor" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-1">Adresse</label>
                    <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                      className="input-field w-full text-sm" placeholder="z.B. Möderndorf 1, 9620 Hermagor"
                      onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditIdx(null); }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={confirmEdit} disabled={saving}
                      className="btn-primary text-sm flex items-center gap-1.5">
                      {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Speichern
                    </button>
                    <button onClick={() => setEditIdx(null)} className="btn-secondary text-sm">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-surface-50">
                  <MapPin className="w-4 h-4 text-fire-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{p.label}</p>
                    <p className="text-xs text-ink-muted truncate">{p.address}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveUp(i)} disabled={i === 0}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink disabled:opacity-30 transition-colors" title="Nach oben">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveDown(i)} disabled={i === places.length - 1}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink disabled:opacity-30 transition-colors" title="Nach unten">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startEdit(i)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors" title="Bearbeiten">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(i)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 transition-colors" title="Löschen">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {places.length === 0 && !showAdd && (
            <div className="text-center py-8 text-ink-muted border border-dashed border-surface-300 rounded-xl">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Noch keine Schnellwahl-Einträge</p>
            </div>
          )}

          {showAdd ? (
            <div className="border border-surface-300 rounded-xl p-4 space-y-3 bg-surface-50">
              <p className="text-sm font-semibold text-ink">Neuer Eintrag</p>
              <div>
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-1">Name</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} autoFocus
                  className="input-field w-full text-sm" placeholder="z.B. Feuerwehrhaus Görtschach" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-1">Adresse</label>
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)}
                  className="input-field w-full text-sm" placeholder="z.B. Görtschach 26, 9620 Hermagor-Pressegger See"
                  onKeyDown={e => { if (e.key === 'Enter') addPlace(); }} />
              </div>
              <div className="flex gap-2">
                <button onClick={addPlace} disabled={saving}
                  className="btn-primary text-sm flex items-center gap-1.5">
                  {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Hinzufügen
                </button>
                <button onClick={() => { setShowAdd(false); setNewLabel(''); setNewAddress(''); }}
                  className="btn-secondary text-sm">Abbrechen</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-surface-300 text-sm text-ink-muted hover:text-ink hover:border-surface-400 transition-colors">
              <Plus className="w-4 h-4" /> Eintrag hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  );
}


const SECTIONS: { id: Section; label: string; icon: any; adminOnly?: boolean }[] = [
  { id: 'profile',   label: 'Profil',           icon: User        },
  { id: 'password',  label: 'Passwort',          icon: KeyRound    },
  { id: 'twofactor',     label: 'Zwei-Faktor-Auth',  icon: ShieldCheck },
  { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
  { id: 'push-overview',  label: 'Push-Übersicht User', icon: Bell, adminOnly: true },
  { id: 'permissions', label: 'Berechtigungen',     icon: Shield,   adminOnly: true },
  { id: 'members',   label: 'Kamerad:innen',        icon: Users,    adminOnly: true },
  { id: 'branding',  label: 'Branding',          icon: Palette,  adminOnly: true },
  { id: 'privacy',   label: 'Datenschutz',        icon: Shield,   adminOnly: true },
  { id: 'security',  label: 'Sicherheit',         icon: Shield,   adminOnly: true },
  { id: 'email',     label: 'E-Mail (SMTP)',       icon: Mail,     adminOnly: true },
  { id: 'data',      label: 'Backup',             icon: Download, adminOnly: true },
  { id: 'update',    label: 'Update',             icon: RefreshCw, adminOnly: true },
  { id: 'ai',        label: 'KI & Integrationen',  icon: Bot,      adminOnly: true },
  { id: 'status',    label: 'System-Status',        icon: Activity, adminOnly: true },
  { id: 'papierkorb', label: 'Papierkorb',             icon: Trash2,   adminOnly: true },
  { id: 'diktat',    label: 'Diktat (Whisper)',     icon: Mic,      adminOnly: true },
  { id: 'nav',       label: 'Einsatz-Navigation',   icon: Navigation, adminOnly: true },
];

// ── KI & Integrationen Section ───────────────────────────────────────────────
type AiProvider = 'gemini' | 'groq' | 'openai' | 'ollama';

const AI_PROVIDERS: { id: AiProvider; label: string; emoji: string; desc: string; keyLabel: string; keyPlaceholder: string; link?: string; linkLabel?: string; isUrl?: boolean }[] = [
  { id: 'gemini', label: 'Google Gemini Flash', emoji: '🤖', desc: '1.500 Anfragen/Tag gratis', keyLabel: 'API-Key', keyPlaceholder: 'AIzaSy...', link: 'https://aistudio.google.com/apikey', linkLabel: 'aistudio.google.com/apikey' },
  { id: 'groq',   label: 'Groq API',            emoji: '⚡', desc: '100k Tokens/Tag gratis',   keyLabel: 'API-Key', keyPlaceholder: 'gsk_...',    link: 'https://console.groq.com',       linkLabel: 'console.groq.com' },
  { id: 'openai', label: 'OpenAI (ChatGPT)',     emoji: '🧠', desc: 'GPT-4o-mini · kostenpflichtig', keyLabel: 'API-Key', keyPlaceholder: 'sk-...', link: 'https://platform.openai.com/api-keys', linkLabel: 'platform.openai.com' },
  { id: 'ollama', label: 'Ollama (lokal)',        emoji: '🏠', desc: 'Läuft auf deinem Server · kostenlos', keyLabel: 'Server-URL', keyPlaceholder: 'http://localhost:11434', isUrl: true },
];



// ── Quick Status Bar (oben rechts in Administration) ─────────────────
function QuickStatusBar({ onClickDetail }: { onClickDetail: () => void }) {
  const [svcs, setSvcs] = useState<Record<string, { ok: boolean; label: string }>>({});
  const [loading, setLoading] = useState(true);

  const SERVICE_ORDER = ['backend', 'database', 'cpu', 'disk', 'nginx', 'ollama', 'whisper'];
  const SERVICE_SHORT: Record<string, string> = {
    backend: 'Backend', database: 'DB', cpu: 'CPU', disk: 'HDD', nginx: 'Nginx', ollama: 'Ollama', whisper: 'Whisper',
  };

  const load = useCallback(async () => {
    try {
      const r = await api.get('/settings/system-status');
      setSvcs(r.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const knownSvcs = SERVICE_ORDER.map(k => svcs[k]).filter(Boolean);
  const allOk = knownSvcs.length > 0 && knownSvcs.every(s => s.ok);
  const hasError = knownSvcs.some(s => !s.ok);

  return (
    <button onClick={onClickDetail}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-xl shadow-sm hover:shadow-md transition-all text-xs">
      {loading ? (
        <Loader className="w-3.5 h-3.5 animate-spin text-ink-muted" />
      ) : (
        <>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : hasError ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-medium text-ink-muted hidden sm:inline">
            {allOk ? 'Alle Dienste aktiv' : `${Object.values(svcs).filter(s => !s.ok).length} Fehler`}
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            {SERVICE_ORDER.map(key => svcs[key] ? (
              <div key={key} title={`${SERVICE_SHORT[key]}: ${svcs[key].ok ? 'OK' : 'Fehler'}`}
                className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${svcs[key].ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-ink-muted hidden lg:inline">{SERVICE_SHORT[key]}</span>
              </div>
            ) : null)}
          </div>
        </>
      )}
    </button>
  );
}


function PapierkorbSection() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/einsatzplaene/papierkorb');
      setItems(r.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const restore = async (id: string) => {
    await api.post(`/einsatzplaene/papierkorb/${id}/restore`);
    toast.success('Wiederhergestellt');
    load();
  };

  const deletePermanent = async (id: string) => {
    await api.delete(`/einsatzplaene/papierkorb/${id}`);
    toast.success('Endgültig gelöscht');
    load();
  };

  const deleteAll = async () => {
    if (!window.confirm('Alle Elemente endgültig löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    await api.delete('/einsatzplaene/papierkorb');
    toast.success('Papierkorb geleert');
    load();
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Papierkorb</h2>
          <p className="text-sm text-ink-muted">Gelöschte Einsatzpläne — nur Administratoren können diese sehen und wiederherstellen.</p>
        </div>
        {items.length > 0 && (
          <button onClick={deleteAll}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
            <Trash2 className="w-4 h-4" />
            Alle löschen
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <Trash2 className="w-12 h-12 mx-auto mb-3 text-surface-200" />
          <p className="font-medium text-ink-muted">Papierkorb ist leer</p>
          <p className="text-sm text-ink-muted mt-1">Gelöschte Einsatzpläne erscheinen hier</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item.id} className="card p-4 overflow-hidden">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-semibold text-sm break-words">{item.title}</p>
                  <p className="text-xs text-ink-muted break-all">{item.fileName} · {formatSize(item.fileSize)}</p>
                  {item.folderName && (
                    <p className="text-xs text-ink-muted">Ordner: {item.folderName}</p>
                  )}
                  <p className="text-xs text-ink-muted">
                    Gelöscht: {new Date(item.deletedAt).toLocaleDateString('de-AT')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => restore(item.id)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors">
                  Wiederherstellen
                </button>
                <button onClick={() => deletePermanent(item.id)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gemeinsame Chart-Hilfsfunktionen ─────────────────────────────────────────
const RANGES = [
  { key: '1h',  label: '1h' },
  { key: '24h', label: '24h' },
  { key: '7d',  label: '7d' },
  { key: '30d', label: '30d' },
  { key: '1y',  label: '1J' },
  { key: '2y',  label: '2J' },
  { key: '3y',  label: '3J' },
  { key: 'all', label: 'Gesamt' },
];

const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function formatChartTime(iso: string, range: string): string {
  const d = new Date(iso);
  if (range === '1h') {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } else if (range === '24h') {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } else if (range === '7d') {
    return `${d.getDate()}.${d.getMonth()+1}. ${String(d.getHours()).padStart(2,'0')}h`;
  } else if (range === '30d') {
    return `${d.getDate()}.${d.getMonth()+1}.`;
  } else {
    // 1J, 2J, 3J, all → Monat + Jahr
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
}

function RangeButtons({ range, setRange }: { range: string; setRange: (r: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {RANGES.map(r => (
        <button key={r.key} onClick={() => setRange(r.key)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            range === r.key ? 'bg-fire-700 text-white' : 'bg-surface-100 text-ink-muted hover:bg-surface-200'
          }`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

type SimpleChartDatum = Record<string, number | string | null | undefined> & { time: string };

function chartValue(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildLinePath(data: SimpleChartDatum[], key: string, width: number, height: number, maxValue: number) {
  const padX = 24;
  const padTop = 8;
  const padBottom = 22;
  const plotW = Math.max(1, width - padX * 2);
  const plotH = Math.max(1, height - padTop - padBottom);
  const max = Math.max(1, maxValue);

  const points = data.map((d, i) => {
    const x = padX + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padTop + (1 - Math.min(max, chartValue(d[key])) / max) * plotH;
    return { x, y, label: d.time, value: chartValue(d[key]) };
  });

  return {
    points,
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
    baseline: padTop + plotH,
  };
}

function SimpleLineChart({ data, valueKey, color, unit = '%', height = 120, maxValue = 100 }: {
  data: SimpleChartDatum[];
  valueKey: string;
  color: string;
  unit?: string;
  height?: number;
  maxValue?: number;
}) {
  const width = 640;
  const { points, path } = buildLinePath(data, valueKey, width, height, maxValue);
  const first = points[0]?.label || '';
  const last = points[points.length - 1]?.label || '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]" preserveAspectRatio="none" role="img">
      {[0, 25, 50, 75, 100].map(v => {
        const y = 8 + (1 - v / 100) * (height - 30);
        return <line key={v} x1={24} x2={width - 24} y1={y} y2={y} stroke="#f0f0f0" strokeDasharray="3 3" />;
      })}
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} vectorEffect="non-scaling-stroke">
          <title>{`${p.label}: ${p.value}${unit}`}</title>
        </circle>
      ))}
      <text x={24} y={height - 4} fill="#9ca3af" fontSize="10">{first}</text>
      <text x={width - 24} y={height - 4} fill="#9ca3af" fontSize="10" textAnchor="end">{last}</text>
    </svg>
  );
}

function SimpleAreaChart({ data, totalKey, usedKey, color, height = 100 }: {
  data: SimpleChartDatum[];
  totalKey: string;
  usedKey: string;
  color: string;
  height?: number;
}) {
  const width = 640;
  const maxValue = Math.max(...data.flatMap(d => [chartValue(d[totalKey]), chartValue(d[usedKey])]), 1);
  const used = buildLinePath(data, usedKey, width, height, maxValue);
  const total = buildLinePath(data, totalKey, width, height, maxValue);
  const first = used.points[0]?.label || '';
  const last = used.points[used.points.length - 1]?.label || '';
  const areaPath = used.points.length
    ? `${used.path} L ${used.points[used.points.length - 1].x.toFixed(1)} ${used.baseline.toFixed(1)} L ${used.points[0].x.toFixed(1)} ${used.baseline.toFixed(1)} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[100px]" preserveAspectRatio="none" role="img">
      {[0, 25, 50, 75, 100].map(v => {
        const y = 8 + (1 - v / 100) * (height - 30);
        return <line key={v} x1={24} x2={width - 24} y1={y} y2={y} stroke="#f0f0f0" strokeDasharray="3 3" />;
      })}
      <path d={areaPath} fill={color} opacity={0.25} />
      <path d={total.path} fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={used.path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {used.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} vectorEffect="non-scaling-stroke">
          <title>{`${p.label}: ${p.value} GB belegt`}</title>
        </circle>
      ))}
      <text x={24} y={height - 4} fill="#9ca3af" fontSize="10">{first}</text>
      <text x={width - 24} y={height - 4} fill="#9ca3af" fontSize="10" textAnchor="end">{last}</text>
    </svg>
  );
}

// ── CPU-Diagramm ──────────────────────────────────────────────────────────────
function CpuChart() {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState('1h');
  const [loading, setLoading] = useState(true);

  const load = async (r: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/settings/metrics?range=${r}`);
      setData(res.data.data.map((d: any) => ({
        time: formatChartTime(d.timestamp, r),
        cpu: d.cpuUsage,
      })));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(range); }, [range]);

  const last = data[data.length - 1]?.cpu ?? null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">🖥️ CPU-Auslastung</p>
          {last !== null && <span className="text-xs font-bold text-emerald-600">{last}%</span>}
        </div>
        <RangeButtons range={range} setRange={(r) => { setRange(r); load(r); }} />
      </div>
      {loading ? (
        <div className="h-28 flex items-center justify-center text-ink-muted text-sm animate-pulse">Lade Daten...</div>
      ) : data.length < 2 ? (
        <div className="h-28 flex items-center justify-center text-ink-muted text-sm">Noch zu wenige Daten</div>
      ) : (
        <SimpleLineChart data={data} valueKey="cpu" color="#22c55e" />
      )}
    </div>
  );
}

// ── RAM-Diagramm ──────────────────────────────────────────────────────────────
function RamChart() {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [ramTotalGB, setRamTotalGB] = useState<string | null>(null);

  const load = async (r: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/settings/metrics?range=${r}`);
      const formatted = res.data.data.map((d: any) => ({
        time: formatChartTime(d.timestamp, r),
        ram: d.ramUsage,
        ramTotalGB: (d.ramTotal / 1024 / 1024 / 1024).toFixed(1),
      }));
      setData(formatted);
      if (formatted.length > 0) setRamTotalGB(formatted[formatted.length - 1].ramTotalGB);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(range); }, [range]);

  const last = data[data.length - 1]?.ram ?? null;
  const lastGB = last !== null && ramTotalGB
    ? ((last / 100) * parseFloat(ramTotalGB)).toFixed(1)
    : null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">💾 RAM-Auslastung</p>
          {last !== null && (
            <span className="text-xs font-bold text-blue-600">
              {last}% {lastGB && ramTotalGB ? `(${lastGB} / ${ramTotalGB} GB)` : ''}
            </span>
          )}
        </div>
        <RangeButtons range={range} setRange={(r) => { setRange(r); load(r); }} />
      </div>
      {loading ? (
        <div className="h-28 flex items-center justify-center text-ink-muted text-sm animate-pulse">Lade Daten...</div>
      ) : data.length < 2 ? (
        <div className="h-28 flex items-center justify-center text-ink-muted text-sm">Noch zu wenige Daten</div>
      ) : (
        <SimpleLineChart data={data} valueKey="ram" color="#3b82f6" />
      )}
    </div>
  );
}

// ── Festplatten-Diagramm ──────────────────────────────────────────────────────
const GB = 1024 * 1024 * 1024;
const DISK_COLORS = ['#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];

function DiskChart() {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [current, setCurrent] = useState<Record<string, any>>({});
  const [partitions, setPartitions] = useState<string[]>([]);
  const [range, setRange] = useState('1h');
  const [loading, setLoading] = useState(true);

  const load = async (r: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/settings/disk-metrics?range=${r}`);
      setPartitions(res.data.partitions || []);
      setCurrent(res.data.current || {});
      const formatted: Record<string, any[]> = {};
      for (const part of (res.data.partitions || [])) {
        formatted[part] = (res.data.data[part] || []).map((d: any) => ({
          time: formatChartTime(d.timestamp, r),
          gesamt: parseFloat((d.total / GB).toFixed(2)),
          belegt: parseFloat((d.used / GB).toFixed(2)),
          frei:   parseFloat((d.free / GB).toFixed(2)),
        }));
      }
      setData(formatted);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(range); }, [range]);

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">🗄️ Festplatten-Verlauf</p>
        <RangeButtons range={range} setRange={(r) => { setRange(r); load(r); }} />
      </div>

      {/* Aktuelle Werte als Kacheln */}
      {partitions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {partitions.map((part, i) => {
            const c = current[part];
            if (!c) return null;
            const totalGB = (c.total / GB).toFixed(1);
            const usedGB  = (c.used  / GB).toFixed(1);
            const freeGB  = (c.free  / GB).toFixed(1);
            const pct     = Math.round((c.used / c.total) * 100);
            return (
              <div key={part} className="bg-surface-50 border border-surface-200 rounded-xl p-3">
                <p className="text-xs font-mono font-bold text-ink truncate">{part}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {usedGB} GB belegt · {freeGB} GB frei · {totalGB} GB gesamt
                </p>
                <div className="mt-2 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: DISK_COLORS[i % DISK_COLORS.length] }} />
                </div>
                <p className="text-xs text-right mt-0.5" style={{ color: DISK_COLORS[i % DISK_COLORS.length] }}>{pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="h-28 flex items-center justify-center text-ink-muted text-sm animate-pulse">Lade Daten...</div>
      ) : partitions.length === 0 ? (
        <div className="h-28 flex items-center justify-center text-ink-muted text-sm">Noch keine Daten</div>
      ) : (
        <div className="space-y-4">
          {partitions.map((part, i) => {
            const chartData = data[part] || [];
            const color = DISK_COLORS[i % DISK_COLORS.length];
            return (
              <div key={part}>
                <p className="text-xs font-mono font-semibold text-ink-muted mb-1">{part}</p>
                {chartData.length < 2 ? (
                  <div className="h-20 flex items-center justify-center text-ink-muted text-xs">Noch zu wenige Daten</div>
                ) : (
                  <SimpleAreaChart data={chartData} totalKey="gesamt" usedKey="belegt" color={color} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusSection() {
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const SERVICE_ORDER = ['backend', 'database', 'cpu', 'disk', 'nginx', 'ollama', 'whisper'];
  const SERVICE_ICONS: Record<string, string> = {
    backend:  '⚙️',
    database: '🗄️',
    cpu:      '🖥️',
    disk:     '💾',
    nginx:    '🌐',
    ollama:   '🤖',
    whisper:  '🎙️',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/settings/system-status');
      setStatus(r.data);
      setLastUpdated(new Date());
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // Nur echte Dienste für den Gesamt-Status zählen
  const SERVICES_ONLY = ['backend', 'database', 'cpu', 'disk', 'nginx', 'ollama', 'whisper'];
  const serviceValues = status ? SERVICES_ONLY.map(k => status[k]).filter(Boolean) : [];
  const allOk = serviceValues.length > 0 && serviceValues.every(s => s.ok);
  const failCount = serviceValues.filter(s => !s.ok).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>System-Status</h2>
          <p className="text-sm text-ink-muted">
            {lastUpdated ? `Zuletzt aktualisiert: ${lastUpdated.toLocaleTimeString('de-AT')}` : 'Wird geladen...'}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-surface-100 hover:bg-surface-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Gesamt-Status */}
      {status && (
        <div className={`card p-4 flex items-center gap-4 ${allOk ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-red-500'} ${!allOk ? 'animate-pulse' : ''}`} />
          <div>
            <p className={`font-semibold text-sm ${allOk ? 'text-emerald-800' : 'text-red-800'}`}>
              {allOk ? 'Alle Dienste laufen' : `${failCount} Dienst${failCount > 1 ? 'e' : ''} nicht erreichbar`}
            </p>
            <p className={`text-xs ${allOk ? 'text-emerald-700' : 'text-red-700'}`}>
              {serviceValues.filter(s => s.ok).length} von {serviceValues.length} Dienste aktiv
            </p>
          </div>
        </div>
      )}

      {/* Metriken-Karten */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* RAM */}
          {status.ram && (
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">💾 RAM</p>
              <div className="w-full bg-surface-100 rounded-full h-1.5 mb-1">
                <div className={`h-1.5 rounded-full ${status.ram.percent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${status.ram.percent}%` }} />
              </div>
              <p className="text-xs text-ink-muted">{status.ram.detail}</p>
            </div>
          )}
          {/* Uptime */}
          {status.uptime && (
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">⏱ Laufzeit</p>
              <p className="text-sm font-semibold text-ink">{status.uptime.detail}</p>
            </div>
          )}
          {/* DB Größe */}
          {status.dbsize && (
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">🗄️ Datenbank</p>
              <p className="text-sm font-semibold text-ink">{status.dbsize.detail}</p>
            </div>
          )}
          {/* Aktive User */}
          {status.activeUsers && (
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">👤 Aktive User</p>
              <p className="text-sm font-semibold text-ink">{status.activeUsers.count ?? '–'} <span className="text-xs font-normal text-ink-muted">/ 24h</span></p>
            </div>
          )}
          {/* Verbindungen */}
          {status.connections && (
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">🔗 Verbindungen</p>
              <p className="text-sm font-semibold text-ink">{status.connections.count ?? '–'} <span className="text-xs font-normal text-ink-muted">TCP</span></p>
            </div>
          )}
          {/* Letztes Backup */}
          {status.lastBackup && (
            <div className={`card p-3 ${!status.lastBackup.ok ? 'border-amber-200 bg-amber-50' : ''}`}>
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">📦 Letztes Backup</p>
              <p className="text-xs font-medium text-ink">{status.lastBackup.detail}</p>
            </div>
          )}
        </div>
      )}

      {/* CPU-Diagramm */}
      <CpuChart />
      {/* RAM-Diagramm */}
      <RamChart />
      {/* Festplatten-Diagramm */}
      <DiskChart />

      {/* Einzelne Services */}
      <div className="card divide-y divide-surface-100">
        {loading && !status ? (
          Array.from({length: 5}).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-surface-200 flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-surface-200 rounded w-24 mb-1" />
                <div className="h-3 bg-surface-100 rounded w-40" />
              </div>
            </div>
          ))
        ) : status ? (
          SERVICE_ORDER.map(key => {
            const svc = status[key];
            if (!svc) return null;
            return (
              <div key={key} className="p-4 flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${svc.ok ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{SERVICE_ICONS[key]}</span>
                    <p className="font-semibold text-sm">{svc.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      svc.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {svc.ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{svc.detail}</p>
                </div>
              </div>
            );
          })
        ) : null}
      </div>

      <p className="text-xs text-ink-muted text-center">
        Automatische Aktualisierung alle 60 Sekunden
      </p>
    </div>
  );
}

function AiSection() {
  const [keys, setKeys] = useState<Record<AiProvider, string>>({ gemini: '', groq: '', openai: '', ollama: '' });
  const [ollamaModel, setOllamaModel] = useState('gemma2:2b');

  const saveOllamaModel = async (model: string) => {
    setOllamaModel(model);
    try {
      await api.post('/settings/ollama-url', { ollamaUrl: keys.ollama || null, ollamaModel: model });
      toast.success('Modell gespeichert: ' + model);
    } catch { toast.error('Fehler beim Speichern des Modells'); }
  };
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [ollamaInstalling, setOllamaInstalling] = useState(false);
  const [ollamaInstallLog, setOllamaInstallLog] = useState('');
  const [ollamaPulling, setOllamaPulling] = useState(false);
  const [ollamaPullLog, setOllamaPullLog] = useState('');
  const [ollamaPullDone, setOllamaPullDone] = useState(false);
  const [ollamaPullPercent, setOllamaPullPercent] = useState<number | null>(null);
  const [show, setShow] = useState<Record<AiProvider, boolean>>({ gemini: false, groq: false, openai: false, ollama: false });
  const [activeProvider, setActiveProvider] = useState<AiProvider>('gemini');
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ollamaLive, setOllamaLive] = useState<{
    isInstalled: boolean; isRunning: boolean; models: string[];
    runningModel: string | null; runningModelSize: number | null;
  } | null>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      setKeys({
        gemini: r.data.geminiApiKey || '',
        groq:   r.data.groqApiKey   || '',
        openai: r.data.openaiApiKey  || '',
        ollama: r.data.ollamaUrl     || '',
      });
      if (r.data.ollamaModel) setOllamaModel(r.data.ollamaModel);
      if (r.data.activeAiProvider) setActiveProvider(r.data.activeAiProvider as AiProvider);
      setLoaded(true);
    }).catch(() => setLoaded(true));

    // Ollama Live-Status laden
    const loadLiveStatus = () => {
      api.get('/settings/ollama-live-status').then(r => setOllamaLive(r.data)).catch(() => {});
    };
    loadLiveStatus();
    const liveInterval = setInterval(loadLiveStatus, 10000);

    // Ollama-Installationsstatus prüfen
    api.get('/settings/ollama-status').then(r => {
      setOllamaInstalled(r.data.isInstalled);
      if (r.data.running) { setOllamaInstalling(true); pollInstallStatus(); }
    }).catch(() => {});
  }, []);

  const pollInstallStatus = () => {
    const interval = setInterval(async () => {
      try {
        const r = await api.get('/settings/ollama-status');
        setOllamaInstallLog(r.data.log || '');
        if (!r.data.running) {
          clearInterval(interval);
          setOllamaInstalling(false);
          setOllamaInstalled(r.data.isInstalled || r.data.success);
          if (r.data.success) toast.success('Ollama erfolgreich installiert!');
          else toast.error('Installation fehlgeschlagen — siehe Log');
        }
      } catch { clearInterval(interval); }
    }, 2000);
  };

  const installOllama = async () => {
    setOllamaInstalling(true);
    setOllamaInstallLog('');
    try {
      await api.post('/settings/ollama-install', {});
      pollInstallStatus();
    } catch { toast.error('Fehler beim Starten der Installation'); setOllamaInstalling(false); }
  };

  const pullModel = async () => {
    setOllamaPulling(true);
    setOllamaPullLog('');
    setOllamaPullDone(false);
    setOllamaPullPercent(null);
    try {
      const token = localStorage.getItem('token');
      const es = new EventSource(`/api/settings/ollama-pull-stream?model=${encodeURIComponent(ollamaModel)}&auth=${encodeURIComponent(token || '')}`);

      es.onmessage = (e) => {
        try {
          const json = JSON.parse(e.data);
          if (json.error) {
            toast.error(json.error);
            setOllamaPulling(false);
            es.close();
            return;
          }
          if (json.status) {
            setOllamaPullLog(prev => prev + json.status + '\n');
          }
          if (json.percent !== null && json.percent !== undefined) {
            setOllamaPullPercent(json.percent);
          }
          if (json.done) {
            es.close();
            setOllamaPulling(false);
            setOllamaPullDone(true);
            setOllamaPullPercent(100);
            if (json.status === 'success') toast.success(`Modell ${ollamaModel} geladen!`);
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        setOllamaPulling(false);
        toast.error('Verbindung unterbrochen');
      };
    } catch { toast.error('Fehler beim Starten des Downloads'); setOllamaPulling(false); }
  };

  const saveKey = async (provider: AiProvider) => {
    setSaving(provider);
    try {
      const endpointMap: Record<AiProvider, string> = {
        gemini: '/settings/gemini-key',
        groq:   '/settings/groq-key',
        openai: '/settings/openai-key',
        ollama: '/settings/ollama-url',
      };
      const bodyMap: Record<AiProvider, object> = {
        gemini: { geminiApiKey: keys.gemini || null },
        groq:   { groqApiKey:   keys.groq   || null },
        openai: { openaiApiKey: keys.openai  || null },
        ollama: { ollamaUrl:    keys.ollama  || null, ollamaModel: ollamaModel || 'gemma2:2b' },
      };
      await api.post(endpointMap[provider], bodyMap[provider]);
      toast.success('Gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(null); }
  };

  const selectProvider = async (provider: AiProvider) => {
    if (!keys[provider]) { toast.error('Bitte zuerst Key/URL eintragen und speichern'); return; }
    try {
      await api.post('/settings/active-ai-provider', { provider });
      setActiveProvider(provider);
      setTestResult(null);
      toast.success(`${AI_PROVIDERS.find(p => p.id === provider)?.label} ist jetzt aktiv`);
    } catch { toast.error('Fehler beim Aktivieren'); }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      // Stream-Endpunkt testen — nach erstem Token sofort abbrechen
      const controller = new AbortController();
      const token = localStorage.getItem('token');
      const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
      const res = await fetch(`${baseUrl}/api/ai/jahresbericht/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ year: new Date().getFullYear(), sectionKey: 'vorwort', instruction: 'Test', currentText: '',
          stats: { activeMembers: 5, youthMembers: 0, reserveMembers: 0, honorMembers: 0,
            newMembers: 0, totalIncidents: 1, fireIncidents: 1, technicalIncidents: 0,
            waterIncidents: 0, otherIncidents: 0, totalEvents: 3, avgAttendance: 4,
            totalTrips: 5, totalKm: '150', fuelCost: 'keine Daten',
            activeEquipment: 3, checksPerformed: 0, openDefects: 0, totalHonors: 0, honorDetails: '' } }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      // Ersten Token lesen — dann sofort abbrechen
      const reader = res.body?.getReader();
      if (reader) {
        await reader.read();
        controller.abort();
        reader.releaseLock();
      }
      setTestResult('ok');
      toast.success('KI ist bereit!');
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // Absichtlich abgebrochen nach erstem Token — das ist OK
        setTestResult('ok');
        toast.success('KI ist bereit!');
      } else {
        setTestResult('error');
        toast.error(e?.message || 'Verbindung fehlgeschlagen');
      }
    }
    finally { setTesting(false); }
  };

  if (!loaded) return <div className="flex justify-center py-10"><span className="w-6 h-6 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" /></div>;

  const activeProv = AI_PROVIDERS.find(p => p.id === activeProvider);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>KI-Integration</h2>
        <p className="text-sm text-ink-muted">Wähle einen KI-Dienst für automatische Textgenerierung im Jahresbericht.</p>
      </div>

      {/* Aktiver Provider Status */}
      <div className={`flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-2.5 border ${testResult === 'error' ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
        <CheckCircle className="w-4 h-4" />
        <span>Aktiv: <strong>{activeProv?.emoji} {activeProv?.label}</strong></span>
        {testResult === 'ok' && <span className="ml-auto text-xs">✓ Verbindung OK</span>}
        {testResult === 'error' && <span className="ml-auto text-xs text-red-600">✗ Verbindung fehlgeschlagen</span>}
      </div>

      {/* Provider Cards */}
      <div className="space-y-3">
        {AI_PROVIDERS.map(prov => {
          const isActive = activeProvider === prov.id;
          return (
            <div key={prov.id} className={`rounded-2xl border-2 overflow-hidden transition-all ${isActive ? 'border-emerald-500 shadow-md' : 'border-surface-200'}`}>
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b ${isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-surface-50 border-surface-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg">{prov.emoji}</div>
                  <div>
                    <p className="font-bold text-ink text-sm">{prov.label}</p>
                    <p className={`text-xs font-medium ${isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>{prov.desc}</p>
                  </div>
                </div>
                {/* Häkchen-Button */}
                <button
                  onClick={() => selectProvider(prov.id)}
                  title={isActive ? 'Aktiver Anbieter' : 'Diesen Anbieter aktivieren'}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow'
                      : 'border-surface-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-400'
                  }`}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>

              {/* Key/URL Input */}
              <div className="p-4 space-y-3 bg-white">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{prov.keyLabel}</label>
                  <div className="relative">
                    <input
                      type={prov.isUrl ? 'text' : (show[prov.id] ? 'text' : 'password')}
                      value={keys[prov.id]}
                      onChange={e => setKeys(k => ({ ...k, [prov.id]: e.target.value }))}
                      placeholder={prov.keyPlaceholder}
                      className="input-field pr-10 font-mono text-sm"
                      autoComplete="off"
                    />
                    {!prov.isUrl && (
                      <button type="button" onClick={() => setShow(s => ({ ...s, [prov.id]: !s[prov.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                        {show[prov.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {prov.link && (
                    <p className="text-xs text-ink-muted mt-1">
                      Key holen auf <a href={prov.link} target="_blank" rel="noreferrer" className="text-fire-700 underline">{prov.linkLabel}</a>
                    </p>
                  )}
                </div>

                {/* Ollama Modell-Auswahl */}
                {prov.id === 'ollama' && (
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Modell</label>
                    <div className="flex gap-2">
                      <select
                        value={ollamaModel}
                        onChange={e => saveOllamaModel(e.target.value)}
                        className="input-field text-sm flex-1"
                      >
                        <option value="llama3">llama3 (~8 GB RAM)</option>
                        <option value="llama3.2:3b">llama3.2:3b (~4 GB RAM)</option>
                        <option value="phi3">phi3 (~2.4 GB RAM)</option>
                        <option value="phi3.5">phi3.5 (~2.4 GB RAM)</option>
                        <option value="mistral">mistral (~6 GB RAM)</option>
                        <option value="gemma2:2b">gemma2:2b (~3 GB RAM)</option>
                        <option value="custom">Eigenes Modell...</option>
                      </select>
                    </div>
                    {ollamaModel === 'custom' && (
                      <input
                        type="text"
                        placeholder="z.B. llama3.1:8b"
                        className="input-field font-mono text-sm mt-2"
                        onChange={e => setOllamaModel(e.target.value)}
                      />
                    )}
                    <p className="text-xs text-ink-muted mt-1">
                      Verfügbare Modelle: <code className="bg-surface-100 px-1 rounded">ollama list</code> im Terminal
                    </p>
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                      <p className="font-semibold">💡 Hinweis zur Geschwindigkeit (ohne GPU):</p>
                      <p><strong>gemma2:2b</strong> — empfohlen · ~10–20 Sek · 2.6B Parameter · ~3 GB RAM</p>
                      <p><strong>llama3</strong> — langsam ohne GPU · 40–80 Sek · 8B Parameter · ~8 GB RAM</p>
                      <p>Ohne dedizierte GPU (NVIDIA/AMD) sind kleinere Modelle wie <strong>gemma2:2b</strong> deutlich schneller und für Jahresberichte völlig ausreichend. Mit GPU wäre auch llama3 in 2–3 Sekunden fertig.</p>
                    </div>
                  </div>
                )}

                {/* Ollama Install + Pull Buttons */}
                {prov.id === 'ollama' && (
                  <div className="space-y-3 pt-1 border-t border-surface-100">
                    {/* Live Status Block */}
                    {ollamaLive ? (
                      <div className={`rounded-xl p-3 text-xs space-y-2 border ${
                        ollamaLive.isRunning ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-50 border-surface-200'
                      }`}>
                        {/* Zeile 1: Dienst */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ollamaLive.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-surface-300'}`} />
                            <span className="font-semibold">
                              {!ollamaLive.isInstalled ? 'Nicht installiert' : ollamaLive.isRunning ? 'Dienst läuft' : 'Dienst gestoppt'}
                            </span>
                          </div>
                          {ollamaLive.isRunning && (
                            <span className="text-emerald-700 font-medium">● online</span>
                          )}
                        </div>
                        {/* Zeile 2: Geladene Modelle */}
                        {ollamaLive.isRunning && ollamaLive.models.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-ink-muted w-24 flex-shrink-0">Modelle:</span>
                            <span className="text-ink font-mono">{ollamaLive.models.join(', ')}</span>
                          </div>
                        )}
                        {ollamaLive.isRunning && ollamaLive.models.length === 0 && (
                          <div className="text-amber-700">⚠ Kein Modell heruntergeladen — bitte Modell laden</div>
                        )}
                        {/* Zeile 3: Aktiv im RAM */}
                        {ollamaLive.runningModel ? (
                          <div className="flex items-center gap-2">
                            <span className="text-ink-muted w-24 flex-shrink-0">Im RAM:</span>
                            <span className="text-emerald-700 font-semibold font-mono">{ollamaLive.runningModel}</span>
                            {ollamaLive.runningModelSize && (
                              <span className="text-ink-muted">({Math.round(ollamaLive.runningModelSize / 1024 / 1024 / 1024 * 10) / 10} GB)</span>
                            )}
                          </div>
                        ) : ollamaLive.isRunning && (
                          <div className="flex items-center gap-2">
                            <span className="text-ink-muted w-24 flex-shrink-0">Im RAM:</span>
                            <span className="text-ink-muted italic">Kein Modell aktiv</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ollamaInstalled ? 'bg-emerald-500' : 'bg-surface-300'}`} />
                        <span className="text-xs text-ink-muted">
                          {ollamaInstalled === null ? 'Status wird geprüft...' : ollamaInstalled ? 'Ollama ist installiert' : 'Ollama ist nicht installiert'}
                        </span>
                      </div>
                    )}

                    {/* Install Button */}
                    {!ollamaInstalled && (
                      <button
                        onClick={installOllama}
                        disabled={ollamaInstalling}
                        className="btn-primary flex items-center gap-2 text-sm w-full justify-center"
                      >
                        {ollamaInstalling
                          ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Wird installiert...</>
                          : '⬇ Ollama installieren'
                        }
                      </button>
                    )}

                    {/* Install Log */}
                    {ollamaInstallLog && (
                      <pre className="text-xs bg-ink text-emerald-400 rounded-xl p-3 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                        {ollamaInstallLog.slice(-1500)}
                      </pre>
                    )}

                    {/* Pull Model Button — nur wenn Ollama installiert */}
                    {ollamaInstalled && (() => {
                      const modelBase = ollamaModel?.split(':')[0] || '';
                      const isInstalled = ollamaLive?.models?.some(m =>
                        m === ollamaModel || m.startsWith(modelBase + ':') || m === modelBase
                      ) ?? false;
                      return (
                      <>
                        <button
                          onClick={pullModel}
                          disabled={ollamaPulling || !ollamaModel || ollamaModel === 'custom'}
                          className="btn-secondary flex items-center gap-2 text-sm w-full justify-center"
                        >
                          {ollamaPulling
                            ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Modell wird geladen...</>
                            : ollamaPullDone
                              ? `✓ ${ollamaModel} geladen`
                              : isInstalled
                                ? `🔄 Modell "${ollamaModel}" aktualisieren`
                                : `⬇ Modell "${ollamaModel}" herunterladen`
                          }
                        </button>
                        {isInstalled && !ollamaPulling && !ollamaPullDone && (
                          <p className="text-xs text-emerald-600 text-center">✓ Bereits installiert</p>
                        )}
                        {(ollamaPulling || ollamaPullDone) && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-ink-muted">
                              <span>{ollamaPullDone ? '✓ Abgeschlossen' : 'Wird heruntergeladen...'}</span>
                              {ollamaPullPercent !== null && <span className="font-mono font-semibold">{ollamaPullPercent}%</span>}
                            </div>
                            <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${ollamaPullDone ? 'bg-emerald-500' : 'bg-fire-600'}`}
                                style={{ width: `${ollamaPullPercent ?? (ollamaPulling ? 5 : 0)}%` }}
                              />
                            </div>
                            {ollamaPullLog && (
                              <pre className="text-xs bg-gray-950 text-emerald-400 rounded-xl p-3 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                                {ollamaPullLog}
                              </pre>
                            )}
                          </div>
                        )}
                      </>
                      );
                    })()}
                  </div>
                )}
                <button
                  onClick={() => saveKey(prov.id)}
                  disabled={saving === prov.id || !keys[prov.id]}
                  className="btn-secondary flex items-center gap-2 text-sm justify-center w-full"
                >
                  {saving === prov.id ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Speichern
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Test Button */}
      <button onClick={test} disabled={testing}
        className="btn-secondary flex items-center gap-2 w-full justify-center">
        {testing ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Bot className="w-4 h-4" />}
        Aktiven Anbieter testen
      </button>

      {/* Token-Übersicht */}
      <AiUsageStats />

      {/* Ressourcen-Limits */}
      <ResourceLimitsSection />
    </div>
  );
}

// ── AI Token-Übersicht ────────────────────────────────────────────────────────
function AiUsageStats() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const FUNCTION_LABELS: Record<string, string> = {
    jahresbericht: 'Jahresbericht (komplett)',
    jahresbericht_section: 'Jahresbericht (Abschnitt)',
    diktat: 'Diktat / Spracheingabe',
  };

  const PROVIDER_LABELS: Record<string, string> = {
    openai: 'OpenAI (ChatGPT)',
    gemini: 'Google Gemini',
    groq: 'Groq',
    ollama: 'Ollama (lokal)',
  };

  useEffect(() => {
    api.get('/settings/ai-usage')
      .then((r: any) => setUsage(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!usage || usage.totalRequests === 0) return (
    <div className="card p-5">
      <h3 className="font-bold text-ink text-base mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Token-Übersicht</h3>
      <p className="text-sm text-ink-muted">Noch keine KI-Anfragen aufgezeichnet.</p>
    </div>
  );

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink text-base" style={{ fontFamily: 'var(--font-headings)' }}>Token-Übersicht</h3>
        <span className="text-xs text-ink-muted">{usage.totalRequests} Anfragen gesamt</span>
      </div>

      {/* Pro Anbieter */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Gesamt pro Anbieter</p>
        <div className="space-y-2">
          {Object.entries(usage.byProvider).map(([provider, stats]: [string, any]) => (
            <div key={provider} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-ink">{PROVIDER_LABELS[provider] || provider}</p>
                <p className="text-xs text-ink-muted">{stats.requests} Anfragen · {stats.inputTokens.toLocaleString()} Input · {stats.outputTokens.toLocaleString()} Output</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-ink">{stats.totalTokens.toLocaleString()}</p>
                <p className="text-xs text-ink-muted">Tokens</p>
              </div>
            </div>
          ))}
        </div>
        {usage.byProvider['openai'] && (
          <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            → Echte Kosten im OpenAI Dashboard ansehen
          </a>
        )}
      </div>

      {/* Pro Funktion */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Aufschlüsselung nach Funktion</p>
        <div className="space-y-3">
          {Object.entries(usage.byFunction).map(([fn, providers]: [string, any]) => (
            <div key={fn} className="border border-surface-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-surface-50 border-b border-surface-100">
                <p className="text-xs font-semibold text-ink">{FUNCTION_LABELS[fn] || fn}</p>
              </div>
              {Object.entries(providers).map(([provider, stats]: [string, any]) => (
                <div key={provider} className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs text-ink-muted">{PROVIDER_LABELS[provider] || provider}</p>
                  <p className="text-xs font-mono text-ink">{stats.requests}× · {stats.totalTokens.toLocaleString()} Tokens</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ressourcen-Limits Section ─────────────────────────────────────────────────
function ResourceLimitsSection() {
  const [limits, setLimits] = useState({
    ollamaCpuLimit: 80, ollamaRamLimit: 4,
    whisperCpuLimit: 80, whisperRamLimit: 4,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [totalRamGB, setTotalRamGB] = useState(16); // Fallback 16 GB

  useEffect(() => {
    api.get('/settings/resource-limits').then(r => {
      setLimits(r.data);
      setLoaded(true);
    }).catch(() => setLoaded(true));

    // Verfügbaren RAM vom Server laden
    api.get('/settings/system-status').then(r => {
      const ramTotal = r.data?.ram?.total;
      if (ramTotal) {
        const gb = Math.ceil(ramTotal / 1024 / 1024 / 1024);
        setTotalRamGB(gb);
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings/resource-limits', limits);
      toast.success('Ressourcen-Limits gespeichert — Ollama wird neu gestartet...');
    } catch { toast.error('Fehler beim Speichern'); }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="card p-5 space-y-5">
      <div>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">⚙️ Ressourcen-Limits</p>
        <p className="text-xs text-ink-muted">Begrenzt CPU und RAM für Ollama und Whisper damit das System stabil bleibt.</p>
      </div>

      {/* Ollama */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">🤖 Ollama (lokale KI)</p>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-ink-muted">CPU-Limit</label>
            <span className="text-xs font-bold text-ink">{limits.ollamaCpuLimit}%</span>
          </div>
          <input type="range" min={10} max={100} step={5} value={limits.ollamaCpuLimit}
            onChange={e => setLimits(prev => ({ ...prev, ollamaCpuLimit: parseInt(e.target.value) }))}
            className="w-full accent-fire-700" />
          <div className="flex justify-between text-xs text-ink-muted mt-0.5"><span>10%</span><span>100%</span></div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-ink-muted">RAM-Limit</label>
            <span className="text-xs font-bold text-ink">{limits.ollamaRamLimit} GB</span>
          </div>
          <input type="range" min={1} max={totalRamGB} step={1} value={limits.ollamaRamLimit}
            onChange={e => setLimits(prev => ({ ...prev, ollamaRamLimit: parseInt(e.target.value) }))}
            className="w-full accent-fire-700" />
          <div className="flex justify-between text-xs text-ink-muted mt-0.5"><span>1 GB</span><span>{totalRamGB} GB</span></div>
        </div>
      </div>

      {/* Whisper */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">🎙️ Whisper (Diktat)</p>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-ink-muted">CPU-Limit</label>
            <span className="text-xs font-bold text-ink">{limits.whisperCpuLimit}%</span>
          </div>
          <input type="range" min={10} max={100} step={5} value={limits.whisperCpuLimit}
            onChange={e => setLimits(prev => ({ ...prev, whisperCpuLimit: parseInt(e.target.value) }))}
            className="w-full accent-fire-700" />
          <div className="flex justify-between text-xs text-ink-muted mt-0.5"><span>10%</span><span>100%</span></div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-ink-muted">RAM-Limit</label>
            <span className="text-xs font-bold text-ink">{limits.whisperRamLimit} GB</span>
          </div>
          <input type="range" min={1} max={totalRamGB} step={1} value={limits.whisperRamLimit}
            onChange={e => setLimits(prev => ({ ...prev, whisperRamLimit: parseInt(e.target.value) }))}
            className="w-full accent-fire-700" />
          <div className="flex justify-between text-xs text-ink-muted mt-0.5"><span>1 GB</span><span>{totalRamGB} GB</span></div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-800">⚠️ Whisper-RAM-Limit wird beim nächsten Service-Neustart wirksam. Ollama wird sofort neu gestartet.</p>
      </div>

      <button onClick={save} disabled={saving}
        className="btn-primary flex items-center gap-2 w-full justify-center">
        {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Speichern...</> : <><Save className="w-4 h-4" /> Limits speichern</>}
      </button>
    </div>
  );
}


// ── Berechtigungen eingebettet ───────────────────────────────────────────────
const PERM_AREAS = [
  // Hauptmenü
  { key: 'dashboard',              label: 'Dashboard',                    group: '' },
  { key: 'incidents',              label: 'Einsätze',                     group: '' },
  { key: 'einsatzplaene',          label: 'Einsatzpläne',                 group: '' },
  { key: 'exercises',              label: 'Übungen',                      group: '' },
  { key: 'org_events',             label: 'Ereignisse',                   group: '' },
  { key: 'members',                label: 'Kamerad:innen',                group: '' },
  { key: 'calendar',               label: 'Kalender Allgemein',           group: '' },
  { key: 'birthdays',              label: 'Geburtstage',                  group: '' },
  { key: 'honors',                 label: 'Ehrungen',                     group: '' },
  // Dokumentation Allgemein
  { key: 'vehicles',               label: 'Fahrtenbuch',                  group: 'Dokumentation Allgemein' },
  { key: 'equipment',              label: 'Gerätebuch',                   group: 'Dokumentation Allgemein' },
  { key: 'documents_public',       label: 'Dokumente Allgemein',          group: 'Dokumentation Allgemein' },
  // Verwaltung Kommando
  { key: 'calendar_command',       label: 'Kalender Kommando',            group: 'Verwaltung Kommando' },
  { key: 'kommando_termine',       label: 'Kommandotermine',              group: 'Verwaltung Kommando' },
  { key: 'documents_command',      label: 'Verwaltung Kommando',           group: 'Verwaltung Kommando' },
  { key: 'protocols',              label: 'Protokolle',                   group: 'Verwaltung Kommando' },
  { key: 'reports',                label: 'Berichte',                     group: 'Verwaltung Kommando' },
  { key: 'jahresbericht',          label: 'Jahresbericht',                group: 'Verwaltung Kommando' },
  { key: 'berichte_kameradschaft', label: 'Berichte Kameradschaftsführer', group: 'Verwaltung Kommando' },
  { key: 'berichte_kassier',       label: 'Berichte Kassier',             group: 'Verwaltung Kommando' },
  { key: 'schriftverkehr',         label: 'Schriftverkehr',               group: 'Verwaltung Kommando' },
  { key: 'administration',         label: 'Administration',               group: '' },
];
const PERM_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];
const PERM_ACTION_LABELS: Record<string,string> = { VIEW:'Anzeigen', CREATE:'Erstellen', EDIT:'Bearbeiten', DELETE:'Löschen' };

type PermEntry = { area: string; action: string };
type PermGroup = { id: string; name: string; description: string; permissions: PermEntry[]; members: any[] };

function PermissionsSectionEmbed() {
  const [tab, setTab] = useState<'groups' | 'users'>('groups');
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<PermGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userPerms, setUserPerms] = useState<Record<string, PermEntry[]>>({});

  useEffect(() => { loadPerms(); }, []);

  const loadPerms = async () => {
    setLoading(true);
    try {
      const [gRes, uRes] = await Promise.all([api.get('/permissions/groups'), api.get('/users')]);
      setGroups(gRes.data);
      setUsers((uRes.data.users || uRes.data || []).filter((u: any) => u.role !== 'ADMIN'));
    } catch { toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  };

  const hasPerm = (perms: PermEntry[], area: string, action: string) => perms.some(p => p.area === area && p.action === action);
  const togglePerm = (perms: PermEntry[], area: string, action: string): PermEntry[] =>
    hasPerm(perms, area, action) ? perms.filter(p => !(p.area === area && p.action === action)) : [...perms, { area, action }];

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setSaving(true);
    try {
      await api.post('/permissions/groups', { name: newGroupName, description: newGroupDesc, permissions: [] });
      toast.success('Gruppe erstellt'); setNewGroupName(''); setNewGroupDesc(''); setShowNewGroup(false); loadPerms();
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const saveGroup = async (group: PermGroup) => {
    setSaving(true);
    try { await api.put(`/permissions/groups/${group.id}`, group); toast.success('Gespeichert'); setEditingGroup(null); loadPerms(); }
    catch { toast.error('Fehler'); } finally { setSaving(false); }
  };

  const saveUserPerms = async (userId: string) => {
    setSaving(true);
    try { await api.put(`/permissions/users/${userId}`, { permissions: userPerms[userId] || [] }); toast.success('Gespeichert'); }
    catch { toast.error('Fehler'); } finally { setSaving(false); }
  };

  const PermMatrix = ({ perms, onChange }: { perms: PermEntry[]; onChange: (p: PermEntry[]) => void }) => {
    const allSelected = PERM_AREAS.every(a => PERM_ACTIONS.every(ac => hasPerm(perms, a.key, ac)));
    const selectAll = () => {
      const all: PermEntry[] = [];
      PERM_AREAS.forEach(a => PERM_ACTIONS.forEach(ac => all.push({ area: a.key, action: ac })));
      onChange(all);
    };
    const selectNone = () => onChange([]);
    const toggleRow = (areaKey: string) => {
      const rowAll = PERM_ACTIONS.every(ac => hasPerm(perms, areaKey, ac));
      if (rowAll) onChange(perms.filter(p => p.area !== areaKey));
      else {
        const next = perms.filter(p => p.area !== areaKey);
        PERM_ACTIONS.forEach(ac => next.push({ area: areaKey, action: ac }));
        onChange(next);
      }
    };
    const toggleCol = (action: string) => {
      const colAll = PERM_AREAS.every(a => hasPerm(perms, a.key, action));
      if (colAll) onChange(perms.filter(p => p.action !== action));
      else {
        const next = perms.filter(p => p.action !== action);
        PERM_AREAS.forEach(a => { if (!hasPerm(perms, a.key, action)) next.push({ area: a.key, action }); });
        onChange(next);
      }
    };
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
            ✓ Alle auswählen
          </button>
          <button onClick={selectNone} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
            ✗ Alle abwählen
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr>
              <th className="text-left py-1 pr-3 text-ink-muted font-medium">Bereich</th>
              {PERM_ACTIONS.map(a => (
                <th key={a} className="text-center py-1 px-1.5 text-ink-muted font-medium w-16">
                  <button onClick={() => toggleCol(a)} className="hover:text-fire-700 transition-colors" title={`Spalte ${PERM_ACTION_LABELS[a]} umschalten`}>
                    {PERM_ACTION_LABELS[a]}
                  </button>
                </th>
              ))}
            </tr></thead>
            <tbody>{PERM_AREAS.map((area, i) => (
              <tr key={area.key} className={i % 2 === 0 ? 'bg-surface-50' : ''}>
                <td className="py-1 pr-3 text-ink font-medium">
                  <button onClick={() => toggleRow(area.key)} className="hover:text-fire-700 transition-colors text-left" title="Zeile umschalten">
                    {area.label}
                  </button>
                </td>
                {PERM_ACTIONS.map(action => (
                  <td key={action} className="text-center py-1 px-1.5">
                    <button onClick={() => onChange(togglePerm(perms, area.key, action))}
                      className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-colors ${hasPerm(perms, area.key, action) ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-transparent hover:bg-surface-300'}`}>
                      <Check className="w-3 h-3" />
                    </button>
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-10"><Loader className="w-6 h-6 animate-spin text-fire-700" /></div>;

  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Berechtigungen</h2>
        <p className="text-sm text-ink-muted">Gruppen und individuelle Benutzerrechte verwalten</p></div>
      <div className="flex gap-2 border-b border-surface-200">
        {([['groups','Gruppen'], ['users','Individuelle Rechte']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-fire-700 text-fire-700' : 'border-transparent text-ink-muted hover:text-ink'}`}>{l}</button>
        ))}
      </div>

      {tab === 'groups' && <div className="space-y-3">
        <div className="flex justify-end"><button onClick={() => setShowNewGroup(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Neue Gruppe</button></div>
        {showNewGroup && <div className="card p-4 space-y-3 border-fire-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Name *</label>
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="input-field" placeholder="z.B. Kassier" /></div>
            <div><label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Beschreibung</label>
              <input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} className="input-field" placeholder="Optional" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewGroup(false)} className="btn-secondary text-sm">Abbrechen</button>
            <button onClick={createGroup} disabled={saving || !newGroupName} className="btn-primary text-sm flex items-center gap-2">
              {saving && <Loader className="w-3.5 h-3.5 animate-spin" />} Erstellen</button>
          </div>
        </div>}
        {groups.length === 0 ? <div className="card p-8 text-center text-ink-muted"><Shield className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Noch keine Gruppen</p></div> :
          groups.map(group => {
            const isEditing = editingGroup?.id === group.id;
            return <div key={group.id} className="card overflow-hidden">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-fire-700 flex-shrink-0" />
                  <span className="font-semibold text-ink text-sm flex-1 min-w-0">{group.name}</span>
                  {group.description && <span className="text-xs text-ink-muted">— {group.description}</span>}
                  <span className="text-xs text-ink-muted bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0">{group.members.length} Mitglieder</span>
                </div>
                <div className="flex gap-2 justify-end">
                  {isEditing ? <>
                    <button onClick={() => setEditingGroup(null)} className="btn-secondary text-xs py-1 px-2">Abbrechen</button>
                    <button onClick={() => saveGroup(editingGroup!)} disabled={saving} className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                      {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Speichern</button>
                  </> : <>
                    <button onClick={() => setEditingGroup({ ...group, permissions: group.permissions || [] })} className="btn-secondary text-xs py-1.5 px-3">Bearbeiten</button>
                    <button onClick={async () => { if(confirm('Gruppe löschen?')) { await api.delete(`/permissions/groups/${group.id}`); loadPerms(); } }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>}
                </div>
              </div>
              {isEditing && <div className="p-4 space-y-4">
                <PermMatrix perms={editingGroup!.permissions} onChange={p => setEditingGroup(prev => prev ? { ...prev, permissions: p } : null)} />
                <div className="pt-3 border-t border-surface-200">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Mitglieder</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {group.members.map(m => <span key={m.userId} className="flex items-center gap-1 text-xs bg-surface-100 border border-surface-200 px-2 py-0.5 rounded-lg">
                      {m.user?.member ? `${m.user.member.firstName} ${m.user.member.lastName}` : m.user?.email}
                      <button onClick={async () => { await api.delete(`/permissions/groups/${group.id}/members/${m.userId}`); loadPerms(); }} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </span>)}
                  </div>
                  <select onChange={async e => { if(e.target.value) { await api.post(`/permissions/groups/${group.id}/members`, { userId: e.target.value }); e.target.value=''; loadPerms(); } }} className="input-field text-sm w-auto">
                    <option value="">+ Benutzer hinzufügen...</option>
                    {users.filter(u => !group.members.some(m => m.userId === u.id)).map(u => <option key={u.id} value={u.id}>{u.member ? `${u.member.firstName} ${u.member.lastName}` : u.email}</option>)}
                  </select>
                </div>
              </div>}
            </div>;
          })}
      </div>}

      {tab === 'users' && <div className="space-y-2">
        <p className="text-sm text-ink-muted">Individuelle Rechte überschreiben Gruppen-Rechte.</p>
        {users.map(u => {
          const name = u.member ? `${u.member.firstName} ${u.member.lastName}` : u.email;
          const isExpanded = expandedUser === u.id;
          const perms = userPerms[u.id] || [];
          return <div key={u.id} className="card overflow-hidden">
            <button onClick={async () => {
              if (!isExpanded && !userPerms[u.id]) {
                const r = await api.get(`/permissions/users/${u.id}`);
                setUserPerms(prev => ({ ...prev, [u.id]: r.data }));
              }
              setExpandedUser(isExpanded ? null : u.id);
            }} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <div className="text-left"><p className="font-medium text-ink text-sm">{name}</p><p className="text-xs text-ink-muted">{u.email} · {({'COMMANDER':'Kommandant','DEPUTY_COMMANDER':'Stv. Kommandant','SECRETARY':'Schriftführer','GROUP_COMMANDER':'Gruppenkommandant','MEMBER':'Mitglied'} as any)[u.role] || u.role}</p></div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-muted" /> : <ChevronDown className="w-4 h-4 text-ink-muted" />}
            </button>
            {isExpanded && <div className="p-4 border-t border-surface-200">
              <PermMatrix perms={perms} onChange={p => setUserPerms(prev => ({ ...prev, [u.id]: p }))} />
              <button onClick={() => saveUserPerms(u.id)} disabled={saving} className="btn-primary text-sm flex items-center gap-2 mt-3">
                {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern</button>
            </div>}
          </div>;
        })}
      </div>}
    </div>
  );
}

function PushOverviewEmbed() {
  return <PushOverviewPage />;
}

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('profile');
  const { user } = useAuth();
  const visible = SECTIONS.filter(s => !s.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Administration</h1>
        <QuickStatusBar onClickDetail={() => setActive('status')} />
      </div>
      <div className="flex flex-col sm:flex-row gap-6">
        <aside className="sm:w-56 flex-shrink-0">
          {/* Mobile + Desktop: vertical list */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
            {visible.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium transition-all duration-150 border-b border-surface-100 last:border-0 ${
                  active === s.id
                    ? 'bg-fire-50 text-fire-700 border-l-2 border-l-fire-700'
                    : 'text-ink-muted hover:bg-surface-50 hover:text-ink'
                }`} style={{ fontFamily: 'var(--font-general)' }}>
                <s.icon className="w-4 h-4 flex-shrink-0" />{s.label}
              </button>
            ))}
          </div>
        </aside>
        <div className="flex-1 bg-white rounded-2xl border border-surface-200 shadow-card p-6 min-h-[500px]">
          {active === 'profile'   && <ProfileSection />}
          {active === 'password'  && <PasswordSection />}
          {active === 'twofactor'     && <TwoFactorSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'members'   && <MembersSection />}
          {active === 'branding'  && <BrandingSection />}
          {active === 'privacy'   && <PrivacySection />}
          {active === 'security'  && <SecuritySection />}
          {active === 'email'     && <EmailSection />}
          {active === 'data'      && <DataSection />}
          {active === 'update'    && <UpdateSection />}
          {active === 'ai'        && <AiSection />}
          {active === 'status'     && <StatusSection />}
          {active === 'papierkorb'  && <PapierkorbSection />}
          {active === 'push-overview' && <PushOverviewEmbed />}
          {active === 'diktat'     && <DiktatSection />}
          {active === 'nav'        && <NavSection />}

      {active === 'permissions' && <PermissionsSectionEmbed />}
        </div>
      </div>
    </div>
  );
}

// ── Datenschutz Section ───────────────────────────────────────────────────────
function PrivacySection() {
  const [privacyText, setPrivacyText] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [currentVersion, setCurrentVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bumpVersion, setBumpVersion] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loadingAcceptances, setLoadingAcceptances] = useState(true);

  useEffect(() => {
    api.get('/privacy').then((r: any) => {
      setPrivacyText(r.data.privacyText || '');
      setCurrentVersion(r.data.privacyVersion || 0);
    }).catch(() => {}).finally(() => setLoading(false));

    api.get('/privacy/acceptances').then((r: any) => {
      setAcceptances(r.data.users || []);
    }).catch(() => {}).finally(() => setLoadingAcceptances(false));
  }, [currentVersion]);

  const handleSave = async () => {
    if (bumpVersion && !versionNote.trim()) {
      toast.error('Bitte einen Änderungsgrund angeben');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/privacy', { privacyText, privacyVersionNote: versionNote, bumpVersion });
      if (bumpVersion) {
        setCurrentVersion(res.data.newVersion);
        toast.success(`Datenschutztext gespeichert — Version ${res.data.newVersion} — alle User müssen neu bestätigen`);
      } else {
        toast.success('Datenschutztext gespeichert');
      }
      setBumpVersion(false);
      setVersionNote('');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-fire-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-headings)' }}>Datenschutzinformation</h2>
        <p className="text-sm text-ink-muted">Datenschutztext gemäß Art. 13 DSGVO — wird beim Login angezeigt und muss bestätigt werden.</p>
      </div>

      <div className={`card p-4 flex items-center gap-3 ${currentVersion > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <Shield className={`w-5 h-5 flex-shrink-0 ${currentVersion > 0 ? 'text-green-600' : 'text-amber-600'}`} />
        <div>
          <p className="text-sm font-semibold text-ink">
            {currentVersion > 0 ? `Aktive Version ${currentVersion}` : 'Kein Datenschutztext hinterlegt'}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {currentVersion > 0
              ? 'User müssen beim Login bestätigen. Neue User müssen beim ersten Login bestätigen.'
              : 'Solange kein Text hinterlegt ist, gibt es keinen Datenschutz-Zwang beim Login.'}
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Datenschutztext</label>
          <button onClick={() => setShowPreview((v: boolean) => !v)} className="text-xs text-fire-700 hover:underline">
            {showPreview ? 'Editor anzeigen' : 'Vorschau'}
          </button>
        </div>
        {showPreview ? (
          <div className="min-h-48 p-4 bg-surface-50 rounded-xl border border-surface-200 text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {privacyText || <span className="text-ink-muted italic">Kein Text hinterlegt</span>}
          </div>
        ) : (
          <textarea
            value={privacyText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrivacyText(e.target.value)}
            className="input w-full min-h-64 font-mono text-sm resize-y"
            placeholder={'Datenschutzinformation gemäß Art. 13 DSGVO\n\nVerantwortlicher: ...\nZweck der Verarbeitung: ...\nRechtsgrundlage: ...\n...'}
          />
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Versionierung</label>
          <p className="text-xs text-ink-muted mt-1">Wenn du eine neue Version erstellst, müssen alle User beim nächsten Login erneut bestätigen und sehen den Änderungsgrund.</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={bumpVersion} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBumpVersion(e.target.checked)} className="mt-0.5 rounded" />
          <div>
            <p className="text-sm font-semibold text-ink">Neue Version erstellen (alle User müssen neu bestätigen)</p>
            <p className="text-xs text-ink-muted mt-0.5">Aktuelle Version: {currentVersion} → neue Version: {currentVersion + 1}</p>
          </div>
        </label>
        {bumpVersion && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Änderungsgrund <span className="text-red-500">*</span></label>
            <input type="text" value={versionNote} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVersionNote(e.target.value)} className="input w-full" placeholder="z.B. Neue Verarbeitungstätigkeit hinzugefügt: Push-Benachrichtigungen" />
            <p className="text-xs text-ink-muted">Dieser Text wird den Usern beim nächsten Login angezeigt.</p>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
        {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Speichern...</> : 'Datenschutztext speichern'}
      </button>

      {/* Bestätigungsstatus aller User */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Bestätigungsstatus der User</h3>
        {loadingAcceptances ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-fire-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">Name / E-Mail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">Bestätigt am</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {acceptances.map((u: any) => (
                  <tr key={u.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{u.name}</p>
                      {u.name !== u.email && <p className="text-xs text-ink-muted">{u.email}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-muted">
                      {u.acceptedVersion > 0 ? `v${u.acceptedVersion}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {u.acceptedAt
                        ? new Date(u.acceptedAt).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {currentVersion === 0 ? (
                        <span className="text-xs text-ink-muted">Kein Text</span>
                      ) : u.upToDate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">✓ Aktuell</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">⚠ Ausstehend</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

