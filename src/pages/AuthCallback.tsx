import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeRedirectTarget } from "../lib/routeFlow";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Completing sign-in");
  const [detail, setDetail] = useState("Restoring your session and redirecting...");

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof window.setTimeout> | null = null;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const type = url.searchParams.get("type");
        const next = normalizeRedirectTarget(url.searchParams.get("next"), "/patient");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        if (cancelled) return;

        if (type === "recovery") {
          navigate("/login/reset-password", { replace: true });
          return;
        }

        if (code) {
          setTitle("Thanks for verifying your Vitality account request");
          setDetail("Your email is confirmed. We’re preparing your next step now.");
          redirectTimer = window.setTimeout(() => {
            navigate(next, { replace: true });
          }, 1600);
          return;
        }

        navigate(next, { replace: true });
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to complete sign-in.");
      }
    })();

    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div className="app-bg">
      <div className="shell">
        <div className="card card-pad" style={{ maxWidth: 720 }}>
          <div className="h1">{title}</div>
          <div className="space" />
          {error ? (
            <div style={{ color: "crimson" }}>{error}</div>
          ) : (
            <div className="muted">{detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}
