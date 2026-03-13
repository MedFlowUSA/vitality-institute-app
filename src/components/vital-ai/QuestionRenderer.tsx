import type { IntakeQuestion } from "../../lib/vitalAi/types";
import DictationTextarea from "../DictationTextarea";

export default function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <div style={{ marginBottom: 6, color: "#F8FAFC", fontSize: 13, fontWeight: 800 }}>
      {question.label}
      {question.required ? " *" : ""}
    </div>
  );

  const sharedInputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    padding: "13px 14px",
    border: "1px solid rgba(200,182,255,0.38)",
    background: "rgba(15,23,42,0.92)",
    outline: "none",
    fontSize: 14,
    color: "#F8FAFC",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.22)",
  };

  const selectStyle: React.CSSProperties = {
    ...sharedInputStyle,
    background: "#FFFFFF",
    color: "#1F1633",
    border: "1px solid rgba(184,164,255,0.48)",
    boxShadow: "0 0 0 1px rgba(184,164,255,0.10), inset 0 1px 2px rgba(15,23,42,0.08)",
    fontWeight: 700,
  };

  if (question.type === "textarea") {
    return (
      <div style={{ marginBottom: 16 }}>
        {label}
        <DictationTextarea
          value={typeof value === "string" ? value : ""}
          onChange={(nextValue) => onChange(nextValue)}
          style={sharedInputStyle}
          helpText="You can type or use your microphone for longer answers."
          unsupportedText="Microphone dictation is not available in this browser. You can keep typing."
        />
      </div>
    );
  }

  if (question.type === "select") {
    return (
        <div style={{ marginBottom: 16 }}>
          {label}
          <select
            className="input"
            style={selectStyle}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" style={{ color: "#5B5670", background: "#FFFFFF" }}>
              Select...
            </option>
            {(question.options ?? []).map((option) => (
              <option key={option} value={option} style={{ color: "#1F1633", background: "#FFFFFF" }}>
                {option}
              </option>
            ))}
          </select>
        </div>
    );
  }

  if (question.type === "boolean") {
    return (
      <div
        className="card card-pad"
        style={{
          marginBottom: 16,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <label style={{ display: "flex", gap: 10, alignItems: "center", color: "#F8FAFC", fontWeight: 700 }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {question.label}
          {question.required ? " *" : ""}
        </label>
      </div>
    );
  }

  const inputType = question.type === "number" ? "number" : question.type === "date" ? "date" : "text";

  return (
    <div style={{ marginBottom: 16 }}>
      {label}
      <input
        className="input"
        type={inputType}
        style={sharedInputStyle}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={(e) => onChange(question.type === "number" ? e.target.value : e.target.value)}
      />
    </div>
  );
}
