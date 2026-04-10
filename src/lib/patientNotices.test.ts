import { describe, expect, it } from "vitest";
import { buildPatientNoticeState, readPatientNoticeState } from "./patientNotices";

describe("patientNotices", () => {
  it("builds a success notice state by default", () => {
    expect(buildPatientNoticeState("Intake submitted successfully.")).toEqual({
      patientNotice: "Intake submitted successfully.",
      patientNoticeTone: "success",
    });
  });

  it("preserves an explicit notice tone", () => {
    expect(buildPatientNoticeState("Please review your file upload.", "warning")).toEqual({
      patientNotice: "Please review your file upload.",
      patientNoticeTone: "warning",
    });
  });

  it("reads a valid notice state", () => {
    expect(
      readPatientNoticeState({
        patientNotice: "Labs submitted successfully.",
        patientNoticeTone: "info",
      })
    ).toEqual({
      message: "Labs submitted successfully.",
      tone: "info",
    });
  });

  it("trims notice copy and falls back to success when tone is unknown", () => {
    expect(
      readPatientNoticeState({
        patientNotice: "  Assessment saved successfully.  ",
        patientNoticeTone: "unexpected",
      })
    ).toEqual({
      message: "Assessment saved successfully.",
      tone: "success",
    });
  });

  it("returns null for missing or blank notices", () => {
    expect(readPatientNoticeState(null)).toBeNull();
    expect(readPatientNoticeState({})).toBeNull();
    expect(readPatientNoticeState({ patientNotice: "   " })).toBeNull();
  });
});
