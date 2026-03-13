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
        <div key={pathway.id} className="card card-pad" style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div className="h2">{pathway.name}</div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
            {pathway.description ?? "Start this intake pathway."}
          </div>
          <div className="space" />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => onSelect(pathway)}
            disabled={busySlug === pathway.slug}
          >
            {busySlug === pathway.slug ? "Starting..." : "Start Intake"}
          </button>
        </div>
      ))}
    </div>
  );
}
