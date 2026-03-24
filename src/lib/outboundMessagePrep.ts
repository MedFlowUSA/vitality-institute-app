import { buildFollowUpMessage, resolveBookingRequestLead } from "./publicFollowUpEngine";
import { getBookingNextStep, getVitalAiNextStep, type BookingRequestStatus } from "./publicSubmissionOps";
import type { PublicVitalAiAnswers, PublicVitalAiPathway, PublicVitalAiStatus } from "./publicVitalAiLite";
import { scoreConversionLead, type ConversionLeadMetadata, type ConversionPathway, type ConversionUrgencyLevel, type ConversionValueLevel } from "./vitalAi/conversionEngine";
import { getRevenueRecommendation, type RevenueRecommendation } from "./vitalAi/revenueEngine";

export type OutboundChannel = "sms" | "email" | "sms_or_email" | "manual_review";
export type OutboundPriority = "low" | "medium" | "high";
export type OutboundTimingKey = "within_24_hours" | "within_4_hours" | "as_soon_as_possible";

export type OutboundMessagePayload = {
  eventType: "booking_request_follow_up" | "public_vital_ai_follow_up";
  title: string;
  recipient: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    preferredContactMethod?: "phone" | "email" | "either" | null;
    recommendedChannel: OutboundChannel;
  };
  lead: {
    type: ConversionPathway;
    urgency: ConversionUrgencyLevel;
    value: ConversionValueLevel;
    score: number;
    outcomeLabel: string;
  };
  message: {
    subject: string | null;
    body: string;
    staffNote: string | null;
  };
  recommendation: {
    primaryOffer: string;
    secondaryOffer?: string;
    consultRequired: boolean;
    note?: string;
    nextStep: string;
  };
  timing: {
    priority: OutboundPriority;
    sendWindow: OutboundTimingKey;
    label: string;
  };
  related: {
    bookingRequestId?: string | null;
    submissionId?: string | null;
    locationId?: string | null;
    serviceId?: string | null;
    patientId?: string | null;
    pathway?: PublicVitalAiPathway | null;
    requestedStart?: string | null;
    source?: string | null;
  };
};

type ContactPreference = "phone" | "email" | "either" | null | undefined;

function joinDefined(parts: Array<string | null | undefined>, separator: string) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(separator);
}

function normalizeFullName(firstName?: string | null, lastName?: string | null) {
  const fullName = joinDefined([firstName, lastName], " ");
  return fullName || null;
}

function resolveRecommendedChannel(input: {
  preferredContactMethod?: ContactPreference;
  email?: string | null;
  phone?: string | null;
  urgencyLevel: ConversionUrgencyLevel;
}): OutboundChannel {
  const hasEmail = Boolean(input.email?.trim());
  const hasPhone = Boolean(input.phone?.trim());

  if (input.preferredContactMethod === "email") {
    if (hasEmail) return "email";
    if (hasPhone) return "sms";
  }

  if (input.preferredContactMethod === "phone") {
    if (hasPhone) return "sms";
    if (hasEmail) return "email";
  }

  if (hasPhone && hasEmail) {
    return input.urgencyLevel === "high" ? "sms" : "sms_or_email";
  }

  if (hasPhone) return "sms";
  if (hasEmail) return "email";
  return "manual_review";
}

function resolveTiming(urgencyLevel: ConversionUrgencyLevel): OutboundMessagePayload["timing"] {
  if (urgencyLevel === "high") {
    return {
      priority: "high",
      sendWindow: "as_soon_as_possible",
      label: "Send as soon as possible",
    };
  }

  if (urgencyLevel === "medium") {
    return {
      priority: "medium",
      sendWindow: "within_4_hours",
      label: "Send within 4 hours",
    };
  }

  return {
    priority: "low",
    sendWindow: "within_24_hours",
    label: "Send within 24 hours",
  };
}

function buildSubject(input: {
  leadType: ConversionPathway;
  urgencyLevel: ConversionUrgencyLevel;
  primaryOffer: string;
}): string {
  const leadLabel =
    input.leadType === "glp1"
      ? "GLP-1 follow-up"
      : input.leadType === "hormone"
      ? "Hormone consultation follow-up"
      : input.leadType === "peptides"
      ? "Peptide consultation follow-up"
      : input.leadType === "wound"
      ? "Wound care follow-up"
      : "Care follow-up";

  if (input.urgencyLevel === "high") {
    return `Vitality Institute: ${leadLabel} needs prompt review`;
  }

  return `Vitality Institute: ${input.primaryOffer}`;
}

function buildBody(input: {
  fullName?: string | null;
  patientMessage: string;
  supportingLine: string;
  recommendation: RevenueRecommendation;
  requestedStart?: string | null;
}) {
  const greeting = input.fullName ? `Hi ${input.fullName},` : "Hello,";
  const scheduleLine = input.requestedStart
    ? ` We have your requested time on file for ${new Date(input.requestedStart).toLocaleString()}.`
    : "";
  const offerLine = ` Recommended next step: ${input.recommendation.primaryOffer}.`;
  const consultLine = input.recommendation.consultRequired
    ? " A provider review or consultation may be part of the next step before treatment is finalized."
    : "";

  return `${greeting} ${input.patientMessage} ${input.supportingLine}${scheduleLine}${offerLine}${consultLine}`.trim();
}

function buildStaffNote(input: {
  followUpStaffNote: string;
  nextStep: string;
  recommendation: RevenueRecommendation;
}) {
  return joinDefined(
    [
      input.followUpStaffNote,
      `Next operational step: ${input.nextStep}`,
      `Primary offer: ${input.recommendation.primaryOffer}`,
      input.recommendation.secondaryOffer ? `Secondary offer: ${input.recommendation.secondaryOffer}` : null,
      input.recommendation.note ?? null,
    ],
    " "
  );
}

function buildPayload(input: {
  eventType: OutboundMessagePayload["eventType"];
  title: string;
  lead: ConversionLeadMetadata;
  recommendation: RevenueRecommendation;
  nextStep: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredContactMethod?: ContactPreference;
  related: OutboundMessagePayload["related"];
}) {
  const followUp = buildFollowUpMessage(input.lead.leadType, input.lead.urgencyLevel);
  const fullName = normalizeFullName(input.firstName, input.lastName);
  const recommendedChannel = resolveRecommendedChannel({
    preferredContactMethod: input.preferredContactMethod,
    email: input.email,
    phone: input.phone,
    urgencyLevel: input.lead.urgencyLevel,
  });

  return {
    eventType: input.eventType,
    title: input.title,
    recipient: {
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      fullName,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      preferredContactMethod: input.preferredContactMethod ?? null,
      recommendedChannel,
    },
    lead: {
      type: input.lead.leadType,
      urgency: input.lead.urgencyLevel,
      value: input.lead.valueLevel,
      score: input.lead.leadScore,
      outcomeLabel: input.lead.outcomeLabel,
    },
    message: {
      subject: buildSubject({
        leadType: input.lead.leadType,
        urgencyLevel: input.lead.urgencyLevel,
        primaryOffer: input.recommendation.primaryOffer,
      }),
      body: buildBody({
        fullName,
        patientMessage: followUp.patientMessage,
        supportingLine: followUp.supportingLine,
        recommendation: input.recommendation,
        requestedStart: input.related.requestedStart,
      }),
      staffNote: buildStaffNote({
        followUpStaffNote: followUp.staffNote,
        nextStep: input.nextStep,
        recommendation: input.recommendation,
      }),
    },
    recommendation: {
      primaryOffer: input.recommendation.primaryOffer,
      secondaryOffer: input.recommendation.secondaryOffer,
      consultRequired: input.recommendation.consultRequired,
      note: input.recommendation.note,
      nextStep: input.nextStep,
    },
    timing: resolveTiming(input.lead.urgencyLevel),
    related: input.related,
  } satisfies OutboundMessagePayload;
}

export function prepareBookingRequestOutboundPayload(input: {
  requestId: string | null;
  locationId?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  requestedStart?: string | null;
  notes?: string | null;
  source?: string | null;
  patientId?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  linkedVitalAi?: {
    pathway?: PublicVitalAiPathway | null;
    answers?: PublicVitalAiAnswers | Record<string, unknown> | null;
  } | null;
  status?: BookingRequestStatus;
}): OutboundMessagePayload {
  const lead =
    input.linkedVitalAi?.pathway != null
      ? scoreConversionLead({
          pathway: input.linkedVitalAi.pathway,
          answers: input.linkedVitalAi.answers ?? {},
        })
      : resolveBookingRequestLead({
          serviceName: input.serviceName,
          notes: input.notes,
        });

  const recommendation = getRevenueRecommendation({
    lead,
    answers: input.linkedVitalAi?.answers ?? {},
  });

  const nextStep = getBookingNextStep({
    status: input.status ?? "new",
    hasVitalAiSubmission: Boolean(input.linkedVitalAi?.pathway),
    patientLinked: Boolean(input.patientId),
    isWound: lead.leadType === "wound",
  });

  return buildPayload({
    eventType: "booking_request_follow_up",
    title: "Booking Request Follow-Up",
    lead,
    recommendation,
    nextStep,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    preferredContactMethod: input.phone ? "phone" : input.email ? "email" : null,
    related: {
      bookingRequestId: input.requestId,
      locationId: input.locationId ?? null,
      serviceId: input.serviceId ?? null,
      patientId: input.patientId ?? null,
      requestedStart: input.requestedStart ?? null,
      source: input.source ?? null,
      pathway: input.linkedVitalAi?.pathway ?? null,
    },
  });
}

export function preparePublicVitalAiOutboundPayload(input: {
  submissionId: string | null;
  pathway: PublicVitalAiPathway;
  answers: PublicVitalAiAnswers | Record<string, unknown>;
  summary?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredContactMethod: "phone" | "email" | "either";
  preferredLocationId?: string | null;
  bookingRequestId?: string | null;
  serviceId?: string | null;
  patientId?: string | null;
  notes?: string | null;
  source?: string | null;
  status?: PublicVitalAiStatus;
}): OutboundMessagePayload {
  const lead = scoreConversionLead({
    pathway: input.pathway,
    answers: input.answers,
  });
  const recommendation = getRevenueRecommendation({
    lead,
    answers: input.answers,
  });
  const nextStep = getVitalAiNextStep({
    status: input.status ?? "new",
    pathway: input.pathway,
    hasBookingRequest: Boolean(input.bookingRequestId),
    patientLinked: Boolean(input.patientId),
  });

  const payload = buildPayload({
    eventType: "public_vital_ai_follow_up",
    title: "Public Vital AI Follow-Up",
    lead,
    recommendation,
    nextStep,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    preferredContactMethod: input.preferredContactMethod,
    related: {
      submissionId: input.submissionId,
      bookingRequestId: input.bookingRequestId ?? null,
      locationId: input.preferredLocationId ?? null,
      serviceId: input.serviceId ?? null,
      patientId: input.patientId ?? null,
      pathway: input.pathway,
      source: input.source ?? null,
    },
  });

  if (input.summary?.trim()) {
    payload.message.staffNote = joinDefined([payload.message.staffNote, `Summary: ${input.summary.trim()}`], " ");
  }

  if (input.notes?.trim()) {
    payload.message.staffNote = joinDefined([payload.message.staffNote, `Booking note: ${input.notes.trim()}`], " ");
  }

  return payload;
}
