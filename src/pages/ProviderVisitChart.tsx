import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";
import TreatmentPlanSection from "../components/provider/TreatmentPlanSection";
import WoundAssessmentSection from "../components/provider/WoundAssessmentSection";
import { getSignedUrl } from "../lib/patientFiles";
import SoapNotePanel from "../components/SoapNotePanel";
import { analyzeWoundProgression } from "../lib/woundProgression";
import { getErrorMessage } from "../lib/patientRecords";
import type { ProviderVisitSummary, SoapNoteRecord, TreatmentPlanRecord, WoundAssessmentRecord } from "../lib/provider/types";

const LazyVisitPacketSection = lazy(() => import("../components/provider/VisitPacketSection"));
const LazyWoundPacketPreview = lazy(() => import("../components/provider/WoundPacketPreview"));
const LazyVisitPacketSectionSummary = lazy(() => import("../components/visits/VisitPacketSection"));

type VisitRow = ProviderVisitSummary & {
  created_at: string;
  appointment_id: string | null;
};

type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

type AssessmentRow = Pick<
  WoundAssessmentRecord,
  "id" | "created_at" | "wound_label" | "body_site" | "laterality" | "wound_type" | "photo_file_id"
> & {
  wound_label: string | null;
  photo_file_id?: string | null;
};

type SoapRow = Pick<
  SoapNoteRecord,
  "id" | "created_at" | "subjective" | "objective" | "assessment" | "plan" | "is_signed" | "is_locked" | "signed_at"
>;

type PlanRow = Pick<
  TreatmentPlanRecord,
  "id" | "created_at" | "status" | "summary" | "plan" | "patient_instructions" | "internal_notes"
>;

type FileRow = {
  id: string;
  created_at: string;
  filename: string;
  category: string | null;
  bucket: string;
  path: string;
  content_type: string | null;
  size_bytes: number | null;
  visit_id?: string | null;
};

type TimelineVisitRow = {
  id: string;
  visit_date: string;
  status: string | null;
};

type TimelineAssessmentRow = Pick<
  WoundAssessmentRecord,
  "id" | "visit_id" | "created_at" | "wound_label" | "body_site" | "laterality" | "wound_type" | "photo_file_id"
> & {
  wound_label: string | null;
};

type WoundMeasurementRow = {
  created_at: string;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  exudate: string | null;
  infection_signs: boolean | null;
  pain_score: number | null;
};

type TabKey = "overview" | "assessment" | "soap" | "treatment" | "files" | "packet";

function isImageFile(f: FileRow) {
  return (f.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.filename);
}

export default function ProviderVisitChart() {
  const nav = useNavigate();
  const { id } = useParams();

  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [patient, setPatient] = useState<PatientRow | null>(null);

  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [soap, setSoap] = useState<SoapRow | null>(null);
  const [treatment, setTreatment] = useState<PlanRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [timelineVisits, setTimelineVisits] = useState<TimelineVisitRow[]>([]);
  const [timelineAssessments, setTimelineAssessments] = useState<TimelineAssessmentRow[]>([]);
  const [timelineFiles, setTimelineFiles] = useState<FileRow[]>([]);
  const [woundMeasurements, setWoundMeasurements] = useState<WoundMeasurementRow[]>([]);

  const patientName = useMemo(() => {
    if (!patient) return "Patient";
    return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  }, [patient]);

  const progression = useMemo(() => {
    if (!woundMeasurements?.length) return null;
    return analyzeWoundProgression(woundMeasurements);
  }, [woundMeasurements]);

  const photoTimeline = useMemo(() => {
    const filesById = new Map<string, FileRow>();
    for (const f of timelineFiles) filesById.set(f.id, f);

    return timelineVisits
      .map((v) => {
        const linkedPhotos = timelineAssessments
          .filter((a) => a.visit_id === v.id && a.photo_file_id)
          .map((a) => {
            const file = a.photo_file_id ? filesById.get(a.photo_file_id) ?? null : null;
            return { assessment: a, file };
          })
          .filter((x) => x.file && isImageFile(x.file));

        const looseVisitImages = timelineFiles.filter(
          (f) =>
            f.visit_id === v.id &&
            isImageFile(f) &&
            !timelineAssessments.some((a) => a.visit_id === v.id && a.photo_file_id === f.id)
        );

        return {
          visit: v,
          linkedPhotos,
          looseVisitImages,
        };
      })
      .filter((group) => group.linkedPhotos.length > 0 || group.looseVisitImages.length > 0);
  }, [timelineVisits, timelineAssessments, timelineFiles]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);

    try {
      const { data: v, error: vErr } = await supabase
        .from("patient_visits")
        .select("id,created_at,location_id,patient_id,appointment_id,visit_date,status,summary")
        .eq("id", id)
        .maybeSingle();

      if (vErr) throw vErr;
      if (!v) throw new Error("Visit not found.");

      const visitRow = v as VisitRow;
      setVisit(visitRow);

      const { data: p, error: pErr } = await supabase
        .from("patients")
        .select("id,first_name,last_name,phone,email")
        .eq("id", visitRow.patient_id)
        .maybeSingle();

      if (pErr) throw pErr;
      setPatient((p as PatientRow) ?? null);

      const { data: wa, error: waErr } = await supabase
        .from("wound_assessments")
        .select("id,created_at,wound_label,body_site,laterality,wound_type,photo_file_id")
        .eq("visit_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!waErr) {
        setAssessment((wa?.[0] as AssessmentRow) ?? null);
      } else {
        const { data: wa2, error: wa2Err } = await supabase
          .from("wound_assessments")
          .select("id,created_at,wound_label,body_site,laterality,wound_type,photo_file_id")
          .eq("patient_id", visitRow.patient_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (wa2Err) throw wa2Err;
        setAssessment((wa2?.[0] as AssessmentRow) ?? null);
      }

      const { data: woundHistory } = await supabase
        .from("wound_assessments")
        .select("created_at,length_cm,width_cm,depth_cm,exudate,infection_signs,pain_score")
        .eq("patient_id", visitRow.patient_id)
        .order("created_at", { ascending: true })
        .limit(20);

      if (woundHistory) {
        setWoundMeasurements(woundHistory);
      }

      const { data: sn, error: snErr } = await supabase
        .from("patient_soap_notes")
        .select("id,created_at,subjective,objective,assessment,plan,is_signed,is_locked,signed_at")
        .eq("visit_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!snErr) {
        setSoap((sn?.[0] as SoapRow) ?? null);
      } else {
        const { data: sn2, error: sn2Err } = await supabase
          .from("patient_soap_notes")
          .select("id,created_at,subjective,objective,assessment,plan,is_signed,is_locked,signed_at")
          .eq("patient_id", visitRow.patient_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (sn2Err) throw sn2Err;
        setSoap((sn2?.[0] as SoapRow) ?? null);
      }

      const { data: tp, error: tpErr } = await supabase
        .from("patient_treatment_plans")
        .select("id,created_at,status,summary,patient_instructions,internal_notes,plan")
        .eq("visit_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!tpErr) {
        setTreatment((tp?.[0] as PlanRow) ?? null);
      } else {
        const { data: tp2, error: tp2Err } = await supabase
          .from("patient_treatment_plans")
          .select("id,created_at,status,summary,patient_instructions,internal_notes,plan")
          .eq("patient_id", visitRow.patient_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (tp2Err) throw tp2Err;
        setTreatment((tp2?.[0] as PlanRow) ?? null);
      }

      const { data: f, error: fErr } = await supabase
        .from("patient_files")
        .select("id,created_at,filename,category,bucket,path,content_type,size_bytes,visit_id")
        .eq("visit_id", id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!fErr) {
        setFiles((f as FileRow[]) ?? []);
      } else {
        const { data: f2, error: f2Err } = await supabase
          .from("patient_files")
          .select("id,created_at,filename,category,bucket,path,content_type,size_bytes,visit_id")
          .eq("patient_id", visitRow.patient_id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (f2Err) throw f2Err;
        setFiles((f2 as FileRow[]) ?? []);
      }

      const { data: tv, error: tvErr } = await supabase
        .from("patient_visits")
        .select("id,visit_date,status")
        .eq("patient_id", visitRow.patient_id)
        .order("visit_date", { ascending: false })
        .limit(50);

      if (tvErr) throw tvErr;

      const visitTimelineRows = (tv as TimelineVisitRow[]) ?? [];
      setTimelineVisits(visitTimelineRows);

      const visitIds = visitTimelineRows.map((x) => x.id);

      if (visitIds.length > 0) {
        const { data: twa, error: twaErr } = await supabase
          .from("wound_assessments")
          .select("id,visit_id,created_at,wound_label,body_site,laterality,wound_type,photo_file_id")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false });

        if (twaErr) throw twaErr;
        setTimelineAssessments((twa as TimelineAssessmentRow[]) ?? []);

        const { data: tf, error: tfErr } = await supabase
          .from("patient_files")
          .select("id,created_at,filename,category,bucket,path,content_type,size_bytes,visit_id")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false })
          .limit(300);

        if (tfErr) throw tfErr;
        setTimelineFiles((tf as FileRow[]) ?? []);
      } else {
        setTimelineAssessments([]);
        setTimelineFiles([]);
      }
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load visit chart."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadUrls = async () => {
      const allFiles = [...files, ...timelineFiles];
      if (!allFiles.length) {
        setFileUrls({});
        return;
      }

      const unique = new Map<string, FileRow>();
      for (const f of allFiles) unique.set(f.id, f);

      const out: Record<string, string> = {};
      for (const f of unique.values()) {
        try {
          const url = await getSignedUrl(f.bucket, f.path);
          out[f.id] = url;
        } catch {
          // ignore missing/failed signed url
        }
      }

      if (!cancelled) setFileUrls(out);
    };

    loadUrls();

    return () => {
      cancelled = true;
    };
  }, [files, timelineFiles]);

  const TabButton = ({ k, label }: { k: TabKey; label: string }) => (
    <button
      type="button"
      className={`btn ${tab === k ? "btn-primary" : "btn-ghost"}`}
      onClick={() => setTab(k)}
      style={{ padding: "8px 12px" }}
    >
      {label}
    </button>
  );

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title={patientName}
          subtitle={visit ? `Visit - ${new Date(visit.visit_date).toLocaleString()} - ${visit.status ?? "new"}` : "Visit"}
          secondaryCta={{ label: "Back to Queue", to: "/provider/queue" }}
          showKpis={false}
          rightActions={
            <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/queue")}>
              Back
            </button>
          }
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <TabButton k="overview" label="Overview" />
            <TabButton k="assessment" label="Assessment" />
            <TabButton k="soap" label="SOAP" />
            <TabButton k="treatment" label="Treatment Plan" />
            <TabButton k="files" label="Files" />
            <TabButton k="packet" label="Packet" />
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading chart...</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}

          {!loading && !err && visit && (
            <>
              {tab === "overview" && (
                <div>
                  <div className="h2">Summary</div>
                  <div className="space" />
                  <div className="muted">Patient</div>
                  <div style={{ fontWeight: 600 }}>{patientName}</div>
                  <div className="space" />
                  <div className="muted">Visit Status</div>
                  <div style={{ fontWeight: 600 }}>{visit.status ?? "new"}</div>
                  <div className="space" />
                  <div className="muted">Visit Summary</div>
                  <div>{visit.summary ?? "-"}</div>
                  <div className="space" />

                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div className="card card-pad" style={{ flex: "1 1 260px" }}>
                      <div className="muted">Assessment</div>
                      <div style={{ fontWeight: 700 }}>{assessment ? "On file" : "Missing"}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {assessment?.wound_label ?? assessment?.wound_type ?? "-"}
                      </div>
                    </div>

                    <div className="card card-pad" style={{ flex: "1 1 260px" }}>
                      <div className="muted">SOAP Note</div>
                      <div style={{ fontWeight: 700 }}>{soap ? "On file" : "Missing"}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {soap?.is_signed ? "signed" : soap ? "draft" : "-"}
                      </div>
                    </div>

                    <div className="card card-pad" style={{ flex: "1 1 260px" }}>
                      <div className="muted">Treatment Plan</div>
                      <div style={{ fontWeight: 700 }}>{treatment ? "On file" : "Missing"}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {treatment?.status ?? "-"}
                      </div>
                    </div>
                  </div>

                  {progression && (
                    <div className="card card-pad" style={{ marginTop: 16 }}>
                      <div className="muted">Healing Forecast</div>

                      <div style={{ fontWeight: 700, fontSize: 18 }}>
                        {progression.trajectory}
                      </div>

                      <div className="muted" style={{ marginTop: 6 }}>
                        Confidence: {progression.confidence}
                      </div>

                      {progression.improvement_pct !== null && (
                        <div className="muted">
                          Improvement: {progression.improvement_pct.toFixed(1)}%
                        </div>
                      )}

                      <div style={{ marginTop: 10 }}>
                        {progression.reasoning}
                      </div>

                      <div className="muted" style={{ marginTop: 8 }}>
                        Suggested Action: {progression.suggested_action}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "assessment" && (
                <WoundAssessmentSection
                  visitId={visit.id}
                  patientId={visit.patient_id}
                  locationId={visit.location_id}
                />
              )}

              {tab === "soap" && (
                <SoapNotePanel
                  visitId={visit.id}
                  patientId={visit.patient_id}
                  locationId={visit.location_id}
                />
              )}

              {tab === "treatment" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <TreatmentPlanSection
                    visitId={visit.id}
                    patientId={visit.patient_id}
                    locationId={visit.location_id}
                  />
                  <Suspense fallback={<div className="card card-pad"><div className="muted">Loading packet tools...</div></div>}>
                    <LazyVisitPacketSection
                      visitId={visit.id}
                      patientId={visit.patient_id}
                      locationId={visit.location_id}
                    />
                  </Suspense>
                </div>
              )}

              {tab === "files" && (
                <div>
                  <div className="h2">Wound Photo Timeline</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Visit-by-visit wound images for progression review.
                  </div>
                  <div className="space" />

                  {photoTimeline.length === 0 ? (
                    <div className="muted">No wound photos linked across visits yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 16 }}>
                      {photoTimeline.map((group) => (
                        <div key={group.visit.id} className="card card-pad">
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                              <div className="h2" style={{ fontSize: 18 }}>
                                {new Date(group.visit.visit_date).toLocaleString()}
                              </div>
                              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                Status: {group.visit.status ?? "unknown"}
                              </div>
                            </div>

                            {group.visit.id === visit.id ? (
                              <div className="v-chip">Current Visit</div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => nav(`/provider/visits/${group.visit.id}`)}
                              >
                                Open Visit
                              </button>
                            )}
                          </div>

                          <div className="space" />

                          {group.linkedPhotos.length > 0 && (
                            <>
                              <div className="muted" style={{ marginBottom: 10 }}>
                                Linked wound photos
                              </div>
                              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                                {group.linkedPhotos.map(({ assessment: a, file }) => {
                                  if (!file) return null;
                                  const url = fileUrls[file.id];

                                  return (
                                    <div key={a.id} className="card card-pad" style={{ flex: "1 1 280px", minWidth: 260 }}>
                                      {url ? (
                                        <img
                                          src={url}
                                          alt={file.filename}
                                          style={{
                                            width: "100%",
                                            height: 220,
                                            objectFit: "cover",
                                            borderRadius: 12,
                                            marginBottom: 12,
                                            border: "1px solid rgba(255,255,255,.10)",
                                          }}
                                        />
                                      ) : null}

                                      <div style={{ fontWeight: 700 }}>{a.wound_label ?? "Wound photo"}</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                        {a.body_site ?? "-"}
                                        {a.laterality ? ` - ${a.laterality}` : ""}
                                        {a.wound_type ? ` - ${a.wound_type}` : ""}
                                      </div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                        {new Date(a.created_at).toLocaleString()}
                                      </div>

                                      <div className="space" />

                                      {url ? (
                                        <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                                          Open Photo
                                        </a>
                                      ) : (
                                        <div className="muted" style={{ fontSize: 12 }}>
                                          Preview unavailable
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {group.looseVisitImages.length > 0 && (
                            <>
                              <div className="space" />
                              <div className="muted" style={{ marginBottom: 10 }}>
                                Other visit images
                              </div>
                              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                                {group.looseVisitImages.map((file) => {
                                  const url = fileUrls[file.id];

                                  return (
                                    <div key={file.id} className="card card-pad" style={{ flex: "1 1 280px", minWidth: 260 }}>
                                      {url ? (
                                        <img
                                          src={url}
                                          alt={file.filename}
                                          style={{
                                            width: "100%",
                                            height: 220,
                                            objectFit: "cover",
                                            borderRadius: 12,
                                            marginBottom: 12,
                                            border: "1px solid rgba(255,255,255,.10)",
                                          }}
                                        />
                                      ) : null}

                                      <div style={{ fontWeight: 700 }}>{file.filename}</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                        {file.category ?? "image"}
                                      </div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                        {new Date(file.created_at).toLocaleString()}
                                      </div>

                                      <div className="space" />

                                      {url ? (
                                        <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                                          Open Image
                                        </a>
                                      ) : (
                                        <div className="muted" style={{ fontSize: 12 }}>
                                          Preview unavailable
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space" />
                  <div className="h2">Files for This Visit</div>
                  <div className="space" />

                  {files.length === 0 ? (
                    <div className="muted">No files found for this visit yet.</div>
                  ) : (
                    <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                      {files.map((f) => {
                        const isImage = isImageFile(f);
                        const url = fileUrls[f.id];

                        return (
                          <div key={f.id} className="card card-pad" style={{ flex: "1 1 320px", minWidth: 280 }}>
                            {isImage && url ? (
                              <img
                                src={url}
                                alt={f.filename}
                                style={{
                                  width: "100%",
                                  height: 220,
                                  objectFit: "cover",
                                  borderRadius: 12,
                                  marginBottom: 12,
                                  border: "1px solid rgba(255,255,255,.10)",
                                }}
                              />
                            ) : null}

                            <div style={{ fontWeight: 700 }}>{f.filename}</div>

                            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                              {f.category ?? "file"} - {new Date(f.created_at).toLocaleString()}
                            </div>

                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {f.content_type ?? "unknown type"}
                              {f.size_bytes ? ` - ${Math.round(f.size_bytes / 1024)} KB` : ""}
                            </div>

                            <div className="space" />

                            {url ? (
                              <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                                Open File
                              </a>
                            ) : (
                              <div className="muted" style={{ fontSize: 12 }}>
                                Preview unavailable
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "packet" && (
                <div>
                  <Suspense fallback={<div className="card card-pad"><div className="muted">Loading packet preview...</div></div>}>
                    <LazyVisitPacketSectionSummary
                      visitId={visit.id}
                      patientId={visit.patient_id}
                    />
                    <div className="space" />
                    <LazyWoundPacketPreview
                      visitId={visit.id}
                      patientId={visit.patient_id}
                      locationId={visit.location_id}
                    />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
