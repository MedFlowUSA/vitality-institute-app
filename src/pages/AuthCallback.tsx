import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeRedirectTarget } from "../lib/routeFlow";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const type = url.searchParams.get("type");
        const next = normalizeRedirectTarget(url.searchParams.get("next"), "/");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        if (cancelled) return;

        if (type === "recovery") {
          navigate("/login/reset-password", { replace: true });
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
    };
  }, [navigate]);

  return (
    <div className="app-bg">
      <div className="shell">
        <div className="card card-pad" style={{ maxWidth: 720 }}>
          <div className="h1">Completing sign-in</div>
          <div className="space" />
          {error ? (
            <div style={{ color: "crimson" }}>{error}</div>
          ) : (
            <div className="muted">Restoring your session and redirecting...</div>
          )}
        </div>
      </div>
    </div>
  );
}
