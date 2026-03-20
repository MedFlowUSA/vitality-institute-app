import { readPublicBookingDraft } from "./publicBookingDraft";
import { supabase } from "./supabase";
import type { PublicVitalAiAnswers, PublicVitalAiPathway } from "./publicVitalAiLite";

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
};

export async function submitPublicVitalAiRequest(input: SubmitPublicVitalAiInput) {
  const bookingDraft = readPublicBookingDraft();
  const { data, error } = await supabase
    .from("public_vital_ai_submissions")
    .insert([
      {
        pathway: input.pathway,
        status: "new",
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        preferred_contact_method: input.preferredContactMethod,
        preferred_location_id: input.preferredLocationId || bookingDraft?.locationId || null,
        answers_json: input.answers,
        summary: input.summary,
        source: "public_vital_ai_lite",
        booking_request_id: bookingDraft?.requestId ?? null,
        service_id: bookingDraft?.serviceId ?? null,
        notes: bookingDraft?.notes?.trim() || null,
      },
    ])
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}
