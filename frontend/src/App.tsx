import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { PermissionProvider } from './utils/PermissionContext';
import { useBranding } from './utils/BrandingContext';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { Shield, CheckCircle } from 'lucide-react';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import MemberDetailPage from './pages/MemberDetailPage';
import MemberFormPage from './pages/MemberFormPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import ExercisesPage from './pages/ExercisesPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import OrgEventsPage from './pages/OrgEventsPage';
import OrgEventDetailPage from './pages/OrgEventDetailPage';
import KommandoTerminePage from './pages/KommandoTerminePage';
import KommandoTermineDetailPage from './pages/KommandoTermineDetailPage';
import EventFormPage from './pages/EventFormPage';
import AttendancePage from './pages/AttendancePage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentFormPage from './pages/IncidentFormPage';
import BirthdaysPage from './pages/BirthdaysPage';
import HonorsPage from './pages/HonorsPage';
import ReportsPage from './pages/ReportsPage';
import JahresberichtPage from './pages/JahresberichtPage';
import JahresberichtStartPage from './pages/JahresberichtStartPage';
import BerichtSpeichernPage from './pages/BerichtSpeichernPage';
import BerichteKommandoPage from './pages/BerichteKommandoPage';
import SchriftverkehrPage from './pages/SchriftverkehrPage';
import BerichteDetailPage from './pages/BerichteDetailPage';
import PermissionsPage from './pages/PermissionsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import TwoFactorPage from './pages/TwoFactorPage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import PushInboxPage from './pages/PushInboxPage';
import PushOverviewPage from './pages/PushOverviewPage';
import MeinProfilPage from './pages/MeinProfilPage';
import EinsatzplaenePage from './pages/EinsatzplaenePage';
import { EinsatzplaeneCacheProvider } from './utils/EinsatzplaeneCacheContext';

import MemberListPage from './pages/MemberListPage';
import ProtocolsPage from './pages/ProtocolsPage';
import ProtocolUploadPage from './pages/ProtocolUploadPage';
import ProtocolDetailPage from './pages/ProtocolDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import CategoryCreatePage from './pages/CategoryCreatePage';
import DocumentsPublicPage from './pages/DocumentsPublicPage';
import CalendarPage from './pages/CalendarPage';
import CalendarEventFormPage from './pages/CalendarEventFormPage';
import CalendarCategoryPage from './pages/CalendarCategoryPage';
import CalendarCommandPage from './pages/CalendarCommandPage';
import UserAccountPage from './pages/UserAccountPage';
import VehicleLogbookPage from './pages/VehicleLogbookPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import VehicleFormPage from './pages/VehicleFormPage';
import TripFormPage from './pages/TripFormPage';
import FuelFormPage from './pages/FuelFormPage';
import MaintenanceFormPage from './pages/MaintenanceFormPage';
import EquipmentPage from './pages/EquipmentPage';
import EquipmentDetailPage from './pages/EquipmentDetailPage';
import EquipmentFormPage from './pages/EquipmentFormPage';
import EquipmentEntryFormPage from './pages/EquipmentEntryFormPage';
import CategoryCreatePublicPage from './pages/CategoryCreatePublicPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [privacyStatus, setPrivacyStatus] = useState<{
    required: boolean; accepted: boolean; privacyText: string | null;
    privacyVersionNote: string | null; currentVersion: number;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineConfirm, setDeclineConfirm] = useState(false);
  const { logout } = useAuth();

  const checkPrivacy = useCallback(async () => {
    try {
      const res = await api.get('/privacy/status');
      setPrivacyStatus(res.data);
    } catch {
      setPrivacyStatus({ required: false, accepted: true, privacyText: null, privacyVersionNote: null, currentVersion: 0 });
    }
  }, []);

  useEffect(() => {
    if (user) checkPrivacy();
  }, [user, checkPrivacy]);

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (privacyStatus === null) return null;

  if (privacyStatus.required && privacyStatus.privacyText) {
    const ps = privacyStatus as any;
    const headerBg = ps.privacyHeaderBg || '#1e293b';
    const headerText = ps.privacyHeaderText || '#ffffff';
    const pageBg = ps.privacyPageBg || '#f1f5f9';
    const buttonBg = ps.privacyButtonBg || '#16a34a';
    const contentText = ps.privacyContentText || '#374151';
    const logoUrl = ps.logoUrl || null;
    const fwName = ps.name || 'Datenschutzinformation';

    const handleAccept = async () => {
      setAccepting(true);
      try {
        await api.post('/privacy/accept');
        setPrivacyStatus(prev => prev ? { ...prev, required: false, accepted: true } : null);
      } catch {
        setAccepting(false);
      }
    };

    const handleDecline = async () => {
      setDeclining(true);
      setTimeout(() => { logout(); }, 3000);
    };

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: pageBg }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">

          {/* Header */}
          <div className="px-6 py-5 flex items-center gap-4 flex-shrink-0" style={{ background: headerBg }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-10 h-10" style={{ color: headerText }} />
              </div>
            )}
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: 'var(--font-privacy)', color: headerText }}>
                Datenschutzinformation
              </h2>
              <p className="text-xs mt-0.5" style={{ color: headerText + 'bb' }}>
                {fwName} — Bitte nimm dir einen Moment und lies die folgende Information
              </p>
            </div>
          </div>

          {/* Änderungsgrund */}
          {privacyStatus.privacyVersionNote && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex-shrink-0 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">ℹ️</span>
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Was hat sich geändert? </span>
                {privacyStatus.privacyVersionNote}
              </p>
            </div>
          )}

          {/* Text */}
          <div className="px-6 py-5 overflow-y-auto flex-1">
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: contentText }}>
              {privacyStatus.privacyText}
            </div>
          </div>

          {/* Footer */}
          {!declineConfirm ? (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex-shrink-0 space-y-2">
              <button onClick={handleAccept} disabled={accepting}
                className="w-full px-4 py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                style={{ background: buttonBg }}>
                {accepting
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird gespeichert...</>
                  : <><CheckCircle className="w-4 h-4" /> Ich habe die Datenschutzinformation gelesen und bestätige sie</>
                }
              </button>
              <button onClick={() => setDeclineConfirm(true)} className="w-full px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-sm transition-colors">
                Nicht zustimmen
              </button>
              <p className="text-xs text-slate-400 text-center">Version {privacyStatus.currentVersion}</p>
            </div>
          ) : (
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex-shrink-0 space-y-4">
              {!declining ? (
                <>
                  <p className="text-sm text-slate-700 text-center leading-relaxed">
                    Du hast die Datenschutzinformation nicht bestätigt. Ohne Zustimmung ist leider kein Zugang zum System möglich. Du wirst jetzt abgemeldet.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeclineConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors">Zurück</button>
                    <button onClick={handleDecline} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium transition-colors">Abmelden</button>
                  </div>
                </>
              ) : (
                <div className="text-center py-2 space-y-2">
                  <p className="text-sm text-slate-600">Du wirst in Kürze abgemeldet...</p>
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  // Sync hier – innerhalb AuthProvider, user + Token bereits verfügbar
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/new" element={<MemberFormPage />} />
        <Route path="members/:id" element={<MemberDetailPage />} />
        <Route path="members/:id/edit" element={<MemberFormPage />} />
        <Route path="members/:memberId/account" element={<UserAccountPage />} />
        <Route path="vehicles" element={<VehicleLogbookPage />} />
        <Route path="vehicles/new" element={<VehicleFormPage />} />
        <Route path="vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="vehicles/:id/edit" element={<VehicleFormPage />} />
        <Route path="trips/new" element={<TripFormPage />} />
        <Route path="trips/:id/edit" element={<TripFormPage />} />
        <Route path="fuel/new" element={<FuelFormPage />} />
        <Route path="fuel/:id/edit" element={<FuelFormPage />} />
        <Route path="maintenance/new" element={<MaintenanceFormPage />} />
        <Route path="maintenance/:id/edit" element={<MaintenanceFormPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="equipment/new" element={<EquipmentFormPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="equipment/:id/edit" element={<EquipmentFormPage />} />
        <Route path="equipment/:id/:type/new" element={<EquipmentEntryFormPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/new" element={<EventFormPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="events/:id/edit" element={<EventFormPage />} />
        <Route path="events/:id/attendance" element={<AttendancePage />} />
        <Route path="exercises" element={<ExercisesPage />} />
        <Route path="exercises/:id" element={<ExerciseDetailPage />} />
        <Route path="org-events" element={<OrgEventsPage />} />
        <Route path="org-events/:id" element={<OrgEventDetailPage />} />
        <Route path="kommando-termine" element={<KommandoTerminePage />} />
        <Route path="kommando-termine/:id" element={<KommandoTermineDetailPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/new" element={<IncidentFormPage />} />
        <Route path="incidents/:id/edit" element={<IncidentFormPage />} />
        <Route path="birthdays" element={<BirthdaysPage />} />
        <Route path="honors" element={<HonorsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/jahresbericht" element={<JahresberichtPage />} />
        <Route path="jahresbericht" element={<JahresberichtStartPage />} />
        <Route path="reports/speichern" element={<BerichtSpeichernPage />} />
        <Route path="berichte/:bereich" element={<BerichteKommandoPage />} />
        <Route path="schriftverkehr" element={<SchriftverkehrPage />} />
        <Route path="berichte/:bereich/:id" element={<BerichteDetailPage />} />
        <Route path="administration/permissions" element={<PermissionsPage />} />
        <Route path="protocols" element={<ProtocolsPage />} />
        <Route path="protocols/new" element={<ProtocolUploadPage />} />
        <Route path="protocols/:id" element={<ProtocolDetailPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/new" element={<CategoryCreatePage />} />
        <Route path="documents/edit" element={<CategoryCreatePage />} />
        <Route path="documents/upload" element={<DocumentUploadPage />} />
        <Route path="documents/:id" element={<DocumentDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="calendar/new" element={<CalendarEventFormPage />} />
        <Route path="calendar/:id/edit" element={<CalendarEventFormPage />} />
        <Route path="calendar/categories" element={<CalendarCategoryPage />} />
        <Route path="calendar-command" element={<CalendarCommandPage />} />
        <Route path="calendar-command/new" element={<CalendarEventFormPage isCommand />} />
        <Route path="calendar-command/:id/edit" element={<CalendarEventFormPage isCommand />} />
        <Route path="calendar-command/categories" element={<CalendarCategoryPage isCommand />} />
        <Route path="documents-public" element={<DocumentsPublicPage />} />
        <Route path="documents-public/new" element={<CategoryCreatePublicPage />} />
        <Route path="documents-public/edit" element={<CategoryCreatePublicPage />} />
        <Route path="documents-public/upload" element={<DocumentUploadPage />} />
        <Route path="documents-public/:id" element={<DocumentDetailPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="two-factor" element={<TwoFactorPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="inbox" element={<PushInboxPage />} />
        <Route path="push-uebersicht" element={<PushOverviewPage />} />
        <Route path="mein-profil" element={<MeinProfilPage />} />
        <Route path="einsatzplaene" element={<EinsatzplaenePage />} />
        <Route path="members/list" element={<MemberListPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
        <PermissionProvider>
      <EinsatzplaeneCacheProvider>
      <AppRoutes />
      </EinsatzplaeneCacheProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '10px', background: '#1e293b', color: '#fff' },
          success: { style: { background: '#166534', color: '#fff' } },
          error: { style: { background: '#991b1b', color: '#fff' } },
        }}
      />
        </PermissionProvider>
    </AuthProvider>
  );
}
