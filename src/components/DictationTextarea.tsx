import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

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

export default function DictationTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  style,
  helpText = "You can type or use your microphone for longer answers.",
  unsupportedText = "Microphone dictation is not available in this browser. You can keep typing.",
  buttonClassName = "btn btn-ghost",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  helpText?: string;
  unsupportedText?: string;
  buttonClassName?: string;
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

  const startDictation = () => {
    if (!speechCtor || disabled) return;

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

      const base = value.trim() ? `${value.trim()} ` : "";
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

  return (
    <div>
      <div style={{ position: "relative" }}>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 110, paddingRight: speechCtor && !disabled ? 120 : undefined, ...style }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {speechCtor && !disabled ? (
          <button
            type="button"
            className={buttonClassName}
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
        {speechCtor ? helpText : unsupportedText}
      </div>
      {dictationError ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#FCA5A5" }}>{dictationError}</div>
      ) : null}
    </div>
  );
}
