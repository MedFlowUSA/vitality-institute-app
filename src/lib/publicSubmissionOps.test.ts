import { describe, expect, it } from "vitest";
import {
  describeBookingSource,
  getBookingCaptureTypeLabel,
  getBookingNextStep,
  getPublicVitalAiCaptureTypeLabel,
  getVitalAiNextStep,
  isExpansionBookingRequest,
  isExpansionPublicVitalAiSubmission,
} from "./publicSubmissionOps";

describe("publicSubmissionOps", () => {
  it("labels expansion-interest sources distinctly from live booking flows", () => {
    expect(describeBookingSource("public_expansion_interest:phoenix-az")).toBe("Expansion waitlist interest");
    expect(describeBookingSource("public_booking_flow")).toBe("Direct public booking");
  });

  it("keeps expansion-interest next steps out of live scheduling guidance", () => {
    expect(
      getBookingNextStep({
        status: "new",
        hasVitalAiSubmission: false,
        patientLinked: false,
        isWound: false,
        source: "public_expansion_interest:phoenix-az",
      })
    ).toContain("expansion demand");

    expect(
      getBookingNextStep({
        status: "scheduled",
        hasVitalAiSubmission: true,
        patientLinked: true,
        isWound: false,
        source: "public_booking_flow",
      })
    ).toContain("Confirm the booked consult");
  });

  it("resolves booking and Vital AI capture types without relying only on source labels", () => {
    expect(
      isExpansionBookingRequest({
        captureType: "expansion_interest",
        source: "public_booking_flow",
      })
    ).toBe(true);
    expect(
      isExpansionPublicVitalAiSubmission({
        captureType: null,
        preferredLocationIsPlaceholder: true,
      })
    ).toBe(true);
    expect(getBookingCaptureTypeLabel("live_booking")).toBe("Live booking request");
    expect(getPublicVitalAiCaptureTypeLabel("expansion_interest")).toBe("Expansion market follow-up");
  });

  it("keeps expansion-market Vital AI follow-up out of live scheduling guidance", () => {
    expect(
      getVitalAiNextStep({
        status: "new",
        pathway: "general_consult",
        hasBookingRequest: false,
        patientLinked: false,
        isExpansionInterest: true,
      })
    ).toContain("expansion-market follow-up");
  });
});
