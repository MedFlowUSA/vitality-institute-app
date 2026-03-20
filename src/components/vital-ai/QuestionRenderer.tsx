import type { IntakeQuestion } from "../../lib/vitalAi/types";
import DictationTextarea from "../DictationTextarea";
import { guidedPanelSoftStyle } from "./guidedIntakeStyles";

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
    <div style={{ marginBottom: 6, color: "inherit", fontSize: 13, fontWeight: 800 }}>
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
      <div style={{ marginBottom: 4 }}>
        {label}
        {question.helpText ? (
          <div className="muted" style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.5 }}>
            {question.helpText}
          </div>
        ) : null}
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
        <div style={{ marginBottom: 4 }}>
          {label}
          {question.helpText ? (
            <div className="muted" style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.5 }}>
              {question.helpText}
            </div>
          ) : null}
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
    const selectedValue = value === true ? "yes" : value === false ? "no" : null;

    return (
      <div style={{ marginBottom: 16 }}>
        {label}
        {question.helpText ? (
          <div className="muted" style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.5 }}>
            {question.helpText}
          </div>
        ) : null}
        <div
          className="card card-pad"
          role="radiogroup"
          aria-label={question.label}
          style={{
            ...guidedPanelSoftStyle,
          }}
        >
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              role="radio"
              aria-checked={selectedValue === "yes"}
              className={selectedValue === "yes" ? "btn btn-primary" : "btn btn-ghost"}
              onClick={() => onChange(true)}
              style={{
                minWidth: 110,
                justifyContent: "center",
                background: selectedValue === "yes" ? "linear-gradient(135deg, #C8B6FF, #8B7CFF)" : "rgba(255,255,255,0.08)",
                color: selectedValue === "yes" ? "#140F24" : "#F8FAFC",
                border: selectedValue === "yes" ? "1px solid rgba(184,164,255,0.46)" : "1px solid rgba(255,255,255,0.16)",
              }}
            >
              Yes
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedValue === "no"}
              className={selectedValue === "no" ? "btn btn-primary" : "btn btn-ghost"}
              onClick={() => onChange(false)}
              style={{
                minWidth: 110,
                justifyContent: "center",
                background: selectedValue === "no" ? "linear-gradient(135deg, #C8B6FF, #8B7CFF)" : "rgba(255,255,255,0.08)",
                color: selectedValue === "no" ? "#140F24" : "#F8FAFC",
                border: selectedValue === "no" ? "1px solid rgba(184,164,255,0.46)" : "1px solid rgba(255,255,255,0.16)",
              }}
            >
              No
            </button>
          </div>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Choose Yes or No to continue.
          </div>
        </div>
      </div>
    );
  }

  const inputType = question.type === "number" ? "number" : question.type === "date" ? "date" : "text";

  return (
    <div style={{ marginBottom: 16 }}>
      {label}
      {question.helpText ? (
        <div className="muted" style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.5 }}>
          {question.helpText}
        </div>
      ) : null}
      <input
        className="input"
        type={inputType}
        style={sharedInputStyle}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={(e) => onChange(question.type === "number" ? e.target.value : e.target.value)}
        spellCheck={question.type === "text"}
        autoCorrect={question.type === "text" ? "on" : undefined}
        autoCapitalize={question.type === "text" ? "sentences" : undefined}
      />
    </div>
  );
}
