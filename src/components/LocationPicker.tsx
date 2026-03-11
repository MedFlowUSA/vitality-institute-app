import { useEffect, useMemo, useState } from "react";
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

export default function LocationPicker() {
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userLocs, setUserLocs] = useState<UserLocationRow[]>([]);
  const [locMap, setLocMap] = useState<Record<string, LocationRow>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeLabel = useMemo(() => {
    if (!activeLocationId) return "No location";
    const l = locMap[activeLocationId];
    if (!l) return activeLocationId.slice(0, 8);
    const place = [l.city, l.state].filter(Boolean).join(", ");
    return place ? `${l.name} • ${place}` : l.name;
  }, [activeLocationId, locMap]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) return;
      setErr(null);
      setLoading(true);

      try {
        const { data: ul, error: ulErr } = await supabase
          .from("user_locations")
          .select("id,user_id,location_id,is_primary")
          .eq("user_id", user.id);

        if (ulErr) throw ulErr;
        const rows = (ul as UserLocationRow[]) ?? [];
        if (cancelled) return;

        setUserLocs(rows);

        const locIds = Array.from(new Set(rows.map((r) => r.location_id)));
        if (locIds.length === 0) {
          setLocMap({});
          return;
        }

        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name,city,state")
          .in("id", locIds);

        if (locErr) throw locErr;
        if (cancelled) return;

        const next: Record<string, LocationRow> = {};
        for (const l of (locs as LocationRow[]) ?? []) next[l.id] = l;
        setLocMap(next);

        // If profile has no active_location_id yet, default to primary (or first)
        if (!activeLocationId) {
          const primary = rows.find((r) => r.is_primary)?.location_id ?? rows[0]?.location_id ?? null;
          if (primary) await setActiveLocationId(primary);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load locations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]); // intentionally not depending on activeLocationId to avoid loops

  const setPrimaryAndActive = async (locationId: string) => {
    if (!user?.id) return;
    setSaving(true);
    setErr(null);
    try {
      // mark chosen as primary (trigger will unset others)
      const row = userLocs.find((r) => r.location_id === locationId);
      if (row?.id) {
        const { error } = await supabase.from("user_locations").update({ is_primary: true }).eq("id", row.id);
        if (error) throw error;
      }
      await setActiveLocationId(locationId);

      // refresh local userLocs
      const { data: ul, error: ulErr } = await supabase
        .from("user_locations")
        .select("id,user_id,location_id,is_primary")
        .eq("user_id", user.id);

      if (ulErr) throw ulErr;
      setUserLocs((ul as UserLocationRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to set active location.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="v-chip">
        Location: <strong className="muted">Loading…</strong>
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
        onChange={(e) => setPrimaryAndActive(e.target.value)}
        disabled={saving}
        title="Switch active location"
      >
        <option value="" disabled>
          Select location…
        </option>
        {userLocs
          .slice()
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
          .map((ul) => {
            const l = locMap[ul.location_id];
            const label = l ? l.name : ul.location_id;
            return (
              <option key={ul.location_id} value={ul.location_id}>
                {ul.is_primary ? "★ " : ""}
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
