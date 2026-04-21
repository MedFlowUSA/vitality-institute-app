import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import MarketGroupedSelect from "./locations/MarketGroupedSelect";
import { useClinicContext } from "../features/clinics/hooks/useClinicContext";
import { formatCatalogLocationName } from "../lib/services/catalog";
import { buildMarketOptionGroups, isOperationalMarket, isPlaceholderMarket, type MarketStatus } from "../lib/locationMarkets";
import { supabase } from "../lib/supabase";

type UserLocationRow = {
  id: string;
  user_id: string;
  location_id: string;
  is_primary: boolean;
};

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_placeholder: boolean;
  market_status: MarketStatus;
  display_priority?: number | null;
};

type PickerLocationRow = LocationRow & {
  is_primary?: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function LocationPicker() {
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const { isEnabled, activeClinic, activeClinicLocations } = useClinicContext();
  const [loading, setLoading] = useState(true);
  const [userLocs, setUserLocs] = useState<UserLocationRow[]>([]);
  const [locMap, setLocMap] = useState<Record<string, LocationRow>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const visibleOperationalUserLocs = useMemo(() => {
    const operationalRows = userLocs.filter((row) => {
      const location = locMap[row.location_id];
      return !location || isOperationalMarket(location);
    });
    if (!isEnabled || !activeClinic || activeClinicLocations.length === 0) return operationalRows;
    const allowedIds = new Set(activeClinicLocations.map((location) => location.location_id));
    return operationalRows.filter((row) => allowedIds.has(row.location_id));
  }, [activeClinic, activeClinicLocations, isEnabled, locMap, userLocs]);
  const placeholderRows = useMemo(
    () => Object.values(locMap).filter((location) => isPlaceholderMarket(location)),
    [locMap]
  );
  const pickerRows = useMemo<PickerLocationRow[]>(
    () => [
      ...visibleOperationalUserLocs.map((row) => ({
        ...(locMap[row.location_id] ?? {
          id: row.location_id,
          name: row.location_id,
          city: null,
          state: null,
          is_placeholder: false,
          market_status: "live" as const,
          display_priority: null,
        }),
        is_primary: row.is_primary,
      })),
      ...placeholderRows
        .filter((location) => !visibleOperationalUserLocs.some((row) => row.location_id === location.id))
        .map((location) => ({
          ...location,
          is_primary: false,
        })),
    ],
    [locMap, placeholderRows, visibleOperationalUserLocs]
  );
  const pickerGroups = useMemo(
    () =>
      buildMarketOptionGroups(pickerRows, {
        valueOf: (location) => location.id,
        labelOf: (location) => {
          const place = [location.city, location.state].filter(Boolean).join(", ");
          const base = place ? `${formatCatalogLocationName(location)} - ${place}` : formatCatalogLocationName(location);
          return location.is_primary && !isPlaceholderMarket(location) ? `Primary - ${base}` : base;
        },
        includeComingSoon: true,
        disableComingSoon: true,
      }),
    [pickerRows]
  );

  const activeLabel = useMemo(() => {
    if (!activeLocationId) return "No location";
    const location = locMap[activeLocationId];
    if (!location) return activeLocationId.slice(0, 8);
    const place = [location.city, location.state].filter(Boolean).join(", ");
    const displayName = formatCatalogLocationName(location);
    return place ? `${displayName} • ${place}` : displayName;
  }, [activeLocationId, locMap]);

  const loadLocations = useCallback(async () => {
    if (!user?.id) {
      setUserLocs([]);
      setLocMap({});
      setLoading(false);
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const { data: userLocationRows, error: userLocationError } = await supabase
        .from("user_locations")
        .select("id,user_id,location_id,is_primary")
        .eq("user_id", user.id);

      if (userLocationError) throw userLocationError;
      const rows = (userLocationRows as UserLocationRow[]) ?? [];
      setUserLocs(rows);

      const locationIds = Array.from(new Set(rows.map((row) => row.location_id)));
      const [{ data: liveLocationRows, error: liveLocationError }, { data: placeholderLocationRows, error: placeholderLocationError }] =
        await Promise.all([
          locationIds.length === 0
            ? Promise.resolve({ data: [] as LocationRow[], error: null })
            : supabase
                .from("locations")
                .select("id,name,city,state,is_placeholder,market_status,display_priority")
                .in("id", locationIds),
          supabase
            .from("locations")
            .select("id,name,city,state,is_placeholder,market_status,display_priority")
            .eq("market_status", "coming_soon")
            .order("display_priority")
            .order("name"),
        ]);

      if (liveLocationError) throw liveLocationError;
      if (placeholderLocationError) throw placeholderLocationError;

      const nextMap: Record<string, LocationRow> = {};
      for (const location of [...((liveLocationRows as LocationRow[]) ?? []), ...((placeholderLocationRows as LocationRow[]) ?? [])]) {
        nextMap[location.id] = location;
      }
      setLocMap(nextMap);

      if (!activeLocationId) {
        const primaryLocationId = rows.find((row) => row.is_primary)?.location_id ?? rows[0]?.location_id ?? null;
        if (primaryLocationId) {
          await setActiveLocationId(primaryLocationId);
        }
      }
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load locations."));
    } finally {
      setLoading(false);
    }
  }, [activeLocationId, setActiveLocationId, user?.id]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    if (!visibleOperationalUserLocs.length) return;
    if (activeLocationId && visibleOperationalUserLocs.some((row) => row.location_id === activeLocationId)) return;
    void setActiveLocationId(visibleOperationalUserLocs[0].location_id);
  }, [activeLocationId, setActiveLocationId, visibleOperationalUserLocs]);

  const setPrimaryAndActive = async (locationId: string) => {
    if (!user?.id) return;

    setSaving(true);
    setErr(null);

    try {
      const row = userLocs.find((item) => item.location_id === locationId);
      if (row?.id) {
        const { error } = await supabase.from("user_locations").update({ is_primary: true }).eq("id", row.id);
        if (error) throw error;
      }

      await setActiveLocationId(locationId);
      await loadLocations();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to set active location."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="v-chip">
        Location: <strong className="muted">Loading...</strong>
      </div>
    );
  }

  if (pickerRows.length === 0) {
    return (
      <div className="v-chip" title={err ?? ""}>
        Location: <strong className="muted">{err ? "Error" : activeClinic ? "None in active clinic" : "None linked"}</strong>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div className="v-chip">
        Location: <strong>{activeLabel}</strong>
      </div>

      <MarketGroupedSelect
        label="Active location"
        value={activeLocationId ?? ""}
        onChange={(value) => void setPrimaryAndActive(value)}
        groups={pickerGroups}
        placeholder="Select location..."
        disabled={saving}
        helperText="Live clinic locations are selectable. Coming-soon markets are shown for network visibility only."
        style={{ width: 320 }}
        selectStyle={{ width: "100%" }}
      />

      {err ? (
        <div className="muted" style={{ fontSize: 12, color: "crimson" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
