import { useState } from "react";
import { useNavigate } from "react-router-dom";

type ProviderGuideAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: "primary" | "ghost";
};

type ProviderGuidePanelProps = {
  title: string;
  description: string;
  workflowState?: string | null;
  nextAction?: string | null;
  actions?: ProviderGuideAction[];
};

export type { ProviderGuideAction };

export default function ProviderGuidePanel({
  title,
  description,
  workflowState,
  nextAction,
  actions = [],
}: ProviderGuidePanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="card card-pad card-light surface-light"
      style={{
        background: "linear-gradient(135deg, rgba(245,240,255,0.96), rgba(236,229,255,0.94))",
        border: "1px solid rgba(184,164,255,0.28)",
        boxShadow: "0 14px 36px rgba(17,24,39,0.08)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#5B4E86" }}>
            Provider Guide
          </div>
          <div className="h2" style={{ margin: "8px 0 0 0" }}>
            {title}
          </div>
        </div>

        <button className="btn btn-ghost" type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Hide Guide" : "Show Guide"}
        </button>
      </div>

      {expanded ? (
        <>
          <div className="space" />

          <div className="surface-light-body" style={{ lineHeight: 1.7 }}>{description}</div>

          {(workflowState || nextAction) ? (
            <>
              <div className="space" />
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                {workflowState ? (
                  <div
                    style={{
                      flex: "1 1 220px",
                      minWidth: 200,
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(184,164,255,0.22)",
                      background: "rgba(255,255,255,0.62)",
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      Workflow State
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 800 }}>{workflowState}</div>
                  </div>
                ) : null}

                {nextAction ? (
                  <div
                    style={{
                      flex: "1 1 280px",
                      minWidth: 220,
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(184,164,255,0.22)",
                      background: "rgba(255,255,255,0.62)",
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      Recommended Next Action
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 800 }}>{nextAction}</div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {actions.length > 0 ? (
            <>
              <div className="space" />
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {actions.map((action) => (
                  <button
                    key={`${action.label}-${action.to ?? "action"}`}
                    className={action.tone === "primary" ? "btn btn-primary" : "btn btn-ghost"}
                    type="button"
                    onClick={() => {
                      if (action.onClick) {
                        action.onClick();
                        return;
                      }
                      if (action.to) navigate(action.to);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
