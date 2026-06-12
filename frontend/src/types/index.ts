export type UserRole = 'ADMIN' | 'COMMANDER' | 'DEPUTY_COMMANDER' | 'SECRETARY' | 'GROUP_COMMANDER' | 'MEMBER';
export type MemberStatus = 'ACTIVE' | 'RESERVE' | 'YOUTH' | 'HONORARY' | 'EXITED';
export type EventType = 'MEETING' | 'EXERCISE' | 'INCIDENT' | 'FIRE_INCIDENT' | 'TECHNICAL_INCIDENT' | 'FUNERAL' | 'EVENT' | 'TRAINING' | 'OTHER';
export type ExerciseType = 'RADIO' | 'DISTRICT' | 'COMMUNITY' | 'DISASTER' | 'DRIVE' | 'OTHER';
export type OrgEventType = 'MEETING' | 'FUNERAL' | 'EVENT' | 'TRAINING' | 'OTHER';
export type KommandoTerminType = 'AUSSCHUSS' | 'KOMMANDO';
export type AttendanceStatus = 'PRESENT' | 'EXCUSED' | 'ABSENT';
export type IncidentType = 'FIRE' | 'TECHNICAL' | 'TRAFFIC_ACCIDENT' | 'STORM' | 'SEARCH' | 'OTHER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  memberId?: string;
  member?: { firstName: string; lastName: string; rank?: string; memberNumber?: string };
}

export interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  street?: string;
  zipCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  entryDate?: string;
  exitDate?: string;
  rank?: string;
  functionTitle?: string;
  status: MemberStatus;
  groupName?: string;
  driverLicenses: string[];
  isBreathingApparatus: boolean;
  isMachinist: boolean;
  hasFirstAidTraining: boolean;
  trainings: string[];
  clothingSizes?: Record<string, string>;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  honors?: Honor[];
  attendances?: Attendance[];
}

export interface Event {
  id: string;
  type: EventType;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  responsiblePersonId?: string;
  responsiblePerson?: { id: string; firstName: string; lastName: string };
  notes?: string;
  createdAt: string;
  _count?: { attendances: number };
  attendances?: Attendance[];
}

export interface Attendance {
  id: string;
  eventId: string;
  memberId: string;
  member?: Pick<Member, 'id' | 'firstName' | 'lastName' | 'rank' | 'groupName' | 'memberNumber'>;
  event?: Pick<Event, 'title' | 'type' | 'date'>;
  status: AttendanceStatus;
  notes?: string;
}

export interface Incident {
  id: string;
  incidentNumber: string;
  type: IncidentType;
  alarmTime?: string;
  departureTime?: string;
  endTime?: string;
  location: string;
  commanderId?: string;
  shortReport?: string;
  actions?: string;
  specialOccurrences?: string;
  createdAt: string;
  _count?: { members: number };
}

export interface Honor {
  id: string;
  memberId: string;
  member?: Pick<Member, 'id' | 'firstName' | 'lastName' | 'memberNumber'>;
  title: string;
  honorDate: string;
  reason?: string;
  awardedBy?: string;
  notes?: string;
}

export interface DashboardData {
  stats: {
    activeMembers: number;
    reserveMembers: number;
    youthMembers: number;
    honoraryMembers: number;
    totalEvents: number;
    totalPresences: number;
  };
  upcomingEvents: Event[];
  recentIncidents: Incident[];
  upcomingBirthdays: Array<Member & { daysUntil: number; nextAge: number; age: number; isToday: boolean }>;
  recentHonors: Honor[];
}

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Aktiv',
  RESERVE: 'Reservist',
  YOUTH: 'Jugend',
  HONORARY: 'Ehrenmitglied',
  EXITED: 'Ausgetreten',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MEETING: 'Sitzung',
  EXERCISE: 'Übung',
  INCIDENT: 'Einsatz',
  FIRE_INCIDENT: 'Brandeinsatz',
  TECHNICAL_INCIDENT: 'Technischer Einsatz',
  FUNERAL: 'Beerdigung',
  EVENT: 'Veranstaltung',
  TRAINING: 'Schulung',
  OTHER: 'Sonstiges',
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  RADIO: 'Funkübung',
  DISTRICT: 'Abschnittsübung',
  COMMUNITY: 'Gemeindeübung',
  DISASTER: 'Katastrophenschutzübung',
  DRIVE: 'Übungsfahrt',
  OTHER: 'Sonstiges',
};

export const ORG_EVENT_TYPE_LABELS: Record<OrgEventType, string> = {
  MEETING: 'Sitzung',
  FUNERAL: 'Beerdigung',
  EVENT: 'Veranstaltung',
  TRAINING: 'Schulung',
  OTHER: 'Sonstiges',
};

export const KOMMANDO_TERMIN_TYPE_LABELS: Record<KommandoTerminType, string> = {
  AUSSCHUSS: 'Ausschusssitzung',
  KOMMANDO: 'Kommandositzung',
};

// Nur diese Typen im Ereignis-Formular anzeigen (Punkt 8)
export const EVENT_FORM_TYPES: Partial<Record<EventType, string>> = {
  MEETING: 'Sitzung',
  FUNERAL: 'Beerdigung',
  EVENT: 'Veranstaltung',
  TRAINING: 'Schulung',
  OTHER: 'Sonstiges',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  FIRE: 'Brandeinsatz',
  TECHNICAL: 'Technischer Einsatz',
  TRAFFIC_ACCIDENT: 'Verkehrsunfall',
  STORM: 'Unwettereinsatz',
  SEARCH: 'Suchaktion',
  OTHER: 'Sonstiger Einsatz',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator/in',
  COMMANDER: 'Kommandant/in',
  DEPUTY_COMMANDER: 'Stellvertreter/in',
  SECRETARY: 'Schriftführer/in',
  GROUP_COMMANDER: 'Gruppenkommandant/in',
  MEMBER: 'Mitglied',
};

export const USER_ROLE_LABELS_MALE: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  COMMANDER: 'Kommandant',
  DEPUTY_COMMANDER: 'Stellvertreter',
  SECRETARY: 'Schriftführer',
  GROUP_COMMANDER: 'Gruppenkommandant',
  MEMBER: 'Mitglied',
};

export const USER_ROLE_LABELS_FEMALE: Record<UserRole, string> = {
  ADMIN: 'Administratorin',
  COMMANDER: 'Kommandantin',
  DEPUTY_COMMANDER: 'Stellvertreterin',
  SECRETARY: 'Schriftführerin',
  GROUP_COMMANDER: 'Gruppenkommandantin',
  MEMBER: 'Mitglied',
};

export function getRoleLabel(role: UserRole, gender?: string | null): string {
  if (gender === 'female') return USER_ROLE_LABELS_FEMALE[role] || role;
  if (gender === 'male') return USER_ROLE_LABELS_MALE[role] || role;
  return USER_ROLE_LABELS[role] || role;
}
