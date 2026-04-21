import { COMING_SOON_MARKETS, buildPlaceholderLocationName, type MarketStatus } from "./locationMarkets";

export type PublicClinicLocation = {
  name: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  cityStateZip: string;
  hoursLabel: string;
  note?: string;
  website?: string;
  is_placeholder?: boolean;
  market_status?: MarketStatus;
  display_priority?: number;
};

export function normalizePublicClinicLocationName(name: string) {
  const trimmed = name.trim();
  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
  const looksLikeLegacyLosAngelesBrand =
    normalized.includes("touch") &&
    normalized.includes("vitality") &&
    normalized.includes("los angeles");

  if (looksLikeLegacyLosAngelesBrand) {
    return "Vitality Institute of Los Angeles";
  }
  return name;
}

export const PUBLIC_CLINIC_LOCATIONS: PublicClinicLocation[] = [
  {
    name: "Vitality Institute of Redlands",
    phone: "909-500-4572",
    email: "hello@vitalityinstitute.com",
    addressLine1: "411 W. State Street, Suite B",
    cityStateZip: "Redlands, CA 92373",
    hoursLabel: "Monday to Friday, 10:00 AM to 4:00 PM",
    website: "http://www.redlandsvitality.com/",
    is_placeholder: false,
    market_status: "live",
    display_priority: 1,
  },
  {
    name: "Vitality Institute of Los Angeles",
    phone: "(213) 912-6838",
    addressLine1: "931 N Vignes St",
    addressLine2: "Suite 102-8",
    cityStateZip: "Los Angeles, CA 90012",
    hoursLabel: "Opening soon",
    note: "A modern wellness studio in Los Angeles with hyperbaric oxygen therapy, detox technology, body sculpting, and non-invasive fat reduction services.",
    is_placeholder: false,
    market_status: "live",
    display_priority: 2,
  },
  ...COMING_SOON_MARKETS.map((market) => ({
    name: buildPlaceholderLocationName(market.city),
    addressLine1: "Expansion Market",
    cityStateZip: `${market.city}, ${market.state}`,
    hoursLabel: "Coming Soon",
    note: `We are preparing this market now. Join the expansion waitlist and we will reach out when appointments open in ${market.city}.`,
    is_placeholder: true,
    market_status: "coming_soon" as const,
    display_priority: market.display_priority,
  })),
];
