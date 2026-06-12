import ClearCacheButton from '../components/ClearCacheButton';
import { useState, useEffect, useRef } from 'react';
import {
  User, Key, ShieldCheck, Bell, Settings, FileText, RefreshCw,
  Camera, Trash2, Eye, EyeOff, AlertCircle, Phone,
  MapPin, Mail, ChevronRight, Check
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import api, { memberApi, userApi, authApi } from '../api';
import { usePush } from '../hooks/usePush';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 'lg' }: { url?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'md' ? 'w-14 h-14 text-lg' : 'w-9 h-9 text-sm';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className={`${dim} rounded-2xl object-cover ring-2 ring-white shadow-md`} />;
  return <div className={`${dim} rounded-2xl bg-fire-100 text-fire-700 font-bold flex items-center justify-center ring-2 ring-white shadow-md`}>{initials}</div>;
}

// ── Sektion-Tab ───────────────────────────────────────────────────────────────
type Tab = 'profil' | 'akt' | 'kontakt' | 'passwort' | '2fa' | 'benachrichtigungen' | 'push' | 'app';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'profil',           label: 'Profil',              icon: User },
  { id: 'akt',              label: 'Mein Akt',            icon: FileText },
  { id: 'kontakt',          label: 'Kontaktdaten',        icon: Phone },
  { id: 'passwort',         label: 'Passwort',            icon: Key },
  { id: '2fa',              label: 'Zwei-Faktor-Auth',    icon: ShieldCheck },
  { id: 'push',             label: 'Push-Einstellungen',  icon: Settings },
  { id: 'app',              label: 'App & Cache',         icon: RefreshCw },
];

// ── Push-Einstellungen (inline) ───────────────────────────────────────────────
function PushSettingsInline() {
  const { supported, permission, settings, loading, subscribe, unsubscribe, updateSettings } = usePush();
  const isGranted = permission === 'granted' && settings?.hasSubscription;

  const ITEMS = [
    { key: 'pushNewEvent',    label: 'Neue Ereignisse',  emoji: '📅' },
    { key: 'pushNewExercise', label: 'Neue Übungen',     emoji: '🧯' },
    { key: 'pushNewIncident', label: 'Neue Einsätze',    emoji: '🚨' },
    { key: 'pushBirthday',   label: 'Geburtstage',      emoji: '🎂' },
    { key: 'pushReminder7',  label: '7 Tage vorher',    emoji: '⏰' },
    { key: 'pushReminder3',  label: '3 Tage vorher',    emoji: '⏰' },
    { key: 'pushReminder1',  label: '1 Tag vorher',     emoji: '⏰' },
  ] as const;

  if (!supported) return (
    <div className="card p-5 text-center text-ink-muted">
      <p className="text-sm">Push wird von diesem Browser nicht unterstützt.</p>
      <p className="text-xs mt-1">Bitte über HTTPS öffnen (Chrome, Firefox, Safari).</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`card p-4 flex items-center justify-between gap-4 ${isGranted ? 'border-green-200 bg-green-50' : ''}`}>
        <div>
          <p className="font-semibold text-sm">{isGranted ? '🔔 Aktiv auf diesem Gerät' : '🔕 Deaktiviert'}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {isGranted ? 'Du erhältst Push-Benachrichtigungen.'
              : permission === 'denied' ? 'In Browser-Einstellungen erlauben.'
              : 'Aktiviere um keine Termine zu verpassen.'}
          </p>
        </div>
        {permission !== 'denied' && (
          <button onClick={isGranted ? unsubscribe : subscribe} disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 disabled:opacity-50 transition-all ${
              isGranted ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-fire-700 text-white hover:bg-fire-800'
            }`}>
            {loading ? '...' : isGranted ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        )}
      </div>

      {isGranted && settings && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Was möchtest du erhalten?</p>
          <div className="divide-y divide-surface-100">
            {ITEMS.map(({ key, label, emoji }) => (
              <div key={key} className="flex items-center justify-between py-2.5 gap-4">
                <div className="flex items-center gap-2">
                  <span>{emoji}</span>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <button onClick={() => updateSettings({ [key]: !settings[key] })}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${settings[key] ? 'bg-fire-700' : 'bg-surface-200'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function MeinProfilPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<Tab>('profil');
  const [member, setMember] = useState<any>(null);
  const [loadingMember, setLoadingMember] = useState(true);

  // Kontakt-Formular
  const [kontakt, setKontakt] = useState({ phone: '', email: '', street: '', zipCode: '', city: '' });
  const [savingKontakt, setSavingKontakt] = useState(false);

  // Passwort-Formular
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  // Avatar
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // 2FA
  const [twoFaStep, setTwoFaStep] = useState<'info' | 'qr' | 'verify' | 'disable'>('info');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [tfCode, setTfCode] = useState('');
  const [tfLoading, setTfLoading] = useState(false);
  const is2faEnabled = user?.twoFactorEnabled;

  useEffect(() => {
    const memberId = (user as any)?.memberId;
    if (memberId) {
      memberApi.get(memberId).then(m => {
        setMember(m);
        setKontakt({
          phone: m.phone || '',
          email: m.email || '',
          street: m.street || '',
          zipCode: m.zipCode || '',
          city: m.city || '',
        });
      }).catch(() => {}).finally(() => setLoadingMember(false));
    } else {
      setLoadingMember(false);
    }
  }, [(user as any)?.memberId]);

  const displayName = user?.member
    ? `${user.member.firstName} ${user.member.lastName}`
    : user?.email?.split('@')[0] || 'Benutzer';

  // Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await userApi.uploadAvatar(file);
      login(result.user ? result.user : { ...user, avatarUrl: result.avatarUrl });
      toast.success('Profilfoto aktualisiert');
    } catch { toast.error('Fehler beim Upload'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  };

  const handleAvatarRemove = async () => {
    try {
      const result = await userApi.deleteAvatar();
      login(result.user ? result.user : { ...user, avatarUrl: null });
      toast.success('Profilfoto entfernt');
    } catch { toast.error('Fehler'); }
  };

  // Kontakt speichern
  const saveKontakt = async () => {
    if (!member?.id) return;
    setSavingKontakt(true);
    try {
      await memberApi.update(member.id, kontakt);
      toast.success('Kontaktdaten gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingKontakt(false); }
  };

  // Passwort ändern
  const savePasswort = async () => {
    if (pw.new !== pw.confirm) { toast.error('Passwörter stimmen nicht überein'); return; }
    if (pw.new.length < 8) { toast.error('Mindestens 8 Zeichen'); return; }
    setSavingPw(true);
    try {
      await authApi.changePassword(pw.current, pw.new);
      toast.success('Passwort erfolgreich geändert');
      setPw({ current: '', new: '', confirm: '' });
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Falsches aktuelles Passwort'); }
    finally { setSavingPw(false); }
  };

  // 2FA
  const refreshUser = async () => { const me = await authApi.me(); login(me); };
  const start2fa = async () => {
    setTfLoading(true);
    try { const d = await authApi.setup2fa(); setQrCode(d.qrCode); setSecret(d.secret); setTwoFaStep('qr'); }
    catch { toast.error('Fehler'); } finally { setTfLoading(false); }
  };
  const verify2fa = async () => {
    setTfLoading(true);
    try { await authApi.verify2fa(tfCode); await refreshUser(); toast.success('2FA aktiviert!'); setTwoFaStep('info'); setTfCode(''); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Ungültiger Code'); } finally { setTfLoading(false); }
  };
  const disable2fa = async () => {
    setTfLoading(true);
    try { await authApi.disable2fa(tfCode); await refreshUser(); toast.success('2FA deaktiviert'); setTwoFaStep('info'); setTfCode(''); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Ungültiger Code'); } finally { setTfLoading(false); }
  };

  const FUNKTIONEN = [
    { key: 'isBreathingApparatus', label: 'Atemschutzträger' },
    { key: 'isMachinist',         label: 'Maschinist' },
    { key: 'hasFirstAidTraining', label: 'Ersthelfer' },
    { key: 'isDriver',            label: 'Fahrer' },
    { key: 'isRadioOperator',     label: 'Funker' },
    { key: 'isParamedic',         label: 'Feuerwehrsanitäter' },
    { key: 'isDiver',             label: 'Taucher' },
    { key: 'isFlightHelper',      label: 'Flughelfer' },
    { key: 'isHazmatExpert',      label: 'Schadstoffexperte' },
    { key: 'isExplosivesExpert',  label: 'Sprengbefugter' },
    { key: 'isEquipmentManager',  label: 'Gerätewart' },
    { key: 'isYouthLeader',       label: 'Jugendführer' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <Avatar url={user?.avatarUrl} name={displayName} size="lg" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-fire-700 hover:bg-fire-800 text-white rounded-xl flex items-center justify-center shadow transition-colors">
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>{displayName}</h1>
          <p className="text-sm text-ink-muted">{user?.email}</p>
          {member?.rank && <p className="text-xs text-fire-700 font-medium mt-0.5">{member.rank}</p>}
        </div>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar Tabs */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="card p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActive(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap flex-shrink-0 ${
                  active === id
                    ? 'bg-fire-700 text-white'
                    : 'text-ink-muted hover:bg-surface-100 hover:text-ink'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Inhalt */}
        <div className="flex-1 min-w-0">

          {/* PROFIL */}
          {active === 'profil' && (
            <div className="space-y-4">
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">Profilinformationen</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Name', value: displayName },
                    { label: 'E-Mail (Login)', value: user?.email },
                    { label: 'Rolle', value: user?.role },
                    { label: 'Mitgliedsnummer', value: member?.memberNumber || '—' },
                    { label: 'Dienstgrad', value: member?.rank || '—' },
                    { label: 'Status', value: member?.status || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                      <p className="text-xs text-ink-muted mb-1">{label}</p>
                      <p className="text-sm font-medium text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Camera className="w-4 h-4 text-ink-muted" />
                  <div>
                    <p className="text-sm font-medium">Profilfoto</p>
                    <p className="text-xs text-ink-muted">Klicke auf dein Foto oben um es zu ändern</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="text-xs px-3 py-1.5 bg-fire-700 text-white rounded-lg hover:bg-fire-800 transition-colors">
                    {uploading ? '...' : 'Ändern'}
                  </button>
                  {user?.avatarUrl && (
                    <button onClick={handleAvatarRemove}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MEIN AKT */}
          {active === 'akt' && (
            <div className="space-y-4">
              {loadingMember ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-fire-700 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !member ? (
                <div className="card p-6 text-center text-ink-muted">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Kein Mitglied verknüpft</p>
                </div>
              ) : (
                <>
                  <div className="card p-5">
                    <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">Persönliche Daten</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: 'Vorname', value: member.firstName },
                        { label: 'Nachname', value: member.lastName },
                        { label: 'Geburtsdatum', value: member.birthDate ? format(new Date(member.birthDate), 'dd. MMMM yyyy', { locale: de }) : '—' },
                        { label: 'Eintrittsdatum', value: member.entryDate ? format(new Date(member.entryDate), 'dd.MM.yyyy', { locale: de }) : '—' },
                        { label: 'Mitgliedsnummer', value: member.memberNumber },
                        { label: 'Feuerwehrpass-Nr.', value: member.fireServicePassNumber || '—' },
                        { label: 'Dienstgrad', value: member.rank || '—' },
                        { label: 'Status', value: member.status },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                          <p className="text-xs text-ink-muted mb-1">{label}</p>
                          <p className="text-sm font-medium text-ink">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Funktionen */}
                  <div className="card p-5">
                    <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Funktionen</p>
                    <div className="flex flex-wrap gap-2">
                      {FUNKTIONEN.filter(f => member[f.key]).map(f => (
                        <span key={f.key} className="inline-flex items-center gap-1 px-3 py-1.5 bg-fire-50 text-fire-700 border border-fire-200 rounded-full text-xs font-medium">
                          <Check className="w-3 h-3" /> {f.label}
                        </span>
                      ))}
                      {FUNKTIONEN.filter(f => member[f.key]).length === 0 && (
                        <p className="text-sm text-ink-muted">Keine Funktionen eingetragen</p>
                      )}
                    </div>
                  </div>

                  {/* Ausbildungen */}
                  {member.trainings?.length > 0 && (
                    <div className="card p-5">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Ausbildungen / Lehrgänge</p>
                      <div className="space-y-1.5">
                        {member.trainings.map((t: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-ink">
                            <div className="w-1.5 h-1.5 rounded-full bg-fire-700 flex-shrink-0" />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Führerscheine */}
                  {member.driverLicenses?.length > 0 && (
                    <div className="card p-5">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Führerscheinklassen</p>
                      <div className="flex flex-wrap gap-2">
                        {member.driverLicenses.map((l: string) => (
                          <span key={l} className="px-3 py-1 bg-surface-100 text-ink rounded-lg text-sm font-mono font-medium">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="card p-4 bg-amber-50 border-amber-200">
                    <p className="text-xs text-amber-700">
                      <strong>Hinweis:</strong> Diese Daten können nur vom Administrator geändert werden.
                      Für Korrekturen wende dich bitte an den Kommandanten oder Administrator.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* KONTAKT */}
          {active === 'kontakt' && (
            <div className="card p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Kontaktdaten</p>
                <p className="text-xs text-ink-muted">Diese Daten kannst du selbst aktualisieren.</p>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'phone',   label: 'Telefon',   icon: Phone,  type: 'tel',   placeholder: '+43 ...' },
                  { key: 'email',   label: 'E-Mail',    icon: Mail,   type: 'email', placeholder: 'name@beispiel.at' },
                  { key: 'street',  label: 'Straße',    icon: MapPin, type: 'text',  placeholder: 'Musterstraße 1' },
                  { key: 'zipCode', label: 'PLZ',       icon: MapPin, type: 'text',  placeholder: '9xxx' },
                  { key: 'city',    label: 'Ort',       icon: MapPin, type: 'text',  placeholder: 'Musterort' },
                ].map(({ key, label, icon: Icon, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input type={type} value={(kontakt as any)[key]} placeholder={placeholder}
                        onChange={e => setKontakt(k => ({ ...k, [key]: e.target.value }))}
                        className="input-field pl-9" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={saveKontakt} disabled={savingKontakt || !member}
                className="btn-primary w-full">
                {savingKontakt ? 'Speichern...' : 'Kontaktdaten speichern'}
              </button>
            </div>
          )}

          {/* PASSWORT */}
          {active === 'passwort' && (
            <div className="card p-5 space-y-4 max-w-md">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Passwort ändern</p>
                <p className="text-xs text-ink-muted">Mindestens 8 Zeichen.</p>
              </div>
              {[
                { label: 'Aktuelles Passwort', field: 'current' as const },
                { label: 'Neues Passwort',     field: 'new'     as const },
                { label: 'Bestätigung',        field: 'confirm' as const },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{label}</label>
                  <div className="relative">
                    <input type={showPw[field] ? 'text' : 'password'} className="input-field pr-10"
                      value={pw[field]} onChange={e => setPw(p => ({ ...p, [field]: e.target.value }))} />
                    <button type="button" onClick={() => setShowPw(s => ({ ...s, [field]: !s[field] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted">
                      {showPw[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {pw.confirm && pw.new !== pw.confirm && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Passwörter stimmen nicht überein
                </p>
              )}
              <button onClick={savePasswort}
                disabled={savingPw || pw.new !== pw.confirm || pw.new.length < 8}
                className="btn-primary w-full">
                {savingPw ? 'Speichern...' : 'Passwort ändern'}
              </button>
            </div>
          )}

          {/* 2FA */}
          {active === '2fa' && (
            <div className="card p-5 space-y-4 max-w-md">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Zwei-Faktor-Authentifizierung</p>
                <p className="text-xs text-ink-muted">Schütze deinen Account mit einem zweiten Faktor.</p>
              </div>
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${is2faEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-50 border-surface-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${is2faEnabled ? 'bg-emerald-100' : 'bg-surface-200'}`}>
                  <ShieldCheck className={`w-5 h-5 ${is2faEnabled ? 'text-emerald-600' : 'text-ink-faint'}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">2FA ist {is2faEnabled ? 'aktiviert ✓' : 'deaktiviert'}</p>
                  <p className="text-xs text-ink-muted">{is2faEnabled ? 'Dein Konto ist durch einen zweiten Faktor geschützt.' : 'Aktiviere 2FA für mehr Sicherheit.'}</p>
                </div>
              </div>
              {twoFaStep === 'info' && !is2faEnabled && (
                <button onClick={start2fa} disabled={tfLoading} className="btn-primary w-full">
                  {tfLoading ? 'Wird eingerichtet...' : '2FA einrichten'}
                </button>
              )}
              {twoFaStep === 'qr' && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">Scanne diesen QR-Code mit <strong>Google Authenticator</strong>, <strong>Authy</strong> oder <strong>Microsoft Authenticator</strong>.</p>
                  {qrCode && <div className="flex justify-center"><img src={qrCode} alt="QR" className="w-48 h-48 rounded-xl border-4 border-white shadow" /></div>}
                  <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                    <p className="text-xs text-ink-faint mb-1">Manueller Schlüssel:</p>
                    <p className="text-xs font-mono break-all select-all">{secret}</p>
                  </div>
                  <button onClick={() => setTwoFaStep('verify')} className="btn-primary w-full">Weiter → Code eingeben</button>
                  <button onClick={() => setTwoFaStep('info')} className="btn-secondary w-full">Abbrechen</button>
                </div>
              )}
              {twoFaStep === 'verify' && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">Gib den 6-stelligen Code aus der Authenticator-App ein:</p>
                  <input type="text" inputMode="numeric" className="input-field text-center text-2xl tracking-widest font-mono"
                    value={tfCode} onChange={e => setTfCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6} autoFocus />
                  <button onClick={verify2fa} disabled={tfLoading || tfCode.length !== 6} className="btn-primary w-full">2FA aktivieren</button>
                  <button onClick={() => { setTwoFaStep('qr'); setTfCode(''); }} className="btn-secondary w-full">← Zurück</button>
                </div>
              )}
              {is2faEnabled && twoFaStep === 'info' && (
                <button onClick={() => setTwoFaStep('disable')} className="btn-danger w-full">2FA deaktivieren</button>
              )}
              {twoFaStep === 'disable' && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">Gib deinen Authenticator-Code ein:</p>
                  <input type="text" inputMode="numeric" className="input-field text-center text-2xl tracking-widest font-mono"
                    value={tfCode} onChange={e => setTfCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6} autoFocus />
                  <button onClick={disable2fa} disabled={tfLoading || tfCode.length !== 6} className="btn-danger w-full">Deaktivieren</button>
                  <button onClick={() => { setTwoFaStep('info'); setTfCode(''); }} className="btn-secondary w-full">Abbrechen</button>
                </div>
              )}
            </div>
          )}



          {/* PUSH-EINSTELLUNGEN */}
          {active === 'push' && <PushSettingsInline />}

          {active === 'app' && (
            <div className="space-y-4">
              <div className="card p-5">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">App-Cache</p>
                <p className="text-sm text-ink-muted mb-4">Leert alle lokalen Caches (Einsatzpläne, App-Shell) und lädt die App neu. Nützlich wenn die App nicht aktuell aussieht oder Probleme hat.</p>
                <ClearCacheButton />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
