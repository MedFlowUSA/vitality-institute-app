import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import InlineNotice from "../../../components/InlineNotice";
import RouteHeader from "../../../components/RouteHeader";
import VitalityHero from "../../../components/VitalityHero";
import ProviderGuidePanel from "../../../components/provider/ProviderGuidePanel";
import ProviderWorkspaceNav from "../../../components/provider/ProviderWorkspaceNav";
import { useAuth } from "../../../auth/AuthProvider";
import { useClinicContext } from "../../clinics/hooks/useClinicContext";
import { buildProviderProtocolQueueGuide } from "../../../lib/provider/providerGuide";
import { PROVIDER_ROUTES, providerProtocolReviewPath, providerVitalAiProfilePath } from "../../../lib/providerRoutes";
import { supabase } from "../../../lib/supabase";
import { formatProtocolRecommendationTypeLabel, formatProtocolServiceLineLabel, formatProviderProtocolDecisionLabel } from "../display";
import { isProtocolAssessmentReviewable } from "../reviewFlow";
import type { AiProtocolAssessmentRow, ProviderProtocolReviewRow } from "../types";
import type { VitalAiPathwayRow, VitalAiProfileRow } from "../../../lib/vitalAi/types";

type QueuePatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type QueueAssessmentRow = Pick<
  AiProtocolAssessmentRow,
  | "id"
  | "vital_ai_session_id"
  | "vital_ai_profile_id"
  | "patient_id"
  | "clinic_id"
  | "location_id"
  | "service_line"
  | "recommendation_type"
  | "structured_output_json"
  | "status"
  | "provider_review_required"
  | "created_at"
  | "updated_at"
>;

type QueueReviewRow = Pick<
  ProviderProtocolReviewRow,
  "id" | "ai_protocol_assessment_id" | "provider_id" | "clinic_id" | "decision" | "signed_at" | "created_at" | "updated_at"
>;

type QueueProfileRow = Pick<VitalAiProfileRow, "id" | "pathway_id" | "summary" | "triage_level" | "status" | "profile_json">;

const ASSESSMENT_SELECT_FIELDS =
  "id,vital_ai_session_id,vital_ai_profile_id,patient_id,clinic_id,location_id,service_line,recommendation_type,structured_output_json,status,provider_review_required,created_at,updated_at";
const REVIEW_SELECT_FIELDS =
  "id,ai_protocol_assessment_id,provider_id,clinic_id,decision,signed_at,created_at,updated_at";
const PROFILE_SELECT_FIELDS = "id,pathway_id,summary,triage_level,status,profile_json";
const PATHWAY_SELECT_FIELDS = "id,slug,name";
const PATIENT_SELECT_FIELDS = "id,first_name,last_name";

function patientNameFromAssessment(patient?: QueuePatient | null, profile?: QueueProfileRow | null) {
  if (patient) return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  const profilePatient = (profile?.profile_json as { patient?: { first_name?: string; last_name?: string } } | null)?.patient;
  return `${profilePatient?.first_name ?? ""} ${profilePatient?.last_name ?? ""}`.trim() || "Patient";
}

export default function ProviderProtocolQueue() {
  const navigate = useNavigate();
  const { activeLocationId, resumeKey } = useAuth();
  const { activeClinicId } = useClinicContext();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<QueueAssessmentRow[]>([]);
  const [reviewsByAssessment, setReviewsByAssessment] = useState<Record<string, QueueReviewRow>>({});
  const [profilesById, setProfilesById] = useState<Record<string, QueueProfileRow>>({});
  const [pathwaysById, setPathwaysById] = useState<Record<string, Pick<VitalAiPathwayRow, "id" | "slug" | "name">>>({});
  const [patientsById, setPatientsById] = useState<Record<string, QueuePatient>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        let assessmentQuery = supabase
          .from("ai_protocol_assessments")
          .select(ASSESSMENT_SELECT_FIELDS)
          .eq("provider_review_required", true)
          .order("created_at", { ascending: false });

        if (activeClinicId) assessmentQuery = assessmentQuery.eq("clinic_id", activeClinicId);
        if (activeLocationId) assessmentQuery = assessmentQuery.eq("location_id", activeLocationId);

        const { data: assessmentRows, error: assessmentError } = await assessmentQuery;
        if (assessmentError) throw assessmentError;

        const nextAssessments = (assessmentRows as QueueAssessmentRow[] | null) ?? [];
        setAssessments(nextAssessments);

        const assessmentIds = nextAssessments.map((assessment) => assessment.id);
        const profileIds = Array.from(new Set(nextAssessments.map((assessment) => assessment.vital_ai_profile_id).filter(Boolean))) as string[];
        const patientIds = Array.from(new Set(nextAssessments.map((assessment) => assessment.patient_id).filter(Boolean))) as string[];

        const [reviewResult, profileResult, patientResult] = await Promise.all([
          assessmentIds.length
            ? supabase.from("provider_protocol_reviews").select(REVIEW_SELECT_FIELDS).in("ai_protocol_assessment_id", assessmentIds)
            : Promise.resolve({ data: [], error: null }),
          profileIds.length
            ? supabase.from("vital_ai_profiles").select(PROFILE_SELECT_FIELDS).in("id", profileIds)
            : Promise.resolve({ data: [], error: null }),
          patientIds.length
            ? supabase.from("patients").select(PATIENT_SELECT_FIELDS).in("id", patientIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (reviewResult.error) throw reviewResult.error;
        if (profileResult.error) throw profileResult.error;
        if (patientResult.error) throw patientResult.error;

        const nextReviewsByAssessment: Record<string, QueueReviewRow> = {};
        for (const review of (reviewResult.data as QueueReviewRow[] | null) ?? []) {
          nextReviewsByAssessment[review.ai_protocol_assessment_id] = review;
        }
        setReviewsByAssessment(nextReviewsByAssessment);

        const nextProfilesById: Record<string, QueueProfileRow> = {};
        const pathwayIds = new Set<string>();
        for (const profile of (profileResult.data as QueueProfileRow[] | null) ?? []) {
          nextProfilesById[profile.id] = profile;
          pathwayIds.add(profile.pathway_id);
        }
        setProfilesById(nextProfilesById);

        const nextPatientsById: Record<string, QueuePatient> = {};
        for (const patient of (patientResult.data as QueuePatient[] | null) ?? []) nextPatientsById[patient.id] = patient;
        setPatientsById(nextPatientsById);

        if (pathwayIds.size > 0) {
          const { data: pathwayRows, error: pathwayError } = await supabase
            .from("vital_ai_pathways")
            .select(PATHWAY_SELECT_FIELDS)
            .in("id", Array.from(pathwayIds));
          if (pathwayError) throw pathwayError;

          const nextPathwaysById: Record<string, Pick<VitalAiPathwayRow, "id" | "slug" | "name">> = {};
          for (const pathway of (pathwayRows as Array<Pick<VitalAiPathwayRow, "id" | "slug" | "name">> | null) ?? []) {
            nextPathwaysById[pathway.id] = pathway;
          }
          setPathwaysById(nextPathwaysById);
        } else {
          setPathwaysById({});
        }
      } catch (loadError: unknown) {
        setErr(loadError instanceof Error ? loadError.message : "Failed to load the protocol approval queue.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeClinicId, activeLocationId, resumeKey]);

  const pendingItems = useMemo(
    () =>
      assessments.filter((assessment) =>
        isProtocolAssessmentReviewable({
          providerReviewRequired: assessment.provider_review_required,
          assessmentStatus: assessment.status,
          hasExistingReview: Boolean(reviewsByAssessment[assessment.id]),
        })
      ),
    [assessments, reviewsByAssessment]
  );
  const reviewedItems = useMemo(
    () => assessments.filter((assessment) => !!reviewsByAssessment[assessment.id]),
    [assessments, reviewsByAssessment]
  );
  const guide = useMemo(() => buildProviderProtocolQueueGuide(pendingItems.length), [pendingItems.length]);

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Protocol Approval Queue"
          subtitle="Physician-reviewed sign-off for AI-assisted protocol suggestions."
          backTo={PROVIDER_ROUTES.home}
          homeTo={PROVIDER_ROUTES.home}
        />

        <div className="space" />

        <VitalityHero
          title="Protocol Approval Queue"
          subtitle="Review AI-assisted suggestions, make physician edits, and complete sign-off before any downstream routing."
          secondaryCta={{ label: "Back", to: PROVIDER_ROUTES.home }}
          showKpis={false}
        />

        <div className="space" />

        <ProviderWorkspaceNav compact />

        <div className="space" />

        <ProviderGuidePanel
          title={guide.title}
          description={guide.description}
          workflowState={guide.workflowState}
          nextAction={guide.nextAction}
          actions={[
            { label: "Vital AI Requests", to: PROVIDER_ROUTES.vitalAi, tone: "primary" },
          ]}
        />

        <div className="space" />

        {err ? <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} /> : null}

        {loading ? (
          <div className="card card-pad">
            <div className="muted">Loading protocol approval queue...</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                <div className="muted" style={{ fontSize: 12 }}>Awaiting physician review</div>
                <div className="h2" style={{ marginTop: 6 }}>{pendingItems.length}</div>
              </div>
              <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                <div className="muted" style={{ fontSize: 12 }}>Reviewed</div>
                <div className="h2" style={{ marginTop: 6 }}>{reviewedItems.length}</div>
              </div>
              <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                <div className="muted" style={{ fontSize: 12 }}>Total clinic-scoped assessments</div>
                <div className="h2" style={{ marginTop: 6 }}>{assessments.length}</div>
              </div>
            </div>

            {pendingItems.length === 0 ? (
              <div className="card card-pad">
                <div className="muted">No reviewable protocol assessments are in scope for the active clinic and location.</div>
              </div>
            ) : (
              pendingItems.map((assessment) => {
                const review = reviewsByAssessment[assessment.id] ?? null;
                const profile = assessment.vital_ai_profile_id ? profilesById[assessment.vital_ai_profile_id] ?? null : null;
                const pathway = profile ? pathwaysById[profile.pathway_id] ?? null : null;
                const patient = assessment.patient_id ? patientsById[assessment.patient_id] ?? null : null;
                const suggestion = assessment.structured_output_json;

                return (
                  <div key={assessment.id} className="card card-pad">
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 380px" }}>
                          <div className="h2">{patientNameFromAssessment(patient, profile)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {pathway?.name ?? "Vital AI pathway"} | {formatProtocolServiceLineLabel(assessment.service_line)} |{" "}
                          {formatProtocolRecommendationTypeLabel(assessment.recommendation_type)}
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Generated {new Date(assessment.created_at).toLocaleString()}
                          {review?.signed_at ? ` | Reviewed ${new Date(review.signed_at).toLocaleString()}` : ""}
                        </div>
                        <div style={{ marginTop: 10, lineHeight: 1.6, color: "#3E355C" }}>
                          {suggestion.rationale_summary}
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <div className="v-chip">
                          {review ? formatProviderProtocolDecisionLabel(review.decision) : "Awaiting review"}
                        </div>
                        <button className="btn btn-primary" type="button" onClick={() => navigate(providerProtocolReviewPath(assessment.id))}>
                          {review ? "Open Review" : "Review Protocol"}
                        </button>
                        {profile ? (
                          <button className="btn btn-ghost" type="button" onClick={() => navigate(providerVitalAiProfilePath(profile.id))}>
                            Open Intake
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space" />

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {suggestion.risk_flags.length > 0 ? (
                        <div className="v-chip">Risk flags: <strong>{suggestion.risk_flags.length}</strong></div>
                      ) : (
                        <div className="v-chip">Risk flags: <strong>0</strong></div>
                      )}
                      <div className="v-chip">Missing items: <strong>{suggestion.missing_required_labs.length}</strong></div>
                      <div className="v-chip">Program: <strong>{suggestion.suggested_program ?? "Physician to determine"}</strong></div>
                      <div className="v-chip">Profile status: <strong>{profile?.status ?? "n/a"}</strong></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
