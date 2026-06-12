import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Calendar, Shield, Award, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { memberApi } from '../api';
import api from '../api';
import { Member, MEMBER_STATUS_LABELS } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '../utils/AuthContext';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function BoolBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-sm ${value ? 'text-green-700' : 'text-gray-400'}`}>
      {value ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {label}
    </div>
  );
}

const TRAINING_FEMALE: Record<string, string> = {
  'Führen I – Gruppenkommandantenlehrgang': 'Führen I – Gruppenkommandantinnenlehrgang',
  'Führen II – Einsatzleiterlehrgang': 'Führen II – Einsatzleiterinnenlehrgang',
  'Kommandantenseminar': 'Kommandantinnenseminar',
  'Kommandantenseminar Betriebsfeuerwehren': 'Kommandantinnenseminar Betriebsfeuerwehren',
  'Kommandanten-Weiterbildungsseminar „Vorbeugender Brandschutz-Grundlagen“': 'Kommandantinnen-Weiterbildungsseminar „Vorbeugender Brandschutz-Grundlagen“',
  'Lehrgang „Kameradschaftsführer“': 'Lehrgang „Kameradschaftsführerin“',
  'Jugendhelfer': 'Junghelfer',
};

export default function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = ['ADMIN', 'COMMANDER', 'DEPUTY_COMMANDER', 'SECRETARY'].includes(user?.role || '');
  const isAdmin = user?.role === 'ADMIN';

  const [showForceDelete, setShowForceDelete] = useState(false);
  const [forceDeletePreview, setForceDeletePreview] = useState<any>(null);
  const [confirmName, setConfirmName] = useState('');
  const [forceDeleting, setForceDeleting] = useState(false);

  const openForceDelete = async () => {
    try {
      const res = await api.get(`/members/${id}/force-delete-preview`);
      setForceDeletePreview(res.data);
      setConfirmName('');
      setShowForceDelete(true);
    } catch {
      toast.error('Fehler beim Laden der Vorschau');
    }
  };

  const handleForceDelete = async () => {
    if (!forceDeletePreview) return;
    const fullName = `${forceDeletePreview.member.firstName.trim()} ${forceDeletePreview.member.lastName.trim()}`;
    if (confirmName !== fullName) {
      toast.error('Name stimmt nicht überein');
      return;
    }
    setForceDeleting(true);
    try {
      await api.delete(`/members/${id}/force`, { data: { confirmName } });
      toast.success('Mitglied vollständig gelöscht');
      navigate('/members');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Fehler beim Löschen');
    } finally {
      setForceDeleting(false);
    }
  };

  useEffect(() => {
    memberApi.get(id!)
      .then(setMember)
      .catch(() => { toast.error('Kamerad:in nicht gefunden'); navigate('/members'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(`Kamerad:in ${member?.firstName} ${member?.lastName} wirklich als ausgetreten markieren?`)) return;
    try {
      await memberApi.delete(id!);
      toast.success('Kamerad:in als ausgetreten markiert');
      navigate('/members');
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-fire-700 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!member) return null;

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    RESERVE: 'bg-blue-100 text-blue-800',
    YOUTH: 'bg-purple-100 text-purple-800',
    HONORARY: 'bg-yellow-100 text-yellow-800',
    EXITED: 'bg-gray-100 text-gray-600',
  };

  const age = member.birthDate
    ? Math.floor((Date.now() - new Date(member.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const yearsOfService = member.entryDate
    ? Math.floor((Date.now() - new Date(member.entryDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <button onClick={() => navigate('/members')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Zurück</span>
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <Link to={`/members/${id}/edit`} className="btn-secondary text-sm flex items-center gap-1.5">
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Link>
            <button onClick={handleDelete} className="btn-danger text-sm flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Austritt</span>
            </button>
            {isAdmin && (
              <button onClick={openForceDelete} className="btn-danger text-sm flex items-center gap-1.5" title="Mitglied vollständig löschen">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Löschen</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Force Delete Modal */}
      {showForceDelete && forceDeletePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForceDelete(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Mitglied vollständig löschen</h2>
                <p className="text-xs text-red-600 font-medium">Diese Aktion kann nicht rückgängig gemacht werden</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800 space-y-1">
              <p className="font-semibold">Folgende Daten werden unwiderruflich gelöscht:</p>
              {(() => {
                const c = forceDeletePreview.counts;
                const items = [
                  c.attendances > 0 && `${c.attendances} Anwesenheiten (Veranstaltungen)`,
                  c.exerciseAttendances > 0 && `${c.exerciseAttendances} Anwesenheiten (Übungen)`,
                  c.orgEventAttendances > 0 && `${c.orgEventAttendances} Anwesenheiten (Ereignisse)`,
                  c.kommandoAttendances > 0 && `${c.kommandoAttendances} Anwesenheiten (Kommandotermine)`,
                  c.incidentMembers > 0 && `${c.incidentMembers} Einsatz-Teilnahmen`,
                  c.honors > 0 && `${c.honors} Ehrungen`,
                  forceDeletePreview.hasUser && 'Login-Account',
                  'Mitgliedsdaten',
                ].filter(Boolean);
                const neutral = [
                  c.trips > 0 && `${c.trips} Fahrten (bleiben, Fahrer wird geleert)`,
                  c.responsibleEvents > 0 && `${c.responsibleEvents} Veranstaltungen (bleiben, Verantwortlicher wird geleert)`,
                  c.responsibleExercises > 0 && `${c.responsibleExercises} Übungen (bleiben, Verantwortlicher wird geleert)`,
                  c.trainingPlanEntries > 0 && `${c.trainingPlanEntries} Übungsplan-Einträge (bleiben, Leiter wird geleert)`,
                  c.schulungsplanEntries > 0 && `${c.schulungsplanEntries} Schulungsplan-Einträge (bleiben, Trainer wird geleert)`,
                ].filter(Boolean);
                return (
                  <>
                    <ul className="list-disc list-inside space-y-0.5">{items.map((i,k) => <li key={k}>{i}</li>)}</ul>
                    {neutral.length > 0 && (
                      <>
                        <p className="font-semibold mt-2 text-amber-800">Erhalten bleiben (Referenz wird geleert):</p>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-800">{neutral.map((i,k) => <li key={k}>{i}</li>)}</ul>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                Zur Bestätigung den vollständigen Namen eingeben:
              </label>
              <p className="text-sm font-mono bg-surface-100 px-3 py-1.5 rounded-lg mb-2 text-ink">
                {forceDeletePreview.member.firstName.trim()} {forceDeletePreview.member.lastName.trim()}
              </p>
              <input
                type="text"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder="Namen hier eingeben..."
                className="input-field"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowForceDelete(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button
                onClick={handleForceDelete}
                disabled={confirmName.trim() !== `${forceDeletePreview.member.firstName.trim()} ${forceDeletePreview.member.lastName.trim()}` || forceDeleting}
                className="btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {forceDeleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden"
            style={{ background: 'rgba(168,40,40,0.1)', border: '2px solid rgba(168,40,40,0.2)' }}>
            {member.profileImage
              ? <img src={member.profileImage} alt={member.firstName} className="w-full h-full object-cover" />
              : member.user?.avatarUrl
              ? <img src={member.user.avatarUrl} alt={member.firstName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-fire-700 font-bold text-2xl">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
            }
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-start gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{member.lastName} {member.firstName}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[member.status]}`}>
                {MEMBER_STATUS_LABELS[member.status]}
              </span>
            </div>
            <p className="text-gray-600">{member.rank}</p>
            <p className="text-sm text-gray-500">{member.functionTitle}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">#{member.memberNumber}</span>
              {age && <span>{age} Jahre</span>}
              {yearsOfService && <span>{yearsOfService} Dienstjahre</span>}
              {member.groupName && <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{member.groupName}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contact */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-fire-700" />
            Kontakt & Adresse
          </h2>
          <div className="space-y-0">
            <InfoRow label="Telefon" value={member.phone} />
            <InfoRow label="E-Mail" value={member.email} />
            <InfoRow label="Straße" value={member.street} />
            <InfoRow label="PLZ / Ort" value={member.zipCode && member.city ? `${member.zipCode} ${member.city}` : member.city} />
            <InfoRow label="Notfallkontakt" value={member.emergencyContactName} />
            <InfoRow label="Notfalltelefon" value={member.emergencyContactPhone} />
          </div>
        </div>

        {/* Personal */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-fire-700" />
            Persönliche Daten
          </h2>
          <div>
            <InfoRow label="Geburtsdatum" value={member.birthDate ? format(new Date(member.birthDate), 'd. MMMM yyyy', { locale: de }) : undefined} />
            {member.deathDate && <InfoRow label="Sterbedatum" value={format(new Date(member.deathDate), 'd. MMMM yyyy', { locale: de })} />}
            <InfoRow label="Eintrittsdatum" value={member.entryDate ? format(new Date(member.entryDate), 'd. MMMM yyyy', { locale: de }) : undefined} />
            {member.fireServicePassNumber && <InfoRow label="Feuerwehrpass-Nr." value={member.fireServicePassNumber} />}
            {member.exitDate && <InfoRow label="Austrittsdatum" value={format(new Date(member.exitDate), 'd. MMMM yyyy', { locale: de })} />}
            <InfoRow label="Führerscheinklassen" value={member.driverLicenses?.join(', ')} />
          </div>
        </div>

        {/* Qualifications */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Funktionen</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {(() => {
              const isFemale = member.gender === 'female';
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
                { field: 'hasFirstAidTraining',  male: 'Erste-Hilfe-Ausbildung',   female: 'Erste-Hilfe-Ausbildung' },
              ];
              const active = quals.filter(q => (member as any)[q.field]);
              if (active.length === 0) return <p className="text-sm text-gray-400">Keine Funktionen eingetragen</p>;
              return active.map(q => (
                <span key={q.field} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-fire-50 text-fire-700 ring-1 ring-fire-200 font-medium">
                  ✓ {isFemale ? q.female : q.male}
                </span>
              ));
            })()}
          </div>
          {member.trainings && member.trainings.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Ausbildungen / Lehrgänge</p>
              <div className="flex flex-wrap gap-1.5">
                {member.trainings.map((t, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Honors */}
        {member.honors && member.honors.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-fire-700" />
              Ehrungen
            </h2>
            <div className="space-y-3">
              {member.honors.map(honor => (
                <div key={honor.id} className="flex items-start gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <Award className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{honor.title}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(honor.honorDate), 'd.M.yyyy')}
                      {honor.awardedBy && ` · ${honor.awardedBy}`}
                    </p>
                    {honor.reason && <p className="text-xs text-gray-500 mt-0.5">{honor.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {member.notes && (
        <div className="card p-5 mt-4">
          <h2 className="font-semibold text-gray-900 mb-2">Bemerkungen</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{member.notes}</p>
        </div>
      )}
    </div>
  );
}
