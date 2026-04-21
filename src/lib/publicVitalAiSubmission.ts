import { readPublicBookingDraft } from "./publicBookingDraft";
import type { PublicVitalAiCaptureType } from "./publicSubmissionOps";
import { supabase } from "./supabase";
import type { PublicVitalAiAnswers, PublicVitalAiPathway } from "./publicVitalAiLite";
import { scoreConversionLead } from "./vitalAi/conversionEngine";

export type SubmitPublicVitalAiInput = {
  pathway: PublicVitalAiPathway;
  answers: PublicVitalAiAnswers;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  preferredContactMethod: "phone" | "email" | "either";
  preferredLocationId?: string;
  summary: string;
  captureType?: PublicVitalAiCaptureType;
};

export async function submitPublicVitalAiRequest(input: SubmitPublicVitalAiInput) {
  const bookingDraft = readPublicBookingDraft();
  const preferredLocationId = input.preferredLocationId || bookingDraft?.locationId || null;
  const leadMetadata = scoreConversionLead({
    pathway: input.pathway,
    answers: input.answers,
  });
  const submissionId = crypto.randomUUID();
  const { error } = await supabase
    .from("public_vital_ai_submissions")
    .insert([
      {
        id: submissionId,
        pathway: input.pathway,
        status: "new",
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        preferred_contact_method: input.preferredContactMethod,
        preferred_location_id: preferredLocationId,
        answers_json: input.answers,
        summary: input.summary,
        source: "public_vital_ai_lite",
        capture_type: input.captureType ?? "standard_intake",
        booking_request_id: bookingDraft?.requestId ?? null,
        service_id: bookingDraft?.serviceId ?? null,
        notes: bookingDraft?.notes?.trim() || null,
        lead_type: leadMetadata.leadType,
        urgency_level: leadMetadata.urgencyLevel,
        value_level: leadMetadata.valueLevel,
      },
    ]);

  if (error) throw error;
  return { id: submissionId };
}
