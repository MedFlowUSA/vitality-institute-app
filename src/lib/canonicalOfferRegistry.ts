export type CanonicalLeadType = "wound" | "glp1" | "peptides" | "hormone" | "general";
export type CanonicalGuidedIntakePathway = "wound-care" | "glp1" | "peptides" | "wellness";
export type CanonicalPublicVitalAiPathway = "wound_care" | "glp1_weight_loss" | "general_consult";
export type CanonicalIntakeOnlyPathway = "glp1" | "peptides" | "wellness";
export type CanonicalCtaBehavior = "request_visit" | "start_vital_ai";
export type CanonicalServiceTypeKey =
  | "wound_care"
  | "glp1"
  | "hrt"
  | "trt"
  | "peptides"
  | "injectables"
  | "iv_therapy"
  | "general";

export type CanonicalOfferDefinition = {
  id: string;
  slug: string;
  title: string;
  publicLabel: string;
  category: string;
  bookingFirst: boolean;
  intakeFirst: boolean;
  consultRequired: boolean;
  canonicalPathway: CanonicalGuidedIntakePathway | null;
  publicVitalAiPathway: CanonicalPublicVitalAiPathway;
  intakeOnlyPathway: CanonicalIntakeOnlyPathway | null;
  leadType: CanonicalLeadType;
  defaultPrimaryCtaLabel: string;
  defaultPrimaryBehavior: CanonicalCtaBehavior;
  defaultSecondaryCta?: {
    label: string;
    behavior: CanonicalCtaBehavior;
  };
  aliases: string[];
};

type ResolvableOfferLike = {
  slug?: string | null;
  title?: string | null;
  name?: string | null;
  category?: string | null;
  service_group?: string | null;
  visit_type?: string | null;
};

const CANONICAL_OFFERS: CanonicalOfferDefinition[] = [
  {
    id: "wound-care",
    slug: "wound-care",
    title: "Wound Care",
    publicLabel: "Wound Care",
    category: "Wound Care",
    bookingFirst: false,
    intakeFirst: true,
    consultRequired: true,
    canonicalPathway: "wound-care",
    publicVitalAiPathway: "wound_care",
    intakeOnlyPathway: null,
    leadType: "wound",
    defaultPrimaryCtaLabel: "Start Wound Review",
    defaultPrimaryBehavior: "start_vital_ai",
    defaultSecondaryCta: {
      label: "Request Visit",
      behavior: "request_visit",
    },
    aliases: ["wound", "wound care", "ulcer", "slow healing", "drainage"],
  },
  {
    id: "glp1",
    slug: "glp1",
    title: "GLP-1 Weight Optimization",
    publicLabel: "GLP-1 / Weight Optimization",
    category: "Medical Weight Care",
    bookingFirst: false,
    intakeFirst: true,
    consultRequired: false,
    canonicalPathway: "glp1",
    publicVitalAiPathway: "glp1_weight_loss",
    intakeOnlyPathway: "glp1",
    leadType: "glp1",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["glp1", "glp-1", "weight optimization", "weight loss", "semaglutide", "tirzepatide"],
  },
  {
    id: "peptides",
    slug: "peptides",
    title: "Peptide Therapy",
    publicLabel: "Peptide Therapy",
    category: "Peptide Therapy",
    bookingFirst: false,
    intakeFirst: true,
    consultRequired: true,
    canonicalPathway: "peptides",
    publicVitalAiPathway: "general_consult",
    intakeOnlyPathway: "peptides",
    leadType: "peptides",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["peptide", "peptides", "bpc-157", "ipamorelin", "cjc-1295", "metabolic support stack"],
  },
  {
    id: "hormone",
    slug: "hormone",
    title: "Hormone Optimization",
    publicLabel: "Hormone Optimization",
    category: "Hormone Health",
    bookingFirst: false,
    intakeFirst: true,
    consultRequired: true,
    canonicalPathway: "wellness",
    publicVitalAiPathway: "general_consult",
    intakeOnlyPathway: "wellness",
    leadType: "hormone",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["hormone", "hormone optimization", "hrt", "menopause", "pellet therapy", "women's hormone", "womens hormone"],
  },
  {
    id: "trt",
    slug: "trt",
    title: "Testosterone Optimization",
    publicLabel: "Testosterone Optimization",
    category: "Hormone Health",
    bookingFirst: false,
    intakeFirst: true,
    consultRequired: true,
    canonicalPathway: "wellness",
    publicVitalAiPathway: "general_consult",
    intakeOnlyPathway: "wellness",
    leadType: "hormone",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["trt", "testosterone", "testosterone optimization", "testosterone therapy"],
  },
  {
    id: "injectables",
    slug: "injectables",
    title: "Injectables",
    publicLabel: "Injectables",
    category: "Aesthetic Care",
    bookingFirst: true,
    intakeFirst: false,
    consultRequired: false,
    canonicalPathway: null,
    publicVitalAiPathway: "general_consult",
    intakeOnlyPathway: null,
    leadType: "general",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["injectable", "injectables", "neuromodulator"],
  },
  {
    id: "iv-therapy",
    slug: "iv-therapy",
    title: "IV / Advanced Therapies",
    publicLabel: "IV / Advanced Therapies",
    category: "Advanced Wellness",
    bookingFirst: true,
    intakeFirst: false,
    consultRequired: false,
    canonicalPathway: null,
    publicVitalAiPathway: "general_consult",
    intakeOnlyPathway: null,
    leadType: "general",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["iv", "iv drip", "nad", "nad+", "infusion", "advanced therapies"],
  },
  {
    id: "general",
    slug: "general",
    title: "General Consultation",
    publicLabel: "General Consultation",
    category: "General Care",
    bookingFirst: true,
    intakeFirst: false,
    consultRequired: false,
    canonicalPathway: null,
    publicVitalAiPathway: "general_consult",
    intakeOnlyPathway: null,
    leadType: "general",
    defaultPrimaryCtaLabel: "Request Visit",
    defaultPrimaryBehavior: "request_visit",
    defaultSecondaryCta: {
      label: "Start with Vital AI",
      behavior: "start_vital_ai",
    },
    aliases: ["consult", "consultation", "general", "wellness", "vitality"],
  },
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreAliasMatch(definition: CanonicalOfferDefinition, source: string) {
  const normalizedSource = normalizeText(source);
  if (!normalizedSource) return 0;

  return definition.aliases.reduce((best, alias) => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return best;
    if (normalizedSource === normalizedAlias) return Math.max(best, 140);
    if (normalizedSource.includes(normalizedAlias)) return Math.max(best, 108 + normalizedAlias.split(" ").length);
    if (normalizedAlias.includes(normalizedSource) && normalizedSource.length >= 6) return Math.max(best, 96);

    const aliasTokens = normalizedAlias.split(" ").filter(Boolean);
    const sourceTokens = new Set(normalizedSource.split(" ").filter(Boolean));
    const overlap = aliasTokens.filter((token) => sourceTokens.has(token)).length;
    if (!overlap) return best;
    const ratio = overlap / aliasTokens.length;
    if (ratio === 1) return Math.max(best, 92 + overlap);
    if (ratio >= 0.66) return Math.max(best, 76 + overlap);
    return best;
  }, 0);
}

export function getCanonicalOfferDefinitions() {
  return CANONICAL_OFFERS;
}

export function getCanonicalOfferById(id: string | null | undefined) {
  if (!id) return null;
  return CANONICAL_OFFERS.find((offer) => offer.id === id) ?? null;
}

export function getCanonicalOfferByLeadType(leadType: CanonicalLeadType) {
  if (leadType === "wound") return getCanonicalOfferById("wound-care");
  if (leadType === "glp1") return getCanonicalOfferById("glp1");
  if (leadType === "peptides") return getCanonicalOfferById("peptides");
  if (leadType === "hormone") return getCanonicalOfferById("hormone");
  return getCanonicalOfferById("general");
}

export function getCanonicalServiceTypeKey(input: ResolvableOfferLike): CanonicalServiceTypeKey {
  const resolved = resolveCanonicalOffer(input);

  switch (resolved?.id) {
    case "wound-care":
      return "wound_care";
    case "glp1":
      return "glp1";
    case "hormone":
      return "hrt";
    case "trt":
      return "trt";
    case "peptides":
      return "peptides";
    case "injectables":
      return "injectables";
    case "iv-therapy":
      return "iv_therapy";
    default:
      return "general";
  }
}

export function getCanonicalPatientIntakeServiceType(input: ResolvableOfferLike) {
  const key = getCanonicalServiceTypeKey(input);

  if (key === "wound_care") return "wound_care";
  if (key === "glp1") return "glp1";
  if (key === "hrt") return "hrt";
  if (key === "trt") return "trt";
  if (key === "peptides") return "peptides";

  return "general";
}

export function resolveCanonicalOffer(input: ResolvableOfferLike) {
  const sources = [
    input.slug,
    input.title,
    input.name,
    input.category,
    input.service_group,
    input.visit_type,
    [input.title, input.category, input.slug].filter(Boolean).join(" "),
    [input.name, input.category, input.service_group, input.visit_type].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];

  let best: CanonicalOfferDefinition | null = null;
  let bestScore = 0;

  for (const definition of CANONICAL_OFFERS) {
    const score = sources.reduce((max, source) => Math.max(max, scoreAliasMatch(definition, source)), 0);
    if (score > bestScore) {
      best = definition;
      bestScore = score;
    }
  }

  return bestScore >= 60 ? best : getCanonicalOfferById("general");
}

export function getCanonicalPublicVitalAiPath(input: ResolvableOfferLike) {
  const definition = resolveCanonicalOffer(input);
  return `/vital-ai?pathway=${definition?.publicVitalAiPathway ?? "general_consult"}`;
}

export function getCanonicalPublicPrimaryCta(input: ResolvableOfferLike) {
  const definition = resolveCanonicalOffer(input);
  if (!definition) {
    return {
      label: "Request Visit",
      to: `/book?interest=${encodeURIComponent(input.slug ?? "")}`,
    };
  }

  if (definition.defaultPrimaryBehavior === "start_vital_ai") {
    return {
      label: definition.defaultPrimaryCtaLabel,
      to: getCanonicalPublicVitalAiPath(input),
    };
  }

  return {
    label: definition.defaultPrimaryCtaLabel,
    to: `/book?interest=${encodeURIComponent(input.slug ?? "")}`,
  };
}
