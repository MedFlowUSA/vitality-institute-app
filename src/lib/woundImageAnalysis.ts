export type WoundImageAnalysisInput = {
  hasCurrentImage: boolean;
  hasPriorImage: boolean;
  currentAreaCm2: number | null;
  priorAreaCm2: number | null;
  exudate?: string | null;
  infectionSigns?: string | null;
  painScore?: number | null;
};

export type WoundImageAnalysisResult = {
  quality: "Usable" | "Poor" | "Unclear";
  comparison: "Improved" | "Similar" | "Possibly Worse" | "Baseline Only" | "Unclear";
  visual_notes: string;
  documentation_prompt: string;
  escalation_prompt: string;
};

export function analyzeWoundImage(input: WoundImageAnalysisInput): WoundImageAnalysisResult {
  const {
    hasCurrentImage,
    hasPriorImage,
    currentAreaCm2,
    priorAreaCm2,
    exudate,
    infectionSigns,
    painScore,
  } = input;

  if (!hasCurrentImage) {
    return {
      quality: "Poor",
      comparison: "Unclear",
      visual_notes: "No current wound image is linked for review.",
      documentation_prompt:
        "Upload or link a current wound photo and confirm wound measurements, drainage, and tissue status.",
      escalation_prompt:
        "Image-based comparison is not possible until a current wound photo is available.",
    };
  }

  const quality: WoundImageAnalysisResult["quality"] = "Usable";
  let comparison: WoundImageAnalysisResult["comparison"] = "Unclear";
  const notes: string[] = [];
  const docPrompts: string[] = [];
  const escalation: string[] = [];

  if (!hasPriorImage) {
    comparison = "Baseline Only";
    notes.push("Current image is available, but no prior wound image is linked for visual comparison.");
  } else if (currentAreaCm2 != null && priorAreaCm2 != null && priorAreaCm2 > 0) {
    const pct = ((priorAreaCm2 - currentAreaCm2) / priorAreaCm2) * 100;

    if (pct >= 20) {
      comparison = "Improved";
      notes.push(`Structured measurements suggest meaningful improvement with approximately ${pct.toFixed(1)}% reduction in wound area.`);
    } else if (pct >= 5) {
      comparison = "Similar";
      notes.push(`Structured measurements suggest mild improvement with approximately ${pct.toFixed(1)}% reduction in wound area.`);
    } else if (pct > -5) {
      comparison = "Similar";
      notes.push(`Structured measurements suggest little interval size change (${pct.toFixed(1)}%).`);
    } else {
      comparison = "Possibly Worse";
      notes.push(`Structured measurements suggest interval worsening with approximately ${Math.abs(pct).toFixed(1)}% increase in wound area.`);
    }
  } else {
    comparison = "Unclear";
    notes.push("Image comparison is available, but structured measurement comparison is incomplete.");
  }

  if (exudate) {
    if (exudate === "high" || exudate === "heavy") {
      notes.push(`Drainage burden is documented as ${exudate}.`);
      escalation.push("Review wound drainage burden and confirm whether dressing strategy or treatment plan should be adjusted.");
    } else {
      notes.push(`Exudate is documented as ${exudate}.`);
    }
  }

  if (infectionSigns && infectionSigns.trim()) {
    notes.push(`Possible infection-related findings are documented: ${infectionSigns}.`);
    escalation.push("Confirm infection status clinically and consider whether escalation or antimicrobial management is appropriate.");
  }

  if ((painScore ?? 0) >= 7) {
    notes.push(`Patient-reported pain remains elevated at ${painScore}/10.`);
    escalation.push("Reassess wound burden, infection risk, and pain-management needs.");
  }

  docPrompts.push("Confirm current wound dimensions and compare to prior visit measurements.");
  docPrompts.push("Document visible tissue characteristics, exudate level, and wound edge appearance.");
  if (hasPriorImage) {
    docPrompts.push("Confirm whether the current image is visually consistent with measured healing trend.");
  }

  if (escalation.length === 0) {
    escalation.push("No urgent image-supported escalation prompt detected from current structured data.");
  }

  return {
    quality,
    comparison,
    visual_notes: notes.join(" "),
    documentation_prompt: docPrompts.join(" "),
    escalation_prompt: escalation.join(" "),
  };
}
