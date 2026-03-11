// src/App.tsx
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabase";

import SplashVideo from "./components/SplashVideo";
import AppStatusFooter from "./components/AppStatusFooter";

import AuthCallback from "./pages/AuthCallback";

import Login from "./pages/Login";
import AdminHome from "./pages/AdminHome";
import AdminStaffManagement from "./pages/AdminStaffManagement";

import PatientAuth from "./pages/PatientAuth";
import PatientHome from "./pages/PatientHome";
import PatientOnboarding from "./pages/PatientOnboarding";
import PatientIntake from "./pages/PatientIntake";
import PatientLabs from "./pages/PatientLabs";
import PatientChat from "./pages/PatientChat";
import PatientTreatments from "./pages/PatientTreatments";
import PatientTreatmentDetail from "./pages/PatientTreatmentDetail";
import PatientWoundIntake from "./pages/PatientWoundIntake";
import PatientServices from "./pages/PatientServices";
import PatientBookAppointment from "./pages/PatientBookAppointment";
import PatientAssessment from "./pages/PatientAssessment";
import PatientVisitChart from "./pages/PatientVisitChart";
import ResetPassword from "./pages/ResetPassword";

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
import ProviderVisitBuilder from "./pages/ProviderVisitBuilder";

import ProviderCommandCenter from "./pages/ProviderCommandCenter";
import ServicesPanel from "./pages/ServicesPanel";

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

const PROVIDER_ROLES = [
  "super_admin",
  "location_admin",
  "provider",
  "clinical_staff",
  "billing",
  "front_desk",
] as const;

const SPLASH_SESSION_KEY = "vitality_splash_seen";

const PUBLIC_SPLASH_URL =
  "https://cmrkvgcbbhjnmwjruuwa.supabase.co/storage/v1/object/public/app-assets/splash.mp4";
const DEV_SPLASH_VERSION = import.meta.env.DEV ? String(Date.now()) : "";

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

  if (role === "super_admin" || role === "location_admin") {
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

  return <PatientHome />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem(SPLASH_SESSION_KEY));

  const splashSrc = DEV_SPLASH_VERSION ? `${PUBLIC_SPLASH_URL}?v=${DEV_SPLASH_VERSION}` : PUBLIC_SPLASH_URL;

  return (
    <>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/login/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<Gate />} />

            {/* admin */}
            <Route
              path="/admin"
              element={
                <RequireRole allow={["super_admin", "location_admin"]}>
                  <AdminHome />
                </RequireRole>
              }
            />
            <Route
              path="/admin/services"
              element={
                <RequireRole allow={["super_admin", "location_admin"]}>
                  <ServicesPanel locationId={null} locationName={null} />
                </RequireRole>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <RequireRole allow={["super_admin", "location_admin"]}>
                  <AdminStaffManagement />
                </RequireRole>
              }
            />

            {/* provider */}
            <Route
              path="/provider"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderHome />
                </RequireRole>
              }
            />
            <Route
              path="/provider/command"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderCommandCenter />
                </RequireRole>
              }
            />
            <Route
              path="/provider/queue"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderVisitQueue />
                </RequireRole>
              }
            />
            <Route
              path="/provider/visit/:id"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderVisitChart />
                </RequireRole>
              }
            />
            <Route
              path="/provider/visit-builder/:patientId"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderVisitBuilder />
                </RequireRole>
              }
            />
            <Route
              path="/provider/visit-builder"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderVisitBuilder />
                </RequireRole>
              }
            />
            <Route
              path="/provider/patients"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderPatients />
                </RequireRole>
              }
            />
            <Route
              path="/provider/patients/:patientId"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderPatientCenter />
                </RequireRole>
              }
            />
            <Route
              path="/provider/visits/:id"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderVisitChart />
                </RequireRole>
              }
            />
            <Route
              path="/provider/wound-timeline/:patientId"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <WoundTimeline />
                </RequireRole>
              }
            />
            <Route
              path="/provider/intake"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderIntake />
                </RequireRole>
              }
            />
            <Route
              path="/provider/intakes"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderIntakeQueue />
                </RequireRole>
              }
            />
            <Route
              path="/provider/chat"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderChat />
                </RequireRole>
              }
            />
            <Route
              path="/provider/labs"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderLabs />
                </RequireRole>
              }
            />
            <Route
              path="/provider/ai"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderAI />
                </RequireRole>
              }
            />
            <Route
              path="/provider/referrals"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderReferrals />
                </RequireRole>
              }
            />
            <Route
              path="/provider/referrals/:referralId"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderReferralDetail />
                </RequireRole>
              }
            />
            <Route
              path="/provider/ivr/print/:visitId"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <IVRPacketPrint />
                </RequireRole>
              }
            />

            {/* patient */}
            <Route path="/access" element={<PatientAuth />} />
            <Route path="/patient/auth" element={<PatientAuth />} />
            <Route path="/patient/onboarding" element={<PatientOnboarding />} />
            <Route path="/patient/services" element={<PatientServices />} />
            <Route path="/patient/book" element={<PatientBookAppointment />} />
            <Route path="/patient/assessment" element={<PatientAssessment />} />
            <Route path="/patient/visits" element={<PatientVisitChart />} />
            <Route
              path="/patient"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientGate />
                </RequireRole>
              }
            />
            <Route
              path="/patient/intake"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientIntake />
                </RequireRole>
              }
            />
            <Route
              path="/patient/intake/wound"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientWoundIntake />
                </RequireRole>
              }
            />
            <Route
              path="/patient/labs"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientLabs />
                </RequireRole>
              }
            />
            <Route
              path="/patient/chat"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientChat />
                </RequireRole>
              }
            />
            <Route
              path="/patient/treatments"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientTreatments />
                </RequireRole>
              }
            />
            <Route
              path="/patient/treatments/:visitId"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientTreatmentDetail />
                </RequireRole>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <AppStatusFooter />
        </AuthProvider>
      </BrowserRouter>

      <SplashVideo
        show={showSplash}
        src={splashSrc}
        maxMs={3200}
        onFinish={() => {
          sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
          setShowSplash(false);
        }}
      />
    </>
  );
}


