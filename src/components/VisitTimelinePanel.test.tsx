/* @vitest-environment jsdom */
import { act } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
}));

import VisitTimelinePanel from "./VisitTimelinePanel";

type QueryResult = { data: unknown; error: unknown };

function createQueryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result);
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
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

describe("VisitTimelinePanel", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    mockSupabase.from.mockReset();
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

  it("falls back to base visit records when the timeline view is unavailable", async () => {
    const timelineView = createQueryBuilder({
      data: null,
      error: new Error("view unavailable"),
    });
    const visits = createQueryBuilder({
      data: [
        {
          id: "visit_1",
          patient_id: "patient_1",
          location_id: "loc_1",
          visit_date: "2026-04-16T15:00:00.000Z",
          created_at: "2026-04-16T14:45:00.000Z",
          status: "in_progress",
          summary: "Wound reassessment",
        },
      ],
      error: null,
    });
    const soaps = createQueryBuilder({
      data: [
        {
          id: "soap_1",
          visit_id: "visit_1",
          created_at: "2026-04-16T15:15:00.000Z",
          is_signed: true,
          is_locked: false,
          signed_at: "2026-04-16T15:20:00.000Z",
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "v_patient_visit_timeline") return timelineView;
      if (table === "patient_visits") return visits;
      if (table === "patient_soap_notes") return soaps;
      throw new Error(`Unexpected table: ${table}`);
    });

    const onSelectVisit = vi.fn();

    await act(async () => {
      root.render(
        <VisitTimelinePanel
          patientId="patient_1"
          onSelectVisit={onSelectVisit}
        />
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain(
      "Showing visit history from base visit records while the shared timeline view is unavailable."
    );
    expect(container.textContent).toContain("In Progress | Wound reassessment");
    expect(container.textContent).toContain("Signed");

    const visitButton = container.querySelector("button.btn");
    expect(visitButton).not.toBeNull();

    await act(async () => {
      visitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelectVisit).toHaveBeenCalledWith("visit_1");
    expect(visits.eq).toHaveBeenCalledWith("patient_id", "patient_1");
    expect(soaps.in).toHaveBeenCalledWith("visit_id", ["visit_1"]);
  });
});
