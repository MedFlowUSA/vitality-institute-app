import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

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
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function LocationPicker() {
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userLocs, setUserLocs] = useState<UserLocationRow[]>([]);
  const [locMap, setLocMap] = useState<Record<string, LocationRow>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeLabel = useMemo(() => {
    if (!activeLocationId) return "No location";
    const location = locMap[activeLocationId];
    if (!location) return activeLocationId.slice(0, 8);
    const place = [location.city, location.state].filter(Boolean).join(", ");
    return place ? `${location.name} • ${place}` : location.name;
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
      if (locationIds.length === 0) {
        setLocMap({});
      } else {
        const { data: locationRows, error: locationError } = await supabase
          .from("locations")
          .select("id,name,city,state")
          .in("id", locationIds);

        if (locationError) throw locationError;

        const nextMap: Record<string, LocationRow> = {};
        for (const location of (locationRows as LocationRow[]) ?? []) {
          nextMap[location.id] = location;
        }
        setLocMap(nextMap);
      }

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

  if (userLocs.length === 0) {
    return (
      <div className="v-chip" title={err ?? ""}>
        Location: <strong className="muted">{err ? "Error" : "None linked"}</strong>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div className="v-chip">
        Location: <strong>{activeLabel}</strong>
      </div>

      <select
        className="input"
        style={{ width: 280 }}
        value={activeLocationId ?? ""}
        onChange={(event) => setPrimaryAndActive(event.target.value)}
        disabled={saving}
        title="Switch active location"
      >
        <option value="" disabled>
          Select location...
        </option>
        {userLocs
          .slice()
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
          .map((row) => {
            const location = locMap[row.location_id];
            const label = location ? location.name : row.location_id;
            return (
              <option key={row.location_id} value={row.location_id}>
                {row.is_primary ? "? " : ""}
                {label}
              </option>
            );
          })}
      </select>

      {err ? (
        <div className="muted" style={{ fontSize: 12, color: "crimson" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
