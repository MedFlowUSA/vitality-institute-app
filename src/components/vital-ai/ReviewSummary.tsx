import { buildAnswerList, getQuestionValueLabel } from "../../lib/vitalAi/submission";
import type { PathwayDefinition, ResponseMap, VitalAiFileRow } from "../../lib/vitalAi/types";
import { guidedHelperStyle, guidedPanelSoftStyle, guidedPanelStyle } from "./guidedIntakeStyles";

export default function ReviewSummary({
  definition,
  answers,
  files,
}: {
  definition: PathwayDefinition;
  answers: ResponseMap;
  files: VitalAiFileRow[];
}) {
  const sections = buildAnswerList(definition, answers);
  const answeredCount = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card card-pad" style={guidedPanelStyle}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>
              Review Before Submit
            </div>
            <div className="h2" style={{ marginTop: 8 }}>Make sure everything looks right</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, ...guidedHelperStyle }}>
              Confirm your answers, uploads, and wound details before they are routed to the Vitality care team.
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <div className="v-chip">{sections.length} section{sections.length === 1 ? "" : "s"}</div>
            <div className="v-chip">{answeredCount} answer{answeredCount === 1 ? "" : "s"}</div>
            <div className="v-chip">{files.length} upload{files.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div
          key={section.key}
          className="card card-pad"
          style={guidedPanelStyle}
        >
          <div className="h2">{section.title}</div>
          <div className="muted" style={{ marginTop: 4, ...guidedHelperStyle }}>
            Review this section before you submit your intake.
          </div>
          <div className="space" />
          {section.items.length === 0 ? (
            <div className="muted" style={guidedHelperStyle}>No answers in this section.</div>
          ) : (
            section.items.map(({ question, value }) => (
              <div
                key={question.key}
                className="card card-pad"
                style={{ ...guidedPanelSoftStyle, marginBottom: 10 }}
              >
                <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>
                  {question.label}
                </div>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "#F8FAFC", lineHeight: 1.6 }}>
                  {(question.type === "file" || question.type === "image") && question.category
                    ? files
                        .filter((file) => file.category === question.category)
                        .map((file) => file.filename)
                        .join(", ") || "No files uploaded"
                    : getQuestionValueLabel(question, value)}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
