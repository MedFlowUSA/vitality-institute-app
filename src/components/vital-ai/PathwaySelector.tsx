import type { VitalAiPathwayRow } from "../../lib/vitalAi/types";
import { guidedHelperStyle, guidedMutedStyle, guidedPanelStyle, guidedPrimaryButtonStyle, pathwayAccent } from "./guidedIntakeStyles";

export default function PathwaySelector({
  pathways,
  onSelect,
  busySlug,
}: {
  pathways: VitalAiPathwayRow[];
  onSelect: (pathway: VitalAiPathwayRow) => void;
  busySlug?: string | null;
}) {
  const sortedPathways = [...pathways].sort((a, b) => {
    const rank = (slug: string) => {
      const key = slug.toLowerCase();
      if (key.includes("general") || key.includes("consult")) return 0;
      if (key.includes("wound")) return 1;
      return 2;
    };

    return rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name);
  });

  return (
    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
      {sortedPathways.map((pathway) => {
        const meta = pathwayAccent(pathway.slug);
        const stepCount = pathway.definition_json.steps.length;
        const questionCount = pathway.definition_json.steps.reduce((total, step) => total + step.questions.length, 0);

        return (
        <div
          key={pathway.id}
          className="card card-pad"
          style={{
            flex: "1 1 320px",
            minWidth: 280,
            ...guidedPanelStyle,
            background: `linear-gradient(180deg, ${meta.tone}, rgba(8,15,28,0.98) 24%)`,
          }}
        >
          <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>
            {meta.eyebrow}
          </div>
          <div className="h2" style={{ color: "#F8FAFC", marginTop: 6 }}>{pathway.name}</div>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, ...guidedMutedStyle }}>
            {pathway.description ?? "Start this intake pathway."}
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <div className="v-chip">{stepCount} step{stepCount === 1 ? "" : "s"}</div>
            <div className="v-chip">{questionCount} guided item{questionCount === 1 ? "" : "s"}</div>
            {pathway.slug.toLowerCase().includes("wound") ? <div className="v-chip">Photo uploads supported</div> : null}
          </div>

          <div className="muted" style={{ marginTop: 12, lineHeight: 1.6, ...guidedHelperStyle }}>
            {meta.helper}
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
              ...guidedPrimaryButtonStyle,
            }}
          >
            {busySlug === pathway.slug ? "Starting..." : "Start Intake"}
          </button>
        </div>
      )})}
    </div>
  );
}
