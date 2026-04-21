import { describe, expect, it } from "vitest";
import {
  buildMarketOptionGroups,
  isOperationalMarket,
  isPlaceholderMarket,
  marketStatusLabel,
} from "./locationMarkets";

describe("locationMarkets", () => {
  it("treats coming soon rows as placeholders and keeps live rows operational", () => {
    expect(isPlaceholderMarket({ is_placeholder: true, market_status: "coming_soon" })).toBe(true);
    expect(isOperationalMarket({ is_placeholder: false, market_status: "live" })).toBe(true);
    expect(isOperationalMarket({ is_placeholder: true, market_status: "coming_soon" })).toBe(false);
  });

  it("builds grouped select options with coming soon rows separated", () => {
    const groups = buildMarketOptionGroups(
      [
        { id: "live-1", name: "Vitality Institute of Redlands", is_placeholder: false, market_status: "live", display_priority: 1 },
        { id: "soon-1", name: "Vitality Institute of Phoenix", is_placeholder: true, market_status: "coming_soon", display_priority: 100 },
      ],
      {
        valueOf: (row) => row.id,
        labelOf: (row) => `${row.name}${isPlaceholderMarket(row) ? ` - ${marketStatusLabel(row)}` : ""}`,
      }
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe("Live Clinics");
    expect(groups[0]?.options[0]?.label).toContain("Redlands");
    expect(groups[1]?.label).toBe("Coming Soon");
    expect(groups[1]?.options[0]?.label).toContain("Coming Soon");
  });

  it("keeps live markets first and can hide coming soon markets for operational flows", () => {
    const groups = buildMarketOptionGroups(
      [
        { id: "soon-1", name: "Vitality Institute of Phoenix", is_placeholder: true, market_status: "coming_soon", display_priority: 100 },
        { id: "live-2", name: "Vitality Institute of Yucaipa", is_placeholder: false, market_status: "live", display_priority: 2 },
        { id: "live-1", name: "Vitality Institute of Redlands", is_placeholder: false, market_status: "live", display_priority: 1 },
      ],
      {
        valueOf: (row) => row.id,
        labelOf: (row) => row.name,
        includeComingSoon: false,
      }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Live Clinics");
    expect(groups[0]?.options.map((option) => option.value)).toEqual(["live-1", "live-2"]);
  });

  it("can keep coming soon markets visible but disabled for non-operational pickers", () => {
    const groups = buildMarketOptionGroups(
      [
        { id: "live-1", name: "Vitality Institute of Redlands", is_placeholder: false, market_status: "live", display_priority: 1 },
        { id: "soon-1", name: "Vitality Institute of Phoenix", is_placeholder: true, market_status: "coming_soon", display_priority: 100 },
      ],
      {
        valueOf: (row) => row.id,
        labelOf: (row) => row.name,
        disableComingSoon: true,
      }
    );

    expect(groups[1]?.options[0]?.disabled).toBe(true);
    expect(groups[0]?.options[0]?.disabled).toBe(false);
  });
});
