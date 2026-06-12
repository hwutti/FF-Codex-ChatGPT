import { useEffect, useRef, useState } from 'react';
import DiktatButton from '../components/DiktatButton';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ChevronDown } from 'lucide-react';
import { memberApi } from '../api';
import { MemberStatus } from '../types';
import toast from 'react-hot-toast';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';

const RANKS_MALE = [
  'LBD: Landesbranddirektor',
  'LBDSTV: Landesbranddirektor-Stellvertreter',
  'BR: Brandrat',
  'OBR: Oberbrandrat',
  'ABI: Abschnittsbrandinspektor',
  'HBI: Hauptbrandinspektor',
  'OBI: Oberbrandinspektor',
  'BI: Brandinspektor',
  'HV: Hauptverwalter',
  'OV: Oberverwalter',
  'V: Verwalter',
  'HBM: Hauptbrandmeister',
  'OBM: Oberbrandmeister',
  'BM: Brandmeister',
  'HLM: Hauptlöschmeister',
  'OLM: Oberlöschmeister',
  'LM: Löschmeister',
  'HFM: Hauptfeuerwehrmann',
  'OFM: Oberfeuerwehrmann',
  'FM: Feuerwehrmann',
  'PFM: Probefeuerwehrmann',
];

const RANKS_FEMALE = [
  'LBD: Landesbranddirektorin',
  'LBDSTV: Landesbranddirektor-Stellvertreterin',
  'BR: Brandrätin',
  'OBR: Oberbrandrätin',
  'ABI: Abschnittsbrandinspektorin',
  'HBI: Hauptbrandinspektorin',
  'OBI: Oberbrandinspektorin',
  'BI: Brandinspektorin',
  'HV: Hauptverwalterin',
  'OV: Oberverwalterin',
  'V: Verwalterin',
  'HBM: Hauptbrandmeisterin',
  'OBM: Oberbrandmeisterin',
  'BM: Brandmeisterin',
  'HLM: Hauptlöschmeisterin',
  'OLM: Oberlöschmeisterin',
  'LM: Löschmeisterin',
  'HFM: Hauptfeuerwehrfrau',
  'OFM: Oberfeuerwehrfrau',
  'FM: Feuerwehrfrau',
  'PFM: Probefeuerwehrfrau',
];

const DRIVER_LICENSES = ['AM', 'A1', 'A2', 'A', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D', 'T', 'F'];

// ─── Sub-Komponenten AUSSERHALB der Hauptkomponente ──────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card p-5 mb-4">
    <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">{title}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

const Field = ({ label, required, children, full }: { label: string; required?: boolean; children: React.ReactNode; full?: boolean }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
// ─────────────────────────────────────────────────────────────────────────────

const TRAININGS = [
  'Atemschutzbeauftragtenlehrgang',
  'Atemschutzleistungsprüfung',
  'Atemschutzlehrgang',
  'Ausbildungsbeauftragtenlehrgang',
  'Bewerterschulung FJ-Bewerbe',
  'Bewerterschulung KFLA',
  'BSB',
  'BSW',
  'Combined Success',
  'Einsatztraining „Atemschutz"',
  'Einsatztraining „Technische Rettung"',
  'Erweiterte Grundausbildung',
  'Feuerwehrjugend-Weiterbildung',
  'FJ-Bewerter LB 1',
  'FJ-Bewerter WT',
  'Fortbildung „Atemschutz"',
  'Fortbildung „Technische Rettung"',
  'Führen I – Gruppenkommandantenlehrgang',
  'Führen II – Einsatzleiterlehrgang',
  'Führungstraining',
  'Funkbeauftragtenlehrgang',
  'Gerätewartlehrgang',
  'Hauptmaschinistenlehrgang',
  'Jugendbeauftragtenlehrgang',
  'Jugendhelfer',
  'Kommandanten-Weiterbildungsseminar „Vorbeugender Brandschutz-Grundlagen"',
  'Kommandantenseminar',
  'Kommandantenseminar Betriebsfeuerwehren',
  'Kranführerlehrgang',
  'Lehrgang „Bediener von ATS-Kompressoren"',
  'Lehrgang „Gasmessgeräte"',
  'Lehrgang „Kameradschaftsführer"',
  'Lehrgang „MRAS"',
  'Lehrgang „Technische Rettung (VU)"',
  'Lehrgang „Theorie Lenken 5,5 t"',
  'Lehrgang „Tunneleinsatz-Bahn"',
  'Lehrgang „Tunneleinsatz-Bahn" – nur ÖBB-Projekte',
  'Lehrgang „Tunneleinsatz-Straße"',
  'Lehrgang „Tunneleinsatz-Straße" – nur ÖBB-Projekte',
  'Lehrgang „Vollschutzbekleidung"',
  'Modul „Bodenbrandbekämpfung"',
  'Modul „Einsatz bei neuen Technologien"',
  'Modul „Einsatzvorbereitung" – Online',
  'Modul „FJ-Bewerbe"',
  'Modul „Führungsunterstützung"',
  'Modul „Gase"',
  'Modul „Großtierrettung"',
  'Modul „Heben und Ziehen"',
  'Modul „Hochwassereinsatz"',
  'Modul „Mentales Training für EL"',
  'Modul „Ölwehr"',
  'Modul „Türöffnung"',
  'Motorsägenlehrgang',
  'ÖBFV Trainerausbildung Heißausbildung',
  'Schiffsführer-Weiterbildung',
  'Seilwindenlehrgang',
  'Seminar „Rhetorik"',
  'Stabstraining',
  'Taucher-Weiterbildung',
  'Taucherlehrgang II',
  'TLF-Maschinistenlehrgang',
  'Workshop für Bezirks- und Abschnittsjugendbeauftragte',
];


// Gegenderte Ausbildungsbezeichnungen (weiblich wo nötig)
const TRAINING_FEMALE: Record<string, string> = {
  'Führen I – Gruppenkommandantenlehrgang': 'Führen I – Gruppenkommandantinnenlehrgang',
  'Führen II – Einsatzleiterlehrgang': 'Führen II – Einsatzleiterinnen lehrgang',
  'Kommandantenseminar': 'Kommandantinnenseminar',
  'Kommandantenseminar Betriebsfeuerwehren': 'Kommandantinnenseminar Betriebsfeuerwehren',
  'Kommandanten-Weiterbildungsseminar „Vorbeugender Brandschutz-Grundlagen“': 'Kommandantinnen-Weiterbildungsseminar „Vorbeugender Brandschutz-Grundlagen“',
  'Lehrgang „Kameradschaftsführer“': 'Lehrgang „Kameradschaftsführerin“',
  'Jugendhelfer': 'Junghelfer',
};

function getTrainingLabel(t: string, isFemale: boolean): string {
  if (!isFemale) return t;
  return TRAINING_FEMALE[t] || t;
}

function TrainingMultiSelect({ value, onChange, isFemale }: { value: string[]; onChange: (v: string[]) => void; isFemale?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (t: string) => {
    if (value.includes(t)) onChange(value.filter(v => v !== t));
    else onChange([...value, t]);
  };

  const filtered = TRAININGS.filter(t => t.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 border rounded-xl bg-white text-left transition-colors ${
          open ? 'border-fire-500 ring-2 ring-fire-100' : 'border-surface-200 hover:border-surface-300'
        }`}>
        <span className="text-sm text-gray-500 flex-1">
          {value.length === 0 ? 'Lehrgänge auswählen...' : `${value.length} Lehrgang${value.length !== 1 ? 'e' : ''} ausgewählt`}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected chips below button */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map(t => (
            <span key={t} className="flex items-center gap-1 text-xs bg-fire-50 text-fire-700 border border-fire-200 px-2 py-1 rounded-lg font-medium">
              {isFemale ? (TRAINING_FEMALE[t] || t) : t}
              <button type="button" onClick={() => toggle(t)} className="hover:text-fire-900 ml-0.5 text-base leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-surface-200 rounded-xl shadow-modal max-h-64 flex flex-col">
          <div className="p-2 border-b border-surface-100">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full text-sm px-3 py-1.5 border border-surface-200 rounded-lg outline-none focus:border-fire-400"
              placeholder="Suchen..." />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Keine Treffer</p>}
            {filtered.map(t => (
              <label key={t} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-50 cursor-pointer text-sm">
                <input type="checkbox" checked={value.includes(t)} onChange={() => toggle(t)}
                  className="w-4 h-4 accent-fire-700 flex-shrink-0" />
                <span className="leading-tight">{isFemale ? (TRAINING_FEMALE[t] || t) : t}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <div className="p-2 border-t border-surface-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">{value.length} ausgewählt</span>
              <button type="button" onClick={() => onChange([])} className="text-xs text-red-500 hover:text-red-700">Alle entfernen</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MemberFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [dirty, setDirty] = useState(false);
  const { confirmNavigation, resolve: resolveGuard } = useUnsavedGuard(dirty);
  const guardedNavigate = async (path: string) => {
    const result = await confirmNavigation();
    if (result === 'cancel') return;
    navigate(path);
  };
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    memberNumber: '', firstName: '', lastName: '', birthDate: '', deathDate: '', fireServicePassNumber: '',
    street: '', zipCode: '', city: '', phone: '', email: '',
    entryDate: '', exitDate: '', rank: '', functionTitle: '',
    status: 'ACTIVE' as MemberStatus, groupName: '',
    gender: 'male',
    driverLicenses: [] as string[],
    isBreathingApparatus: false, isMachinist: false, hasFirstAidTraining: false,
    isDriver: false, isRadioOperator: false, isParamedic: false, isDiver: false,
    isFlightHelper: false, isHazmatExpert: false, isExplosivesExpert: false,
    isMRAS: false, isRescueCutter: false, isEquipmentManager: false, isYouthLeader: false,
    trainings: [] as string[], clothingSizes: '', emergencyContactName: '', emergencyContactPhone: '',
    notes: '',
  });

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      memberApi.get(id!)
        .then(m => setForm({
          memberNumber: m.memberNumber || '',
          firstName: m.firstName || '',
          lastName: m.lastName || '',
          birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
          deathDate: m.deathDate ? m.deathDate.split('T')[0] : '',
          fireServicePassNumber: m.fireServicePassNumber || '',
          street: m.street || '',
          zipCode: m.zipCode || '',
          city: m.city || '',
          phone: m.phone || '',
          email: m.email || '',
          entryDate: m.entryDate ? m.entryDate.split('T')[0] : '',
          exitDate: m.exitDate ? m.exitDate.split('T')[0] : '',
          rank: m.rank || '',
          functionTitle: m.functionTitle || '',
          status: m.status,
          groupName: m.groupName || '',
          gender: m.gender || 'male',
          driverLicenses: m.driverLicenses || [],
          isBreathingApparatus: m.isBreathingApparatus,
          isMachinist: m.isMachinist,
          hasFirstAidTraining: m.hasFirstAidTraining,
          isDriver: m.isDriver || false,
          isRadioOperator: m.isRadioOperator || false,
          isParamedic: m.isParamedic || false,
          isDiver: m.isDiver || false,
          isFlightHelper: m.isFlightHelper || false,
          isHazmatExpert: m.isHazmatExpert || false,
          isExplosivesExpert: m.isExplosivesExpert || false,
          isMRAS: m.isMRAS || false,
          isRescueCutter: m.isRescueCutter || false,
          isEquipmentManager: m.isEquipmentManager || false,
          isYouthLeader: m.isYouthLeader || false,
          trainings: m.trainings || [],
          clothingSizes: m.clothingSizes ? JSON.stringify(m.clothingSizes) : '',
          emergencyContactName: m.emergencyContactName || '',
          emergencyContactPhone: m.emergencyContactPhone || '',
          notes: m.notes || '',
        }))
        .catch(() => { toast.error('Mitglied nicht gefunden'); guardedNavigate('/members'); })
        .finally(() => setLoading(false));
    } else {
      // Nächste freie Mitgliedsnummer automatisch laden
      memberApi.nextNumber().then(({ nextNumber }) => {
        setForm(f => ({ ...f, memberNumber: nextNumber }));
      }).catch(() => {});
    }
  }, [id]);

  const set = (field: string, value: any) => { setForm(f => ({ ...f, [field]: value })); setDirty(true); };

  const toggleLicense = (l: string) => {
    setForm(f => ({
      ...f,
      driverLicenses: f.driverLicenses.includes(l)
        ? f.driverLicenses.filter(x => x !== l)
        : [...f.driverLicenses, l],
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        trainings: Array.isArray(form.trainings) ? form.trainings : [],
        deathDate: form.deathDate || null,
        fireServicePassNumber: form.fireServicePassNumber || null,
        birthDate: form.birthDate || null,
        exitDate: form.exitDate || null,
      };
      if (isEdit) {
        await memberApi.update(id!, payload);
        toast.success('Mitglied aktualisiert');
        guardedNavigate(`/members/${id}`);
      } else {
        const member = await memberApi.create(payload);
        toast.success('Mitglied angelegt');
        navigate(`/members/${member.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <>
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => id ? guardedNavigate(`/members/${id}`) : guardedNavigate('/members')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">
          {isEdit ? 'Kamerad:in bearbeiten' : 'Neue/r Kamerad:in'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Section title="Stammdaten">
          <Field label="Mitgliedsnummer" required>
            <input type="text" value={form.memberNumber} onChange={e => set('memberNumber', e.target.value)}
              className="input-field" required disabled={isEdit} />
          </Field>
          <Field label="Status" required>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
              <option value="ACTIVE">Aktiv</option>
              <option value="RESERVE">Reservist</option>
              <option value="YOUTH">Jugend</option>
              <option value="HONORARY">Ehrenmitglied</option>
              <option value="EXITED">Ausgetreten</option>
            </select>
          </Field>
          <Field label="Vorname" required>
            <div className="flex gap-2 items-center">
              <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)} className="input-field" required />
              <DiktatButton onResult={text => set('firstName', text)} />
            </div>
          </Field>
          <Field label="Nachname" required>
            <div className="flex gap-2 items-center">
              <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)} className="input-field" required />
              <DiktatButton onResult={text => set('lastName', text)} />
            </div>
          </Field>
          <Field label="Geburtsdatum">
            <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className="input-field" />
          </Field>
          <Field label="Sterbedatum">
            <input type="date" value={form.deathDate} onChange={e => set('deathDate', e.target.value)} className="input-field" />
          </Field>
          <Field label="Feuerwehrpass-Nummer">
            <input type="text" value={form.fireServicePassNumber} onChange={e => set('fireServicePassNumber', e.target.value)}
              className="input-field" placeholder="z.B. FP-12345" />
          </Field>
          <Field label="Eintrittsdatum">
            <input type="date" value={form.entryDate} onChange={e => set('entryDate', e.target.value)} className="input-field" />
          </Field>
          <Field label="Geschlecht">
            <select value={form.gender} onChange={e => { set('gender', e.target.value); set('rank', ''); }} className="input-field">
              <option value="male">Männlich</option>
              <option value="female">Weiblich</option>
            </select>
          </Field>
          <Field label="Dienstgrad">
            <select value={form.rank} onChange={e => set('rank', e.target.value)} className="input-field">
              <option value="">— Kein Dienstgrad —</option>
              {(form.gender === 'female' ? RANKS_FEMALE : RANKS_MALE).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Funktion">
            <div className="flex gap-2 items-center">
              <input type="text" value={form.functionTitle} onChange={e => set('functionTitle', e.target.value)}
              className="input-field" placeholder="z.B. Kommandant, Schriftführer" />
              <DiktatButton onResult={text => set('functionTitle', text)} />
            </div>
          </Field>
          <Field label="Gruppe / Zug">
            <div className="flex gap-2 items-center">
              <input type="text" value={form.groupName} onChange={e => set('groupName', e.target.value)} className="input-field" />
              <DiktatButton onResult={text => set('groupName', text)} />
            </div>
          </Field>
        </Section>

        <Section title="Kontakt & Adresse">
          <Field label="Straße">
            <div className="flex gap-2 items-center">
              <input type="text" value={form.street} onChange={e => set('street', e.target.value)} className="input-field" />
              <DiktatButton onResult={text => set('street', text)} />
            </div>
          </Field>
          <Field label="PLZ">
            <div className="flex gap-2 items-center">
              <input type="text" value={form.zipCode} onChange={e => set('zipCode', e.target.value)} className="input-field" />
              <DiktatButton onResult={text => set('zipCode', text)} />
            </div>
          </Field>
          <Field label="Ort">
            <div className="flex gap-2 items-center">
              <input type="text" value={form.city} onChange={e => set('city', e.target.value)} className="input-field" />
              <DiktatButton onResult={text => set('city', text)} />
            </div>
          </Field>
          <Field label="Telefon">
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field" />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field" />
          </Field>
        </Section>

        <Section title="Funktionen">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Führerscheinklassen</label>
            <div className="flex flex-wrap gap-2">
              {DRIVER_LICENSES.map(l => (
                <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                  form.driverLicenses.includes(l) ? 'border-fire-700 bg-fire-50 text-fire-700 font-medium' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="checkbox" checked={form.driverLicenses.includes(l)} onChange={() => toggleLicense(l)} className="sr-only" />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">Funktionen</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const isFemale = form.gender === 'female';
                const quals = [
                  { field: 'isBreathingApparatus', male: 'Atemschutzträger',         female: 'Atemschutzträgerin' },
                  { field: 'isMachinist',          male: 'Maschinist',               female: 'Maschinistin' },
                  { field: 'isDriver',             male: 'Kraftfahrer',              female: 'Kraftfahrerin' },
                  { field: 'isRadioOperator',      male: 'Funker',                   female: 'Funkerin' },
                  { field: 'isParamedic',          male: 'Feuerwehrsanitäter',       female: 'Feuerwehrsanitäterin' },
                  { field: 'isDiver',              male: 'Taucher',                  female: 'Taucherin' },
                  { field: 'isFlightHelper',       male: 'Flughelfer',               female: 'Flughelferin' },
                  { field: 'isHazmatExpert',       male: 'Schadstoffexperte',        female: 'Schadstoffexpertin' },
                  { field: 'isExplosivesExpert',   male: 'Sprengbefugter',           female: 'Sprengbefugte' },
                  { field: 'isMRAS',               male: 'MRAS',                     female: 'MRAS' },
                  { field: 'isRescueCutter',       male: 'Bergeschere',              female: 'Bergeschere' },
                  { field: 'isEquipmentManager',   male: 'Gerätewart',               female: 'Gerätewartin' },
                  { field: 'isYouthLeader',        male: 'Jugendbetreuer',           female: 'Jugendbetreuerin' },
                ];
                return quals.map(q => (
                  <label key={q.field} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox"
                      checked={!!(form as any)[q.field]}
                      onChange={e => set(q.field, e.target.checked)}
                      className="w-4 h-4 rounded accent-fire-700" />
                    <span className="text-sm">{isFemale ? q.female : q.male}</span>
                  </label>
                ));
              })()}
            </div>
          </div>
          <Field label="Ausbildungen / Lehrgänge" full>
            <TrainingMultiSelect
              value={Array.isArray(form.trainings) ? form.trainings : []}
              onChange={v => set('trainings', v)}
              isFemale={form.gender === 'female'}
            />
          </Field>
        </Section>

        <Section title="Notfallkontakt">
          <Field label="Name Notfallkontakt">
            <div className="flex gap-2 items-center">
              <input type="text" value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} className="input-field" />
              <DiktatButton onResult={text => set('emergencyContactName', text)} />
            </div>
          </Field>
          <Field label="Telefon Notfallkontakt">
            <input type="tel" value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} className="input-field" />
          </Field>
        </Section>

        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Bemerkungen</h2>
          <div className="flex gap-2 items-start">
<div className="flex gap-2 items-center">
  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            className="input-field resize-none" rows={4} placeholder="Interne Anmerkungen..." />
  <DiktatButton onResult={text => set('notes', text)} />
</div>
<DiktatButton onResult={text => set('notes', text)} /></div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => id ? guardedNavigate(`/members/${id}`) : guardedNavigate('/members')} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Änderungen speichern' : 'Kamerad:in anlegen'}
          </button>
        </div>
      </form>
    </div>
      <UnsavedChangesModal
        onSave={async () => { try { await handleSubmit(); return true; } catch { return false; } }}
        onResolve={resolveGuard}
      />
    </>
  );
}
