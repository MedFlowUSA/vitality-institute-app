import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return password.trim().length >= 8 && password === confirmPassword && !submitting;
  }, [password, confirmPassword, submitting]);

  if (!loading && !user) return <Navigate to="/login" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!canSubmit) {
      setError("Enter matching passwords with at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) throw updateError;

      setMessage("Password updated. You can continue using the app or sign in again later.");
      setPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to update password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <div className="card card-pad" style={{ maxWidth: 640, margin: "0 auto" }}>
          <div className="h1">Set a New Password</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Finish your recovery flow by setting a new password for your account.
          </div>

          <div className="space" />

          <form onSubmit={onSubmit}>
            {error ? <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div> : null}
            {message ? <div style={{ color: "rgba(255,255,255,0.9)", marginBottom: 12 }}>{message}</div> : null}

            <label className="form-control" style={{ display: "block", marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                New password
              </div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            <label className="form-control" style={{ display: "block", marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Confirm password
              </div>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
              />
            </label>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                {submitting ? "Saving..." : "Save New Password"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
