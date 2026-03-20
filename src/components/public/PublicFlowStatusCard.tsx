import { Link } from "react-router-dom";

type Action = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
};

export default function PublicFlowStatusCard({
  eyebrow,
  title,
  body,
  detail,
  tone = "info",
  actions = [],
}: {
  eyebrow?: string;
  title: string;
  body: string;
  detail?: string;
  tone?: "info" | "success";
  actions?: Action[];
}) {
  const accent = tone === "success" ? "rgba(16,185,129,0.16)" : "rgba(124,58,237,0.12)";
  const border = tone === "success" ? "rgba(16,185,129,0.22)" : "rgba(91,78,134,0.18)";

  return (
    <div className="card card-pad card-light surface-light" style={{ border: `1px solid ${border}`, boxShadow: "0 18px 40px rgba(36,27,61,0.08)" }}>
      {eyebrow ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 30,
            padding: "6px 12px",
            borderRadius: 999,
            background: accent,
            color: "#5B4E86",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div className="h2" style={{ marginTop: eyebrow ? 12 : 0 }}>
        {title}
      </div>
      <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8, maxWidth: 760 }}>
        {body}
      </div>
      {detail ? (
        <div className="surface-light-helper" style={{ marginTop: 12, lineHeight: 1.7 }}>
          {detail}
        </div>
      ) : null}
      {actions.length > 0 ? (
        <>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {actions.map((action) =>
              action.to ? (
                <Link key={`${action.label}-${action.to}`} to={action.to} className={action.variant === "ghost" ? "btn btn-ghost" : "btn btn-primary"}>
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  className={action.variant === "ghost" ? "btn btn-ghost" : "btn btn-primary"}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
