import { useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

type RouteHeaderProps = {
  title: string;
  backTo?: string;
  homeTo?: string;
  subtitle?: string;
  rightAction?: ReactNode;
};

function getDefaultHome(role: ReturnType<typeof useAuth>["role"]) {
  if (role === "patient") return "/patient";
  if (role === "super_admin") return "/admin";
  return "/provider";
}

export default function RouteHeader({ title, backTo, homeTo, subtitle, rightAction }: RouteHeaderProps) {
  const navigate = useNavigate();
  const { role } = useAuth();

  const resolvedHome = useMemo(() => homeTo ?? getDefaultHome(role), [homeTo, role]);

  return (
    <div
      className="card card-pad"
      style={{
        background: "rgba(255,255,255,0.94)",
        border: "1px solid rgba(184,164,255,0.22)",
        boxShadow: "0 12px 34px rgba(17,24,39,0.08)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" type="button" onClick={() => (backTo ? navigate(backTo) : navigate(-1))}>
              Back
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate(resolvedHome)}>
              Home
            </button>
          </div>
          <div className="h2" style={{ margin: 0 }}>
            {title}
          </div>
          {subtitle ? (
            <div className="muted" style={{ lineHeight: 1.6 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {rightAction ? <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{rightAction}</div> : null}
      </div>
    </div>
  );
}
