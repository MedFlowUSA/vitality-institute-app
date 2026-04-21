import { supabase } from "./supabase";
import type { BookingRequestCaptureType } from "./publicSubmissionOps";

export type CreateBookingRequestInput = {
  locationId: string;
  serviceId?: string | null;
  serviceLabel?: string | null;
  requestedStart: string;
  notes?: string;
  source?: string;
  patientId?: string | null;
  email?: string | null;
  phone?: string | null;
  captureType?: BookingRequestCaptureType;
};

export async function createBookingRequest(input: CreateBookingRequestInput) {
  const requestId = crypto.randomUUID();
  const { error } = await supabase
    .from("booking_requests")
    .insert([
      {
        id: requestId,
        location_id: input.locationId,
        service_id: input.serviceId ?? null,
        service_label: input.serviceLabel?.trim() || null,
        requested_start: input.requestedStart,
        notes: input.notes?.trim() || null,
        source: input.source ?? "public_booking",
        capture_type: input.captureType ?? "live_booking",
        status: "new",
        patient_id: input.patientId ?? null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
      },
    ]);

  if (error) throw error;
  return { id: requestId };
}
