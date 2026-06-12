import { useState, useEffect } from 'react';
import { Download, X, Copy, Check, Smartphone } from 'lucide-react';

function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__pwaInstallPrompt || null);
  const [isFirefox, setIsFirefox] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsFirefox(ua.includes('firefox'));
    if (window.__pwaInstallPrompt) setDeferredPrompt(window.__pwaInstallPrompt);
    const onReady = () => { if (window.__pwaInstallPrompt) setDeferredPrompt(window.__pwaInstallPrompt); };
    window.addEventListener('pwaInstallReady', onReady);
    return () => window.removeEventListener('pwaInstallReady', onReady);
  }, []);

  const trigger = async () => {
    if (isFirefox) { setShowModal(true); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { window.__pwaInstallPrompt = null; setDeferredPrompt(null); }
      return;
    }
    setShowModal(true);
  };

  return { trigger, isFirefox, showModal, setShowModal };
}

const APP_URL = 'https://verwaltung.ff-görtschach.at';

function CopyButton() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(APP_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm"
    >
      <span className="font-mono text-slate-500 truncate">{APP_URL}</span>
      <span className="flex items-center gap-1.5 flex-shrink-0 text-slate-400">
        {copied
          ? <><Check className="w-4 h-4 text-emerald-500" /><span className="text-emerald-500 font-medium">Kopiert!</span></>
          : <><Copy className="w-4 h-4" /><span>Kopieren</span></>
        }
      </span>
    </button>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
    </div>
  );
}

function InstallModal({ onClose, isFirefox }) {
  const isSafariIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-4 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-800">App installieren</h2>
            <p className="text-xs text-slate-400 mt-0.5">Feuerwehr Verwaltung</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px bg-slate-100 mx-6" />

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {isFirefox ? (
            <>
              <p className="text-sm text-slate-500 leading-relaxed">
                Firefox unterstützt keine direkte App-Installation. Öffne die App in <strong className="text-slate-700">Chrome</strong> oder <strong className="text-slate-700">Microsoft Edge</strong> — dort kannst du sie mit einem Klick installieren.
              </p>
              <CopyButton />
            </>
          ) : isSafariIos ? (
            <div className="space-y-3">
              <Step n="1">Tippe auf das <strong className="text-slate-700">Teilen-Symbol</strong> unten in Safari <span className="text-base">⎙</span></Step>
              <Step n="2">Wähle <strong className="text-slate-700">„Zum Home-Bildschirm"</strong></Step>
              <Step n="3">Tippe auf <strong className="text-slate-700">„Hinzufügen"</strong> — fertig!</Step>
            </div>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">
              Schaue in der <strong className="text-slate-700">Adressleiste</strong> nach einem Installieren-Symbol, oder versuche die Seite neu zu laden.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            Alles klar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PwaInstallButton({ compact = false }) {
  const { trigger, showModal, setShowModal, isFirefox } = usePwaInstall();
  return (
    <>
      <button
        onClick={trigger}
        title="App installieren"
        className={'flex items-center gap-2 rounded-xl transition-all duration-200 ' + (
          compact
            ? 'w-9 h-9 justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            : 'px-3 h-9 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-sm font-medium'
        )}
      >
        <Download className="w-4 h-4 flex-shrink-0" />
        {!compact && <span>Installieren</span>}
      </button>
      {showModal && <InstallModal onClose={() => setShowModal(false)} isFirefox={isFirefox} />}
    </>
  );
}
