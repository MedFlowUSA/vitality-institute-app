import { supabase } from "./supabase";

export type CreateBookingRequestInput = {
  locationId: string;
  serviceId: string;
  requestedStart: string;
  notes?: string;
  source?: string;
  patientId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export async function createBookingRequest(input: CreateBookingRequestInput) {
  const { data, error } = await supabase
    .from("booking_requests")
    .insert([
      {
        location_id: input.locationId,
        service_id: input.serviceId,
        requested_start: input.requestedStart,
        notes: input.notes?.trim() || null,
        source: input.source ?? "public_booking",
        status: "new",
        patient_id: input.patientId ?? null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
      },
    ])
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}
