import { buildAnswerList, getQuestionValueLabel } from "../../lib/vitalAi/submission";
import type { PathwayDefinition, ResponseMap, VitalAiFileRow } from "../../lib/vitalAi/types";

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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {sections.map((section) => (
        <div
          key={section.key}
          className="card card-pad"
          style={{
            background: "rgba(8,15,28,0.96)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div className="h2">{section.title}</div>
          <div className="muted" style={{ marginTop: 4, color: "rgba(226,232,240,0.78)" }}>
            Review this section before you submit your intake.
          </div>
          <div className="space" />
          {section.items.length === 0 ? (
            <div className="muted" style={{ color: "rgba(226,232,240,0.78)" }}>No answers in this section.</div>
          ) : (
            section.items.map(({ question, value }) => (
              <div
                key={question.key}
                className="card card-pad"
                style={{
                  marginBottom: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.82)" }}>
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
