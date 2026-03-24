import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getAuthRedirectUrl, supabase } from "../lib/supabase";

type EntryMode = "signin" | "create";

function normalizeRoleLabel(role?: string | null) {
  if (!role) return "Access Pending";
  return role.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Login() {
  const { user, loading, signIn, signOut, role, roleError, accountStatus } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<EntryMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !submitting;
  }, [email, password, submitting]);

  const resolvedAccountStatus: "approved" | "pending" | "inactive" | "restricted" =
    accountStatus ?? (role ? "approved" : roleError ? "restricted" : "pending");

  function openApprovedHome() {
    if (role === "super_admin" || role === "location_admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (role === "patient") {
      navigate("/patient", { replace: true });
      return;
    }

    navigate("/provider", { replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || "Unable to sign in. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetPassword() {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Enter your email first so we know where to send the reset link.");
      return;
    }

    setResetting(true);

    try {
      const params = new URLSearchParams({ next: "/login/reset-password" });
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthRedirectUrl("/auth/callback", params),
      });

      if (resetError) throw resetError;

      setMessage("Password reset email sent. Open that link from this environment to finish updating your password.");
    } catch (err: any) {
      setError(err?.message || "Unable to send password reset email.");
    } finally {
      setResetting(false);
    }
  }

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
      <div
        style={{
          width: "100%",
          maxWidth: 540,
        }}
      >
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
                  Secure access for patients, providers, staff, and approved Vitality users.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: "rgba(226,232,240,0.64)", lineHeight: 1.6 }}>
              Your portal will open automatically based on your approved access and account type.
            </div>
          </div>

          <div style={{ padding: 28 }}>
            {loading ? (
              <StatusPanel
                tone="neutral"
                title="Checking your access"
                body="Restoring your session and verifying your account."
              />
            ) : user ? (
              resolvedAccountStatus === "approved" ? (
                <StatusPanel
                  tone="success"
                  title="Welcome back"
                  body="Your account is active and ready."
                  email={user.email ?? undefined}
                  badge={normalizeRoleLabel(role)}
                  primaryAction={{
                    label: "Open Dashboard",
                    onClick: openApprovedHome,
                  }}
                  secondaryAction={{
                    label: "Sign Out",
                    onClick: signOut,
                  }}
                />
              ) : resolvedAccountStatus === "pending" ? (
                <StatusPanel
                  tone="warning"
                  title="Access pending approval"
                  body="Your account is signed in, but your Vitality access is still pending review. Your portal will open automatically once approval is complete."
                  email={user.email ?? undefined}
                  badge="Pending"
                  secondaryAction={{
                    label: "Sign Out",
                    onClick: signOut,
                  }}
                />
              ) : resolvedAccountStatus === "inactive" ? (
                <StatusPanel
                  tone="danger"
                  title="Access inactive"
                  body="Your account is signed in, but access is currently inactive. Contact the Vitality team if you believe this is incorrect."
                  email={user.email ?? undefined}
                  badge="Inactive"
                  secondaryAction={{
                    label: "Sign Out",
                    onClick: signOut,
                  }}
                />
              ) : (
                <StatusPanel
                  tone="danger"
                  title="Restricted access"
                  body={roleError || "This account does not currently have approved Vitality access."}
                  email={user.email ?? undefined}
                  badge="Restricted"
                  secondaryAction={{
                    label: "Sign Out",
                    onClick: signOut,
                  }}
                />
              )
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: 6,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    style={mode === "signin" ? activeTabStyle : tabStyle}
                  >
                    Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("create")}
                    style={mode === "create" ? activeTabStyle : tabStyle}
                  >
                    Create Account
                  </button>
                </div>

                <div style={{ height: 22 }} />

                {mode === "signin" ? (
                  <form onSubmit={onSubmit}>
                    {error ? <Alert tone="danger" text={error} /> : null}
                    {message ? <Alert tone="success" text={message} /> : null}

                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Email</label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="name@company.com"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Password</label>

                      <div style={{ position: "relative" }}>
                        <input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type={showPw ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          style={{ ...inputStyle, paddingRight: 98 }}
                        />

                        <button type="button" onClick={() => setShowPw((s) => !s)} style={passwordToggleStyle}>
                          {showPw ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "rgba(226,232,240,0.58)" }}>
                        Secure sign-in for approved Vitality users.
                      </div>

                      <button type="button" onClick={onResetPassword} disabled={resetting} style={linkButtonStyle}>
                        {resetting ? "Sending..." : "Forgot password"}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      style={{
                        ...primaryButtonStyle,
                        marginTop: 18,
                        opacity: canSubmit ? 1 : 0.55,
                        cursor: canSubmit ? "pointer" : "not-allowed",
                      }}
                    >
                      {submitting ? "Signing in..." : "Sign In"}
                    </button>
                  </form>
                ) : (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#F8FAFC" }}>Create your Vitality account</div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 14,
                        color: "rgba(226,232,240,0.72)",
                        lineHeight: 1.7,
                      }}
                    >
                      Create an account to request access. Your Vitality portal and permissions will be assigned after review and approval.
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("/access?mode=signup&next=/")}
                      style={{
                        ...secondaryButtonStyle,
                        marginTop: 18,
                      }}
                    >
                      Continue to Create Account
                    </button>
                  </div>
                )}

                <div
                  style={{
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    color: "rgba(226,232,240,0.58)",
                    lineHeight: 1.7,
                  }}
                >
                  Need help or product information?{" "}
                  <button type="button" onClick={() => navigate("/services")} style={inlineLinkStyle}>
                    Services
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPanel({
  tone,
  title,
  body,
  email,
  badge,
  primaryAction,
  secondaryAction,
}: {
  tone: "neutral" | "success" | "warning" | "danger";
  title: string;
  body: string;
  email?: string;
  badge?: string;
  primaryAction?: { label: string; onClick: () => void | Promise<void> };
  secondaryAction?: { label: string; onClick: () => void | Promise<void> };
}) {
  const panelTone = {
    neutral: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      badgeBg: "rgba(148,163,184,0.18)",
      badgeBorder: "1px solid rgba(148,163,184,0.30)",
      badgeColor: "#E2E8F0",
    },
    success: {
      background: "rgba(16,185,129,0.10)",
      border: "1px solid rgba(16,185,129,0.22)",
      badgeBg: "rgba(16,185,129,0.18)",
      badgeBorder: "1px solid rgba(16,185,129,0.30)",
      badgeColor: "#D1FAE5",
    },
    warning: {
      background: "rgba(245,158,11,0.10)",
      border: "1px solid rgba(245,158,11,0.22)",
      badgeBg: "rgba(245,158,11,0.18)",
      badgeBorder: "1px solid rgba(245,158,11,0.30)",
      badgeColor: "#FEF3C7",
    },
    danger: {
      background: "rgba(239,68,68,0.10)",
      border: "1px solid rgba(239,68,68,0.22)",
      badgeBg: "rgba(239,68,68,0.18)",
      badgeBorder: "1px solid rgba(239,68,68,0.30)",
      badgeColor: "#FEE2E2",
    },
  }[tone];

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 22,
        background: panelTone.background,
        border: panelTone.border,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#F8FAFC", lineHeight: 1.1 }}>{title}</div>
          <div style={{ marginTop: 10, fontSize: 14, color: "rgba(226,232,240,0.74)", lineHeight: 1.7 }}>{body}</div>
        </div>

        {badge ? (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              borderRadius: 999,
              background: panelTone.badgeBg,
              border: panelTone.badgeBorder,
              color: panelTone.badgeColor,
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      {email ? (
        <div style={{ marginTop: 16, fontSize: 13, color: "rgba(226,232,240,0.66)" }}>
          Signed in as <strong style={{ color: "#F8FAFC" }}>{email}</strong>
        </div>
      ) : null}

      {(primaryAction || secondaryAction) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          {primaryAction ? (
            <button type="button" onClick={primaryAction.onClick} style={primaryButtonStyle}>
              {primaryAction.label}
            </button>
          ) : null}

          {secondaryAction ? (
            <button type="button" onClick={secondaryAction.onClick} style={secondaryButtonStyle}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Alert({ tone, text }: { tone: "danger" | "success"; text: string }) {
  const styles =
    tone === "danger"
      ? {
          background: "rgba(239,68,68,0.10)",
          border: "1px solid rgba(239,68,68,0.22)",
          color: "#FECACA",
        }
      : {
          background: "rgba(16,185,129,0.10)",
          border: "1px solid rgba(16,185,129,0.22)",
          color: "#D1FAE5",
        };

  return (
    <div
      style={{
        ...styles,
        padding: 14,
        borderRadius: 16,
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  );
}

const tabStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  border: "1px solid transparent",
  background: "transparent",
  color: "rgba(226,232,240,0.72)",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: "linear-gradient(135deg, rgba(200,182,255,0.24), rgba(139,124,255,0.22))",
  border: "1px solid rgba(184,164,255,0.30)",
  color: "#F8FAFC",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  color: "#E2E8F0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  borderRadius: 16,
  padding: "13px 14px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  outline: "none",
  fontSize: 14,
  color: "#F8FAFC",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
};

const passwordToggleStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  borderRadius: 12,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 800,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#E2E8F0",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  padding: "14px 16px",
  fontSize: 15,
  fontWeight: 900,
  border: "1px solid rgba(184,164,255,0.34)",
  background: "linear-gradient(135deg, #C8B6FF, #8B7CFF)",
  color: "#140F24",
  cursor: "pointer",
  boxShadow: "0 16px 36px rgba(139,124,255,0.24)",
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 800,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#E2E8F0",
  cursor: "pointer",
};

const linkButtonStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#C8B6FF",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const inlineLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#C8B6FF",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};
