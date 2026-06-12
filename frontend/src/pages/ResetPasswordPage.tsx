import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useBranding } from '../utils/BrandingContext';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api';

export default function ResetPasswordPage() {
  const { branding } = useBranding();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    api.get(`/auth/verify-reset-token?token=${token}`)
      .then(r => { setTokenValid(r.data.valid); setEmail(r.data.email || ''); })
      .catch(() => setTokenValid(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben'); return; }
    if (password !== passwordConfirm) { setError('Passwörter stimmen nicht überein'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Fehler beim Zurücksetzen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: branding.loginBgColor || '#1a0a05' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-4" style={{ background: branding.loginColor || '#a82828' }}>
          {branding.logoUrl && <img src={branding.logoUrl} alt="Logo" className="w-12 h-12 object-contain flex-shrink-0" />}
          <div>
            <h1 className="font-bold text-white text-xl" style={{ fontFamily: 'var(--font-login)' }}>Passwort zurücksetzen</h1>
            <p className="text-white/70 text-xs mt-0.5">{branding.name}</p>
          </div>
        </div>

        <div className="px-6 py-8">
          {tokenValid === null && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-fire-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {tokenValid === false && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-ink text-lg">Link ungültig</h2>
                <p className="text-ink-muted text-sm mt-2">Dieser Reset-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.</p>
              </div>
              <Link to="/forgot-password" className="btn-primary inline-flex items-center gap-2 text-sm">
                Neuen Link anfordern
              </Link>
            </div>
          )}

          {tokenValid === true && done && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="font-bold text-ink text-lg">Passwort geändert</h2>
                <p className="text-ink-muted text-sm mt-2">Dein Passwort wurde erfolgreich geändert. Du wirst zur Anmeldung weitergeleitet...</p>
              </div>
            </div>
          )}

          {tokenValid === true && !done && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {email && (
                <div className="bg-slate-50 px-3 py-2 rounded-lg">
                  <p className="text-xs text-ink-muted">Konto: <span className="font-medium text-ink">{email}</span></p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Neues Passwort</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input w-full pl-9 pr-10"
                    placeholder="Mindestens 8 Zeichen"
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Passwort bestätigen</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    className="input w-full pl-9"
                    placeholder="Passwort wiederholen"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
                Passwort speichern
              </button>

              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Zurück zur Anmeldung
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
