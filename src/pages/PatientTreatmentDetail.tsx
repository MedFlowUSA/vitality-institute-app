// src/pages/PatientTreatmentDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getPatientRecordIdForProfile } from "../lib/patientRecords";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type LocationRow = { id: string; name: string; city: string | null; state: string | null };

type VisitRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  appointment_id: string | null;
  visit_date: string | null;
  status: string | null;
  summary: string | null;
};

type SoapRow = {
  id: string;
  created_at: string;
  visit_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_locked: boolean | null;
  signed_at: string | null;
};

type VisitNoteRow = {
  id: string;
  created_at: string;
  visit_id: string;
  author_id: string | null;
  note: string | null;
};

type PatientFileRow = {
  id: string;
  created_at: string;
  visit_id: string | null;
  file_id: string | null;
  status: string | null;
  notes: string | null;
};

export default function PatientTreatmentDetail() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const { visitId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [soap, setSoap] = useState<SoapRow | null>(null);
  const [notes, setNotes] = useState<VisitNoteRow[]>([]);
  const [files, setFiles] = useState<PatientFileRow[]>([]);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, `${l.name}${l.city ? ` - ${l.city}` : ""}`]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
  };

  const load = async () => {
    if (!user?.id) return;
    if (!visitId) return;

    setLoading(true);
    setErr(null);

    try {
      const patientId = await getPatientRecordIdForProfile(user.id);
      if (!patientId) throw new Error("Patient record not found.");

      // Locations for labels
      const locRes = await supabase.from("locations").select("id,name,city,state").order("name");
      if (locRes.error) throw new Error(locRes.error.message);
      setLocations((locRes.data as LocationRow[]) ?? []);

      // Visit (must belong to this patient)
      const vRes = await supabase
        .from("patient_visits")
        .select("id,created_at,location_id,patient_id,appointment_id,visit_date,status,summary")
        .eq("id", visitId)
        .eq("patient_id", patientId)
        .maybeSingle();

      if (vRes.error) throw new Error(vRes.error.message);
      if (!vRes.data) {
        setVisit(null);
        throw new Error("Visit not found (or you do not have access).");
      }
      setVisit(vRes.data as VisitRow);

      // SOAP note (if exists)
      const soapRes = await supabase
        .from("patient_soap_notes")
        .select("id,created_at,visit_id,subjective,objective,assessment,plan,is_locked,signed_at")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (soapRes.error) throw new Error(soapRes.error.message);
      setSoap((soapRes.data as SoapRow) ?? null);

      // Visit notes (if any)
      const noteRes = await supabase
        .from("patient_visit_notes")
        .select("id,created_at,visit_id,author_id,note")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (noteRes.error) throw new Error(noteRes.error.message);
      setNotes((noteRes.data as VisitNoteRow[]) ?? []);

      // Patient files tied to this visit (metadata only)
      const fileRes = await supabase
        .from("patient_files")
        .select("id,created_at,visit_id,file_id,status,notes")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (fileRes.error) throw new Error(fileRes.error.message);
      setFiles((fileRes.data as PatientFileRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load visit details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, visitId]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Treatment Details"
          subtitle="Visit Summary | SOAP | Notes | Files"
          primaryCta={{ label: "Back to Treatments", onClick: () => nav("/patient/treatments") }}
          secondaryCta={{ label: "Home", to: "/patient/home" }}
          rightActions={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient/labs")}>
                Labs
              </button>
              <button className="btn btn-ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </>
          }
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h1">Visit</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Visit ID: {visitId}
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => nav("/patient/treatments")}>
                Back
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && !err && !visit && <div className="muted">Visit not found.</div>}

          {!loading && !err && visit && (
            <>
              <div className="card card-pad" style={{ marginBottom: 12 }}>
                <div className="h2">{fmt(visit.visit_date ?? visit.created_at)}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Location: {locName(visit.location_id)}
                </div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Status: <strong>{visit.status ?? "-"}</strong>
                </div>
                {visit.summary && (
                  <div className="muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                    {visit.summary}
                  </div>
                )}
              </div>

              <div className="card card-pad" style={{ marginBottom: 12 }}>
                <div className="h2">SOAP</div>
                {soap ? (
                  <>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Created: {fmt(soap.created_at)}
                      {" | "}
                      Locked: <strong>{soap.is_locked ? "Yes" : "No"}</strong>
                      {" | "}
                      Signed: <strong>{soap.signed_at ? "Yes" : "No"}</strong>
                    </div>

                    <div className="space" />
                    <div className="card card-pad">
                      <div className="h2">Subjective</div>
                      <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {soap.subjective ?? "-"}
                      </div>
                    </div>

                    <div className="space" />
                    <div className="card card-pad">
                      <div className="h2">Objective</div>
                      <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {soap.objective ?? "-"}
                      </div>
                    </div>

                    <div className="space" />
                    <div className="card card-pad">
                      <div className="h2">Assessment</div>
                      <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {soap.assessment ?? "-"}
                      </div>
                    </div>

                    <div className="space" />
                    <div className="card card-pad">
                      <div className="h2">Plan</div>
                      <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {soap.plan ?? "-"}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="muted" style={{ marginTop: 6 }}>
                    No SOAP note found for this visit yet.
                  </div>
                )}
              </div>

              <div className="card card-pad" style={{ marginBottom: 12 }}>
                <div className="h2">Visit Notes</div>
                {notes.length === 0 ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    No notes yet.
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {notes.map((n) => (
                      <div key={n.id} className="card card-pad" style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {fmt(n.created_at)}
                        </div>
                        <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                          {n.note ?? "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card card-pad">
                <div className="h2">Files</div>
                {files.length === 0 ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    No files attached to this visit yet.
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {files.map((f) => (
                      <div key={f.id} className="card card-pad" style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {fmt(f.created_at)} | Status: <strong>{f.status ?? "-"}</strong>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          File ID: {f.file_id ?? "-"}
                        </div>
                        {f.notes && (
                          <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                            {f.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
