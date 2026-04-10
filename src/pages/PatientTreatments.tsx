// src/pages/PatientTreatments.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getErrorMessage, getPatientRecordIdForProfile } from "../lib/patientRecords";
import { supabase } from "../lib/supabase";
import { getSignedUrl } from "../lib/patientFiles";
import VitalityHero from "../components/VitalityHero";
import { normalizePublicPriceLabel } from "../lib/services/catalog";

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

type LocationRow = { id: string; name: string };

type VisitNoteRow = {
  id: string;
  visit_id: string;
  created_at: string;
  author_id: string | null;
  note: string;
};

type SoapRow = {
  id: string;
  visit_id: string;
  created_at: string;
  is_locked: boolean | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  signed_at: string | null;
};

type AppointmentLiteRow = {
  id: string;
  service_id: string | null;
};

type ServicePricingRow = {
  id: string;
  name: string;
  price_marketing_cents: number | null;
  price_regular_cents: number | null;
};

type TreatmentPlanRow = {
  id: string;
  visit_id: string;
  created_at: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
  plan: unknown;
};

type PatientFileRow = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  appointment_id: string | null;
  created_at: string;
  filename: string;
  category: string | null;
  bucket: string;
  path: string;
  content_type: string | null;
};

type VisitFileMap = Record<string, PatientFileRow[]>;
type FileUrlMap = Record<string, string>;
type QueryError = { message?: string | null };
type QueryArrayResult<T> = { data?: T[] | null; error?: QueryError | null };

function getRows<T>(result: unknown): T[] {
  if (typeof result !== "object" || result === null) return [];
  const queryResult = result as QueryArrayResult<T>;
  const errorMessage = queryResult.error?.message;
  if (errorMessage) throw new Error(errorMessage);
  return queryResult.data ?? [];
}

function fmt(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function fmtDateOnly(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
}

function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function visitStatusLabel(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "open" || s === "in_progress") return "Active";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  return status || "Unknown";
}

function visitStatusStyle(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  const base = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
  } as const;

  if (s === "open" || s === "in_progress") {
    return {
      ...base,
      background: "rgba(59,130,246,.18)",
      border: "1px solid rgba(59,130,246,.35)",
    };
  }

  if (s === "completed") {
    return {
      ...base,
      background: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.35)",
    };
  }

  if (s === "cancelled") {
    return {
      ...base,
      background: "rgba(239,68,68,.18)",
      border: "1px solid rgba(239,68,68,.35)",
    };
  }

  return base;
}

function patientFriendlyPlan(plan?: string | null) {
  if (!plan?.trim()) return "Your care team has not added follow-up treatment instructions yet.";
  return plan;
}

function isImageFile(file?: { filename?: string | null; content_type?: string | null }) {
  const ct = file?.content_type ?? "";
  const name = file?.filename ?? "";
  return ct.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
}

export default function PatientTreatments() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [activeVisitId, setActiveVisitId] = useState<string>("");

  const [notesByVisit, setNotesByVisit] = useState<Record<string, VisitNoteRow[]>>({});
  const [soapByVisit, setSoapByVisit] = useState<Record<string, SoapRow | null>>({});
  const [appointmentsById, setAppointmentsById] = useState<Record<string, AppointmentLiteRow>>({});
  const [servicesById, setServicesById] = useState<Record<string, ServicePricingRow>>({});
  const [treatmentPlanByVisit, setTreatmentPlanByVisit] = useState<Record<string, TreatmentPlanRow | null>>({});
  const [filesByVisit, setFilesByVisit] = useState<VisitFileMap>({});
  const [fileUrls, setFileUrls] = useState<FileUrlMap>({});

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const activeVisit = useMemo(
    () => visits.find((v) => v.id === activeVisitId) ?? null,
    [visits, activeVisitId]
  );

  const activeAppointment = activeVisit?.appointment_id
    ? appointmentsById[activeVisit.appointment_id] ?? null
    : null;

  const activeService = activeAppointment?.service_id
    ? servicesById[activeAppointment.service_id] ?? null
    : null;

  const activeServicePrice = activeService
    ? normalizePublicPriceLabel(
        activeService.price_marketing_cents != null
          ? `$${(Number(activeService.price_marketing_cents) / 100).toFixed(2)}`
          : activeService.price_regular_cents != null
          ? `$${(Number(activeService.price_regular_cents) / 100).toFixed(2)}`
          : null
      )
    : null;

  const activeTreatmentPlan = activeVisit ? treatmentPlanByVisit[activeVisit.id] ?? null : null;

  const currentCareVisits = useMemo(() => {
    return visits.filter((v) => {
      const s = (v.status ?? "").toLowerCase();
      return s === "open" || s === "in_progress";
    });
  }, [visits]);

  const pastVisits = useMemo(() => {
    return visits.filter((v) => {
      const s = (v.status ?? "").toLowerCase();
      return s !== "open" && s !== "in_progress";
    });
  }, [visits]);

  const loadAll = useCallback(async () => {
    setErr(null);
    setLoading(true);

    try {
      if (!user?.id) throw new Error("Not signed in.");
      const patientId = await getPatientRecordIdForProfile(user.id);
      if (!patientId) throw new Error("Patient record not found.");

      const locRes = await withTimeout(
        supabase.from("locations").select("id,name").order("name"),
        12000
      );
      setLocations(getRows<LocationRow>(locRes));

      const vRes = await withTimeout(
        supabase
          .from("patient_visits")
          .select("id,created_at,location_id,patient_id,appointment_id,visit_date,status,summary")
          .eq("patient_id", patientId)
          .order("visit_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        12000
      );
      const vList = getRows<VisitRow>(vRes);
      setVisits(vList);

      const firstId = vList[0]?.id ?? "";
      setActiveVisitId((prev) => prev || firstId);

      const appointmentIds = Array.from(
        new Set(vList.map((v) => v.appointment_id).filter(Boolean) as string[])
      );

      if (appointmentIds.length > 0) {
        const aRes = await withTimeout(
          supabase
            .from("appointments")
            .select("id,service_id")
            .in("id", appointmentIds),
          12000
        );

        const appts = getRows<AppointmentLiteRow>(aRes);
        const apptMap: Record<string, AppointmentLiteRow> = {};
        for (const a of appts) apptMap[a.id] = a;
        setAppointmentsById(apptMap);

        const serviceIds = Array.from(
          new Set(appts.map((a) => a.service_id).filter(Boolean) as string[])
        );

        if (serviceIds.length > 0) {
          const svcRes = await withTimeout(
            supabase
              .from("services")
              .select("id,name,price_marketing_cents,price_regular_cents")
              .in("id", serviceIds),
            12000
          );

          const svcRows = getRows<ServicePricingRow>(svcRes);
          const svcMap: Record<string, ServicePricingRow> = {};
          for (const s of svcRows) svcMap[s.id] = s;
          setServicesById(svcMap);
        } else {
          setServicesById({});
        }
      } else {
        setAppointmentsById({});
        setServicesById({});
      }

      if (vList.length === 0) {
        setAppointmentsById({});
        setServicesById({});
        setTreatmentPlanByVisit({});
        setNotesByVisit({});
        setSoapByVisit({});
        setFilesByVisit({});
        setFileUrls({});
        return;
      }

      const visitIds = vList.map((v) => v.id);

      const nRes = await withTimeout(
        supabase
          .from("patient_visit_notes")
          .select("id,visit_id,created_at,author_id,note")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false }),
        12000
      );
      const notes = getRows<VisitNoteRow>(nRes);
      const byVisit: Record<string, VisitNoteRow[]> = {};
      for (const n of notes) {
        byVisit[n.visit_id] = byVisit[n.visit_id] ? [...byVisit[n.visit_id], n] : [n];
      }
      for (const id of visitIds) if (!byVisit[id]) byVisit[id] = [];
      setNotesByVisit(byVisit);

      const sRes = await withTimeout(
        supabase
          .from("patient_soap_notes")
          .select("id,visit_id,created_at,is_locked,subjective,objective,assessment,plan,signed_at")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false }),
        12000
      );
      const soaps = getRows<SoapRow>(sRes);
      const soapMap: Record<string, SoapRow | null> = {};
      for (const s of soaps) {
        if (!soapMap[s.visit_id]) soapMap[s.visit_id] = s;
      }
      for (const id of visitIds) if (!(id in soapMap)) soapMap[id] = null;
      setSoapByVisit(soapMap);

      const tpRes = await withTimeout(
        supabase
          .from("patient_treatment_plans")
          .select("id,visit_id,created_at,status,summary,patient_instructions,plan")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false }),
        12000
      );

      const plans = getRows<TreatmentPlanRow>(tpRes);
      const planMap: Record<string, TreatmentPlanRow | null> = {};
      for (const p of plans) {
        if (!planMap[p.visit_id]) planMap[p.visit_id] = p;
      }
      for (const id of visitIds) if (!(id in planMap)) planMap[id] = null;
      setTreatmentPlanByVisit(planMap);

      const fRes = await withTimeout(
        supabase
          .from("patient_files")
          .select("id,patient_id,visit_id,appointment_id,created_at,filename,category,bucket,path,content_type")
          .eq("patient_id", patientId)
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false }),
        12000
      );

      const fileRows = getRows<PatientFileRow>(fRes).filter(
        (f) => !!f.visit_id
      );

      const groupedFiles: VisitFileMap = {};
      for (const visitId of visitIds) groupedFiles[visitId] = [];

      for (const file of fileRows) {
        if (!file.visit_id) continue;
        groupedFiles[file.visit_id] = groupedFiles[file.visit_id]
          ? [...groupedFiles[file.visit_id], file]
          : [file];
      }

      setFilesByVisit(groupedFiles);

      const nextUrls: FileUrlMap = {};
      for (const file of fileRows) {
        if (!isImageFile(file)) continue;
        try {
          const url = await getSignedUrl(file.bucket, file.path);
          nextUrls[file.id] = url;
        } catch {
          // ignore broken previews
        }
      }
      setFileUrls(nextUrls);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Failed to load treatments."));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const statCardStyle = {
    flex: "1 1 180px",
  };

  const detailStatCardStyle = {
    flex: "1 1 220px",
  };

  const treatmentImageCardStyle = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(230,221,255,0.05))",
    border: "1px solid rgba(208,190,255,0.16)",
  };

  const treatmentImageStyle = {
    border: "1px solid rgba(214,197,255,0.18)",
  };

  const imageFallbackStyle = {
    height: 180,
    display: "grid" as const,
    placeItems: "center" as const,
    background: "rgba(248,245,255,0.05)",
    border: "1px solid rgba(214,197,255,0.12)",
  };

  const visualHistoryCardStyle = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(232,224,255,0.04))",
    border: "1px solid rgba(208,190,255,0.14)",
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Patient Portal - Treatments - Care Timeline"
          primaryCta={{ label: "Back to Home", to: "/patient/home" }}
          secondaryCta={{ label: "Labs", to: "/patient/labs" }}
          rightActions={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </>
          }
          activityItems={[
            { t: "Now", m: "Review current care and next steps", s: "Care" },
            { t: "Now", m: "See visit summaries and treatment progress", s: "Visits" },
            { t: "Now", m: "Review provider notes and SOAP details", s: "Clinical" },
            { t: "Soon", m: "Expanded treatment milestones and documents", s: "Next" },
          ]}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h1">Treatments</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Follow your current care, review previous visits, and stay up to date on treatment instructions.
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" onClick={loadAll}>
                Refresh
              </button>
            </div>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && !err && (
            <>
              <div className="row" style={{ gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div className="card card-pad patient-panel-soft" style={statCardStyle}>
                  <div className="muted">Total Visits</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{visits.length}</div>
                </div>

                <div className="card card-pad patient-panel-soft" style={statCardStyle}>
                  <div className="muted">Current Care</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{currentCareVisits.length}</div>
                </div>

                <div className="card card-pad patient-panel-soft" style={statCardStyle}>
                  <div className="muted">Past Visits</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{pastVisits.length}</div>
                </div>
              </div>

              <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="card card-pad" style={{ flex: "1 1 360px", minWidth: 320 }}>
                  <div className="h2">Current Care</div>
                  <div className="muted patient-mini-note" style={{ marginTop: 6 }}>
                    Active or in-progress visits and treatment activity.
                  </div>

                  <div className="space" />

                  {currentCareVisits.length === 0 ? (
                    <div className="muted">No active care items right now.</div>
                  ) : (
                    currentCareVisits.map((v) => {
                      const active = v.id === activeVisitId;

                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={active ? "btn btn-primary" : "btn btn-ghost"}
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                            marginBottom: 8,
                            textAlign: "left",
                          }}
                          onClick={() => setActiveVisitId(v.id)}
                        >
                          <span>
                            {fmtDateOnly(v.visit_date ?? v.created_at)}
                            <span className="muted" style={{ display: "block", fontSize: 12 }}>
                              {locName(v.location_id)} - {visitStatusLabel(v.status)}
                            </span>
                          </span>
                          <span style={visitStatusStyle(v.status)}>{visitStatusLabel(v.status)}</span>
                        </button>
                      );
                    })
                  )}

                  <div className="space" />

                  <div className="h2">Past Visits</div>
                  <div className="muted patient-mini-note" style={{ marginTop: 6 }}>
                    Your completed and previous care history.
                  </div>

                  <div className="space" />

                  {pastVisits.length === 0 ? (
                    <div className="muted">No past visits yet.</div>
                  ) : (
                    pastVisits.map((v) => {
                      const active = v.id === activeVisitId;
                      const d = v.visit_date ? new Date(v.visit_date) : new Date(v.created_at);

                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={active ? "btn btn-primary" : "btn btn-ghost"}
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                            marginBottom: 8,
                            textAlign: "left",
                          }}
                          onClick={() => setActiveVisitId(v.id)}
                        >
                          <span>
                            {fmtDateOnly(v.visit_date ?? v.created_at)}
                            <span className="muted" style={{ display: "block", fontSize: 12 }}>
                              {locName(v.location_id)} - {visitStatusLabel(v.status)}
                            </span>
                          </span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="card card-pad" style={{ flex: "2 1 700px", minWidth: 320 }}>
                  {!activeVisit ? (
                    <div className="muted">Select a visit to review your treatment details.</div>
                  ) : (
                    <>
                      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            Treatment Details
                          </div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Visit Date: <strong>{fmt(activeVisit.visit_date ?? activeVisit.created_at)}</strong>
                            {" - "}Location: <strong>{locName(activeVisit.location_id)}</strong>
                          </div>
                        </div>

                        <div style={visitStatusStyle(activeVisit.status)}>{visitStatusLabel(activeVisit.status)}</div>
                      </div>

                      <div className="space" />

                      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                        <div className="card card-pad patient-panel-soft" style={detailStatCardStyle}>
                          <div className="muted">Care Status</div>
                          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>
                            {visitStatusLabel(activeVisit.status)}
                          </div>
                        </div>

                        <div className="card card-pad patient-panel-soft" style={detailStatCardStyle}>
                          <div className="muted">Latest Clinical Note</div>
                          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>
                            {soapByVisit[activeVisit.id]?.signed_at ? "Signed" : soapByVisit[activeVisit.id] ? "Drafted" : "Not Added"}
                          </div>
                        </div>

                        <div className="card card-pad patient-panel-soft" style={detailStatCardStyle}>
                          <div className="muted">Provider Notes</div>
                          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>
                            {(notesByVisit[activeVisit.id] ?? []).length}
                          </div>
                        </div>

                        <div className="card card-pad patient-panel-soft" style={detailStatCardStyle}>
                          <div className="muted">Standard Service Price</div>
                          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>
                            {activeServicePrice ?? "Consult for pricing"}
                          </div>
                        </div>
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="muted">Service</div>
                        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>
                          {activeService?.name ?? "Not linked to a service"}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {activeServicePrice ? `Starting at ${activeServicePrice}` : "Pricing will be confirmed by your care team."}
                        </div>
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Treatment Plan</div>
                        <div className="space" />

                        {activeTreatmentPlan ? (
                          <>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                              <div className="v-chip">{activeTreatmentPlan.status ?? "Plan on File"}</div>
                              <div className="v-chip">Updated {fmt(activeTreatmentPlan.created_at)}</div>
                            </div>

                            <div className="muted">Plan Summary</div>
                            <div style={{ marginTop: 6, lineHeight: 1.7 }}>
                              {activeTreatmentPlan.summary ?? "Your care team has created a treatment plan for this visit."}
                            </div>

                            <div className="space" />

                            <div className="muted">Patient Instructions</div>
                            <div style={{ marginTop: 6, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                              {activeTreatmentPlan.patient_instructions ??
                                "Your care team has not added patient instructions yet."}
                            </div>

                            {activeTreatmentPlan?.plan ? (
                              <>
                                <div className="space" />
                                <div className="muted">Plan Details</div>
                                <pre
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    marginTop: 6,
                                    fontFamily: "inherit",
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {JSON.stringify(activeTreatmentPlan.plan, null, 2)}
                                </pre>
                              </>
                            ) : null}

                            <div className="space" />

                            <div className="muted">Next Steps</div>
                            <div style={{ marginTop: 6, lineHeight: 1.7 }}>
                              {activeTreatmentPlan.summary ??
                                "Continue following your provider's instructions and attend recommended follow-up visits."}
                            </div>
                          </>
                        ) : (
                          <div className="muted">
                            No treatment plan has been added for this visit yet.
                          </div>
                        )}
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Visit Summary</div>
                        <div className="space" />
                        <div className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                          {activeVisit.summary ?? "Your care team has not added a visit summary yet."}
                        </div>
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Photo Progress Timeline</div>
                        <div className="space" />

                        {((filesByVisit[activeVisit.id] ?? []).filter((f) => isImageFile(f))).length === 0 ? (
                          <div className="muted">No wound or treatment photos are attached to this visit yet.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 12 }}>
                            {(filesByVisit[activeVisit.id] ?? [])
                              .filter((f) => isImageFile(f))
                              .map((file) => {
                                const imageUrl = fileUrls[file.id];

                                return (
                                  <div
                                    key={file.id}
                                    className="card card-pad"
                                    style={treatmentImageCardStyle}
                                  >
                                    <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                                      <div style={{ flex: "0 0 220px" }}>
                                        {imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={file.filename}
                                            style={{
                                              width: "100%",
                                              height: 180,
                                              objectFit: "cover",
                                              borderRadius: 14,
                                              ...treatmentImageStyle,
                                            }}
                                          />
                                        ) : (
                                          <div
                                            className="card card-pad"
                                            style={imageFallbackStyle}
                                          >
                                            <div className="muted">Preview unavailable</div>
                                          </div>
                                        )}
                                      </div>

                                      <div style={{ flex: "1 1 280px" }}>
                                        <div style={{ fontWeight: 800 }}>{file.filename}</div>

                                        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                                          Added: {fmt(file.created_at)}
                                        </div>

                                        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                                          Category: {file.category ?? "general"}
                                        </div>

                                        <div className="space" />

                                        {imageUrl ? (
                                          <a
                                            className="btn btn-ghost"
                                            href={imageUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Open Full Image
                                          </a>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Care Snapshot</div>
                        <div className="space" />

                        {soapByVisit[activeVisit.id] ? (
                          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                            <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                              <div className="muted">How you were feeling</div>
                              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                {soapByVisit[activeVisit.id]!.subjective ?? "No patient-reported update recorded."}
                              </div>
                            </div>

                            <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                              <div className="muted">Clinical findings</div>
                              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                {soapByVisit[activeVisit.id]!.objective ?? "No objective findings recorded yet."}
                              </div>
                            </div>

                            <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                              <div className="muted">Assessment</div>
                              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                {soapByVisit[activeVisit.id]!.assessment ?? "No assessment summary available yet."}
                              </div>
                            </div>

                            <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                              <div className="muted">Next steps / plan</div>
                              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                {patientFriendlyPlan(soapByVisit[activeVisit.id]!.plan)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="muted">No clinical treatment summary has been added for this visit yet.</div>
                        )}
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Clinical Note Details</div>
                        <div className="space" />

                        {soapByVisit[activeVisit.id] ? (
                          <>
                            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                              Created: {fmt(soapByVisit[activeVisit.id]!.created_at)}
                              {" - "}Signed:{" "}
                              {soapByVisit[activeVisit.id]!.signed_at
                                ? fmt(soapByVisit[activeVisit.id]!.signed_at)
                                : "-"}
                              {" - "}Locked: {soapByVisit[activeVisit.id]!.is_locked ? "Yes" : "No"}
                            </div>

                            <div className="card card-pad" style={{ marginBottom: 10 }}>
                              <div className="h2">Subjective</div>
                              <div className="space" />
                              <div className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                {soapByVisit[activeVisit.id]!.subjective ?? "-"}
                              </div>
                            </div>

                            <div className="card card-pad" style={{ marginBottom: 10 }}>
                              <div className="h2">Objective</div>
                              <div className="space" />
                              <div className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                {soapByVisit[activeVisit.id]!.objective ?? "-"}
                              </div>
                            </div>

                            <div className="card card-pad" style={{ marginBottom: 10 }}>
                              <div className="h2">Assessment</div>
                              <div className="space" />
                              <div className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                {soapByVisit[activeVisit.id]!.assessment ?? "-"}
                              </div>
                            </div>

                            <div className="card card-pad">
                              <div className="h2">Plan</div>
                              <div className="space" />
                              <div className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                {soapByVisit[activeVisit.id]!.plan ?? "-"}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="muted">No SOAP note is on file yet for this visit.</div>
                        )}
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Provider / Staff Notes</div>
                        <div className="space" />

                        {(notesByVisit[activeVisit.id] ?? []).length === 0 ? (
                          <div className="muted">No additional provider notes are available for this visit yet.</div>
                        ) : (
                          (notesByVisit[activeVisit.id] ?? []).map((n) => (
                            <div key={n.id} className="card card-pad" style={{ marginBottom: 10 }}>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {fmt(n.created_at)}
                              </div>
                              <div className="space" />
                              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{n.note}</div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space" />

                      <div className="card card-pad">
                        <div className="h2">Visual Progress Across Visits</div>
                        <div className="space" />

                        {visits.every((v) => ((filesByVisit[v.id] ?? []).filter((f) => isImageFile(f))).length === 0) ? (
                          <div className="muted">No image history is available yet across visits.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 14 }}>
                            {visits.map((visit) => {
                              const imageFiles = (filesByVisit[visit.id] ?? []).filter((f) => isImageFile(f));
                              if (imageFiles.length === 0) return null;

                              return (
                                <div key={visit.id} className="card card-pad" style={visualHistoryCardStyle}>
                                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 800 }}>
                                      {fmtDateOnly(visit.visit_date ?? visit.created_at)}
                                    </div>
                                    <div className="muted" style={{ fontSize: 12 }}>
                                      {locName(visit.location_id)} - {visitStatusLabel(visit.status)}
                                    </div>
                                  </div>

                                  <div className="space" />

                                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                                    {imageFiles.map((file) => {
                                      const imageUrl = fileUrls[file.id];
                                      if (!imageUrl) return null;

                                      return (
                                        <a
                                          key={file.id}
                                          href={imageUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ textDecoration: "none", color: "inherit" }}
                                        >
                                          <img
                                            src={imageUrl}
                                            alt={file.filename}
                                            style={{
                                              width: 140,
                                              height: 140,
                                              objectFit: "cover",
                                              borderRadius: 12,
                                              ...treatmentImageStyle,
                                            }}
                                          />
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="space" />

                      <div className="muted" style={{ fontSize: 12 }}>
                        Visit ID: {activeVisit.id}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

