import { describe, expect, it } from "vitest";

import {
  buildProviderTimelineRowsFromFallback,
  type ProviderTimelineFallbackSoap,
  type ProviderTimelineFallbackVisit,
} from "./timeline";

describe("provider timeline helpers", () => {
  it("builds fallback rows with the latest SOAP metadata per visit", () => {
    const visits: ProviderTimelineFallbackVisit[] = [
      {
        id: "visit_1",
        patient_id: "patient_1",
        location_id: "loc_1",
        visit_date: "2026-04-15T10:00:00.000Z",
        created_at: "2026-04-15T09:30:00.000Z",
        status: "in_progress",
        summary: "Wound reassessment",
      },
    ];

    const soapRows: ProviderTimelineFallbackSoap[] = [
      {
        id: "soap_older",
        visit_id: "visit_1",
        created_at: "2026-04-15T10:10:00.000Z",
        is_signed: false,
        is_locked: false,
        signed_at: null,
      },
      {
        id: "soap_newer",
        visit_id: "visit_1",
        created_at: "2026-04-15T10:25:00.000Z",
        is_signed: true,
        is_locked: false,
        signed_at: "2026-04-15T10:30:00.000Z",
      },
    ];

    expect(buildProviderTimelineRowsFromFallback(visits, soapRows)).toEqual([
      expect.objectContaining({
        visit_id: "visit_1",
        visit_status: "in_progress",
        soap_id: "soap_newer",
        soap_status: "signed",
        is_signed: true,
        is_locked: false,
        signed_at: "2026-04-15T10:30:00.000Z",
        soap_created_at: "2026-04-15T10:25:00.000Z",
      }),
    ]);
  });

  it("falls back to visit created_at when visit_date is missing and leaves SOAP empty when none exists", () => {
    const visits: ProviderTimelineFallbackVisit[] = [
      {
        id: "visit_2",
        patient_id: "patient_2",
        location_id: "loc_2",
        visit_date: null,
        created_at: "2026-04-16T08:00:00.000Z",
        status: "requested",
        summary: null,
      },
    ];

    expect(buildProviderTimelineRowsFromFallback(visits, [])).toEqual([
      {
        visit_id: "visit_2",
        patient_id: "patient_2",
        location_id: "loc_2",
        visit_date: "2026-04-16T08:00:00.000Z",
        visit_status: "requested",
        summary: null,
        soap_id: null,
        soap_status: null,
        is_signed: null,
        is_locked: null,
        signed_at: null,
        soap_created_at: null,
      },
    ]);
  });

  it("marks locked SOAP rows as locked even if they are also signed", () => {
    const visits: ProviderTimelineFallbackVisit[] = [
      {
        id: "visit_3",
        patient_id: "patient_3",
        location_id: "loc_3",
        visit_date: "2026-04-16T10:00:00.000Z",
        created_at: "2026-04-16T09:30:00.000Z",
        status: "completed",
        summary: "Discharge review",
      },
    ];

    const soapRows: ProviderTimelineFallbackSoap[] = [
      {
        id: "soap_locked",
        visit_id: "visit_3",
        created_at: "2026-04-16T10:15:00.000Z",
        is_signed: true,
        is_locked: true,
        signed_at: "2026-04-16T10:20:00.000Z",
      },
    ];

    expect(buildProviderTimelineRowsFromFallback(visits, soapRows)[0]).toMatchObject({
      soap_id: "soap_locked",
      soap_status: "locked",
      is_signed: true,
      is_locked: true,
    });
  });
});
