// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";

import SplashVideo from "./components/SplashVideo";

import Login from "./pages/Login";
import AdminHome from "./pages/AdminHome";

import PatientHome from "./pages/PatientHome";
import PatientIntake from "./pages/PatientIntake";
import PatientLabs from "./pages/PatientLabs";
import PatientChat from "./pages/PatientChat";
import PatientTreatments from "./pages/PatientTreatments";
import PatientTreatmentDetail from "./pages/PatientTreatmentDetail";
import PatientWoundIntake from "./pages/PatientWoundIntake";

import ProviderHome from "./pages/ProviderHome";
import ProviderPatients from "./pages/ProviderPatients";
import ProviderPatientCenter from "./pages/ProviderPatientCenter";
import ProviderIntake from "./pages/ProviderIntake";
import ProviderChat from "./pages/ProviderChat";
import ProviderLabs from "./pages/ProviderLabs";
import ProviderAI from "./pages/ProviderAI";

// ✅ wire pages that exist but weren't routed
import ProviderQueue from "./pages/ProviderQueue";
import ServicesPanel from "./pages/ServicesPanel";

function FullscreenLoader({
  text = "Loading…",
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

function Gate() {
  const { loading, user, role, roleError, refreshRole } = useAuth();

  if (loading) return <FullscreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (!role) {
    const msg =
      "Finalizing profile…\n\n" +
      (roleError
        ? `ROLE ERROR:\n${roleError}\n\nMost common causes:\n• profiles row missing\n• profiles.role is NULL\n• RLS blocks profiles select\n`
        : "If this stays here, your profiles role is missing or blocked by RLS.\n");

    return <FullscreenLoader text={msg} secondary="Retry role lookup" onSecondary={refreshRole} />;
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
    const msg =
      "Finalizing profile…\n\n" +
      (roleError ? `ROLE ERROR:\n${roleError}\n` : "No role loaded yet. This usually means profiles is missing or blocked.\n");

    return <FullscreenLoader text={msg} secondary="Retry role lookup" onSecondary={refreshRole} />;
  }

  if (!allow.includes(role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(false);

  // Cache-bust ONLY in DEV so replacing the video shows immediately
  const splashSrc = useMemo(() => {
    if (import.meta.env.DEV) return `${PUBLIC_SPLASH_URL}?v=${Date.now()}`;
    return PUBLIC_SPLASH_URL;
  }, []);

  // Only show splash once per session
  useEffect(() => {
    const seen = sessionStorage.getItem(SPLASH_SESSION_KEY);
    if (!seen) setShowSplash(true);
  }, []);

  return (
    <>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* entry */}
            <Route path="/" element={<Gate />} />

            {/* login */}
            <Route path="/login" element={<Login />} />

            {/* admin */}
            <Route
              path="/admin"
              element={
                <RequireRole allow={["super_admin", "location_admin"]}>
                  <AdminHome />
                </RequireRole>
              }
            />

            {/* admin: services panel */}
            <Route
              path="/admin/services"
              element={
                <RequireRole allow={["super_admin", "location_admin"]}>
                  <ServicesPanel />
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

            {/* provider: queue */}
            <Route
              path="/provider/queue"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderQueue />
                </RequireRole>
              }
            />

            {/* provider: patients list */}
            <Route
              path="/provider/patients"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderPatients />
                </RequireRole>
              }
            />

            {/* provider: patient center */}
            <Route
              path="/provider/patients/:patientId"
              element={
                <RequireRole allow={[...PROVIDER_ROLES]}>
                  <ProviderPatientCenter />
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

            {/* patient */}
            <Route
              path="/patient"
              element={
                <RequireRole allow={["patient"]}>
                  <PatientHome />
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

            {/* ✅ wound intake route (FIXED) */}
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

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>

      {/* Video splash overlays on top of ALL screens */}
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