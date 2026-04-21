// src/App.tsx
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, type AppRole, useAuth } from "./auth/AuthProvider";
import { ClinicProvider } from "./features/clinics/context/ClinicContext";
import { supabase } from "./lib/supabase";

import AppStatusFooter from "./components/AppStatusFooter";
import { buildOnboardingRoute } from "./lib/routeFlow";
import { PROVIDER_ROUTES, providerPatientCenterLegacyPath, providerPatientCenterPath, providerVisitChartPath } from "./lib/providerRoutes";

const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const Login = lazy(() => import("./pages/Login"));
const PublicLanding = lazy(() => import("./pages/PublicLandingSimplified"));
const PublicServices = lazy(() => import("./pages/PublicServices"));
const PublicServiceDetail = lazy(() => import("./pages/PublicServiceDetail"));
const PublicContact = lazy(() => import("./pages/PublicContact"));
const PublicBook = lazy(() => import("./pages/PublicBook"));
const PublicVitalAiLite = lazy(() => import("./pages/PublicVitalAiLite"));
const PublicAppGuide = lazy(() => import("./pages/PublicAppGuide"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

const PatientAuth = lazy(() => import("./pages/PatientAuth"));
const PatientHome = lazy(() => import("./pages/PatientHome"));
const PatientOnboarding = lazy(() => import("./pages/PatientOnboarding"));
const PatientLabs = lazy(() => import("./pages/PatientLabs"));
const PatientConversationCenter = lazy(() => import("./pages/PatientConversationCenter"));
const PatientTreatments = lazy(() => import("./pages/PatientTreatments"));
const PatientTreatmentDetail = lazy(() => import("./pages/PatientTreatmentDetail"));
const PatientServices = lazy(() => import("./pages/PatientServices"));
const PatientBookAppointment = lazy(() => import("./pages/PatientBookAppointment"));
const PatientAssessment = lazy(() => import("./pages/PatientAssessment"));
const PatientVisitChart = lazy(() => import("./pages/PatientVisitChart"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VitalAiIntakeHome = lazy(() => import("./pages/VitalAiIntakeHome"));
const VitalAiSession = lazy(() => import("./pages/VitalAiSession"));
const VitalAiSessionReview = lazy(() => import("./pages/VitalAiSessionReview"));
const VitalAiSessionComplete = lazy(() => import("./pages/VitalAiSessionComplete"));

const ProviderHome = lazy(() => import("./pages/ProviderHome"));
const ProviderPatients = lazy(() => import("./pages/ProviderPatients"));
const ProviderPatientCenter = lazy(() => import("./pages/ProviderPatientCenter"));
const WoundTimeline = lazy(() => import("./pages/WoundTimeline"));
const ProviderIntake = lazy(() => import("./pages/ProviderIntake"));
const ProviderConversationCenter = lazy(() => import("./pages/ProviderConversationCenter"));
const ProviderLabs = lazy(() => import("./pages/ProviderLabs"));
const ProviderAI = lazy(() => import("./pages/ProviderAI"));
const IVRPacketPrint = lazy(() => import("./pages/IVRPacketPrint"));
const ProviderReferrals = lazy(() => import("./pages/ProviderReferrals"));
const ProviderReferralDetail = lazy(() => import("./pages/ProviderReferralDetail"));
const ProviderQueue = lazy(() => import("./pages/ProviderQueue"));
const ProviderVisitChart = lazy(() => import("./pages/ProviderVisitChart"));
const ProviderVisitBuilder = lazy(() => import("./pages/ProviderVisitBuilderVirtual"));
const ProviderVitalAiQueue = lazy(() => import("./pages/ProviderVitalAiQueue"));
const ProviderVitalAiProfileDetail = lazy(() => import("./pages/ProviderVitalAiProfileDetail"));
const ProviderCommandCenter = lazy(() => import("./pages/ProviderCommandCenter"));
const ProviderProtocolQueue = lazy(() => import("./features/protocols/pages/ProviderProtocolQueue"));
const ProviderProtocolReview = lazy(() => import("./features/protocols/pages/ProviderProtocolReview"));

const AdminHome = lazy(() => import("./pages/AdminHome"));
const AdminStaffManagement = lazy(() => import("./pages/AdminStaffManagement"));
const AdminInquiries = lazy(() => import("./pages/AdminInquiries"));
const AdminBookingRequests = lazy(() => import("./pages/AdminBookingRequests"));
const ServicesPanel = lazy(() => import("./pages/ServicesPanel"));
const AdminVitalAiQueue = lazy(() => import("./pages/AdminVitalAiQueue"));
const AdminVitalAiLeadDetail = lazy(() => import("./pages/AdminVitalAiLeadDetail"));
const AdminPublicVitalAiSubmissions = lazy(() => import("./pages/AdminPublicVitalAiSubmissions"));
const ClinicListPage = lazy(() => import("./features/clinics/pages/ClinicListPage"));
const ClinicDetailPage = lazy(() => import("./features/clinics/pages/ClinicDetailPage"));
const ClinicUsersPage = lazy(() => import("./features/clinics/pages/ClinicUsersPage"));
const ClinicSettingsPage = lazy(() => import("./features/clinics/pages/ClinicSettingsPage"));

function FullscreenLoader({
  text = "Loading...",
  secondary,
  onSecondary,
}: {
  text?: string;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="app-bg">
      <div className="shell">
        <div className="card card-pad" style={{ maxWidth: 720 }}>
          <div className="h1">Vitality Institute</div>
          <div className="space" />
          <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </div>
          {secondary && onSecondary && (
            <>
              <div className="space" />
              <button className="btn btn-primary" type="button" onClick={onSecondary}>
                {secondary}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const ADMIN_ROLES = ["super_admin", "location_admin"] as const;
const SUPER_ADMIN_ROLES = ["super_admin"] as const;
const PROVIDER_ROLES = [
  "super_admin",
  "location_admin",
  "provider",
  "clinical_staff",
  "billing",
  "front_desk",
] as const;
const PHYSICIAN_REVIEW_ROLES = ["super_admin", "provider"] as const;
const PATIENT_ROLES = ["patient"] as const;

function roleTroubleshootMessage(roleError?: string | null) {
  let msg = "Finalizing profile...\n\n";

  if (roleError) {
    msg += "ROLE ERROR:\n" + roleError + "\n\n";
    msg += "Most common causes:\n";
    msg += "- profiles row missing\n";
    msg += "- profiles.role is NULL\n";
    msg += "- RLS blocks profiles select\n";
  } else {
    msg += "If this stays here, your profiles role is missing or blocked by RLS.\n";
  }

  return msg;
}

function getErrorMessage(e: unknown, fallback: string) {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function Gate() {
  const { loading, user, role, roleError, refreshRole } = useAuth();

  if (loading) return <FullscreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (!role) {
    return (
      <FullscreenLoader
        text={roleTroubleshootMessage(roleError)}
        secondary="Retry role lookup"
        onSecondary={refreshRole}
      />
    );
  }

  if ((ADMIN_ROLES as readonly string[]).includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  if ((PROVIDER_ROLES as readonly string[]).includes(role)) {
    return <Navigate to={PROVIDER_ROUTES.home} replace />;
  }

  return <Navigate to="/patient/home" replace />;
}

function getHomeRouteForRole(role: AppRole | null) {
  if (!role) return "/";
  if ((ADMIN_ROLES as readonly string[]).includes(role)) return "/admin";
  if ((PROVIDER_ROLES as readonly string[]).includes(role)) return PROVIDER_ROUTES.home;
  return "/patient/home";
}

function PublicEntryRoute() {
  const { loading, user, role, roleError, refreshRole } = useAuth();

  if (loading) return <FullscreenLoader />;

  if (!user) return <PublicLanding />;

  if (!role) {
    return (
      <FullscreenLoader
        text={roleTroubleshootMessage(roleError)}
        secondary="Retry role lookup"
        onSecondary={refreshRole}
      />
    );
  }

  return <Navigate to={getHomeRouteForRole(role)} replace />;
}

function RequireRole({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { loading, user, role, roleError, refreshRole } = useAuth();

  if (loading) return <FullscreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (!role) {
    return (
      <FullscreenLoader
        text={roleTroubleshootMessage(roleError)}
        secondary="Retry role lookup"
        onSecondary={refreshRole}
      />
    );
  }

  if (!allow.includes(role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function withRole(allow: readonly string[], element: React.ReactNode) {
  return <RequireRole allow={[...allow]}>{element}</RequireRole>;
}

function PatientGate() {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      setErr(null);
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        setHasProfile(!!data?.id);
      } catch (e: unknown) {
        if (!cancelled) setErr(getErrorMessage(e, "Failed to check patient profile."));
        if (!cancelled) setHasProfile(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) return <FullscreenLoader />;

  if (err) {
    return (
      <FullscreenLoader
        text={`Patient profile check failed:\n${err}`}
        secondary="Retry"
        onSecondary={() => window.location.reload()}
      />
    );
  }

  if (!hasProfile) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildOnboardingRoute({ next: nextPath })} replace />;
  }

  return <Navigate to={`/patient/home${location.search}${location.hash}`} replace />;
}

function RequirePatientProfile({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      setErr(null);
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        setHasProfile(!!data?.id);
      } catch (e: unknown) {
        if (!cancelled) setErr(getErrorMessage(e, "Failed to check patient profile."));
        if (!cancelled) setHasProfile(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) return <FullscreenLoader />;

  if (err) {
    return (
      <FullscreenLoader
        text={`Patient profile check failed:\n${err}`}
        secondary="Retry"
        onSecondary={() => window.location.reload()}
      />
    );
  }

  if (!hasProfile) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildOnboardingRoute({ next: nextPath })} replace />;
  }

  return <>{children}</>;
}

function withPatientProfile(element: React.ReactNode) {
  return withRole(PATIENT_ROLES, <RequirePatientProfile>{element}</RequirePatientProfile>);
}

function LegacyPathRedirect({ to }: { to: string }) {
  const location = useLocation();

  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function LegacyProviderVisitRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  if (!id) return <Navigate to={PROVIDER_ROUTES.queue} replace />;

  return <Navigate to={`${providerVisitChartPath(id)}${location.search}${location.hash}`} replace />;
}

function LegacyProviderPatientCenterRedirect() {
  const { patientId } = useParams<{ patientId?: string }>();
  const location = useLocation();
  const base = providerPatientCenterPath(patientId);

  return <Navigate to={`${base}${location.search}${location.hash}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClinicProvider>
          <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<PublicEntryRoute />} />
            <Route path="/services" element={<PublicServices />} />
            <Route path="/services/:slug" element={<PublicServiceDetail />} />
            <Route path="/contact" element={<PublicContact />} />
            <Route path="/book" element={<PublicBook />} />
            <Route path="/how-to-use-the-app" element={<PublicAppGuide />} />
            <Route path="/vital-ai" element={<PublicVitalAiLite />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/start" element={<LegacyPathRedirect to="/vital-ai" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<Gate />} />

            {/* admin */}
            <Route
              path="/admin"
              element={withRole(ADMIN_ROLES, <AdminHome />)}
            />
            <Route
              path="/admin/services"
              element={withRole(ADMIN_ROLES, <ServicesPanel locationId={null} locationName={null} />)}
            />
            <Route
              path="/admin/staff"
              element={withRole(ADMIN_ROLES, <AdminStaffManagement />)}
            />
            <Route
              path="/admin/clinics"
              element={withRole(SUPER_ADMIN_ROLES, <ClinicListPage />)}
            />
            <Route
              path="/admin/clinics/new"
              element={withRole(SUPER_ADMIN_ROLES, <ClinicListPage />)}
            />
            <Route
              path="/admin/clinics/:clinicId"
              element={withRole(SUPER_ADMIN_ROLES, <ClinicDetailPage />)}
            />
            <Route
              path="/admin/clinics/:clinicId/users"
              element={withRole(SUPER_ADMIN_ROLES, <ClinicUsersPage />)}
            />
            <Route
              path="/admin/clinics/:clinicId/settings"
              element={withRole(SUPER_ADMIN_ROLES, <ClinicSettingsPage />)}
            />
            <Route
              path="/admin/vital-ai"
              element={withRole(ADMIN_ROLES, <AdminVitalAiQueue />)}
            />
            <Route
              path="/admin/inquiries"
              element={withRole(ADMIN_ROLES, <AdminInquiries />)}
            />
            <Route
              path="/admin/booking-requests"
              element={withRole(ADMIN_ROLES, <AdminBookingRequests />)}
            />
            <Route
              path="/admin/vital-ai-lite"
              element={withRole(ADMIN_ROLES, <AdminPublicVitalAiSubmissions />)}
            />
            <Route
              path="/admin/vital-ai/leads/:leadId"
              element={withRole(ADMIN_ROLES, <AdminVitalAiLeadDetail />)}
            />

            {/* provider */}
            <Route
              path={PROVIDER_ROUTES.home}
              element={withRole(PROVIDER_ROLES, <ProviderHome />)}
            />
            <Route
              path={PROVIDER_ROUTES.dashboardLegacy}
              element={withRole(PROVIDER_ROLES, <LegacyPathRedirect to={PROVIDER_ROUTES.home} />)}
            />
            <Route
              path={PROVIDER_ROUTES.command}
              element={withRole(PROVIDER_ROLES, <ProviderCommandCenter />)}
            />
            <Route
              path={PROVIDER_ROUTES.commandLegacy}
              element={withRole(PROVIDER_ROLES, <LegacyPathRedirect to={PROVIDER_ROUTES.command} />)}
            />
            <Route
              path={PROVIDER_ROUTES.virtualVisitsLegacy}
              element={withRole(PROVIDER_ROLES, <Navigate to={PROVIDER_ROUTES.virtualVisitsHash} replace />)}
            />
              <Route
                path={PROVIDER_ROUTES.queue}
                element={withRole(PROVIDER_ROLES, <ProviderQueue />)}
              />
            <Route
              path="/provider/visit/:id"
              element={withRole(PROVIDER_ROLES, <LegacyProviderVisitRedirect />)}
            />
            <Route
              path="/provider/visit-builder/:patientId"
              element={withRole(PROVIDER_ROLES, <ProviderVisitBuilder />)}
            />
            <Route
              path="/provider/visit-builder"
              element={withRole(PROVIDER_ROLES, <ProviderVisitBuilder />)}
            />
            <Route
              path={PROVIDER_ROUTES.patients}
              element={withRole(PROVIDER_ROLES, <ProviderPatients />)}
            />
            <Route
              path={providerPatientCenterLegacyPath()}
              element={withRole(PROVIDER_ROLES, <LegacyProviderPatientCenterRedirect />)}
            />
            <Route
              path="/provider/patients/:patientId"
              element={withRole(PROVIDER_ROLES, <ProviderPatientCenter />)}
            />
            <Route
              path={`${providerPatientCenterLegacyPath(":patientId")}`}
              element={withRole(PROVIDER_ROLES, <LegacyProviderPatientCenterRedirect />)}
            />
            <Route
              path="/provider/visits/:id"
              element={withRole(PROVIDER_ROLES, <ProviderVisitChart />)}
            />
            <Route
              path="/provider/wound-timeline/:patientId"
              element={withRole(PROVIDER_ROLES, <WoundTimeline />)}
            />
            <Route
              path={PROVIDER_ROUTES.intakeLegacy}
              element={withRole(PROVIDER_ROLES, <LegacyPathRedirect to={PROVIDER_ROUTES.intakes} />)}
            />
            <Route
              path={PROVIDER_ROUTES.intakeQueueLegacy}
              element={withRole(PROVIDER_ROLES, <LegacyPathRedirect to={PROVIDER_ROUTES.intakes} />)}
            />
            <Route
              path={PROVIDER_ROUTES.intakes}
              element={withRole(PROVIDER_ROLES, <ProviderIntake />)}
            />
              <Route
              path={PROVIDER_ROUTES.messages}
              element={withRole(PROVIDER_ROLES, <ProviderConversationCenter />)}
              />
            <Route
              path={PROVIDER_ROUTES.messagesLegacy}
              element={withRole(PROVIDER_ROLES, <LegacyPathRedirect to={PROVIDER_ROUTES.messages} />)}
            />
            <Route
              path={PROVIDER_ROUTES.labs}
              element={withRole(PROVIDER_ROLES, <ProviderLabs />)}
            />
            <Route
              path={PROVIDER_ROUTES.ai}
              element={withRole(PROVIDER_ROLES, <ProviderAI />)}
            />
            <Route
              path={PROVIDER_ROUTES.vitalAi}
              element={withRole(PROVIDER_ROLES, <ProviderVitalAiQueue />)}
            />
            <Route
              path={PROVIDER_ROUTES.protocolQueue}
              element={withRole(PHYSICIAN_REVIEW_ROLES, <ProviderProtocolQueue />)}
            />
            <Route
              path="/provider/vital-ai/profile/:profileId"
              element={withRole(PROVIDER_ROLES, <ProviderVitalAiProfileDetail />)}
            />
            <Route
              path="/provider/protocol-review/:assessmentId"
              element={withRole(PHYSICIAN_REVIEW_ROLES, <ProviderProtocolReview />)}
            />
            <Route
              path={PROVIDER_ROUTES.referrals}
              element={withRole(PROVIDER_ROLES, <ProviderReferrals />)}
            />
            <Route
              path="/provider/referrals/:referralId"
              element={withRole(PROVIDER_ROLES, <ProviderReferralDetail />)}
            />
            <Route
              path="/provider/ivr/print/:visitId"
              element={withRole(PROVIDER_ROLES, <IVRPacketPrint />)}
            />

            {/* patient */}
            <Route path="/access" element={<PatientAuth />} />
            <Route path="/patient/auth" element={<LegacyPathRedirect to="/access" />} />
            <Route path="/patient/onboarding" element={withRole(PATIENT_ROLES, <PatientOnboarding />)} />
            <Route path="/patient/services" element={withPatientProfile(<PatientServices />)} />
            <Route path="/patient/book" element={withPatientProfile(<PatientBookAppointment />)} />
            <Route path="/patient/assessment" element={withPatientProfile(<PatientAssessment />)} />
            <Route path="/patient/visits" element={withPatientProfile(<PatientVisitChart />)} />
            <Route
              path="/patient"
              element={withRole(PATIENT_ROLES, <PatientGate />)}
            />
            <Route
              path="/patient/home"
              element={withPatientProfile(<PatientHome />)}
            />
            <Route
              path="/patient/intake"
              element={withRole(PATIENT_ROLES, <Navigate to="/intake" replace />)}
            />
            <Route
              path="/patient/intake/wound"
              element={withRole(PATIENT_ROLES, <Navigate to="/intake?pathway=wound-care&autostart=1" replace />)}
            />
            <Route
              path="/patient/labs"
              element={withPatientProfile(<PatientLabs />)}
            />
              <Route
              path="/patient/chat"
              element={withPatientProfile(<PatientConversationCenter />)}
              />
            <Route
              path="/patient/treatments"
              element={withPatientProfile(<PatientTreatments />)}
            />
            <Route
              path="/patient/treatments/:visitId"
              element={withPatientProfile(<PatientTreatmentDetail />)}
            />
            <Route
              path="/intake"
              element={withPatientProfile(<VitalAiIntakeHome />)}
            />
            <Route
              path="/intake/session/:sessionId"
              element={withPatientProfile(<VitalAiSession />)}
            />
            <Route
              path="/intake/session/:sessionId/review"
              element={withPatientProfile(<VitalAiSessionReview />)}
            />
            <Route
              path="/intake/session/:sessionId/complete"
              element={withPatientProfile(<VitalAiSessionComplete />)}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>

          <AppStatusFooter />
        </ClinicProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function RouteLoader() {
  return <FullscreenLoader text="Loading page..." />;
}


