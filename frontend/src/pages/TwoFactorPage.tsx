import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuth } from '../utils/AuthContext';
import { ShieldCheck, ShieldOff, ArrowLeft, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

const TwoFactorPage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'info' | 'qr' | 'verify' | 'disable'>('info');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const is2faEnabled = (user as any)?.twoFactorEnabled;

  const startSetup = async () => {
    setLoading(true);
    try {
      const data = await authApi.setup2fa();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('qr');
    } catch {
      toast.error('Fehler beim Einrichten der 2FA');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.verify2fa(code);
      toast.success('2FA erfolgreich aktiviert!');
      // Refresh user data
      const me = await authApi.me();
        login(token, me);
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ungültiger Code');
    } finally {
      setLoading(false);
    }
  };

  const disable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.disable2fa(code);
      toast.success('2FA deaktiviert');
      const me = await authApi.me();
        login(token, me);
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ungültiger Code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Zwei-Faktor-Authentifizierung</h1>
      </div>

      {/* Status card */}
      <div className={`card mb-6 flex items-center gap-4 ${is2faEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${is2faEnabled ? 'bg-green-100' : 'bg-gray-200'}`}>
          {is2faEnabled
            ? <ShieldCheck className="h-6 w-6 text-green-600" />
            : <ShieldOff className="h-6 w-6 text-gray-500" />}
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            2FA ist {is2faEnabled ? 'aktiviert' : 'deaktiviert'}
          </p>
          <p className="text-sm text-gray-500">
            {is2faEnabled
              ? 'Dein Konto ist mit einem zweiten Faktor geschützt.'
              : 'Aktiviere 2FA für zusätzliche Sicherheit.'}
          </p>
        </div>
      </div>

      {/* Step: Info / Start */}
      {step === 'info' && !is2faEnabled && (
        <div className="card space-y-4">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-fire-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Authenticator-App erforderlich</p>
              <p className="text-sm text-gray-500 mt-1">
                Du brauchst eine App wie <strong>Google Authenticator</strong>, <strong>Authy</strong> oder <strong>Microsoft Authenticator</strong> auf deinem Smartphone.
              </p>
            </div>
          </div>
          <button onClick={startSetup} disabled={loading} className="btn-primary w-full">
            {loading ? 'Wird eingerichtet...' : '2FA einrichten'}
          </button>
        </div>
      )}

      {/* Step: Show QR Code */}
      {step === 'qr' && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">QR-Code scannen</h2>
            <p className="text-sm text-gray-500">Scanne diesen QR-Code mit deiner Authenticator-App.</p>
          </div>
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code" className="w-52 h-52 border-4 border-white shadow-lg rounded-lg" />
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Manueller Schlüssel (falls QR-Scan nicht möglich):</p>
            <p className="text-xs font-mono break-all text-gray-700">{secret}</p>
          </div>
          <button onClick={() => setStep('verify')} className="btn-primary w-full">
            Code eingeben →
          </button>
        </div>
      )}

      {/* Step: Verify code */}
      {step === 'verify' && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Code bestätigen</h2>
            <p className="text-sm text-gray-500">Gib den 6-stelligen Code aus deiner App ein, um 2FA zu aktivieren.</p>
          </div>
          <form onSubmit={verifyAndEnable} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              className="input-field text-center text-2xl tracking-widest font-mono"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full">
              {loading ? 'Prüfen...' : '2FA aktivieren'}
            </button>
            <button type="button" onClick={() => setStep('qr')} className="btn-secondary w-full">
              Zurück zum QR-Code
            </button>
          </form>
        </div>
      )}

      {/* Disable 2FA */}
      {is2faEnabled && step === 'info' && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-600">
            Um 2FA zu deaktivieren, gib deinen aktuellen Authenticator-Code ein.
          </p>
          <button onClick={() => setStep('disable')} className="btn-danger w-full">
            2FA deaktivieren
          </button>
        </div>
      )}

      {step === 'disable' && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">2FA deaktivieren</h2>
            <p className="text-sm text-gray-500">Gib deinen aktuellen Authenticator-Code ein.</p>
          </div>
          <form onSubmit={disable2fa} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              className="input-field text-center text-2xl tracking-widest font-mono"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
            <button type="submit" disabled={loading || code.length !== 6} className="btn-danger w-full">
              {loading ? 'Deaktivieren...' : '2FA deaktivieren'}
            </button>
            <button type="button" onClick={() => setStep('info')} className="btn-secondary w-full">
              Abbrechen
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TwoFactorPage;
