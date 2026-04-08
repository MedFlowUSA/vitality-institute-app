import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { PROVIDER_ROUTES } from "../../lib/providerRoutes";

type ProviderWorkspaceNavProps = {
  title?: string;
  compact?: boolean;
};

type WorkspaceItem = {
  label: string;
  to: string;
};

const WORKSPACE_ITEMS: WorkspaceItem[] = [
  { label: "Command Center", to: PROVIDER_ROUTES.command },
  { label: "Queue", to: PROVIDER_ROUTES.queue },
  { label: "Intakes", to: PROVIDER_ROUTES.intakes },
  { label: "Vital AI Requests", to: PROVIDER_ROUTES.vitalAi },
  { label: "Referrals", to: PROVIDER_ROUTES.referrals },
  { label: "Labs", to: PROVIDER_ROUTES.labs },
  { label: "Messages", to: PROVIDER_ROUTES.messages },
  { label: "Patient Center", to: PROVIDER_ROUTES.patients },
  { label: "Virtual Visits", to: PROVIDER_ROUTES.virtualVisitsHash },
];

function isActivePath(currentPath: string, target: string) {
  const [targetPath] = target.split("#");
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export default function ProviderWorkspaceNav({
  title = "Provider Workspace",
  compact = false,
}: ProviderWorkspaceNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeLocationId } = useAuth();
  const [expanded, setExpanded] = useState(!compact);

  const locationSummary = useMemo(
    () => (activeLocationId ? "Location scope active" : "No active location selected"),
    [activeLocationId]
  );

  return (
    <div
      className="card card-pad card-light surface-light"
      style={{
        background: "rgba(255,255,255,0.94)",
        border: "1px solid rgba(184,164,255,0.22)",
        boxShadow: "0 12px 34px rgba(17,24,39,0.08)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#5B4E86" }}>
            {title}
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            {locationSummary}
          </div>
        </div>

        {compact ? (
          <button className="btn btn-ghost" type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Hide Tools" : "Show Tools"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {WORKSPACE_ITEMS.map((item) => (
              <button
                key={item.to}
                className={isActivePath(location.pathname, item.to) ? "btn btn-primary" : "btn btn-ghost"}
                type="button"
                onClick={() => navigate(item.to)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
