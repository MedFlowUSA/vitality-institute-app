import { useMemo, useState } from "react";
import type { ReactNode } from "react";
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
  eyebrow = "Intake Guidance",
  guidanceOverride,
  avatarSize = 120,
  avatarCircular = false,
  children,
}: {
  stepKey?: string | null;
  title?: string;
  isComplete?: boolean;
  eyebrow?: string;
  guidanceOverride?: string;
  avatarSize?: number;
  avatarCircular?: boolean;
  children?: ReactNode;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const guidance = useMemo(
    () => guidanceOverride || guidanceForStep(stepKey, isComplete),
    [guidanceOverride, stepKey, isComplete]
  );
  const avatarRadius = avatarCircular ? "999px" : 22;

  return (
    <div
      className="card card-pad"
      style={{
        background: "linear-gradient(135deg, rgba(244,240,255,0.98), rgba(233,224,255,0.96))",
        border: "1px solid rgba(139,124,255,0.24)",
        boxShadow: "0 16px 36px rgba(31,41,55,0.14)",
      }}
    >
      <div className="row" style={{ gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            flex: `0 0 ${avatarSize}px`,
            width: avatarSize,
          }}
        >
          {useFallback ? (
            <div
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarRadius,
                overflow: "hidden",
                border: "1px solid rgba(139,124,255,0.18)",
                background: "rgba(255,255,255,0.92)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <img
                src={logo}
                alt="Vitality Institute"
                style={{
                  width: avatarCircular ? avatarSize * 0.58 : 72,
                  height: avatarCircular ? avatarSize * 0.58 : 72,
                  objectFit: "contain",
                }}
              />
            </div>
          ) : (
            <img
              src="/vital-ai-avatar.png"
              alt="Vital AI assistant"
              onError={() => setUseFallback(true)}
              style={{
                width: avatarSize,
                height: avatarSize,
                objectFit: "cover",
                borderRadius: avatarRadius,
                border: "1px solid rgba(139,124,255,0.22)",
                boxShadow: "0 16px 34px rgba(139,124,255,0.18)",
                display: "block",
              }}
            />
          )}
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <div style={{ fontSize: 12, color: "#5B4E86", fontWeight: 800 }}>{eyebrow}</div>
          <div style={{ fontWeight: 900, color: "#241B3D", fontSize: 18, marginTop: 4 }}>{title}</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: "#3E355C" }}>
            {guidance}
          </div>
          {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
