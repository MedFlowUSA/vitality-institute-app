import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
  storage: {
    from: vi.fn(),
  },
}));

vi.mock("./supabase", () => ({
  supabase: mockSupabase,
}));

function createMaybeSingleChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe("patientFiles", () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.storage.from.mockReset();
  });

  it("returns both patient id and profile id when starting from a patient record id", async () => {
    const byId = createMaybeSingleChain({
      data: { id: "patient_1", profile_id: "profile_1" },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== "patients") throw new Error(`Unexpected table: ${table}`);
      return byId;
    });

    const { resolvePatientFileOwnerIds } = await import("./patientFiles");

    await expect(resolvePatientFileOwnerIds("patient_1")).resolves.toEqual(["patient_1", "profile_1"]);
    expect(byId.eq).toHaveBeenCalledWith("id", "patient_1");
  });

  it("falls back to profile_id lookup and includes the linked patient record id", async () => {
    const byId = createMaybeSingleChain({
      data: null,
      error: null,
    });
    const byProfile = createMaybeSingleChain({
      data: { id: "patient_2", profile_id: "profile_2" },
      error: null,
    });

    let patientCall = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== "patients") throw new Error(`Unexpected table: ${table}`);
      patientCall += 1;
      return patientCall === 1 ? byId : byProfile;
    });

    const { resolvePatientFileOwnerIds } = await import("./patientFiles");

    await expect(resolvePatientFileOwnerIds("profile_2")).resolves.toEqual(["profile_2", "patient_2"]);
    expect(byId.eq).toHaveBeenCalledWith("id", "profile_2");
    expect(byProfile.eq).toHaveBeenCalledWith("profile_id", "profile_2");
  });

  it("returns the candidate id by itself when no patient record can be resolved", async () => {
    const byId = createMaybeSingleChain({
      data: null,
      error: null,
    });
    const byProfile = createMaybeSingleChain({
      data: null,
      error: null,
    });

    let patientCall = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== "patients") throw new Error(`Unexpected table: ${table}`);
      patientCall += 1;
      return patientCall === 1 ? byId : byProfile;
    });

    const { resolvePatientFileOwnerIds } = await import("./patientFiles");

    await expect(resolvePatientFileOwnerIds("orphan_id")).resolves.toEqual(["orphan_id"]);
  });
});
