import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

type IntakeRow = {
  id: string;
  patient_id: string;
  location_id: string;
  service_type: string;
  status: string;
  wound_data: any;
  medications: string | null;
  consent_accepted: boolean | null;
  consent_signed_name: string | null;
  consent_signed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

type PatientMini = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

type VisitRow = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_date: string;
  status: string | null;
  summary: string | null;
  intake_id: string | null;
  created_at: string;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function ProviderIntakeQueue() {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [patientMap, setPatientMap] = useState<Record<string, PatientMini>>({});
  const [selectedId, setSelectedId] = useState<string>("");

  const [busyId, setBusyId] = useState<string | null>(null);

  const selected = useMemo(
    () => intakes.find((x) => x.id === selectedId) ?? null,
    [intakes, selectedId]
  );

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      // Soft-launch: show submitted + needs_info. You can tighten later.
      const { data, error } = await supabase
        .from("patient_intakes")
        .select("*")
        .in("status", ["submitted", "needs_info"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (data as IntakeRow[]) ?? [];
      setIntakes(rows);

      const patientIds = Array.from(new Set(rows.map((r) => r.patient_id))).filter(Boolean);
      if (patientIds.length) {
        // If your patients table has different columns, tell me and I’ll adjust
        const { data: pats, error: pErr } = await supabase
          .from("patients")
          .select("id,first_name,last_name,email,phone")
          .in("id", patientIds);

        if (pErr) {
          // Don't hard-fail queue if patients mini fails.
          console.warn("patients mini load error:", pErr);
        } else {
          const next: Record<string, PatientMini> = {};
          for (const p of (pats as PatientMini[]) ?? []) next[p.id] = p;
          setPatientMap(next);
        }
      }

      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load intakes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patientLabel = (patientId: string) => {
    const p = patientMap[patientId];
    if (!p) return patientId.slice(0, 8);
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    if (name) return name;
    if (p.phone) return p.phone;
    if (p.email) return p.email;
    return patientId.slice(0, 8);
  };

  const approveCreateVisit = async (intake: IntakeRow) => {
    if (!user?.id) return setErr("You must be signed in.");
    if (!intake?.id) return;
    if (!intake.location_id) return setErr("Intake missing location_id.");
    if (!intake.patient_id) return setErr("Intake missing patient_id.");

    setBusyId(intake.id);
    setErr(null);

    try {
      // 1) create visit linked to intake_id
      const { data: visit, error: vErr } = await supabase
        .from("patient_visits")
        .insert([
          {
            patient_id: intake.patient_id,
            location_id: intake.location_id,
            visit_date: new Date().toISOString(),
            status: "open",
            summary: intake.service_type === "wound_care" ? "Wound care intake — new visit" : "Intake — new visit",
            intake_id: intake.id,
          },
        ])
        .select("id,patient_id,location_id,visit_date,status,summary,intake_id,created_at")
        .single();

      if (vErr) throw vErr;

      // 2) mark intake reviewed + approved + optionally lock it
      const { error: iErr } = await supabase
        .from("patient_intakes")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          locked_at: new Date().toISOString(),
        })
        .eq("id", intake.id);

      if (iErr) throw iErr;

      // refresh
      await load();

      alert(`Visit created: ${(visit as VisitRow).id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to approve and create visit.");
    } finally {
      setBusyId(null);
    }
  };

  const requestMoreInfo = async (intake: IntakeRow) => {
    if (!user?.id) return setErr("You must be signed in.");
    setBusyId(intake.id);
    setErr(null);
    try {
      const { error } = await supabase
        .from("patient_intakes")
        .update({
          status: "needs_info",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", intake.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to set needs_info.");
    } finally {
      setBusyId(null);
    }
  };

  const extractUploads = (wd: any) => {
    const arr = wd?.uploads;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((u: any) => ({
        filename: String(u?.filename ?? ""),
        category: String(u?.category ?? ""),
        bucket: String(u?.bucket ?? ""),
        path: String(u?.path ?? ""),
      }))
      .filter((x: any) => x.filename && x.bucket && x.path);
  };

  const isStaff = role && role !== "patient";

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Intake Queue"
          subtitle="Review wound intakes • approve to create a visit"
          secondaryCta={{ label: "Back", to: "/provider" }}
          rightActions={
            <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
              Refresh
            </button>
          }
          showKpis={true}
        />

        <div className="space" />

        {!isStaff ? (
          <div className="card card-pad">
            <div className="h2">Not authorized</div>
            <div className="muted" style={{ marginTop: 6 }}>
              This page is for staff roles only.
            </div>
          </div>
        ) : loading ? (
          <div className="card card-pad">
            <div className="muted">Loading intake queue…</div>
          </div>
        ) : err ? (
          <div className="card card-pad">
            <div className="h2">Queue Error</div>
            <div className="space" />
            <div style={{ color: "crimson" }}>{err}</div>
            <div className="space" />
            <button className="btn btn-ghost" type="button" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* LEFT: list */}
            <div className="card card-pad" style={{ flex: "1 1 360px", minWidth: 320 }}>
              <div className="h2">Intakes</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Showing: submitted / needs_info
              </div>

              <div className="space" />

              {intakes.length === 0 ? (
                <div className="muted">No intakes in queue.</div>
              ) : (
                intakes.map((i) => {
                  const active = i.id === selectedId;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className={active ? "btn btn-primary" : "btn btn-ghost"}
                      style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left" }}
                      onClick={() => setSelectedId(i.id)}
                    >
                      <span>
                        <div style={{ fontWeight: 750 }}>{patientLabel(i.patient_id)}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                          {i.service_type} • {i.status} • {fmt(i.created_at)}
                        </div>
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        Open
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* RIGHT: detail */}
            <div className="card card-pad" style={{ flex: "2 1 640px", minWidth: 340 }}>
              {!selected ? (
                <div className="muted">Select an intake.</div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div className="h2">Intake Detail</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        Patient: <strong>{patientLabel(selected.patient_id)}</strong>
                      </div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        Service: {selected.service_type} • Status: {selected.status} • Submitted: {fmt(selected.created_at)}
                      </div>
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => requestMoreInfo(selected)}
                        title="Marks intake as needs_info"
                      >
                        {busyId === selected.id ? "Working…" : "Needs Info"}
                      </button>

                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => approveCreateVisit(selected)}
                        title="Creates a new visit and locks this intake"
                      >
                        {busyId === selected.id ? "Approving…" : "Approve → Create Visit"}
                      </button>
                    </div>
                  </div>

                  <div className="hr-soft" />

                  <div className="card card-pad">
                    <div className="h2">Wound Data</div>
                    <div className="space" />

                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <div className="v-chip">
                        Location: <strong>{selected.wound_data?.wound_location ?? "—"}</strong>
                      </div>
                      <div className="v-chip">
                        Duration: <strong>{selected.wound_data?.wound_duration ?? "—"}</strong>
                      </div>
                      <div className="v-chip">
                        Pain: <strong>{String(selected.wound_data?.pain_level ?? "—")}</strong>
                      </div>
                      <div className="v-chip">
                        Diabetes: <strong>{String(selected.wound_data?.has_diabetes ?? "—")}</strong>
                      </div>
                      <div className="v-chip">
                        Smokes: <strong>{String(selected.wound_data?.smokes ?? "—")}</strong>
                      </div>
                    </div>

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Cause
                    </div>
                    <div style={{ marginTop: 6 }}>{selected.wound_data?.wound_cause || "—"}</div>

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Prior treatments
                    </div>
                    <div style={{ marginTop: 6 }}>{selected.wound_data?.prior_treatments || "—"}</div>

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Current dressing / care
                    </div>
                    <div style={{ marginTop: 6 }}>{selected.wound_data?.current_dressing || "—"}</div>

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Medications
                    </div>
                    <div style={{ marginTop: 6 }}>{selected.medications || "—"}</div>

                    <div className="space" />

                    <div className="h2">Uploads</div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      These come from wound_data.uploads (and should also be in patient_files if you applied the upload fix).
                    </div>

                    <div className="space" />

                    {extractUploads(selected.wound_data).length === 0 ? (
                      <div className="muted">No uploads found.</div>
                    ) : (
                      <ul className="muted" style={{ paddingLeft: 16 }}>
                        {extractUploads(selected.wound_data).map((u: any, idx: number) => (
                          <li key={`${u.path}-${idx}`} style={{ marginBottom: 6 }}>
                            <strong>{u.category}</strong>: {u.filename}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Consent
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Accepted: <strong>{selected.consent_accepted ? "Yes" : "No"}</strong>
                      {" • "}
                      Signed name: <strong>{selected.consent_signed_name ?? "—"}</strong>
                      {" • "}
                      Signed at: <strong>{fmt(selected.consent_signed_at)}</strong>
                    </div>

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Review
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Reviewed at: <strong>{fmt(selected.reviewed_at)}</strong>
                      {" • "}
                      Locked at: <strong>{fmt(selected.locked_at)}</strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
