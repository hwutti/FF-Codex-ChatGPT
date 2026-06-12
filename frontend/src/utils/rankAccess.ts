// Dienstgrade die keinen Zugriff auf Berichte und Dokumente haben
const RESTRICTED_RANKS = [
  // Männlich
  'PFM: Probefeuerwehrmann',
  'FM: Feuerwehrmann',
  'OFM: Oberfeuerwehrmann',
  'HFM: Hauptfeuerwehrmann',
  // Weiblich
  'PFM: Probefeuerwehrfrau',
  'FM: Feuerwehrfrau',
  'OFM: Oberfeuerwehrfrau',
  'HFM: Hauptfeuerwehrfrau',
];

export function hasAdvancedAccess(user: any): boolean {
  // Admins, Commanders etc. haben immer Zugriff
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'COMMANDER') return true;
  if (user.role === 'DEPUTY_COMMANDER') return true;
  if (user.role === 'SECRETARY') return true;

  // Für MEMBER-Rolle: Dienstgrad prüfen
  const rank = user.member?.rank || '';
  if (!rank) return true; // Kein Dienstgrad = Zugriff erlaubt

  // Prüfen ob Dienstgrad in der gesperrten Liste ist
  const rankCode = rank.split(':')[0].trim();
  const restricted = ['PFM', 'FM', 'OFM', 'HFM'];
  return !restricted.includes(rankCode);
}
