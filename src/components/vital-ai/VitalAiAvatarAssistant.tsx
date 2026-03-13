import { useMemo, useState } from "react";
import logo from "../../assets/vitality-logo.png";

function guidanceForStep(stepKey: string | null | undefined, isComplete?: boolean) {
  if (isComplete) {
    return "Your intake is complete. The Vitality team can now review your responses, uploads, and next steps.";
  }

  if (!stepKey || stepKey === "contact") {
    return "I will guide you through the intake one step at a time. Start with your basic contact information so we can save your progress correctly.";
  }

  if (stepKey.includes("upload")) {
    return "Upload clear, readable files here. For wound care, use a bright, focused image so the provider can review the wound before the visit.";
  }

  if (stepKey.includes("wound")) {
    return "Share as much detail as you can about the wound, including duration, pain, drainage, and any infection concerns.";
  }

  if (stepKey === "consent") {
    return "Review your answers carefully before you confirm consent. Once submitted, your intake moves into staff and provider review.";
  }

  return "Answer the questions in as much detail as you can. Your progress is saved automatically while you move through the intake.";
}

export default function VitalAiAvatarAssistant({
  stepKey,
  title = "Vital AI Assistant",
  isComplete,
}: {
  stepKey?: string | null;
  title?: string;
  isComplete?: boolean;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const guidance = useMemo(() => guidanceForStep(stepKey, isComplete), [stepKey, isComplete]);

  return (
    <div
      className="card card-pad"
      style={{
        background: "linear-gradient(135deg, rgba(200,182,255,0.18), rgba(139,124,255,0.08))",
        border: "1px solid rgba(184,164,255,0.24)",
      }}
    >
      <div className="row" style={{ gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            flex: "0 0 120px",
            width: 120,
          }}
        >
          {useFallback ? (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 22,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <img
                src={logo}
                alt="Vitality Institute"
                style={{ width: 72, height: 72, objectFit: "contain" }}
              />
            </div>
          ) : (
            <img
              src="/vital-ai-avatar.png"
              alt="Vital AI assistant"
              onError={() => setUseFallback(true)}
              style={{
                width: 120,
                height: 120,
                objectFit: "cover",
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 16px 34px rgba(139,124,255,0.22)",
                display: "block",
              }}
            />
          )}
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <div className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.82)" }}>
            Intake Guidance
          </div>
          <div style={{ fontWeight: 800, color: "#F8FAFC", fontSize: 18, marginTop: 4 }}>{title}</div>
          <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: "rgba(226,232,240,0.84)" }}>
            {guidance}
          </div>
        </div>
      </div>
    </div>
  );
}
