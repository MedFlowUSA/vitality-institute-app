import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getAuthRedirectUrl, supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "magic";

function normalizeMode(value: string | null): Mode {
  const raw = (value ?? "").toLowerCase();
  if (raw === "signup") return "signup";
  if (raw === "magic") return "magic";
  return "login";
}

function normalizeNextPath(value: string | null, pathname: string) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  if (pathname.startsWith("/patient")) return "/patient";
  return "/";
}

export default function PatientAuth() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    return normalizeNextPath(searchParams.get("next"), location.pathname);
  }, [location.pathname, searchParams]);

  const canSubmit = useMemo(() => {
    if (!email.trim()) return false;
    if (mode === "magic") return true;
    return password.trim().length >= 6;
  }, [email, password, mode]);

  const authRedirect = useMemo(() => {
    const params = new URLSearchParams({ next: nextPath });
    return getAuthRedirectUrl("/auth/callback", params);
  }, [nextPath]);

  useEffect(() => {
    setMode(normalizeMode(searchParams.get("mode")));
  }, [searchParams]);

  const submit = async () => {
    setErr(null);
    setMsg(null);
    if (!canSubmit) return;

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: authRedirect,
          },
        });
        if (error) throw error;

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
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(16,185,129,0.10) 0%, rgba(14,165,233,0.08) 20%, rgba(15,23,42,1) 58%, #06111f 100%)",
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
              padding: "32px 28px 20px 28px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background:
                "radial-gradient(circle at top left, rgba(16,185,129,0.14), transparent 38%), radial-gradient(circle at top right, rgba(14,165,233,0.12), transparent 34%)",
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
                    background: "linear-gradient(135deg, #10B981, #38BDF8)",
                    boxShadow: "0 8px 24px rgba(56,189,248,0.24)",
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
                  MedFlow USA
                </div>
                <div style={{ marginTop: 6, fontSize: 14, color: "rgba(226,232,240,0.72)", lineHeight: 1.6 }}>
                  Secure account access for approved MedFlow users and invited partners.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: "rgba(226,232,240,0.64)", lineHeight: 1.6 }}>
              Choose how you want to continue. Your destination will open automatically after sign-in.
            </div>
          </div>

          <div style={{ padding: 28 }}>
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
                onClick={() => setMode("login")}
                style={mode === "login" ? activeTabStyle : tabStyle}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setMode("signup")}
                style={mode === "signup" ? activeTabStyle : tabStyle}
              >
                Create Account
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setMode("magic")}
                style={mode === "magic" ? activeTabStyle : tabStyle}
              >
                Magic Link
              </button>
            </div>

            <div style={{ height: 22 }} />

            {err ? <div style={errorStyle}>{err}</div> : null}
            {msg ? <div style={messageStyle}>{msg}</div> : null}

            <label style={{ display: "block", marginBottom: 12 }}>
              <div style={labelStyle}>Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
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
              </label>
            ) : null}

            <button className="btn btn-primary" type="button" disabled={!canSubmit || busy} onClick={submit}>
              {busy ? "Working..." : mode === "signup" ? "Create account" : mode === "login" ? "Sign in" : "Send magic link"}
            </button>

            <div style={{ height: 16 }} />

            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.60)", lineHeight: 1.6 }}>
              Destination after sign-in: <strong style={{ color: "#F8FAFC" }}>{nextPath}</strong>
            </div>

            <div style={{ height: 12 }} />

            <button
              type="button"
              onClick={() => nav("/", { replace: true })}
              style={{
                background: "transparent",
                border: "none",
                color: "#67E8F9",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Back to sign in
            </button>
          </div>
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
  background: "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(14,165,233,0.20))",
  border: "1px solid rgba(56,189,248,0.24)",
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
