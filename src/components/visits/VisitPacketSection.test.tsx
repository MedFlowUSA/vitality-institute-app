/* @vitest-environment jsdom */
import { act } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

const mockPatientFiles = vi.hoisted(() => ({
  resolvePatientFileOwnerIds: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("../../lib/patientFiles", () => ({
  resolvePatientFileOwnerIds: mockPatientFiles.resolvePatientFileOwnerIds,
}));

import VisitPacketSection from "./VisitPacketSection";

type QueryResult = { data: unknown; error: unknown };

function createQueryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result);
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };

  return builder;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("VisitPacketSection", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockPatientFiles.resolvePatientFileOwnerIds.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("uses normalized patient file owner ids and only shows visit photos in the summary list", async () => {
    mockPatientFiles.resolvePatientFileOwnerIds.mockResolvedValue(["patient_1", "profile_1"]);

    const wounds = createQueryBuilder({
      data: [
        {
          id: "wound_1",
          wound_label: "Left Leg Ulcer",
          body_site: "Lower leg",
          laterality: "Left",
          length_cm: 2,
          width_cm: 3,
          depth_cm: 1,
          exudate: "Moderate",
          infection_signs: "None",
        },
      ],
      error: null,
    });
    const plan = createQueryBuilder({
      data: {
        id: "plan_1",
        status: "in_progress",
        summary: "Compression and dressing changes",
        patient_instructions: "Keep the area dry.",
      },
      error: null,
    });
    const files = createQueryBuilder({
      data: [
        { id: "file_img", filename: "photo-a.jpg", content_type: "image/jpeg" },
        { id: "file_pdf", filename: "report.pdf", content_type: "application/pdf" },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "wound_assessments") return wounds;
      if (table === "patient_treatment_plans") return plan;
      if (table === "patient_files") return files;
      throw new Error(`Unexpected table: ${table}`);
    });

    await act(async () => {
      root.render(<VisitPacketSection visitId="visit_1" patientId="patient_1" />);
    });
    await flushAsyncWork();

    expect(mockPatientFiles.resolvePatientFileOwnerIds).toHaveBeenCalledWith("patient_1");
    expect(files.in).toHaveBeenCalledWith("patient_id", ["patient_1", "profile_1"]);
    expect(files.eq).toHaveBeenCalledWith("visit_id", "visit_1");

    expect(container.textContent).toContain("Left Leg Ulcer");
    expect(container.textContent).toContain("In Progress");
    expect(container.textContent).toContain("photo-a.jpg");
    expect(container.textContent).not.toContain("report.pdf");
  });
});
