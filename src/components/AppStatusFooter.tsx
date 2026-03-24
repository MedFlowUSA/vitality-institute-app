import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function AppStatusFooter() {
  const { user, role, activeLocationId } = useAuth();
  const location = useLocation();

  const userLabel = user?.email ?? user?.id?.slice(0, 8) ?? "guest";

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 40,
        borderTop: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(5,8,18,0.88)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="shell" style={{ padding: "8px 0" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Route: <strong style={{ color: "rgba(255,255,255,0.95)" }}>{location.pathname}</strong>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Role: <strong style={{ color: "rgba(255,255,255,0.95)" }}>{role ?? "-"}</strong>
            {" • "}
            Location: <strong style={{ color: "rgba(255,255,255,0.95)" }}>{activeLocationId ?? "-"}</strong>
            {" • "}
            User: <strong style={{ color: "rgba(255,255,255,0.95)" }}>{userLabel}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}