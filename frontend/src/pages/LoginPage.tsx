import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { useBranding } from '../utils/BrandingContext';
import { authApi } from '../api';
import { Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { version } from '../../package.json';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.login(email, password, requiresTwoFactor ? totpCode : undefined, requiresTwoFactor ? trustDevice : undefined);
      if (data.requiresTwoFactor) { setRequiresTwoFactor(true); setLoading(false); return; }
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const bgStyle = branding.loginBgImage
    ? { backgroundImage: `url(${branding.loginBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(135deg, ${branding.loginBgColor} 0%, ${branding.loginBgColor}dd 40%, ${branding.loginBgColor} 100%)` };

  return (
    <div className="min-h-screen flex" style={bgStyle}>
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col w-[45%] p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute bottom-0 left-0 right-0 h-64 opacity-10"
          style={{ background: 'radial-gradient(ellipse at bottom, #c93535 0%, transparent 70%)' }} />

        {/* Logo area */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <img src={branding.logoUrl || "/logo.png"} alt={branding.name} className="w-20 h-20 object-contain drop-shadow-2xl" />
            <div>
              <h1 className="text-white text-3xl font-bold leading-tight" style={{ fontFamily: 'var(--font-login)' }}>
                {(branding.name || '').split(' ')[0]}
              </h1>
              <p className="text-fire-400 text-sm font-medium tracking-widest uppercase">{(branding.name || '').split(' ').slice(1).join(' ')}</p>
            </div>
          </div>

          <div className="space-y-6 max-w-xs">
            <div>
              <p className="text-white/30 text-xs font-semibold tracking-widest uppercase mb-3">{branding.loginBadge}</p>
              <h2 className="text-white text-4xl font-bold leading-tight" style={{ fontFamily: 'var(--font-login)', color: branding.loginColor }}>
                {branding.loginTitle}
              </h2>
            </div>
            <p className="text-white/40 text-sm leading-relaxed">
              {branding.loginSubtitle} {branding.name} — gegründet {branding.foundedYear}.
            </p>
          </div>
        </div>

        {/* Bottom stat */}
        <div className="relative z-10 mt-auto">
          <div className="flex items-center gap-3 text-white/20 text-xs">
            <div className="w-6 h-px bg-white/20" />
            <span className="tracking-widest uppercase font-medium">Est. {branding.foundedYear}</span>
          </div>
          <div className="mt-4 text-white/20 text-xs">v{version}</div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <img src={branding.logoUrl || "/logo.png"} alt={branding.name} className="w-14 h-14 object-contain" />
            <div>
              <p className="text-white font-bold text-xl" style={{ fontFamily: 'var(--font-login)' }}>{(branding.name || "").split(" ")[0]}</p>
              <p className="text-fire-400 text-xs tracking-widest uppercase">{(branding.name || "").split(" ").slice(1).join(" ")}</p>
            </div>
          </div>

          {!requiresTwoFactor ? (
            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-modal">
              <div className="mb-8">
                <h2 className="text-white text-2xl font-bold mb-1.5" style={{ fontFamily: 'var(--font-login)' }}>
                  {branding.loginWelcomeTitle}
                </h2>
                <p className="text-white/40 text-sm">{branding.loginWelcomeSubtitle}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/60 text-xs font-semibold tracking-wider uppercase mb-2">E-Mail</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-fire-500/50 focus:border-fire-500/50 transition-all"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="deine@email.at"
                    required autoFocus
                    style={{ fontFamily: 'var(--font-general)' }}
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-semibold tracking-wider uppercase mb-2">Passwort</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full px-4 py-3 pr-12 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-fire-500/50 focus:border-fire-500/50 transition-all"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ fontFamily: 'var(--font-general)' }}
                    />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 mt-2 px-6 py-3 bg-fire-700 hover:bg-fire-600 text-white font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 shadow-[0_4px_24px_rgba(169,40,40,0.35)]"
                  style={{ fontFamily: 'var(--font-general)' }}>
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><span>Anmelden</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                <div className="text-center mt-3">
                  <Link to="/forgot-password" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                    Passwort vergessen?
                  </Link>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-modal">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-fire-700/30 border border-fire-600/30 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-6 h-6 text-fire-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl" style={{ fontFamily: 'var(--font-login)' }}>2-Faktor-Code</h2>
                  <p className="text-white/40 text-xs">Aus deiner Authenticator-App</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text" inputMode="numeric"
                  className="w-full px-4 py-4 bg-white/[0.06] border border-white/10 rounded-xl text-white text-center text-3xl tracking-[0.5em] font-mono placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-fire-500/50 transition-all"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="······" maxLength={6} required autoFocus
                />
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${trustDevice ? 'bg-fire-600 border-fire-600' : 'border-white/30 hover:border-white/50'}`}
                    onClick={() => setTrustDevice(t => !t)}>
                    {trustDevice && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-white/60 text-sm group-hover:text-white/80 transition-colors" onClick={() => setTrustDevice(t => !t)}>
                    Diesem Gerät 30 Tage vertrauen
                  </span>
                </label>
                <button type="submit" disabled={loading || totpCode.length !== 6}
                  className="w-full py-3 bg-fire-700 hover:bg-fire-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-[0_4px_24px_rgba(169,40,40,0.35)]"
                  style={{ fontFamily: 'var(--font-general)' }}>
                  {loading ? 'Prüfen...' : 'Bestätigen'}
                </button>
                <button type="button" onClick={() => { setRequiresTwoFactor(false); setTotpCode(''); }}
                  className="w-full py-3 text-white/40 hover:text-white/70 text-sm transition-colors"
                  style={{ fontFamily: 'var(--font-general)' }}>
                  ← Zurück
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
