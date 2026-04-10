import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type AppRole } from "../auth/AuthProvider";
import { PROVIDER_ROUTES } from "../lib/providerRoutes";
import { readPublicBookingDraft } from "../lib/publicBookingDraft";
import { buildAuthRoute, normalizeRedirectTarget } from "../lib/routeFlow";
import { getAuthRedirectUrl, supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "magic";

function getHomeRouteForRole(role: AppRole | null) {
  if (role === "super_admin" || role === "location_admin") return "/admin";
  if (role && role !== "patient") return PROVIDER_ROUTES.home;
  return "/patient/home";
}

function normalizeMode(value: string | null): Mode {
  const raw = (value ?? "").toLowerCase();
  if (raw === "signup") return "signup";
  if (raw === "magic") return "magic";
  return "login";
}

function normalizeNextPath(value: string | null, pathname: string) {
  if (value) return normalizeRedirectTarget(value, pathname.startsWith("/patient") ? "/patient/home" : "/");
  if (pathname.startsWith("/patient")) return "/patient/home";
  return "/";
}

export default function PatientAuth() {
  const { loading, user, role } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bookingDraft = useMemo(() => readPublicBookingDraft(), []);
  const handoff = searchParams.get("handoff");

  const nextPath = useMemo(() => {
    return normalizeNextPath(searchParams.get("next"), location.pathname);
  }, [location.pathname, searchParams]);

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const trimmedPassword = useMemo(() => password.trim(), [password]);
  const isEmailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail), [trimmedEmail]);

  const inlineValidationMessage = useMemo(() => {
    if (!trimmedEmail) return "Enter your email address.";
    if (!isEmailValid) return "Enter a valid email address.";
    if (mode === "magic") return null;
    if (!trimmedPassword) return mode === "signup" ? "Create a password to continue." : "Enter your password.";
    if (mode === "signup" && trimmedPassword.length < 6) return "Password must be at least 6 characters.";
    return null;
  }, [isEmailValid, mode, trimmedEmail, trimmedPassword]);

  const canSubmit = useMemo(() => {
    if (!isEmailValid) return false;
    if (mode === "magic") return true;
    if (mode === "signup") return trimmedPassword.length >= 6;
    return trimmedPassword.length > 0;
  }, [isEmailValid, mode, trimmedPassword]);

  const authRedirect = useMemo(() => {
    const params = new URLSearchParams({ next: nextPath });
    return getAuthRedirectUrl("/auth/callback", params);
  }, [nextPath]);

  useEffect(() => {
    setMode(normalizeMode(searchParams.get("mode")));
  }, [searchParams]);

  useEffect(() => {
    setErr(null);
    setMsg(null);
  }, [email, mode, password]);

  useEffect(() => {
    if (loading || !user?.id) return;

    if (role && role !== "patient") {
      nav(getHomeRouteForRole(role), { replace: true });
      return;
    }

    nav(nextPath, { replace: true });
  }, [loading, nav, nextPath, role, user?.id]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    nav(buildAuthRoute({ mode: nextMode, next: nextPath, handoff }), { replace: true });
  };

  const submit = async () => {
    setErr(null);
    setMsg(null);
    if (!canSubmit) {
      setErr(inlineValidationMessage ?? "Complete the required fields to continue.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: authRedirect,
          },
        });
        if (error) throw error;

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setMode("login");
          setErr("An account already exists for this email. Sign in or use a magic link instead.");
          return;
        }

        if (data.session) {
          nav(nextPath, { replace: true });
          return;
        }

        setMsg("Account created. Check your email to confirm your access, then return here to continue.");
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;

        nav(nextPath, { replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirect,
        },
      });
      if (error) throw error;

      setMsg("Magic link sent. Open that email from this environment to continue.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Authentication failed.";
      if (message.toLowerCase().includes("already registered") || message.toLowerCase().includes("user already registered")) {
        setMode("login");
        setErr("An account already exists for this email. Sign in or use a magic link instead.");
        return;
      }
      if (message.toLowerCase().includes("email not confirmed")) {
        setErr("Check your email and confirm your account before signing in, or use the magic link tab to continue.");
        return;
      }
      if (message.toLowerCase().includes("invalid login credentials")) {
        setErr("We couldn't sign you in with that email and password. Double-check your password or use the magic link tab.");
        return;
      }
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(184,164,255,0.18) 0%, rgba(139,124,255,0.14) 24%, rgba(63,58,99,0.20) 42%, rgba(15,23,42,1) 62%, #06111f 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div
          style={{
            borderRadius: 28,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "linear-gradient(180deg, rgba(8,15,28,0.96), rgba(10,18,34,0.98))",
            boxShadow: "0 28px 70px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                padding: "30px 28px 18px 28px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                background:
                  "radial-gradient(circle at top left, rgba(184,164,255,0.22), transparent 38%), radial-gradient(circle at top right, rgba(139,124,255,0.18), transparent 34%)",
              }}
            >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #C8B6FF, #8B7CFF)",
                    boxShadow: "0 8px 24px rgba(139,124,255,0.28)",
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#F8FAFC",
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                  }}
                >
                  Vitality Institute
                </div>
                <div style={{ marginTop: 6, fontSize: 14, color: "rgba(226,232,240,0.72)", lineHeight: 1.6 }}>
                  Secure account access for continuing intake, scheduling, and follow-up.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: "rgba(226,232,240,0.64)", lineHeight: 1.6 }}>
              Sign in or create your account to continue with a clean handoff into the next step.
            </div>
          </div>

          <form style={{ padding: 28 }} onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
                padding: 6,
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => switchMode("login")}
                style={mode === "login" ? activeTabStyle : tabStyle}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => switchMode("signup")}
                style={mode === "signup" ? activeTabStyle : tabStyle}
              >
                Create Account
              </button>
              <button type="button" className="btn" onClick={() => switchMode("magic")} style={mode === "magic" ? activeTabStyle : tabStyle}>
                Magic Link
              </button>
            </div>

            <div style={{ height: 18 }} />

            <div style={{ fontSize: 13, color: "rgba(226,232,240,0.66)", lineHeight: 1.6, marginBottom: 14 }}>
              {mode === "signup"
                ? "Create a secure account first, then confirm your email to continue."
                : mode === "magic"
                ? "Send a secure magic link if you prefer not to use a password."
                : "Sign in to continue where you left off."}
            </div>

            {handoff === "booking_request" && bookingDraft?.requestId ? (
              <div style={contextCardStyle}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: "#C8B6FF" }}>
                  Visit Request Saved
                </div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: "#F8FAFC" }}>
                  Continue to account setup and intake
                </div>
                <div style={{ marginTop: 8, color: "rgba(226,232,240,0.78)", lineHeight: 1.7 }}>
                  Your request for {bookingDraft.serviceName || "your selected service"}{bookingDraft.locationName ? ` at ${bookingDraft.locationName}` : ""} has been saved.
                  Create or access your account to continue intake so our team can review next steps.
                </div>
                <div style={{ marginTop: 10, color: "rgba(226,232,240,0.62)", fontSize: 12, lineHeight: 1.6 }}>
                  Reference: {bookingDraft.requestId}. A coordinator may follow up to confirm scheduling, and provider review may be required depending on your concern.
                </div>
              </div>
            ) : null}

            {handoff === "vital_ai_lite" ? (
              <div style={contextCardStyle}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: "#C8B6FF" }}>
                  Vital AI Handoff
                </div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: "#F8FAFC" }}>
                  Continue into your fuller intake
                </div>
                <div style={{ marginTop: 8, color: "rgba(226,232,240,0.78)", lineHeight: 1.7 }}>
                  You can sign in or create your account now, and we&apos;ll carry you into the full intake flow without losing the care direction you selected.
                </div>
                {bookingDraft?.serviceName || bookingDraft?.locationName ? (
                  <div style={{ marginTop: 10, color: "rgba(226,232,240,0.62)", fontSize: 12, lineHeight: 1.6 }}>
                    Saved context: {bookingDraft?.serviceName || "Selected service"}
                    {bookingDraft?.locationName ? ` at ${bookingDraft.locationName}` : ""}.
                  </div>
                ) : null}
              </div>
            ) : null}

            {err ? <div style={errorStyle}>{err}</div> : null}
            {msg ? <div style={messageStyle}>{msg}</div> : null}

            <label style={{ display: "block", marginBottom: 12 }}>
              <div style={labelStyle}>Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
              {!trimmedEmail || isEmailValid ? null : (
                <div style={{ ...helperStyle, color: "#fecaca" }}>Enter a valid email address.</div>
              )}
            </label>

            {mode !== "magic" ? (
              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={labelStyle}>Password</div>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="minimum 6 characters"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                {mode === "signup" ? (
                  <div style={{ ...helperStyle, color: trimmedPassword && trimmedPassword.length < 6 ? "#fecaca" : helperStyle.color }}>
                    Use at least 6 characters so your account can be created successfully.
                  </div>
                ) : null}
              </label>
            ) : null}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={!canSubmit || busy}
              aria-disabled={!canSubmit || busy}
              style={{ width: "100%", opacity: !canSubmit && !busy ? 0.72 : 1, cursor: !canSubmit && !busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "Working..." : mode === "signup" ? "Create account" : mode === "login" ? "Sign in" : "Send magic link"}
            </button>

            {!canSubmit && !busy ? (
              <div style={helperStyle}>{inlineValidationMessage ?? "Complete the required fields to continue."}</div>
            ) : mode === "magic" ? (
              <div style={helperStyle}>We&apos;ll send a secure sign-in link to your email.</div>
            ) : null}

            <div style={{ height: 14 }} />

            {mode !== "magic" ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
              >
                {mode === "signup" ? "Already have an account? Sign In" : "Need an account? Create One"}
              </button>
            ) : null}

            <div style={{ height: 16 }} />

            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.60)", lineHeight: 1.6, textAlign: "center" }}>
              Destination after sign-in: <strong style={{ color: "#F8FAFC" }}>{nextPath}</strong>
            </div>

            <div style={{ height: 12 }} />

            <button
              type="button"
              onClick={() => nav("/", { replace: true })}
              className="btn btn-secondary"
              style={{ width: "100%" }}
            >
              Back to Home
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  marginBottom: 6,
  color: "rgba(226,232,240,0.72)",
};

const tabStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  border: "1px solid transparent",
  background: "transparent",
  color: "rgba(226,232,240,0.72)",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  width: "100%",
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: "linear-gradient(135deg, rgba(200,182,255,0.24), rgba(139,124,255,0.22))",
  border: "1px solid rgba(184,164,255,0.30)",
  color: "#F8FAFC",
};

const errorStyle: React.CSSProperties = {
  color: "#fecaca",
  background: "rgba(239,68,68,0.10)",
  border: "1px solid rgba(239,68,68,0.22)",
  borderRadius: 16,
  padding: 12,
  marginBottom: 12,
};

const messageStyle: React.CSSProperties = {
  color: "#d1fae5",
  background: "rgba(16,185,129,0.10)",
  border: "1px solid rgba(16,185,129,0.22)",
  borderRadius: 16,
  padding: 12,
  marginBottom: 12,
};

const helperStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "rgba(226,232,240,0.68)",
  lineHeight: 1.6,
};

const contextCardStyle: React.CSSProperties = {
  color: "#F8FAFC",
  background: "linear-gradient(135deg, rgba(200,182,255,0.14), rgba(139,124,255,0.12))",
  border: "1px solid rgba(184,164,255,0.22)",
  borderRadius: 20,
  padding: 16,
  marginBottom: 12,
};
