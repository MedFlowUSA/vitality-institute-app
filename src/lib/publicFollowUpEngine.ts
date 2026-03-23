import { resolveCanonicalOffer } from "./canonicalOfferRegistry";
import type {
  ConversionLeadMetadata,
  ConversionPathway,
  ConversionUrgencyLevel,
  ConversionValueLevel,
} from "./vitalAi/conversionEngine";

export type FollowUpMessage = {
  patientMessage: string;
  supportingLine: string;
  staffNote: string;
};

export function buildFollowUpMessage(
  leadType: ConversionPathway,
  urgencyLevel: ConversionUrgencyLevel
): FollowUpMessage {
  const patientMessage =
    urgencyLevel === "high"
      ? "We've received your request and will review it as soon as possible."
      : "We received your request and our team will review it shortly.";

  if (leadType === "wound") {
    return {
      patientMessage,
      supportingLine:
        urgencyLevel === "high"
          ? "A team member may reach out sooner if your wound concern needs earlier follow-up."
          : "Wound-related requests may need earlier outreach, image review, or provider review before the next visit step is confirmed.",
      staffNote:
        urgencyLevel === "high"
          ? "Prioritize wound follow-up, review urgency cues early, and consider faster coordinator outreach."
          : "Keep wound context visible and review whether photos, coordinator outreach, or provider review should happen next.",
    };
  }

  if (leadType === "glp1") {
    return {
      patientMessage,
      supportingLine:
        "If this path still feels right, we can help you keep moving toward intake, eligibility review, and scheduling.",
      staffNote:
        "High-conversion GLP-1 interest. Guide toward intake completion or consultation scheduling after review.",
    };
  }

  if (leadType === "hormone") {
    return {
      patientMessage,
      supportingLine:
        "Hormone-focused requests usually move into consultation first so a provider can review symptoms, history, and any needed labs.",
      staffNote:
        "Consultation-first follow-up recommended. Reinforce provider review and possible lab review before treatment planning.",
    };
  }

  if (leadType === "peptides") {
    return {
      patientMessage,
      supportingLine:
        "If you'd like to keep moving, our team can help route you into the right consultation or next intake step.",
      staffNote:
        "Peptide-interest lead. Encourage the clearest next step toward consultation or guided intake completion.",
    };
  }

  return {
    patientMessage,
    supportingLine: "We'll guide you to the right next step after review.",
    staffNote: "Lower-priority general inquiry. Use coordinator follow-up to clarify the best next step.",
  };
}

function urgencyRank(level: ConversionUrgencyLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function valueRank(level: ConversionValueLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

export function compareLeadPriority(a: {
  urgencyLevel: ConversionUrgencyLevel;
  valueLevel: ConversionValueLevel;
  createdAt?: string | null;
}, b: {
  urgencyLevel: ConversionUrgencyLevel;
  valueLevel: ConversionValueLevel;
  createdAt?: string | null;
}) {
  return (
    urgencyRank(b.urgencyLevel) - urgencyRank(a.urgencyLevel) ||
    valueRank(b.valueLevel) - valueRank(a.valueLevel) ||
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );
}

export function getUrgencyIndicatorStyle(level: ConversionUrgencyLevel) {
  if (level === "high") {
    return {
      background: "rgba(239,68,68,0.14)",
      border: "1px solid rgba(239,68,68,0.28)",
      color: "#991B1B",
    };
  }

  if (level === "medium") {
    return {
      background: "rgba(245,158,11,0.14)",
      border: "1px solid rgba(245,158,11,0.28)",
      color: "#9A3412",
    };
  }

  return {
    background: "rgba(124,58,237,0.12)",
    border: "1px solid rgba(124,58,237,0.2)",
    color: "#5B21B6",
  };
}

export function getValueIndicatorStyle(level: ConversionValueLevel) {
  if (level === "high") {
    return {
      background: "rgba(250,204,21,0.16)",
      border: "1px solid rgba(250,204,21,0.32)",
      color: "#854D0E",
    };
  }

  if (level === "medium") {
    return {
      background: "rgba(56,189,248,0.12)",
      border: "1px solid rgba(56,189,248,0.22)",
      color: "#0F4C81",
    };
  }

  return {
    background: "rgba(148,163,184,0.12)",
    border: "1px solid rgba(148,163,184,0.2)",
    color: "#475569",
  };
}

function hasUrgentWoundSignals(notes?: string | null) {
  const normalized = (notes ?? "").toLowerCase();
  return ["infection", "drainage", "severe pain", "worsening", "redness", "swelling"].some((token) =>
    normalized.includes(token)
  );
}

export function resolveBookingRequestLead(args: {
  serviceName?: string | null;
  notes?: string | null;
}): ConversionLeadMetadata {
  const offer = resolveCanonicalOffer({
    name: args.serviceName ?? "",
    category: null,
    service_group: null,
  });

  if (offer?.leadType === "wound") {
    const urgencyLevel = hasUrgentWoundSignals(args.notes) ? ("high" as ConversionUrgencyLevel) : ("medium" as ConversionUrgencyLevel);
    return {
      leadType: "wound" as ConversionPathway,
      urgencyLevel,
      valueLevel: "high" as ConversionValueLevel,
      leadScore: urgencyLevel === "high" ? 90 : 72,
      outcomeLabel: urgencyLevel === "high" ? "Prompt attention recommended" : "Provider review recommended",
    };
  }

  if (offer?.leadType === "glp1") {
    return {
      leadType: "glp1" as ConversionPathway,
      urgencyLevel: "low" as ConversionUrgencyLevel,
      valueLevel: "high" as ConversionValueLevel,
      leadScore: 82,
      outcomeLabel: "Recommended next step",
    };
  }

  if (offer?.leadType === "hormone") {
    return {
      leadType: "hormone" as ConversionPathway,
      urgencyLevel: "medium" as ConversionUrgencyLevel,
      valueLevel: "medium" as ConversionValueLevel,
      leadScore: 68,
      outcomeLabel: "Provider review recommended",
    };
  }

  if (offer?.leadType === "peptides") {
    return {
      leadType: "peptides" as ConversionPathway,
      urgencyLevel: "low" as ConversionUrgencyLevel,
      valueLevel: "medium" as ConversionValueLevel,
      leadScore: 56,
      outcomeLabel: "Recommended next step",
    };
  }

  return {
    leadType: "general" as ConversionPathway,
    urgencyLevel: "low" as ConversionUrgencyLevel,
    valueLevel: "low" as ConversionValueLevel,
    leadScore: 30,
    outcomeLabel: "Recommended next step",
  };
}
