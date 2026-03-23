export type PublicOffering = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  price: string;
  duration?: string;
  overview: string;
  idealFor: string;
  serviceDetails: string;
  whatToExpect: string;
  faqNotes: string[];
  bookableDirectly?: boolean;
};

export const PUBLIC_OFFERINGS: PublicOffering[] = [
  {
    slug: "glp1-weight-optimization-consultation",
    title: "GLP-1 Weight Optimization Consultation",
    category: "Medical Consultations",
    summary: "A focused consultation to review goals, history, and whether GLP-1 care is appropriate.",
    price: "$99",
    duration: "30-45 min",
    overview: "A structured consultation for patients exploring medically guided weight optimization.",
    idealFor: "Patients who want a clear starting point for GLP-1-based weight optimization or metabolic support.",
    serviceDetails: "Consultation pricing covers provider review of goals, health history, and treatment fit. Labs may be reviewed or ordered when clinically appropriate.",
    whatToExpect: "Expect a discussion of weight goals, prior attempts, metabolic history, and whether follow-up planning is appropriate.",
    faqNotes: [
      "Eligibility is determined by medical evaluation.",
      "Telehealth follow-up may be available for select patients.",
      "Monthly programs include physician oversight and treatment adjustments when appropriate.",
    ],
  },
  {
    slug: "testosterone-optimization-consultation",
    title: "Testosterone Optimization Consultation",
    category: "Hormone Optimization",
    summary: "A men’s hormone consultation focused on symptoms, goals, labs, and next-step planning.",
    price: "$149",
    duration: "30-45 min",
    overview: "A provider-led hormone consultation for men exploring testosterone optimization.",
    idealFor: "Men seeking evaluation for low energy, performance changes, body composition concerns, or hormonal symptoms.",
    serviceDetails: "Consultation may include lab review, symptom assessment, and a discussion of appropriate follow-up options.",
    whatToExpect: "Expect a focused hormone conversation, review of symptoms and available labs, and discussion of whether treatment planning is appropriate.",
    faqNotes: [
      "Labs may be reviewed or ordered when clinically appropriate.",
      "Treatment eligibility depends on medical evaluation and lab findings.",
      "Follow-up cadence varies by program and provider guidance.",
    ],
  },
  {
    slug: "womens-hormone-balance-consultation",
    title: "Women’s Hormone Balance Consultation",
    category: "Hormone Optimization",
    summary: "A consultation for women seeking support for hormonal symptoms, balance, and follow-up care.",
    price: "$149",
    duration: "30-45 min",
    overview: "A structured women’s hormone consultation designed around symptoms, goals, and individualized follow-up planning.",
    idealFor: "Women exploring hormone support, symptom review, or personalized care planning.",
    serviceDetails: "Consultation includes symptom review, history discussion, and lab-informed next-step planning where appropriate.",
    whatToExpect: "Expect a provider conversation around symptoms, goals, prior labs if available, and possible follow-up options.",
    faqNotes: [
      "Medical evaluation determines treatment fit.",
      "Some follow-ups may be completed through telehealth when appropriate.",
      "Programs vary based on physician oversight and individualized needs.",
    ],
  },
  {
    slug: "peptide-therapy-consultation",
    title: "Peptide Therapy Consultation",
    category: "Peptide Therapy",
    summary: "A consult to discuss goals, symptom focus, prior therapy, and whether peptide support is appropriate.",
    price: "$99",
    duration: "30 min",
    overview: "A starting point for peptide therapy discussions, grounded in provider review and patient goals.",
    idealFor: "Patients interested in recovery, metabolic support, performance, or provider-guided peptide planning.",
    serviceDetails: "Consultation includes goal review, symptom context, prior therapy history, and provider approval considerations.",
    whatToExpect: "Expect a clear conversation about goals, safety context, and which next steps make the most sense.",
    faqNotes: [
      "Provider approval is required before treatment planning.",
      "Not every patient is an appropriate fit.",
      "Treatment and follow-up vary by program.",
    ],
  },
  {
    slug: "botox-consultation",
    title: "Botox Consultation",
    category: "Botox",
    summary: "Aesthetic consultation to review treatment areas, goals, and same-day options when appropriate.",
    price: "Complimentary with same-day treatment",
    duration: "15-30 min",
    overview: "A quick but structured Botox consultation for patients considering targeted injectable treatment.",
    idealFor: "Patients exploring forehead, glabella, crow’s feet, or upper-face Botox planning.",
    serviceDetails: "The consultation clarifies treatment goals, areas of concern, and provider recommendations before same-day or future treatment.",
    whatToExpect: "Expect a brief aesthetic review, treatment discussion, and guidance on likely unit range and pricing.",
    faqNotes: [
      "Forehead pricing typically ranges from $300-$400.",
      "Glabella and crow’s feet often range from $220-$300.",
      "Full upper face commonly ranges from $500-$650.",
    ],
  },
  {
    slug: "glp1-essential",
    title: "GLP-1 Essential",
    category: "GLP-1 Weight Optimization",
    summary: "Entry GLP-1 program for structured weight optimization with ongoing oversight.",
    price: "$449/month",
    overview: "A monthly GLP-1 program designed for patients who need a guided starting point with physician oversight.",
    idealFor: "Patients starting a structured GLP-1 pathway and wanting a clear monthly plan.",
    serviceDetails: "Monthly plans may include physician oversight, follow-up, and treatment adjustments, varying by program.",
    whatToExpect: "Expect initial clinical review, a structured follow-up cadence, and adjustments based on progress and provider guidance.",
    faqNotes: [
      "Eligibility is determined by medical evaluation.",
      "Labs may be reviewed or ordered when clinically appropriate.",
      "Telehealth follow-up may be available for select services.",
    ],
  },
  {
    slug: "glp1-plus",
    title: "GLP-1 Plus",
    category: "GLP-1 Weight Optimization",
    summary: "Expanded GLP-1 program with additional follow-up intensity and optimization support.",
    price: "$529/month",
    overview: "A more robust GLP-1 program for patients seeking added structure and closer follow-up.",
    idealFor: "Patients who want more comprehensive monthly support as part of a GLP-1 pathway.",
    serviceDetails: "Program presentation is marketing-facing; exact treatment structure depends on evaluation and provider planning.",
    whatToExpect: "Expect the same medical review foundation as Essential, with more premium support positioning.",
    faqNotes: [
      "Monthly plans vary by clinical appropriateness.",
      "Medical review determines the right program level.",
    ],
  },
  {
    slug: "glp1-advanced",
    title: "GLP-1 Advanced",
    category: "GLP-1 Weight Optimization",
    summary: "A premium GLP-1 program tier with higher-touch support and physician oversight.",
    price: "$599/month",
    overview: "A premium monthly GLP-1 offering designed for patients seeking the highest support tier presented on the public site.",
    idealFor: "Patients interested in a more advanced support structure for medical weight optimization.",
    serviceDetails: "Exact treatment details depend on medical evaluation and follow-up planning.",
    whatToExpect: "Expect provider review, tailored follow-up, and a structured optimization path if appropriate.",
    faqNotes: [
      "Treatment eligibility is determined medically.",
      "Program details vary by evaluation and provider guidance.",
    ],
  },
  {
    slug: "trt-basic",
    title: "TRT Basic",
    category: "Hormone Optimization",
    summary: "Monthly testosterone optimization program positioned as an entry plan for men.",
    price: "$219/month",
    overview: "A foundational testosterone optimization program presented as a monthly plan on the public site.",
    idealFor: "Men who have completed evaluation and are appropriate for a structured TRT follow-up plan.",
    serviceDetails: "Monthly plans include physician oversight and follow-up cadence as clinically appropriate.",
    whatToExpect: "Expect ongoing review, lab-informed decisions, and adjustments over time.",
    faqNotes: [
      "Labs are reviewed or ordered when clinically appropriate.",
      "Treatment fit depends on evaluation and medical history.",
    ],
  },
  {
    slug: "trt-performance",
    title: "TRT Performance",
    category: "Hormone Optimization",
    summary: "Higher-tier men’s hormone program with a more premium support presentation.",
    price: "$299/month",
    overview: "A premium testosterone optimization plan positioned for patients seeking enhanced support.",
    idealFor: "Men wanting a more elevated hormone optimization program after provider evaluation.",
    serviceDetails: "Program detail is marketing-facing and still depends on clinical review and physician oversight.",
    whatToExpect: "Expect structured follow-up, lab review, and adjustments when medically appropriate.",
    faqNotes: [
      "Eligibility depends on medical evaluation.",
      "Follow-up schedule varies by patient needs.",
    ],
  },
  {
    slug: "hrt-balance-plan",
    title: "HRT Balance Plan",
    category: "Hormone Optimization",
    summary: "Women’s hormone replacement program positioned around balance and symptom support.",
    price: "$259/month",
    overview: "A women’s hormone program designed to support balance, symptoms, and ongoing provider review.",
    idealFor: "Women appropriate for a monthly hormone support pathway after clinical evaluation.",
    serviceDetails: "Monthly plans include physician oversight, follow-up, and treatment adjustments varying by program.",
    whatToExpect: "Expect ongoing review of symptoms, progress, and lab context when relevant.",
    faqNotes: [
      "Medical evaluation determines treatment eligibility.",
      "Telehealth may be available for select follow-ups.",
    ],
  },
  {
    slug: "pellet-therapy",
    title: "Pellet Therapy",
    category: "Hormone Optimization",
    summary: "Pellet therapy option presented as a procedure-based hormone support offering.",
    price: "$450-$600 per insertion",
    overview: "A procedure-based hormone support offering for patients determined to be an appropriate fit.",
    idealFor: "Patients exploring longer-acting hormone support options after medical review.",
    serviceDetails: "Final pricing depends on treatment specifics and provider planning.",
    whatToExpect: "Expect consultation and medical review before insertion planning.",
    faqNotes: [
      "Not every patient is an appropriate pellet candidate.",
      "Provider evaluation determines treatment fit and schedule.",
    ],
  },
  {
    slug: "vitality-core",
    title: "Vitality Core",
    category: "Vitality Bundles",
    summary: "Monthly bundle positioned around foundational wellness support.",
    price: "$549/month",
    overview: "A bundled Vitality offering for patients seeking a broader monthly wellness structure.",
    idealFor: "Patients who want a packaged entry point into ongoing wellness optimization.",
    serviceDetails: "Bundle presentation is marketing-facing; exact included services vary by provider planning and program setup.",
    whatToExpect: "Expect a guided monthly care path with physician oversight and follow-up structure.",
    faqNotes: [
      "Monthly bundle details vary by program design.",
      "Evaluation determines appropriate treatment mix.",
    ],
  },
  {
    slug: "vitality-performance-men",
    title: "Vitality Performance (Men)",
    category: "Vitality Bundles",
    summary: "A men’s-focused monthly bundle positioned around performance and optimization.",
    price: "$599/month",
    overview: "A bundled program for men seeking a more performance-oriented monthly structure.",
    idealFor: "Men who want a premium bundled plan after evaluation.",
    serviceDetails: "Public pricing reflects the current marketing presentation; program specifics depend on provider review.",
    whatToExpect: "Expect an integrated monthly plan with physician oversight and adjustment when appropriate.",
    faqNotes: [
      "Not every service in the bundle is appropriate for every patient.",
      "Plans vary based on provider evaluation.",
    ],
  },
  {
    slug: "vitality-balance-women",
    title: "Vitality Balance (Women)",
    category: "Vitality Bundles",
    summary: "A women’s-focused bundle positioned around balance, wellness, and ongoing support.",
    price: "$549/month",
    overview: "A structured monthly bundle for women seeking a broader optimization plan.",
    idealFor: "Women wanting a premium all-in-one care path after consultation.",
    serviceDetails: "Bundle positioning is designed for clarity on the public site; actual treatment mix depends on evaluation.",
    whatToExpect: "Expect guided follow-up and physician oversight across the plan.",
    faqNotes: [
      "Program details vary by patient needs and provider recommendations.",
    ],
  },
  {
    slug: "vitality-elite",
    title: "Vitality Elite",
    category: "Vitality Bundles",
    summary: "Top-tier bundle with the highest monthly price range shown on the public site.",
    price: "$799-$999/month",
    overview: "A premium bundle for patients seeking the highest-touch monthly Vitality experience.",
    idealFor: "Patients who want the most comprehensive public-facing package tier.",
    serviceDetails: "Exact scope depends on medical evaluation and the final care plan.",
    whatToExpect: "Expect premium follow-up positioning and broader monthly support structure where appropriate.",
    faqNotes: [
      "Final structure varies by evaluation and service fit.",
    ],
  },
  {
    slug: "bpc-157",
    title: "BPC-157",
    category: "Peptide Therapy",
    summary: "Peptide offering positioned around recovery and support.",
    price: "$249/month",
    overview: "A peptide therapy offering highlighted on the public site as a monthly option.",
    idealFor: "Patients discussing recovery-oriented peptide support with a provider.",
    serviceDetails: "Provider approval and clinical fit determine whether this option is appropriate.",
    whatToExpect: "Expect consultation first, then treatment planning if medically appropriate.",
    faqNotes: [
      "Peptide eligibility is determined by provider evaluation.",
    ],
  },
  {
    slug: "cjc-1295-ipamorelin",
    title: "CJC-1295 / Ipamorelin",
    category: "Peptide Therapy",
    summary: "Monthly peptide program marketed around recovery and performance support.",
    price: "$349/month",
    overview: "A peptide therapy offering for patients exploring structured performance or recovery support.",
    idealFor: "Patients discussing premium peptide support options with provider review.",
    serviceDetails: "Public-site presentation is pricing-forward; final fit depends on medical review.",
    whatToExpect: "Expect consultation, safety review, and follow-up planning if appropriate.",
    faqNotes: [
      "Treatment requires provider review and approval.",
    ],
  },
  {
    slug: "nad-infusion",
    title: "NAD+ Infusion",
    category: "Aesthetics & Advanced Therapies",
    summary: "Advanced infusion therapy presented as a session-based option.",
    price: "$349-$499/session",
    overview: "A session-based advanced therapy offering positioned around premium wellness support.",
    idealFor: "Patients interested in high-touch infusion-based support.",
    serviceDetails: "Session pricing varies by protocol and provider planning.",
    whatToExpect: "Expect visit timing, protocol details, and fit to be reviewed before scheduling is finalized.",
    faqNotes: [
      "Session length and pricing vary by treatment plan.",
    ],
  },
  {
    slug: "metabolic-support-stack",
    title: "Metabolic Support Stack",
    category: "Peptide Therapy",
    summary: "A bundled metabolic peptide support offering.",
    price: "$399/month",
    overview: "A metabolic-focused peptide program presented as a monthly support stack.",
    idealFor: "Patients interested in a broader peptide-based metabolic support discussion.",
    serviceDetails: "Program availability and structure depend on provider review and clinical appropriateness.",
    whatToExpect: "Expect provider discussion first, with next-step planning after evaluation.",
    faqNotes: [
      "Treatment fit depends on medical evaluation.",
    ],
  },
  {
    slug: "botox-pricing",
    title: "Botox Pricing",
    category: "Botox",
    summary: "Botox pricing presented publicly by unit and common treatment area ranges.",
    price: "$12 per unit",
    overview: "Botox services are presented with unit pricing and common area ranges to help patients understand typical treatment cost.",
    idealFor: "Patients who want a quick pricing guide before booking a consultation or same-day treatment.",
    serviceDetails: "Forehead: $300-$400. Glabella: $220-$300. Crow’s Feet: $220-$300. Full Upper Face: $500-$650.",
    whatToExpect: "Expect your provider to discuss likely unit range and pricing based on your treatment goals.",
    faqNotes: [
      "Final pricing depends on the treatment plan and provider assessment.",
    ],
  },
  {
    slug: "body-composition-scan",
    title: "Body Composition Scan",
    category: "Add-Ons",
    summary: "A low-friction add-on for more objective progress tracking.",
    price: "$39",
    overview: "A simple add-on for patients who want a clearer baseline or progress marker.",
    idealFor: "Patients in weight, hormone, or wellness programs who want extra measurement support.",
    serviceDetails: "Presented as an add-on rather than a full standalone program.",
    whatToExpect: "Expect a quick adjunct service added around a broader care path.",
    faqNotes: [],
  },
  {
    slug: "expanded-lab-panel",
    title: "Expanded Lab Panel",
    category: "Add-Ons",
    summary: "An add-on lab package for broader clinical insight when appropriate.",
    price: "$179",
    overview: "An add-on intended to support deeper clinical review when a provider determines it is helpful.",
    idealFor: "Patients who may benefit from broader lab review depending on their program.",
    serviceDetails: "Labs may be reviewed or ordered when clinically appropriate.",
    whatToExpect: "Expect provider guidance on whether expanded lab work is necessary.",
    faqNotes: [],
  },
  {
    slug: "priority-scheduling-upgrade",
    title: "Priority Scheduling Upgrade",
    category: "Add-Ons",
    summary: "A convenience add-on for patients who want faster access to scheduling support.",
    price: "$19/month",
    overview: "A lightweight add-on positioned around convenience and access.",
    idealFor: "Patients who value faster scheduling support as part of an ongoing plan.",
    serviceDetails: "Availability and exact implementation may vary by workflow.",
    whatToExpect: "Expect a convenience-focused add-on rather than a treatment service.",
    faqNotes: [],
  },
];

export const PUBLIC_SERVICE_GROUPS = [
  "GLP-1 Weight Optimization",
  "Hormone Optimization",
  "Aesthetics & Advanced Therapies",
  "Peptide Therapy",
  "Botox",
  "Medical Consultations",
  "Vitality Bundles",
  "Add-Ons",
];

export function getPublicOfferingBySlug(slug: string | undefined) {
  if (!slug) return null;
  return PUBLIC_OFFERINGS.find((offering) => offering.slug === slug) ?? null;
}

function normalizeOfferingText(offering: Pick<PublicOffering, "title" | "category" | "slug">) {
  return `${offering.title} ${offering.category} ${offering.slug}`.toLowerCase();
}

export function getPublicOfferingVitalAiPath(offering: Pick<PublicOffering, "title" | "category" | "slug">) {
  const text = normalizeOfferingText(offering);

  if (text.includes("wound")) return "/vital-ai?pathway=wound_care";
  if (text.includes("glp") || text.includes("weight optimization")) return "/vital-ai?pathway=glp1_weight_loss";
  return "/vital-ai?pathway=general_consult";
}

export function getPublicOfferingPrimaryCta(offering: Pick<PublicOffering, "title" | "category" | "slug">) {
  const text = normalizeOfferingText(offering);

  if (text.includes("wound")) {
    return {
      label: "Start Wound Review",
      to: getPublicOfferingVitalAiPath(offering),
    };
  }

  return {
    label: "Request Visit",
    to: `/book?interest=${encodeURIComponent(offering.slug)}`,
  };
}

export function getPublicAccessRoute(mode: "login" | "signup" = "login") {
  return `/access?mode=${mode}`;
}
