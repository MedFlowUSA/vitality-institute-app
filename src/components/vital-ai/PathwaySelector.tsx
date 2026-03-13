import type { VitalAiPathwayRow } from "../../lib/vitalAi/types";

export default function PathwaySelector({
  pathways,
  onSelect,
  busySlug,
}: {
  pathways: VitalAiPathwayRow[];
  onSelect: (pathway: VitalAiPathwayRow) => void;
  busySlug?: string | null;
}) {
  return (
    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
      {pathways.map((pathway) => (
        <div
          key={pathway.id}
          className="card card-pad"
          style={{
            flex: "1 1 320px",
            minWidth: 280,
            background: "rgba(8,15,28,0.98)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
          }}
        >
          <div className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.76)" }}>
            Intake Pathway
          </div>
          <div className="h2" style={{ color: "#F8FAFC", marginTop: 6 }}>{pathway.name}</div>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, color: "rgba(226,232,240,0.84)" }}>
            {pathway.description ?? "Start this intake pathway."}
          </div>
          <div className="space" />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => onSelect(pathway)}
            disabled={busySlug === pathway.slug}
            style={{
              width: "100%",
              minHeight: 48,
              background: "linear-gradient(135deg, #C8B6FF, #8B7CFF)",
              color: "#140F24",
              border: "1px solid rgba(184,164,255,0.42)",
              boxShadow: "0 14px 30px rgba(139,124,255,0.22)",
              fontWeight: 900,
            }}
          >
            {busySlug === pathway.slug ? "Starting..." : "Start Intake"}
          </button>
        </div>
      ))}
    </div>
  );
}
