import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import logo from "../../assets/vitality-logo.png";
import type { ResponseMap } from "../../lib/vitalAi/types";

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join(", ").trim();
  return "";
}

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function pathwayTone(pathwaySlug: string | null | undefined) {
  if (!pathwaySlug) return "general";
  if (includesToken(pathwaySlug, "wound")) return "wound";
  if (includesToken(pathwaySlug, "consult")) return "consult";
  return "general";
}

function detailFromAnswers(stepKey: string | null | undefined, answers?: ResponseMap) {
  if (!answers) return "";

  const painValue = asText(answers.pain_score ?? answers.wound_pain_score ?? answers.painLevel);
  const durationValue = asText(answers.wound_duration ?? answers.duration ?? answers.wound_duration_weeks);
  const visitReason = asText(answers.reason_for_visit ?? answers.visit_reason ?? answers.primary_concern);

  if (stepKey?.includes("wound")) {
    if (painValue) return ` I will keep track of the pain level you reported${painValue ? ` (${painValue})` : ""} as we move through this.`;
    if (durationValue) return ` I will use the wound duration you share to help route your case appropriately.`;
  }

  if (stepKey?.includes("review") || stepKey === "consent") {
    if (visitReason) return ` I have your main concern noted as ${visitReason}.`;
    if (durationValue) return ` I have your wound timeline noted so you can confirm it before submitting.`;
  }

  if (stepKey?.includes("upload")) {
    if (visitReason) return ` Upload anything that helps document ${visitReason}.`;
    if (durationValue) return ` If you have photos from earlier in the wound timeline, include them here.`;
  }

  return "";
}

function guidanceForStep(
  stepKey: string | null | undefined,
  isComplete?: boolean,
  pathwaySlug?: string | null,
  answers?: ResponseMap
) {
  const tone = pathwayTone(pathwaySlug);

  if (isComplete) {
    return "Your intake is complete. The Vitality team can now review your responses, uploads, and next steps.";
  }

  if (!stepKey || stepKey === "contact") {
    if (tone === "consult") {
      return "Hi, I'm Vital AI - I'll guide you through a few questions so our care team can prepare for your visit.";
    }
    if (tone === "wound") {
      return "Hi, I'm Vital AI - I'll guide you through a few questions about your wound so we can prepare the right review path for your care team.";
    }
    return "Hi, I'm Vital AI - I'll guide you through a few questions so our care team can prepare for your visit.";
  }

  if (stepKey.includes("upload")) {
    const base =
      tone === "wound"
        ? "If you have wound photos or records, upload them here so your provider can review them before the visit."
        : "If you have photos or records, upload them here so your provider can review them before the visit.";
    return `${base}${detailFromAnswers(stepKey, answers)}`;
  }

  if (stepKey.includes("wound")) {
    return `Let's gather a few details about your wound so we can route your case appropriately.${detailFromAnswers(stepKey, answers)}`;
  }

  if (stepKey === "consent" || stepKey.includes("review")) {
    return `You're almost done. Please review your answers before submitting.${detailFromAnswers(stepKey, answers)}`;
  }

  if (stepKey.includes("history") || stepKey.includes("medical")) {
    return "I am collecting the clinical background your care team will need so they can review your intake efficiently.";
  }

  if (stepKey.includes("symptom") || stepKey.includes("concern")) {
    return `Tell me a bit more about what is going on so I can help organize the right context for your care team.${detailFromAnswers(
      stepKey,
      answers
    )}`;
  }

  return `I will guide you step by step. Answer as much as you can, and I will keep your progress saved automatically.${detailFromAnswers(
    stepKey,
    answers
  )}`;
}

export default function VitalAiAvatarAssistant({
  stepKey,
  title = "Vital AI Assistant",
  isComplete,
  eyebrow = "Intake Guidance",
  guidanceOverride,
  pathwaySlug,
  answers,
  avatarSize = 120,
  avatarCircular = false,
  children,
}: {
  stepKey?: string | null;
  title?: string;
  isComplete?: boolean;
  eyebrow?: string;
  guidanceOverride?: string;
  pathwaySlug?: string | null;
  answers?: ResponseMap;
  avatarSize?: number;
  avatarCircular?: boolean;
  children?: ReactNode;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const guidance = useMemo(
    () => guidanceOverride || guidanceForStep(stepKey, isComplete, pathwaySlug, answers),
    [answers, guidanceOverride, isComplete, pathwaySlug, stepKey]
  );
  const [visibleGuidance, setVisibleGuidance] = useState(guidance);
  const avatarRadius = avatarCircular ? "999px" : 22;

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisibleGuidance(guidance);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setVisibleGuidance(guidance);
      return;
    }

    setVisibleGuidance("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 2;
      setVisibleGuidance(guidance.slice(0, index));
      if (index >= guidance.length) window.clearInterval(timer);
    }, 18);

    return () => window.clearInterval(timer);
  }, [guidance]);

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
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: "#3E355C", minHeight: 44 }}>
            {visibleGuidance}
            {visibleGuidance.length < guidance.length ? (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 8,
                  marginLeft: 2,
                  color: "#7C3AED",
                  animation: "vital-ai-caret 1s steps(1) infinite",
                }}
              >
                |
              </span>
            ) : null}
          </div>
          <style>{`@keyframes vital-ai-caret { 50% { opacity: 0; } }`}</style>
          {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
