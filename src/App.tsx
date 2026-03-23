// src/App.tsx
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabase";

import AppStatusFooter from "./components/AppStatusFooter";

import AuthCallback from "./pages/AuthCallback";

import Login from "./pages/Login";
import PublicLanding from "./pages/PublicLandingSimplified";
import PublicServices from "./pages/PublicServices";
import PublicServiceDetail from "./pages/PublicServiceDetail";
import PublicContact from "./pages/PublicContact";
import PublicBook from "./pages/PublicBook";
import PublicVitalAiLite from "./pages/PublicVitalAiLite";
import AdminHome from "./pages/AdminHome";
import AdminStaffManagement from "./pages/AdminStaffManagement";
import AdminInquiries from "./pages/AdminInquiries";
import AdminBookingRequests from "./pages/AdminBookingRequests";

import PatientAuth from "./pages/PatientAuth";
import PatientHome from "./pages/PatientHome";
import PatientOnboarding from "./pages/PatientOnboarding";
import PatientLabs from "./pages/PatientLabs";
import PatientChat from "./pages/PatientChat";
import PatientTreatments from "./pages/PatientTreatments";
import PatientTreatmentDetail from "./pages/PatientTreatmentDetail";
import PatientServices from "./pages/PatientServices";
import PatientBookAppointment from "./pages/PatientBookAppointment";
import PatientAssessment from "./pages/PatientAssessment";
import PatientVisitChart from "./pages/PatientVisitChart";
import ResetPassword from "./pages/ResetPassword";
import VitalAiIntakeHome from "./pages/VitalAiIntakeHome";
import VitalAiSession from "./pages/VitalAiSession";
import VitalAiSessionReview from "./pages/VitalAiSessionReview";
import VitalAiSessionComplete from "./pages/VitalAiSessionComplete";

import ProviderHome from "./pages/ProviderHome";
import ProviderPatients from "./pages/ProviderPatients";
import ProviderPatientCenter from "./pages/ProviderPatientCenter";
import WoundTimeline from "./pages/WoundTimeline";
import ProviderIntake from "./pages/ProviderIntake";
import ProviderIntakeQueue from "./pages/ProviderIntakeQueue";
import ProviderChat from "./pages/ProviderChat";
import ProviderLabs from "./pages/ProviderLabs";
import ProviderAI from "./pages/ProviderAI";
import IVRPacketPrint from "./pages/IVRPacketPrint";
import ProviderReferrals from "./pages/ProviderReferrals";
import ProviderReferralDetail from "./pages/ProviderReferralDetail";
import ProviderVisitQueue from "./pages/ProviderVisitQueue";
import ProviderVisitChart from "./pages/ProviderVisitChart";
import ProviderVisitBuilder from "./pages/ProviderVisitBuilderVirtual";
import ProviderVitalAiQueue from "./pages/ProviderVitalAiQueue";
import ProviderVitalAiProfileDetail from "./pages/ProviderVitalAiProfileDetail";

import ProviderCommandCenter from "./pages/ProviderCommandCenter";
import ServicesPanel from "./pages/ServicesPanel";
import AdminVitalAiQueue from "./pages/AdminVitalAiQueue";
import AdminVitalAiLeadDetail from "./pages/AdminVitalAiLeadDetail";
import AdminPublicVitalAiSubmissions from "./pages/AdminPublicVitalAiSubmissions";

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

  return <PatientEntryRouter />;
}

function PatientEntryRouter() {
  return <PatientHome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
            <Route path="/" element={<PublicLanding />} />
            <Route path="/services" element={<PublicServices />} />
            <Route path="/services/:slug" element={<PublicServiceDetail />} />
            <Route path="/contact" element={<PublicContact />} />
            <Route path="/book" element={<PublicBook />} />
            <Route path="/vital-ai" element={<PublicVitalAiLite />} />
            <Route path="/start" element={<PublicVitalAiLite />} />
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
              element={withRole(PROVIDER_ROLES, <ProviderVisitChart />)}
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
              element={withRole(PROVIDER_ROLES, <ProviderIntake />)}
            />
            <Route
              path="/provider/intakes"
              element={withRole(PROVIDER_ROLES, <ProviderIntakeQueue />)}
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
            <Route path="/patient/auth" element={<PatientAuth />} />
            <Route path="/patient/onboarding" element={withRole(PATIENT_ROLES, <PatientOnboarding />)} />
            <Route path="/patient/services" element={withRole(PATIENT_ROLES, <PatientServices />)} />
            <Route path="/patient/book" element={withRole(PATIENT_ROLES, <PatientBookAppointment />)} />
            <Route path="/patient/assessment" element={withRole(PATIENT_ROLES, <PatientAssessment />)} />
            <Route path="/patient/visits" element={withRole(PATIENT_ROLES, <PatientVisitChart />)} />
            <Route
              path="/patient"
              element={withRole(PATIENT_ROLES, <PatientGate />)}
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
              element={withRole(PATIENT_ROLES, <PatientLabs />)}
            />
            <Route
              path="/patient/chat"
              element={withRole(PATIENT_ROLES, <PatientChat />)}
            />
            <Route
              path="/patient/treatments"
              element={withRole(PATIENT_ROLES, <PatientTreatments />)}
            />
            <Route
              path="/patient/treatments/:visitId"
              element={withRole(PATIENT_ROLES, <PatientTreatmentDetail />)}
            />
            <Route
              path="/intake"
              element={withRole(PATIENT_ROLES, <VitalAiIntakeHome />)}
            />
            <Route
              path="/intake/session/:sessionId"
              element={withRole(PATIENT_ROLES, <VitalAiSession />)}
            />
            <Route
              path="/intake/session/:sessionId/review"
              element={withRole(PATIENT_ROLES, <VitalAiSessionReview />)}
            />
            <Route
              path="/intake/session/:sessionId/complete"
              element={withRole(PATIENT_ROLES, <VitalAiSessionComplete />)}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <AppStatusFooter />
      </AuthProvider>
    </BrowserRouter>
  );
}


