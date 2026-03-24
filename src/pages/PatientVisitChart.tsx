import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

type PatientRow = { id: string };

type VisitRow = {
  id: string;
  created_at: string;
  visit_date: string | null;
  status: string | null;
  summary: string | null;
  location_id: string;
  appointment_id: string | null;
  intake_id: string | null;
  referral_id: string | null;
};

type SoapRow = {
  id: string;
  created_at: string;
  status: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
};

type FileRow = {
  id: string;
  created_at: string;
  filename: string;
  content_type: string | null;
  category: string | null;
  bucket: string;
  path: string;
};

type LabRow = {
  id: string;
  created_at: string;
  lab_name: string | null;
  status: string | null;
  result_summary: string | null;
};

type WoundAssessmentRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  visit_id: string;
  wound_label: string | null;
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
};

type TreatmentPlanRow = {
  id: string;
  created_at: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
  internal_notes: string | null;
  plan: any;
  signed_by: string | null;
  signed_at: string | null;
  is_locked: boolean | null;
};

function badge(s?: string | null) {
  const t = (s || "").toLowerCase();
  const base: React.CSSProperties = {
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,.22)",
    background: "rgba(255,255,255,.08)",
    display: "inline-block",
  };

  if (t === "completed")
    return { ...base, background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.35)" };
  if (t === "active" || t === "open" || t === "in_progress")
    return { ...base, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)" };
  if (t === "pending" || t === "submitted")
    return { ...base, background: "rgba(148,163,184,.18)", border: "1px solid rgba(148,163,184,.35)" };
  if (t === "needs_info")
    return { ...base, background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.35)" };

  return base;
}

function prettyJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

export default function PatientVisitChart() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const [patientId, setPatientId] = useState<string>("");
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<VisitRow | null>(null);

  const [soap, setSoap] = useState<SoapRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [wounds, setWounds] = useState<WoundAssessmentRow[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPatient = async () => {
      setErr(null);
      setLoading(true);

      try {
        if (!user?.id) throw new Error("Not signed in.");

        const { data, error } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (error) throw error;

        const pid = (data as PatientRow | null)?.id;
        if (!pid) throw new Error("No patient profile found. Please complete onboarding.");

        if (cancelled) return;
        setPatientId(pid);

        const { data: v, error: vErr } = await supabase
          .from("patient_visits")
          .select("id,created_at,visit_date,status,summary,location_id,appointment_id,intake_id,referral_id")
          .eq("patient_id", pid)
          .order("created_at", { ascending: false })
          .limit(50);

        if (vErr) throw vErr;

        if (cancelled) return;
        setVisits((v as VisitRow[]) ?? []);
        setSelectedVisit(((v as VisitRow[])?.[0] ?? null) as VisitRow | null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load visit chart.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPatient();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setSoap([]);
      setFiles([]);
      setLabs([]);
      setWounds([]);
      setPlans([]);
      setErr(null);

      if (!selectedVisit?.id || !patientId) return;

      setLoadingDetail(true);

      try {
        const visitId = selectedVisit.id;

        const [soapRes, fileRes, labRes, woundRes, planRes] = await Promise.all([
          supabase
            .from("soap_notes")
            .select("id,created_at,status,subjective,objective,assessment,plan")
            .eq("visit_id", visitId)
            .order("created_at", { ascending: false }),

          supabase
            .from("patient_files")
            .select("id,created_at,filename,content_type,category,bucket,path")
            .eq("visit_id", visitId)
            .order("created_at", { ascending: false }),

          supabase
            .from("patient_labs")
            .select("id,created_at,lab_name,status,result_summary")
            .eq("visit_id", visitId)
            .order("created_at", { ascending: false }),

          supabase
            .from("wound_assessments")
            .select("id,created_at,location_id,patient_id,visit_id,wound_label,body_site,laterality,wound_type")
            .eq("visit_id", visitId)
            .order("created_at", { ascending: false }),

          supabase
            .from("patient_treatment_plans")
            .select("id,created_at,status,summary,patient_instructions,internal_notes,plan,signed_by,signed_at,is_locked")
            .eq("visit_id", visitId)
            .order("created_at", { ascending: false }),
        ]);

        if (soapRes.error) throw soapRes.error;
        if (fileRes.error) throw fileRes.error;
        if (labRes.error) throw labRes.error;
        if (woundRes.error) throw woundRes.error;
        if (planRes.error) throw planRes.error;

        if (cancelled) return;

        setSoap((soapRes.data as SoapRow[]) ?? []);
        setFiles((fileRes.data as FileRow[]) ?? []);
        setLabs((labRes.data as LabRow[]) ?? []);
        setWounds((woundRes.data as WoundAssessmentRow[]) ?? []);
        setPlans((planRes.data as TreatmentPlanRow[]) ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load visit details.");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedVisit?.id, patientId]);

  const visitLabel = useMemo(() => {
    if (!selectedVisit) return "";
    const dt = selectedVisit.visit_date || selectedVisit.created_at;
    return new Date(dt).toLocaleString();
  }, [selectedVisit]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Visit Chart • Timeline • Wounds • Treatment Plans • Notes • Files • Labs"
          secondaryCta={{ label: "Back", to: "/patient" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        {loading && (
          <div className="card card-pad">
            <div className="muted">Loading...</div>
          </div>
        )}

        {!loading && err && (
          <div className="card card-pad">
            <div style={{ color: "crimson" }}>{err}</div>
          </div>
        )}

        {!loading && !err && (
          <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <div className="card card-pad" style={{ flex: "1 1 320px", minWidth: 320 }}>
              <div className="h2">Visits</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Select a visit to view details.
              </div>

              <div className="space" />

              {visits.length === 0 ? (
                <div className="muted">No visits yet.</div>
              ) : (
                visits.map((v) => {
                  const active = selectedVisit?.id === v.id;
                  const dt = v.visit_date || v.created_at;

                  return (
                    <button
                      key={v.id}
                      className={active ? "btn btn-primary" : "btn btn-ghost"}
                      type="button"
                      onClick={() => setSelectedVisit(v)}
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        textAlign: "left",
                      }}
                    >
                      <span>
                        {new Date(dt).toLocaleDateString()}{" "}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <span style={badge(v.status)}>{(v.status || "—").toUpperCase()}</span>
                    </button>
                  );
                })
              )}

              <div className="space" />

              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient")}>
                Back to Patient Portal
              </button>
            </div>

            <div className="card card-pad" style={{ flex: "2 1 560px", minWidth: 320 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="h2">Visit Detail</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {selectedVisit ? (
                      <>
                        {visitLabel} {" • "}{" "}
                        <span style={badge(selectedVisit.status)}>{(selectedVisit.status || "—").toUpperCase()}</span>
                      </>
                    ) : (
                      "Select a visit"
                    )}
                  </div>
                </div>
              </div>

              <div className="space" />

              {loadingDetail && <div className="muted">Loading visit details...</div>}

              {!loadingDetail && selectedVisit && (
                <>
                  {selectedVisit.summary && (
                    <div className="card card-pad" style={{ background: "rgba(255,255,255,0.06)", marginBottom: 12 }}>
                      <div className="h2">Summary</div>
                      <div className="muted" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                        {selectedVisit.summary}
                      </div>
                    </div>
                  )}

                  <div className="card card-pad" style={{ marginBottom: 12 }}>
                    <div className="h2">Wound Assessments</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Basic wound records linked to this visit.
                    </div>

                    <div className="space" />

                    {wounds.length === 0 ? (
                      <div className="muted">No wound assessments for this visit.</div>
                    ) : (
                      wounds.map((w) => (
                        <div
                          key={w.id}
                          className="card card-pad"
                          style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <div style={{ fontWeight: 900 }}>
                              {w.wound_label || "Wound"}{" "}
                              <span className="muted" style={{ fontSize: 12 }}>
                                • {new Date(w.created_at).toLocaleString()}
                              </span>
                            </div>
                            <span style={badge("completed")}>RECORDED</span>
                          </div>

                          <div className="space" />

                          <div className="muted" style={{ fontSize: 13 }}>
                            <strong>Body Site:</strong> {w.body_site || "—"}
                          </div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            <strong>Laterality:</strong> {w.laterality || "—"}
                          </div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            <strong>Wound Type:</strong> {w.wound_type || "—"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="card card-pad" style={{ marginBottom: 12 }}>
                    <div className="h2">Treatment Plans</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Patient instructions + structured plan + signature/lock status.
                    </div>

                    <div className="space" />

                    {plans.length === 0 ? (
                      <div className="muted">No treatment plans for this visit.</div>
                    ) : (
                      plans.map((p) => (
                        <div
                          key={p.id}
                          className="card card-pad"
                          style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div className="muted">
                              <strong style={{ color: "rgba(255,255,255,0.92)" }}>
                                {new Date(p.created_at).toLocaleString()}
                              </strong>
                            </div>

                            <div className="row" style={{ gap: 8, alignItems: "center" }}>
                              <span style={badge(p.status)}>{(p.status || "—").toUpperCase()}</span>
                              {p.is_locked ? (
                                <span style={badge("completed")}>LOCKED</span>
                              ) : (
                                <span style={badge("pending")}>DRAFT</span>
                              )}
                            </div>
                          </div>

                          {p.summary && (
                            <>
                              <div className="space" />
                              <div className="muted" style={{ fontWeight: 800 }}>Summary</div>
                              <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{p.summary}</div>
                            </>
                          )}

                          {p.patient_instructions && (
                            <>
                              <div className="space" />
                              <div className="muted" style={{ fontWeight: 800 }}>Patient Instructions</div>
                              <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                                {p.patient_instructions}
                              </div>
                            </>
                          )}

                          {(p.signed_by || p.signed_at) && (
                            <>
                              <div className="space" />
                              <div className="muted" style={{ fontSize: 12 }}>
                                Signed by: <strong>{p.signed_by || "—"}</strong>
                                {" • "}
                                Signed at: <strong>{p.signed_at ? new Date(p.signed_at).toLocaleString() : "—"}</strong>
                              </div>
                            </>
                          )}

                          {p.plan && (
                            <>
                              <div className="space" />
                              <details>
                                <summary className="muted" style={{ cursor: "pointer", fontWeight: 800 }}>
                                  Structured Plan (JSON)
                                </summary>
                                <pre
                                  style={{
                                    marginTop: 10,
                                    padding: 12,
                                    borderRadius: 12,
                                    background: "rgba(0,0,0,0.25)",
                                    overflowX: "auto",
                                    fontSize: 12,
                                  }}
                                >
                                  {prettyJson(p.plan)}
                                </pre>
                              </details>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="card card-pad" style={{ marginBottom: 12 }}>
                    <div className="h2">SOAP Notes</div>
                    <div className="space" />

                    {soap.length === 0 ? (
                      <div className="muted">No SOAP notes yet.</div>
                    ) : (
                      soap.map((n) => (
                        <div
                          key={n.id}
                          className="card card-pad"
                          style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                            <div className="muted">{new Date(n.created_at).toLocaleString()}</div>
                            <span style={badge(n.status)}>{(n.status || "—").toUpperCase()}</span>
                          </div>
                          <div className="space" />
                          {n.subjective && (
                            <>
                              <div className="muted" style={{ fontWeight: 800 }}>Subjective</div>
                              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{n.subjective}</div>
                              <div className="space" />
                            </>
                          )}
                          {n.objective && (
                            <>
                              <div className="muted" style={{ fontWeight: 800 }}>Objective</div>
                              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{n.objective}</div>
                              <div className="space" />
                            </>
                          )}
                          {n.assessment && (
                            <>
                              <div className="muted" style={{ fontWeight: 800 }}>Assessment</div>
                              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{n.assessment}</div>
                              <div className="space" />
                            </>
                          )}
                          {n.plan && (
                            <>
                              <div className="muted" style={{ fontWeight: 800 }}>Plan</div>
                              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{n.plan}</div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="card card-pad" style={{ marginBottom: 12 }}>
                    <div className="h2">Files</div>
                    <div className="space" />

                    {files.length === 0 ? (
                      <div className="muted">No files attached to this visit.</div>
                    ) : (
                      files.map((f) => (
                        <div
                          key={f.id}
                          className="row"
                          style={{
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "8px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800 }}>{f.filename}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {f.category || "file"} {" • "} {new Date(f.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {f.content_type || ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="card card-pad">
                    <div className="h2">Labs</div>
                    <div className="space" />

                    {labs.length === 0 ? (
                      <div className="muted">No labs attached to this visit.</div>
                    ) : (
                      labs.map((l) => (
                        <div
                          key={l.id}
                          className="card card-pad"
                          style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <div style={{ fontWeight: 800 }}>{l.lab_name || "Lab"}</div>
                            <span style={badge(l.status)}>{(l.status || "—").toUpperCase()}</span>
                          </div>
                          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                            {new Date(l.created_at).toLocaleString()}
                          </div>
                          {l.result_summary && (
                            <div className="muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                              {l.result_summary}
                            </div>
                          )}
                        </div>
                      ))
                    )}
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
