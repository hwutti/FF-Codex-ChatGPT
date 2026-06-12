import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../utils/BrandingContext';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../api';

export default function ForgotPasswordPage() {
  const { branding } = useBranding();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Bitte E-Mail-Adresse eingeben'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      setError('Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.');
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
            <h1 className="font-bold text-white text-xl" style={{ fontFamily: 'var(--font-login)' }}>Passwort vergessen</h1>
            <p className="text-white/70 text-xs mt-0.5">{branding.name}</p>
          </div>
        </div>

        <div className="px-6 py-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="font-bold text-ink text-lg">E-Mail gesendet</h2>
                <p className="text-ink-muted text-sm mt-2">
                  Falls ein Konto mit der E-Mail-Adresse <strong>{email}</strong> existiert, wurde ein Reset-Link gesendet. Bitte prüfe auch deinen Spam-Ordner.
                </p>
                <p className="text-ink-muted text-xs mt-2">Der Link ist 1 Stunde gültig.</p>
              </div>
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors mt-4">
                <ArrowLeft className="w-4 h-4" /> Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-sm text-ink-muted">Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">E-Mail-Adresse</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input w-full pl-9"
                    placeholder="deine@email.at"
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                Reset-Link senden
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
