// Shared types for Schriftverkehr

export interface LetterDesign {
  id: string;
  name: string;
  isSystem?: boolean;
  category?: string;
  headerBgColor: string;
  headerBgImage?: string;
  headerBgImageOpacity: number;
  headerLogoLeft?: string;
  headerLogoRight?: string;
  headerLogoCenter?: string;
  headerLogoPosition: string;
  headerTitle: string;
  headerSubtitle: string;
  headerTitleColor: string;
  headerTitleSize: number;
  bodyBgColor: string;
  bodyBgImage?: string;
  bodyBgImageOpacity: number;
  fontFamily: string;
  fontSize: number;
  senderName: string;
  senderAddress: string;
  senderPhone: string;
  senderEmail: string;
  senderWebsite: string;
  senderCity: string;
  senderLineText: string;
  template?: string;
}

export interface LetterTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
}

export interface LetterContact {
  id: string;
  name: string;
  function?: string;
  organization?: string;
  street?: string;
  zip?: string;
  city?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  status: string;
  rank?: string;
}

export interface Signer {
  userId: string;
  name: string;
  function: string;
  hasSignature: boolean;
}

export type TrainingEntryType = 'EINSATZ' | 'FUNK' | 'GEMEINDE' | 'ABSCHNITT' | 'SONSTIGE';

export interface TrainingPlanEntry {
  id: string;
  planId: string;
  date: string;
  time?: string | null;
  type: TrainingEntryType;
  title: string;
  location?: string | null;
  leaderId?: string | null;
  leaderName?: string | null;
  calendarId?: string | null;
  sortOrder: number;
}

export interface TrainingPlan {
  id: string;
  year: number;
  title?: string | null;
  createdBy: string;
  createdByName: string;
  designId?: string | null;
  designSnapshot?: string | null;
  signerUserIds: string;
  closing: string;
  status: string;
  sendCount: number;
  lastSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  entries: TrainingPlanEntry[];
}

export interface SentLetter {
  id: string;
  sentByName: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  signers: string;
  recipients: string;
  sendMode: string;
  status: string;
  createdAt: string;
  designSnapshot?: string;
  template?: { name: string }

