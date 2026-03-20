import type { CSSProperties } from "react";

export const guidedPanelStyle: CSSProperties = {
  background: "rgba(8,15,28,0.98)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
};

export const guidedPanelSoftStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

export const guidedMutedStyle: CSSProperties = {
  color: "rgba(226,232,240,0.82)",
};

export const guidedHelperStyle: CSSProperties = {
  color: "rgba(226,232,240,0.68)",
};

export const guidedPrimaryButtonStyle: CSSProperties = {
  background: "linear-gradient(135deg, #C8B6FF, #8B7CFF)",
  color: "#140F24",
  border: "1px solid rgba(184,164,255,0.42)",
  boxShadow: "0 14px 30px rgba(139,124,255,0.22)",
  fontWeight: 900,
};

export const guidedGhostButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#F8FAFC",
};

export const guidedChipStyle: CSSProperties = {
  background: "rgba(200,182,255,0.18)",
  border: "1px solid rgba(200,182,255,0.34)",
  color: "#F8FAFC",
};

export const guidedQuestionCardStyle: CSSProperties = {
  marginBottom: 14,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
};

export function pathwayAccent(slug: string) {
  const key = slug.toLowerCase();

  if (key.includes("wound")) {
    return {
      eyebrow: "Priority Pathway",
      helper: "Best for wound concerns, photos, triage, and provider review.",
      tone: "rgba(34,197,94,0.22)",
    };
  }

  if (key.includes("glp")) {
    return {
      eyebrow: "Metabolic Pathway",
      helper: "Structured intake for weight optimization and GLP-1 review.",
      tone: "rgba(250,204,21,0.22)",
    };
  }

  if (key.includes("peptide")) {
    return {
      eyebrow: "Wellness Pathway",
      helper: "Guided intake for peptide-related goals and prior use history.",
      tone: "rgba(56,189,248,0.20)",
    };
  }

  if (key.includes("general") || key.includes("consult")) {
    return {
      eyebrow: "Guided Start",
      helper: "A broad starting point when you want help choosing the right next step.",
      tone: "rgba(168,85,247,0.22)",
    };
  }

  return {
    eyebrow: "Intake Pathway",
    helper: "Start this pathway for a guided intake and review-ready summary.",
    tone: "rgba(148,163,184,0.20)",
  };
}
