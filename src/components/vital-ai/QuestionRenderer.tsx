import { useEffect, useRef, useState } from "react";
import type { IntakeQuestion } from "../../lib/vitalAi/types";

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
    .SpeechRecognition
    ?? (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
  return ctor ?? null;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const speechCtor = getSpeechRecognitionCtor();
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

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
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.07)",
    outline: "none",
    fontSize: 14,
    color: "#F8FAFC",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.16)",
  };

  const startDictation = () => {
    if (!speechCtor || question.type !== "textarea") return;

    setDictationError(null);

    const recognition = new speechCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (!transcript) return;

      const base = typeof value === "string" && value.trim() ? `${value.toString().trim()} ` : "";
      onChange(`${base}${transcript}`.trim());
    };

    recognition.onerror = (event) => {
      setDictationError(event.error ? `Dictation error: ${event.error}` : "Dictation is unavailable on this device.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopDictation = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  if (question.type === "textarea") {
    return (
      <div style={{ marginBottom: 16 }}>
        {label}
        <div style={{ position: "relative" }}>
          <textarea
            className="input"
            style={{ ...sharedInputStyle, minHeight: 110, paddingRight: speechCtor ? 120 : 14 }}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {speechCtor ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={isListening ? stopDictation : startDictation}
              style={{
                position: "absolute",
                right: 10,
                top: 10,
                background: isListening ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.10)",
                border: isListening ? "1px solid rgba(239,68,68,0.34)" : "1px solid rgba(255,255,255,0.16)",
                color: "#F8FAFC",
                minWidth: 96,
              }}
            >
              {isListening ? "Stop Mic" : "Use Mic"}
            </button>
          ) : null}
        </div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12, color: "rgba(226,232,240,0.78)" }}>
          {speechCtor ? "You can type or use your microphone for longer answers." : "Type your answer."}
        </div>
        {dictationError ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "#FCA5A5" }}>{dictationError}</div>
        ) : null}
      </div>
    );
  }

  if (question.type === "select") {
    return (
      <div style={{ marginBottom: 16 }}>
        {label}
        <select className="input" style={sharedInputStyle} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select...</option>
          {(question.options ?? []).map((option) => (
            <option key={option} value={option}>
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
