import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { buildMarketOptionGroups, type MarketStatus } from "../lib/locationMarkets";
import MarketGroupedSelect from "./locations/MarketGroupedSelect";

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_placeholder: boolean;
  market_status: MarketStatus;
  display_priority: number | null;
};

type Status = "online" | "slow" | "offline";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function SystemStatusBar() {
  const { user, role, activeLocationId, setActiveLocationId } = useAuth();

  const [status, setStatus] = useState<Status>("offline");
  const [ms, setMs] = useState<number | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeLocationName = useMemo(() => {
    if (!activeLocationId) return null;
    return locations.find((location) => location.id === activeLocationId)?.name ?? null;
  }, [activeLocationId, locations]);

  const locationGroups = useMemo(
    () =>
      buildMarketOptionGroups(locations, {
        valueOf: (location) => location.id,
        labelOf: (location) => {
          const place = [location.city, location.state].filter(Boolean).join(", ");
          return place ? `${location.name} - ${place}` : location.name;
        },
        includeComingSoon: true,
        disableComingSoon: true,
      }),
    [locations]
  );

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      const t0 = performance.now();
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const t1 = performance.now();
      if (cancelled) return;

      const duration = Math.round(t1 - t0);
      setMs(duration);

      if (error) {
        setStatus("offline");
      } else if (duration > 900) {
        setStatus("slow");
      } else {
        setStatus("online");
      }
    };

    void ping();
    const id = window.setInterval(ping, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      const { data: locationRows, error: locationError } = await supabase
        .from("locations")
        .select("id,name,city,state,is_placeholder,market_status,display_priority")
        .order("display_priority")
        .order("name", { ascending: true });

      if (cancelled) return;
      if (!locationError) setLocations((locationRows as LocationRow[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const saveActiveLocation = async (nextId: string) => {
    if (!user?.id) return;
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      await setActiveLocationId(nextId || null);
      setSaveMessage(nextId ? "Active location updated." : "Active location cleared.");
    } catch (error: unknown) {
      console.error("save active location error:", error);
      setSaveError(getErrorMessage(error, "Failed to save active location."));
    } finally {
      setSaving(false);
    }
  };

  const pillClass =
    status === "online"
      ? "v-pill v-pill-ok"
      : status === "slow"
      ? "v-pill v-pill-warn"
      : "v-pill v-pill-bad";

  return (
    <div className="v-statusbar">
      <div className="v-status-left">
        <span className={pillClass}>
          {status.toUpperCase()}
          {ms !== null ? ` - ${ms}ms` : ""}
        </span>

        <span className="v-pill v-pill-neutral">
          Role: <strong>{role ?? "-"}</strong>
        </span>

        <span className="v-pill v-pill-neutral">
          Location: <strong>{activeLocationName ?? "-"}</strong>
        </span>
        {saveMessage ? <span className="v-pill v-pill-ok">{saveMessage}</span> : null}
        {saveError ? <span className="v-pill v-pill-bad">{saveError}</span> : null}
      </div>

      <div className="v-status-right">
        <MarketGroupedSelect
          label="Active location"
          value={activeLocationId ?? ""}
          onChange={saveActiveLocation}
          groups={locationGroups}
          placeholder="Select active location..."
          disabled={saving || locations.length === 0}
          helperText="Coming-soon markets are visible here but cannot be set as an active operational location."
          style={{ width: 320 }}
          selectStyle={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
