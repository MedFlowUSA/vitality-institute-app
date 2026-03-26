import { useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import BrandLockup from "./BrandLockup";

type RouteHeaderProps = {
  title: string;
  backTo?: string;
  homeTo?: string;
  subtitle?: string;
  rightAction?: ReactNode;
};

function getDefaultHome(role: ReturnType<typeof useAuth>["role"]) {
  if (role === "patient") return "/patient/home";
  if (role === "super_admin") return "/admin";
  return "/provider";
}

export default function RouteHeader({ title, backTo, homeTo, subtitle, rightAction }: RouteHeaderProps) {
  const navigate = useNavigate();
  const { role, signOut } = useAuth();

  const resolvedHome = useMemo(() => homeTo ?? getDefaultHome(role), [homeTo, role]);
  const shellLabel = useMemo(() => {
    if (role === "patient") return "Patient Portal";
    if (role === "super_admin" || role === "location_admin") return "Admin Workspace";
    return "Provider Workspace";
  }, [role]);

  return (
    <div
      className="card card-pad card-light surface-light"
      style={{
        boxShadow: "0 12px 34px rgba(17,24,39,0.08)",
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <BrandLockup eyebrow={shellLabel} title={title} subtitle={subtitle} compact />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {rightAction}
            {!rightAction ? (
              <button className="btn btn-ghost" type="button" onClick={() => void signOut()}>
                Logout
              </button>
            ) : null}
          </div>
        </div>

        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" onClick={() => (backTo ? navigate(backTo) : navigate(-1))}>
              Back
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate(resolvedHome)}>
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
