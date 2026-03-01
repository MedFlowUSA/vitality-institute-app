import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { user, loading, signIn } = useAuth() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !submitting;
  }, [email, password, submitting]);

  // If already logged in, Gate at "/" will route by role.
  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Expecting AuthProvider has signIn(email, password)
      await signIn(email.trim(), password);
      // success will redirect via Navigate above or auth state change
    } catch (err: any) {
      setError(err?.message || "Unable to sign in. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F9FC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 20,
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          boxShadow: "0 18px 55px rgba(17,24,39,0.10)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 28px 18px 28px",
            background:
              "radial-gradient(circle at 30% 10%, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.04) 40%, rgba(255,255,255,1) 75%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Optional logo: replace src if you have it available */}
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(124,58,237,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(124,58,237,0.18)",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
                Vitality Institute
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                Secure access to your portal
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} style={{ padding: 28 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@company.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>
              Password
            </label>

            <div style={{ position: "relative" }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 92 }}
              />

              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.22)",
                color: "#991B1B",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151" }}>
              <input type="checkbox" />
              Remember me
            </label>

            <button
              type="button"
              onClick={() => alert("Add forgot-password flow later.")}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#7C3AED",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              Forgot password
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%",
              marginTop: 18,
              borderRadius: 14,
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 800,
              border: "1px solid rgba(124,58,237,0.30)",
              background: canSubmit ? "linear-gradient(135deg, #7C3AED, #A78BFA)" : "#E5E7EB",
              color: canSubmit ? "#FFFFFF" : "#6B7280",
              cursor: canSubmit ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? "0 12px 35px rgba(124,58,237,0.22)" : "none",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ marginTop: 16, fontSize: 12, color: "#6B7280", lineHeight: 1.4 }}>
            By continuing, you agree to Vitality Institute’s internal access policies and secure handling of patient
            information.
          </div>
        </form>

        {/* Footer */}
        <div
          style={{
            padding: "14px 28px",
            borderTop: "1px solid #E5E7EB",
            color: "#6B7280",
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>© {new Date().getFullYear()} Vitality Institute</span>
          <span style={{ color: "#7C3AED", fontWeight: 700 }}>Medical • Wellness</span>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  borderRadius: 14,
  padding: "12px 12px",
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  outline: "none",
  fontSize: 14,
  color: "#111827",
};
