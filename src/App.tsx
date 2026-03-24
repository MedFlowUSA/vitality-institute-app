// src/App.tsx
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, type AppRole, useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabase";

import AppStatusFooter from "./components/AppStatusFooter";
import { buildOnboardingRoute } from "./lib/routeFlow";

const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const Login = lazy(() => import("./pages/Login"));
const PublicLanding = lazy(() => import("./pages/PublicLandingSimplified"));
const PublicServices = lazy(() => import("./pages/PublicServices"));
const PublicServiceDetail = lazy(() => import("./pages/PublicServiceDetail"));
const PublicContact = lazy(() => import("./pages/PublicContact"));
const PublicBook = lazy(() => import("./pages/PublicBook"));
const PublicVitalAiLite = lazy(() => import("./pages/PublicVitalAiLite"));

const PatientAuth = lazy(() => import("./pages/PatientAuth"));
const PatientHome = lazy(() => import("./pages/PatientHome"));
const PatientOnboarding = lazy(() => import("./pages/PatientOnboarding"));
const PatientLabs = lazy(() => import("./pages/PatientLabs"));
const PatientChat = lazy(() => import("./pages/PatientChat"));
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
const ProviderChat = lazy(() => import("./pages/ProviderChat"));
const ProviderLabs = lazy(() => import("./pages/ProviderLabs"));
const ProviderAI = lazy(() => import("./pages/ProviderAI"));
const IVRPacketPrint = lazy(() => import("./pages/IVRPacketPrint"));
const ProviderReferrals = lazy(() => import("./pages/ProviderReferrals"));
const ProviderReferralDetail = lazy(() => import("./pages/ProviderReferralDetail"));
const ProviderVisitQueue = lazy(() => import("./pages/ProviderVisitQueue"));
const ProviderVisitChart = lazy(() => import("./pages/ProviderVisitChart"));
const ProviderVisitBuilder = lazy(() => import("./pages/ProviderVisitBuilderVirtual"));
const ProviderVitalAiQueue = lazy(() => import("./pages/ProviderVitalAiQueue"));
const ProviderVitalAiProfileDetail = lazy(() => import("./pages/ProviderVitalAiProfileDetail"));
const ProviderCommandCenter = lazy(() => import("./pages/ProviderCommandCenter"));

const AdminHome = lazy(() => import("./pages/AdminHome"));
const AdminStaffManagement = lazy(() => import("./pages/AdminStaffManagement"));
const AdminInquiries = lazy(() => import("./pages/AdminInquiries"));
const AdminBookingRequests = lazy(() => import("./pages/AdminBookingRequests"));
const ServicesPanel = lazy(() => import("./pages/ServicesPanel"));
const AdminVitalAiQueue = lazy(() => import("./pages/AdminVitalAiQueue"));
const AdminVitalAiLeadDetail = lazy(() => import("./pages/AdminVitalAiLeadDetail"));
const AdminPublicVitalAiSubmissions = lazy(() => import("./pages/AdminPublicVitalAiSubmissions"));

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
const PROVIDER_ROLES = [
  "super_admin",
  "location_admin",
  "provider",
  "clinical_staff",
  "billing",
  "front_desk",
] as const;
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
    return <Navigate to="/provider" replace />;
  }

  return <Navigate to="/patient" replace />;
}

function getHomeRouteForRole(role: AppRole | null) {
  if (!role) return "/";
  if ((ADMIN_ROLES as readonly string[]).includes(role)) return "/admin";
  if ((PROVIDER_ROLES as readonly string[]).includes(role)) return "/provider";
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

  if (!hasProfile) return <Navigate to="/patient/onboarding" replace />;

  return <Navigate to="/patient/home" replace />;
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

  if (!id) return <Navigate to="/provider/queue" replace />;

  return <Navigate to={`/provider/visits/${id}${location.search}${location.hash}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoader />}>
        <Routes>
            <Route path="/" element={<PublicEntryRoute />} />
            <Route path="/services" element={<PublicServices />} />
            <Route path="/services/:slug" element={<PublicServiceDetail />} />
            <Route path="/contact" element={<PublicContact />} />
            <Route path="/book" element={<PublicBook />} />
            <Route path="/vital-ai" element={<PublicVitalAiLite />} />
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
              path="/provider"
              element={withRole(PROVIDER_ROLES, <ProviderHome />)}
            />
            <Route
              path="/provider/command"
              element={withRole(PROVIDER_ROLES, <ProviderCommandCenter />)}
            />
            <Route
              path="/provider/queue"
              element={withRole(PROVIDER_ROLES, <ProviderVisitQueue />)}
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
              path="/provider/patients"
              element={withRole(PROVIDER_ROLES, <ProviderPatients />)}
            />
            <Route
              path="/provider/patients/:patientId"
              element={withRole(PROVIDER_ROLES, <ProviderPatientCenter />)}
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
              path="/provider/intake"
              element={withRole(PROVIDER_ROLES, <LegacyPathRedirect to="/provider/intakes" />)}
            />
            <Route
              path="/provider/intakes"
              element={withRole(PROVIDER_ROLES, <ProviderIntake />)}
            />
            <Route
              path="/provider/chat"
              element={withRole(PROVIDER_ROLES, <ProviderChat />)}
            />
            <Route
              path="/provider/labs"
              element={withRole(PROVIDER_ROLES, <ProviderLabs />)}
            />
            <Route
              path="/provider/ai"
              element={withRole(PROVIDER_ROLES, <ProviderAI />)}
            />
            <Route
              path="/provider/vital-ai"
              element={withRole(PROVIDER_ROLES, <ProviderVitalAiQueue />)}
            />
            <Route
              path="/provider/vital-ai/profile/:profileId"
              element={withRole(PROVIDER_ROLES, <ProviderVitalAiProfileDetail />)}
            />
            <Route
              path="/provider/referrals"
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
              element={withPatientProfile(<PatientChat />)}
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
      </AuthProvider>
    </BrowserRouter>
  );
}

function RouteLoader() {
  return <FullscreenLoader text="Loading page..." />;
}


