// src/pages/ProviderPatients.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import { getErrorMessage, isProviderAccountLinkingError } from "../lib/patientRecords";
import { supabase } from "../lib/supabase";

type LocationRow = { id: string; name: string };
type MembershipRow = {
  patient_id: string;
  created_at: string | null;
  location_id: string;
};

type PatientRow = {
  id: string;
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
  const visibleLocations = useMemo(
    () => locations.filter((location) => (isAdmin ? true : allowedLocationIds.includes(location.id))),
    [allowedLocationIds, isAdmin, locations],
  );

  const fullName = (patient: PatientRow) => {
    const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
    return name || "Patient";
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

    const ids = (data ?? []).map((row: { location_id?: string | null }) => row.location_id).filter(Boolean) as string[];
    setAllowedLocationIds(ids);

    if (ids.length === 1) setLocationId(ids[0]);
  };

  const loadPatients = async () => {
    setErr(null);
    setLoading(true);

    try {
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
      const membershipByPatient = new Map<string, MembershipRow>();
      for (const row of membershipRows) {
        if (!row.patient_id) continue;
        if (!membershipByPatient.has(row.patient_id)) membershipByPatient.set(row.patient_id, row);
      }

      const patientIds = Array.from(membershipByPatient.keys());
      if (patientIds.length === 0) {
        setPatients([]);
        return;
      }

      let patientQuery = supabase.from("patients").select("id,first_name,last_name,phone").in("id", patientIds);
      if (q.trim()) {
        const term = q.trim();
        patientQuery = patientQuery.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);
      }

      const { data: patientData, error: patientErr } = await patientQuery;
      if (patientErr) throw patientErr;

      const patientRows = (patientData ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
      }>;

      const nextPatients: PatientRow[] = patientRows.map((patient) => ({
        id: patient.id,
        first_name: patient.first_name ?? null,
        last_name: patient.last_name ?? null,
        phone: patient.phone ?? null,
        created_at: membershipByPatient.get(patient.id)?.created_at ?? new Date().toISOString(),
      }));

      nextPatients.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setPatients(nextPatients);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load patients."));
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
      } catch (error: unknown) {
        setErr(getErrorMessage(error, "Failed to load base data."));
      } finally {
        setLoadingBase(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (activeLocationId) setLocationId(activeLocationId);
  }, [activeLocationId]);

  useEffect(() => {
    if (loadingBase) return;
    if (!isAdmin && allowedLocationIds.length === 0) return;
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBase, locationId, allowedLocationIds.join(","), isAdmin, activeLocationId]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Patients"
          subtitle="Search patients, open the patient center, and manage visits, files, and notes."
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

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 280px", minWidth: 240 }}>
              <div className="h1">Patient Directory</div>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Filter by location, search by name or phone, and jump into the next patient quickly.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
                gap: 8,
                flex: "1 1 360px",
                minWidth: 260,
              }}
            >
              <button className="btn btn-primary" type="button" onClick={() => nav("/provider/intakes")} style={{ width: "100%" }}>
                Intakes
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/labs")} style={{ width: "100%" }}>
                Labs
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/chat")} style={{ width: "100%" }}>
                Messages
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/queue")} style={{ width: "100%" }}>
                Queue
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Location
              </div>
              <select
                className="input"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                disabled={!isAdmin && allowedLocationIds.length <= 1}
                title={!isAdmin && allowedLocationIds.length <= 1 ? "You're assigned to one location." : ""}
                style={{ width: "100%" }}
              >
                <option value="">{isAdmin ? "All Locations" : "My Locations"}</option>
                {visibleLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "2 1 320px", minWidth: 240 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Search
              </div>
              <input
                className="input"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search first name, last name, or phone..."
                style={{ width: "100%" }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadPatients();
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 8,
                flex: "1 1 220px",
                minWidth: 220,
              }}
            >
              <button className="btn btn-primary" type="button" onClick={() => void loadPatients()} disabled={loading} style={{ width: "100%" }}>
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setQ("");
                  void loadPatients();
                }}
                disabled={loading}
                style={{ width: "100%" }}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space" />

          {loadingBase && <div className="muted">Loading...</div>}
          {!loadingBase && err && (
            <div
              style={
                isProviderAccountLinkingError(err)
                  ? {
                      padding: "14px 16px",
                      borderRadius: 16,
                      background: "rgba(245, 158, 11, 0.10)",
                      border: "1px solid rgba(245, 158, 11, 0.22)",
                      color: "#8A5A00",
                      lineHeight: 1.6,
                      maxWidth: 760,
                    }
                  : { color: "crimson" }
              }
            >
              {err}
            </div>
          )}

          {!loadingBase && !err && (
            <div>
              <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  {loading ? "Refreshing patient list..." : `${patients.length} patient${patients.length === 1 ? "" : "s"} in view`}
                </div>
                {activeLocationId ? (
                  <div className="v-chip">
                    Active location: <strong>{visibleLocations.find((location) => location.id === activeLocationId)?.name ?? activeLocationId}</strong>
                  </div>
                ) : null}
              </div>

              {loading ? (
                <div className="muted">Loading patients...</div>
              ) : patients.length === 0 ? (
                <div className="muted">No patients found.</div>
              ) : (
                patients.map((patient) => (
                  <div
                    key={patient.id}
                    className="card card-pad card-light surface-light"
                    style={{
                      marginBottom: 12,
                      background: "rgba(250,247,255,0.82)",
                      border: "1px solid rgba(184,164,255,0.18)",
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                        <div className="h2">{fullName(patient)}</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                          {patient.phone ? patient.phone : "No phone on file"}
                        </div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <div className="v-chip">New patient chart</div>
                          <div className="v-chip">active</div>
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 12, wordBreak: "break-word" }}>
                          Patient ID: {patient.id}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
                          gap: 8,
                          flex: "1 1 320px",
                          minWidth: 220,
                        }}
                      >
                        <button className="btn btn-primary" type="button" onClick={() => nav(`/provider/patients/${patient.id}`)} style={{ width: "100%" }}>
                          Open Patient
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => nav(`/provider/visit-builder/${patient.id}`)} style={{ width: "100%" }}>
                          New Visit
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/intakes")} style={{ width: "100%" }}>
                          Intake
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/labs")} style={{ width: "100%" }}>
                          Labs
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/chat")} style={{ width: "100%" }}>
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
