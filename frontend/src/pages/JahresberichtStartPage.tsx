import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Bot, PenLine, Calendar } from 'lucide-react';

export default function JahresberichtStartPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="max-w-lg mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/reports')}
          className="p-2 rounded-xl hover:bg-surface-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-headings)' }}>Jahresbericht</h1>
            <p className="text-xs text-ink-muted">Einsätze, Übungen, km, Anwesenheit</p>
          </div>
        </div>
      </div>

      {/* Jahrgang */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-ink-muted" />
          <p className="text-sm font-semibold">Berichtsjahr</p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                year === y
                  ? 'bg-fire-700 text-white shadow-sm'
                  : 'bg-surface-50 text-ink-muted border border-surface-200 hover:border-fire-300 hover:text-fire-700'
              }`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Modus-Auswahl */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider px-1">Wie möchtest du den Bericht erstellen?</p>

        <button
          onClick={() => navigate(`/reports/jahresbericht?year=${year}`)}
          className="w-full card p-5 flex items-center gap-4 hover:border-fire-300 hover:shadow-md transition-all group text-left">
          <div className="w-12 h-12 rounded-xl bg-fire-100 flex items-center justify-center flex-shrink-0 group-hover:bg-fire-200 transition-colors">
            <Bot className="w-6 h-6 text-fire-700" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink">Mit KI generieren</p>
            <p className="text-sm text-ink-muted mt-0.5">Texte werden automatisch aus deinen Daten erstellt</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-fire-50 text-fire-700 px-2 py-0.5 rounded-full border border-fire-200">🤖 Automatisch</span>
              <span className="text-xs bg-surface-100 text-ink-muted px-2 py-0.5 rounded-full">~2 Min</span>
            </div>
          </div>
          <div className="text-ink-muted group-hover:text-fire-700 transition-colors">›</div>
        </button>

        <button
          onClick={() => navigate(`/reports/jahresbericht?year=${year}&manual=1`)}
          className="w-full card p-5 flex items-center gap-4 hover:border-surface-300 hover:shadow-md transition-all group text-left">
          <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0 group-hover:bg-surface-200 transition-colors">
            <PenLine className="w-6 h-6 text-ink-muted" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink">Händisch eingeben</p>
            <p className="text-sm text-ink-muted mt-0.5">Texte selbst verfassen, Statistiken werden geladen</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-surface-100 text-ink-muted px-2 py-0.5 rounded-full border border-surface-200">✍️ Manuell</span>
            </div>
          </div>
          <div className="text-ink-muted group-hover:text-ink transition-colors">›</div>
        </button>
      </div>
    </div>
  );
}
