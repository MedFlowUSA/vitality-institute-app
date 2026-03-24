// src/pages/ProviderPatients.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type LocationRow = { id: string; name: string };
type MembershipRow = {
  patient_id: string;
  created_at: string | null;
  location_id: string;
};

type PatientRow = {
  id: string; // patient uuid
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

export default function ProviderPatients() {
  const { user, role, signOut, activeLocationId } = useAuth();
  const nav = useNavigate();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [q, setQ] = useState("");

  const [loadingBase, setLoadingBase] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = useMemo(() => role === "super_admin" || role === "location_admin", [role]);

  const fullName = (p: PatientRow) => {
    const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    return n || "Patient";
  };

  const loadLocations = async () => {
    const { data, error } = await supabase.from("locations").select("id,name").order("name");
    if (error) throw new Error(error.message);
    setLocations((data as LocationRow[]) ?? []);
  };

  const loadAllowed = async () => {
    if (!user) return;

    if (isAdmin) {
      setAllowedLocationIds([]);
      return;
    }

    const { data, error } = await supabase.from("user_locations").select("location_id").eq("user_id", user.id);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((r: any) => r.location_id).filter(Boolean);
    setAllowedLocationIds(ids);

    // if exactly one location, lock selection to it
    if (ids.length === 1) setLocationId(ids[0]);
  };

  const loadPatients = async () => {
    setErr(null);
    setLoading(true);

    try {
      // 1) Read scoped memberships from the view
      let query = supabase
        .from("v_patient_location_memberships")
        .select("patient_id, created_at, location_id")
        .order("created_at", { ascending: false })
        .limit(250);

      if (activeLocationId) {
        query = query.eq("location_id", activeLocationId);
      } else if (isAdmin) {
        if (locationId) query = query.eq("location_id", locationId);
      } else {
        if (allowedLocationIds.length === 0) {
          setPatients([]);
          return;
        }
        query = query.in("location_id", allowedLocationIds);
        if (locationId) query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const membershipRows = (data as MembershipRow[]) ?? [];

      // De-dupe memberships by patient_id while preserving newest-first ordering.
      const membershipByPatient = new Map<string, MembershipRow>();
      for (const r of membershipRows) {
        const pid = r.patient_id;
        if (!pid) continue;
        if (!membershipByPatient.has(pid)) membershipByPatient.set(pid, r);
      }

      const patientIds = Array.from(membershipByPatient.keys());
      if (patientIds.length === 0) {
        setPatients([]);
        return;
      }

      // 2) Fetch patient demographics from patients table (source of first/last/phone).
      let pQuery = supabase.from("patients").select("id,first_name,last_name,phone").in("id", patientIds);
      if (q.trim()) {
        const t = q.trim();
        pQuery = pQuery.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,phone.ilike.%${t}%`);
      }

      const { data: patientData, error: patientErr } = await pQuery;
      if (patientErr) throw patientErr;

      const patientRows = (patientData ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
      }>;

      const out: PatientRow[] = [];
      for (const p of patientRows) {
        const m = membershipByPatient.get(p.id);
        out.push({
          id: p.id,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          phone: p.phone ?? null,
          created_at: m?.created_at ?? new Date().toISOString(),
        });
      }
      out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setPatients(out);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load patients.");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoadingBase(true);
      try {
        await loadLocations();
        await loadAllowed();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load base data.");
      } finally {
        setLoadingBase(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (activeLocationId) setLocationId(activeLocationId);
  }, [activeLocationId]);

  // Load directory once base is ready + when location access changes (keeps it feeling “alive”)
  useEffect(() => {
    if (loadingBase) return;
    if (!isAdmin && allowedLocationIds.length === 0) return;
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBase, locationId, allowedLocationIds.join(","), isAdmin, activeLocationId]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Patients"
          subtitle="Search patients • open patient center • manage visits/files/notes"
          secondaryCta={{ label: "Back", to: "/provider" }}
          primaryCta={{ label: "AI Plan Builder", to: "/provider/ai" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={true}
        />

        <div className="space" />

        {/* Quick actions */}
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="h1">Patient Directory</div>
              <div className="muted">Filter by location + search by name/phone.</div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="button" onClick={() => nav("/provider/intakes")}>
                Intakes
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/labs")}>
                Labs
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/queue")}>
                Queue
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Location
              </div>
              <select
                className="input"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={!isAdmin && allowedLocationIds.length <= 1}
                title={!isAdmin && allowedLocationIds.length <= 1 ? "You’re assigned to one location." : ""}
                style={{ width: "100%" }}
              >
                <option value="">{isAdmin ? "All Locations" : "My Locations"}</option>
                {locations
                  .filter((l) => (isAdmin ? true : allowedLocationIds.includes(l.id)))
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Search
              </div>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search first/last name or phone…"
                style={{ width: "100%" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadPatients();
                }}
              />
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <button className="btn btn-primary" type="button" onClick={loadPatients} disabled={loading}>
                {loading ? "Searching…" : "Search"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => { setQ(""); loadPatients(); }} disabled={loading}>
                Clear
              </button>
            </div>
          </div>

          <div className="space" />

          {loadingBase && <div className="muted">Loading…</div>}
          {!loadingBase && err && <div style={{ color: "crimson" }}>{err}</div>}

          {!loadingBase && !err && (
            <div>
              {loading ? (
                <div className="muted">Loading patients…</div>
              ) : patients.length === 0 ? (
                <div className="muted">No patients found.</div>
              ) : (
                patients.map((p) => (
                  <div key={p.id} className="card card-pad" style={{ marginBottom: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div className="h2">{fullName(p)}</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                          {p.phone ? p.phone : "—"}
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Patient ID: {p.id}
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {/* ✅ FIXED ROUTE: matches App.tsx /provider/patients/:patientId */}
                        <button className="btn btn-primary" type="button" onClick={() => nav(`/provider/patients/${p.id}`)}>
                          Open Patient
                        </button>

                        <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/visit-builder/${p.id}`)}>
                          New Visit
                        </button>

                        <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/intakes`)}>
                          Intake
                        </button>

                        <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/labs`)}>
                          Labs
                        </button>

                        <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/chat`)}>
                          Messages
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space" />
      </div>
    </div>
  );
}
