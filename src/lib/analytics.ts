import { supabase } from "./supabase";
import type { ConversionPathway, ConversionUrgencyLevel, ConversionValueLevel } from "./vitalAi/conversionEngine";

export type FunnelEventName =
  | "public_booking_started"
  | "public_booking_submitted"
  | "vital_ai_started"
  | "vital_ai_submitted"
  | "care_summary_viewed"
  | "care_summary_primary_action_clicked"
  | "care_summary_secondary_action_clicked";

export type FunnelEventInput = {
  eventName: FunnelEventName;
  pathway?: string | null;
  leadType?: ConversionPathway | null;
  urgencyLevel?: ConversionUrgencyLevel | null;
  valueLevel?: ConversionValueLevel | null;
  primaryOffer?: string | null;
  secondaryOffer?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function trackFunnelEvent(input: FunnelEventInput) {
  try {
    const { error } = await supabase.from("analytics_events").insert({
      event_name: input.eventName,
      pathway: input.pathway ?? null,
      lead_type: input.leadType ?? null,
      urgency_level: input.urgencyLevel ?? null,
      value_level: input.valueLevel ?? null,
      primary_offer: input.primaryOffer ?? null,
      secondary_offer: input.secondaryOffer ?? null,
      metadata_json: input.metadata ?? {},
    });

    if (error) {
      console.warn("[Analytics] event write failed", {
        eventName: input.eventName,
        error,
      });
    }
  } catch (error) {
    console.warn("[Analytics] event write failed", {
      eventName: input.eventName,
      error,
    });
  }
}
