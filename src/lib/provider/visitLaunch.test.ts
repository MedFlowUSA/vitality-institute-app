import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: mockSupabase,
}));

function createMaybeSingleChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe("visitLaunch", () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockSupabase.rpc.mockReset();
  });

  it("resolves the patient record directly from profile_id when available", async () => {
    const byProfile = createMaybeSingleChain({
      data: { id: "patient_1", profile_id: "profile_1" },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "patients") return byProfile;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { resolvePatientRecordId } = await import("./visitLaunch");

    await expect(resolvePatientRecordId("profile_1")).resolves.toBe("patient_1");
    expect(mockSupabase.from).toHaveBeenCalledWith("patients");
    expect(byProfile.eq).toHaveBeenCalledWith("profile_id", "profile_1");
  });

  it("falls back to looking up the patient by id when profile lookup misses", async () => {
    const byProfile = createMaybeSingleChain({
      data: null,
      error: null,
    });
    const byId = createMaybeSingleChain({
      data: { id: "patient_2", profile_id: null },
      error: null,
    });

    let patientCall = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== "patients") throw new Error(`Unexpected table: ${table}`);
      patientCall += 1;
      return patientCall === 1 ? byProfile : byId;
    });

    const { resolvePatientRecordId } = await import("./visitLaunch");

    await expect(resolvePatientRecordId("patient_2")).resolves.toBe("patient_2");
    expect(byProfile.eq).toHaveBeenCalledWith("profile_id", "patient_2");
    expect(byId.eq).toHaveBeenCalledWith("id", "patient_2");
  });

  it("reuses an existing visit for the appointment before calling the RPC", async () => {
    const byProfile = createMaybeSingleChain({
      data: { id: "patient_3", profile_id: "profile_3" },
      error: null,
    });
    const existingVisit = createMaybeSingleChain({
      data: { id: "visit_existing" },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "patients") return byProfile;
      if (table === "patient_visits") return existingVisit;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { startVisitFromAppointment } = await import("./visitLaunch");

    await expect(
      startVisitFromAppointment({
        appointmentId: "appt_1",
        patientCandidateId: "profile_3",
        locationId: "loc_1",
      })
    ).resolves.toEqual({
      patientId: "patient_3",
      visitId: "visit_existing",
      reusedExistingVisit: true,
    });

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(existingVisit.eq).toHaveBeenCalledWith("appointment_id", "appt_1");
  });

  it("creates a visit through the RPC when no visit exists yet", async () => {
    const byProfile = createMaybeSingleChain({
      data: { id: "patient_4", profile_id: "profile_4" },
      error: null,
    });
    const existingVisit = createMaybeSingleChain({
      data: null,
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "patients") return byProfile;
      if (table === "patient_visits") return existingVisit;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabase.rpc.mockResolvedValue({
      data: { id: "visit_new" },
      error: null,
    });

    const { startVisitFromAppointment } = await import("./visitLaunch");

    await expect(
      startVisitFromAppointment({
        appointmentId: "appt_2",
        patientCandidateId: "profile_4",
        locationId: "loc_2",
      })
    ).resolves.toEqual({
      patientId: "patient_4",
      visitId: "visit_new",
      reusedExistingVisit: false,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("start_patient_visit", {
      p_patient: "patient_4",
      p_location: "loc_2",
      p_appointment: "appt_2",
    });
  });

  it("reuses an existing visit when the incoming candidate id is already the patient record id", async () => {
    const byProfile = createMaybeSingleChain({
      data: null,
      error: null,
    });
    const byId = createMaybeSingleChain({
      data: { id: "patient_5", profile_id: "profile_5" },
      error: null,
    });
    const existingVisit = createMaybeSingleChain({
      data: { id: "visit_existing_patient_id" },
      error: null,
    });

    let patientCall = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "patients") {
        patientCall += 1;
        return patientCall === 1 ? byProfile : byId;
      }
      if (table === "patient_visits") return existingVisit;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { startVisitFromAppointment } = await import("./visitLaunch");

    await expect(
      startVisitFromAppointment({
        appointmentId: "appt_5",
        patientCandidateId: "patient_5",
        locationId: "loc_5",
      })
    ).resolves.toEqual({
      patientId: "patient_5",
      visitId: "visit_existing_patient_id",
      reusedExistingVisit: true,
    });

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(byProfile.eq).toHaveBeenCalledWith("profile_id", "patient_5");
    expect(byId.eq).toHaveBeenCalledWith("id", "patient_5");
  });

  it("throws a deterministic error when no patient record can be resolved", async () => {
    const byProfile = createMaybeSingleChain({
      data: null,
      error: null,
    });
    const byId = createMaybeSingleChain({
      data: null,
      error: null,
    });

    let patientCall = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== "patients") throw new Error(`Unexpected table: ${table}`);
      patientCall += 1;
      return patientCall === 1 ? byProfile : byId;
    });

    const { resolvePatientRecordId } = await import("./visitLaunch");

    await expect(resolvePatientRecordId("missing_patient")).rejects.toThrow("Patient record not found.");
  });
});
