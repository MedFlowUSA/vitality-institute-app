export type MarketStatus = "live" | "coming_soon";

export type MarketTaggedRecord = {
  is_placeholder?: boolean | null;
  market_status?: MarketStatus | null;
  display_priority?: number | null;
};

export type MarketOptionGroupKey = "live" | "coming_soon";

export type MarketOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  groupKey: MarketOptionGroupKey;
  marketStatus: MarketStatus;
  isPlaceholder: boolean;
  meta?: string | null;
};

export type MarketOptionGroup<TValue extends string = string> = {
  key: MarketOptionGroupKey;
  label: string;
  options: MarketOption<TValue>[];
};

export type ExpansionMarketSeed = {
  city: string;
  state: string;
  display_priority: number;
};

export const LIVE_MARKET_GROUP_LABEL = "Live Clinics";
export const COMING_SOON_MARKET_GROUP_LABEL = "Coming Soon";

export const COMING_SOON_MARKETS: ExpansionMarketSeed[] = [
  { city: "San Diego", state: "CA", display_priority: 100 },
  { city: "San Francisco", state: "CA", display_priority: 101 },
  { city: "San Jose", state: "CA", display_priority: 102 },
  { city: "Sacramento", state: "CA", display_priority: 103 },
  { city: "Fresno", state: "CA", display_priority: 104 },
  { city: "Phoenix", state: "AZ", display_priority: 105 },
  { city: "Scottsdale", state: "AZ", display_priority: 106 },
  { city: "Las Vegas", state: "NV", display_priority: 107 },
  { city: "Reno", state: "NV", display_priority: 108 },
  { city: "Seattle", state: "WA", display_priority: 109 },
  { city: "Tacoma", state: "WA", display_priority: 110 },
  { city: "Portland", state: "OR", display_priority: 111 },
  { city: "Boise", state: "ID", display_priority: 112 },
  { city: "Salt Lake City", state: "UT", display_priority: 113 },
  { city: "Denver", state: "CO", display_priority: 114 },
  { city: "Colorado Springs", state: "CO", display_priority: 115 },
  { city: "Albuquerque", state: "NM", display_priority: 116 },
  { city: "Dallas", state: "TX", display_priority: 117 },
  { city: "Fort Worth", state: "TX", display_priority: 118 },
  { city: "Houston", state: "TX", display_priority: 119 },
  { city: "Austin", state: "TX", display_priority: 120 },
  { city: "San Antonio", state: "TX", display_priority: 121 },
  { city: "El Paso", state: "TX", display_priority: 122 },
  { city: "Oklahoma City", state: "OK", display_priority: 123 },
  { city: "Kansas City", state: "MO", display_priority: 124 },
  { city: "St. Louis", state: "MO", display_priority: 125 },
  { city: "Omaha", state: "NE", display_priority: 126 },
  { city: "Minneapolis", state: "MN", display_priority: 127 },
  { city: "Chicago", state: "IL", display_priority: 128 },
  { city: "Indianapolis", state: "IN", display_priority: 129 },
  { city: "Detroit", state: "MI", display_priority: 130 },
  { city: "Cleveland", state: "OH", display_priority: 131 },
  { city: "Columbus", state: "OH", display_priority: 132 },
  { city: "Cincinnati", state: "OH", display_priority: 133 },
  { city: "Nashville", state: "TN", display_priority: 134 },
  { city: "Atlanta", state: "GA", display_priority: 135 },
  { city: "Miami", state: "FL", display_priority: 136 },
  { city: "Orlando", state: "FL", display_priority: 137 },
  { city: "Tampa", state: "FL", display_priority: 138 },
  { city: "Jacksonville", state: "FL", display_priority: 139 },
  { city: "Charlotte", state: "NC", display_priority: 140 },
  { city: "Raleigh", state: "NC", display_priority: 141 },
  { city: "Washington", state: "DC", display_priority: 142 },
  { city: "Philadelphia", state: "PA", display_priority: 143 },
  { city: "Pittsburgh", state: "PA", display_priority: 144 },
  { city: "Newark", state: "NJ", display_priority: 145 },
  { city: "New York", state: "NY", display_priority: 146 },
  { city: "Boston", state: "MA", display_priority: 147 },
  { city: "New Orleans", state: "LA", display_priority: 148 },
  { city: "Baltimore", state: "MD", display_priority: 149 },
];

function normalizedMarketLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function resolveMarketStatus(record: MarketTaggedRecord) {
  if (record.market_status === "coming_soon") return "coming_soon";
  if (record.market_status === "live") return "live";
  return record.is_placeholder ? "coming_soon" : "live";
}

export function isPlaceholderMarket(record: MarketTaggedRecord) {
  return record.is_placeholder === true || resolveMarketStatus(record) === "coming_soon";
}

export function isOperationalMarket(record: MarketTaggedRecord) {
  return !isPlaceholderMarket(record) && resolveMarketStatus(record) === "live";
}

export function marketStatusLabel(record: MarketTaggedRecord) {
  return isPlaceholderMarket(record) ? "Coming Soon" : "Live";
}

export function buildPlaceholderLocationName(city: string) {
  return `Vitality Institute of ${city}`;
}

export function sortMarketRecords<
  T extends MarketTaggedRecord & {
    name?: string | null;
    city?: string | null;
    state?: string | null;
  },
>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const priorityDiff = (a.display_priority ?? 10_000) - (b.display_priority ?? 10_000);
    if (priorityDiff !== 0) return priorityDiff;

    const statusDiff = Number(isPlaceholderMarket(a)) - Number(isPlaceholderMarket(b));
    if (statusDiff !== 0) return statusDiff;

    const aLabel = normalizedMarketLabel(a.name ?? a.city ?? a.state ?? "");
    const bLabel = normalizedMarketLabel(b.name ?? b.city ?? b.state ?? "");
    return aLabel.localeCompare(bLabel);
  });
}

export function countMarketOptionGroups(groups: MarketOptionGroup[]) {
  return groups.reduce(
    (counts, group) => {
      if (group.key === "coming_soon") {
        counts.comingSoon += group.options.length;
      } else {
        counts.live += group.options.length;
      }
      return counts;
    },
    { live: 0, comingSoon: 0 }
  );
}

export function buildMarketOptionGroups<
  TRecord extends MarketTaggedRecord & {
    name?: string | null;
    city?: string | null;
    state?: string | null;
  },
  TValue extends string = string,
>(
  rows: TRecord[],
  config: {
    valueOf: (row: TRecord) => TValue;
    labelOf: (row: TRecord) => string;
    metaOf?: (row: TRecord) => string | null | undefined;
    includeComingSoon?: boolean;
    disableComingSoon?: boolean;
    liveLabel?: string;
    comingSoonLabel?: string;
  }
) {
  const includeComingSoon = config.includeComingSoon ?? true;
  const disableComingSoon = config.disableComingSoon ?? false;
  const liveLabel = config.liveLabel ?? LIVE_MARKET_GROUP_LABEL;
  const comingSoonLabel = config.comingSoonLabel ?? COMING_SOON_MARKET_GROUP_LABEL;

  const liveOptions: MarketOption<TValue>[] = [];
  const comingSoonOptions: MarketOption<TValue>[] = [];

  for (const row of sortMarketRecords(rows)) {
    const placeholder = isPlaceholderMarket(row);
    if (placeholder && !includeComingSoon) continue;

    const option: MarketOption<TValue> = {
      value: config.valueOf(row),
      label: config.labelOf(row),
      disabled: placeholder ? disableComingSoon : false,
      groupKey: placeholder ? "coming_soon" : "live",
      marketStatus: resolveMarketStatus(row),
      isPlaceholder: placeholder,
      meta: config.metaOf?.(row) ?? null,
    };

    if (placeholder) {
      comingSoonOptions.push(option);
    } else {
      liveOptions.push(option);
    }
  }

  const groups: MarketOptionGroup<TValue>[] = [];
  if (liveOptions.length > 0) {
    groups.push({ key: "live", label: liveLabel, options: liveOptions });
  }
  if (comingSoonOptions.length > 0) {
    groups.push({ key: "coming_soon", label: comingSoonLabel, options: comingSoonOptions });
  }
  return groups;
}
