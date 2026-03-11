import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type LocationRow = { id: string; name: string };

type Status = "online" | "slow" | "offline";

export default function SystemStatusBar() {
  const { user, role, activeLocationId, setActiveLocationId } = useAuth();

  const [status, setStatus] = useState<Status>("offline");
  const [ms, setMs] = useState<number | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [saving, setSaving] = useState(false);

  const activeLocationName = useMemo(() => {
    if (!activeLocationId) return null;
    return locations.find((l) => l.id === activeLocationId)?.name ?? null;
  }, [activeLocationId, locations]);

  // Ping (visual feedback)
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      const t0 = performance.now();
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const t1 = performance.now();
      if (cancelled) return;

      const dur = Math.round(t1 - t0);
      setMs(dur);

      if (error) {
        setStatus("offline");
      } else if (dur > 900) {
        setStatus("slow");
      } else {
        setStatus("online");
      }
    };

    ping();
    const id = window.setInterval(ping, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Load locations + active location
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      // Load locations list (expects a public.locations table)
      const { data: locs, error: lErr } = await supabase
        .from("locations")
        .select("id,name")
        .order("name", { ascending: true });

      if (cancelled) return;

      if (!lErr) setLocations((locs as LocationRow[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, activeLocationId, setActiveLocationId]);

  const saveActiveLocation = async (nextId: string) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await setActiveLocationId(nextId || null);
    } catch (e: any) {
      console.error("save active location error:", e);
      alert(e?.message ?? "Failed to save active location.");
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
          {ms !== null ? ` • ${ms}ms` : ""}
        </span>

        <span className="v-pill v-pill-neutral">
          Role: <strong>{role ?? "—"}</strong>
        </span>

        <span className="v-pill v-pill-neutral">
          Location: <strong>{activeLocationName ?? "—"}</strong>
        </span>
      </div>

      <div className="v-status-right">
        <select
          className="input"
          style={{ width: 260 }}
          value={activeLocationId ?? ""}
          onChange={(e) => saveActiveLocation(e.target.value)}
          disabled={saving || locations.length === 0}
        >
          <option value="" disabled>
            Select active location…
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
