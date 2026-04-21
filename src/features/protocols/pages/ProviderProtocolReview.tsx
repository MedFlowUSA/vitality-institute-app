import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import InlineNotice from "../../../components/InlineNotice";
import RouteHeader from "../../../components/RouteHeader";
import VitalityHero from "../../../components/VitalityHero";
import ProviderGuidePanel from "../../../components/provider/ProviderGuidePanel";
import ProviderWorkspaceNav from "../../../components/provider/ProviderWorkspaceNav";
import ProfileSummaryCard from "../../../components/vital-ai/ProfileSummaryCard";
import { useAuth } from "../../../auth/AuthProvider";
import { buildProviderProtocolReviewGuide } from "../../../lib/provider/providerGuide";
import { PROVIDER_ROUTES, providerVitalAiProfilePath } from "../../../lib/providerRoutes";
import { supabase } from "../../../lib/supabase";
import { buildProtocolMedicationText, formatProtocolRecommendationTypeLabel, formatProtocolServiceLineLabel, formatProviderProtocolDecisionLabel, parseProtocolMedicationText } from "../display";
import { buildProviderReviewedProtocolSuggestion, getProtocolWorkflowOutcome, hasProtocolSuggestionEdits } from "../reviewFlow";
import type { AiProtocolAssessmentRow, ProviderProtocolDecision, ProviderProtocolReviewRow, StructuredProtocolSuggestion } from "../types";
import type { PatientRecord, VitalAiFileRow, VitalAiPathwayRow, VitalAiProfileRow, VitalAiSessionRow } from "../../../lib/vitalAi/types";

type EditableDraft = {
  suggestedProgram: string;
  suggestedMedications: string;
  suggestedDosage: string;
  suggestedFrequency: string;
  suggestedDuration: string;
  providerNotes: string;
};

const ASSESSMENT_SELECT_FIELDS =
  "id,vital_ai_session_id,vital_ai_profile_id,patient_id,intake_submission_id,clinic_id,location_id,service_line,recommendation_type,raw_output_json,structured_output_json,model_key,model_version,status,provider_review_required,created_at,updated_at";
const REVIEW_SELECT_FIELDS =
  "id,ai_protocol_assessment_id,provider_id,clinic_id,decision,final_protocol_json,provider_notes,signed_at,created_at,updated_at";

function buildDraft(suggestion: StructuredProtocolSuggestion, review?: ProviderProtocolReviewRow | null): EditableDraft {
  const source = review?.final_protocol_json ?? suggestion;
  return {
    suggestedProgram: source.suggested_program ?? "",
    suggestedMedications: buildProtocolMedicationText(source),
    suggestedDosage: source.suggested_dosage ?? "",
    suggestedFrequency: source.suggested_frequency ?? "",
    suggestedDuration: source.suggested_duration ?? "",
    providerNotes: review?.provider_notes ?? "",
  };
}

function patientName(patient: PatientRecord | null, profile: VitalAiProfileRow | null) {
  if (patient) return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  const profilePatient = (profile?.profile_json as { patient?: { first_name?: string; last_name?: string } } | null)?.patient;
  return `${profilePatient?.first_name ?? ""} ${profilePatient?.last_name ?? ""}`.trim() || "Patient";
}

export default function ProviderProtocolReview() {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const { user, resumeKey } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDecision, setSavingDecision] = useState<ProviderProtocolDecision | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AiProtocolAssessmentRow | null>(null);
  const [review, setReview] = useState<ProviderProtocolReviewRow | null>(null);
  const [profile, setProfile] = useState<VitalAiProfileRow | null>(null);
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [pathway, setPathway] = useState<VitalAiPathwayRow | null>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [files, setFiles] = useState<VitalAiFileRow[]>([]);
  const [draft, setDraft] = useState<EditableDraft>({
    suggestedProgram: "",
    suggestedMedications: "",
    suggestedDosage: "",
    suggestedFrequency: "",
    suggestedDuration: "",
    providerNotes: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      setSuccess(null);
      try {
        const { data: assessmentRow, error: assessmentError } = await supabase
          .from("ai_protocol_assessments")
          .select(ASSESSMENT_SELECT_FIELDS)
          .eq("id", assessmentId)
          .maybeSingle();
        if (assessmentError) throw assessmentError;

        const nextAssessment = (assessmentRow as AiProtocolAssessmentRow | null) ?? null;
        setAssessment(nextAssessment);
        if (!nextAssessment) return;

        const [
          { data: reviewRow, error: reviewError },
          { data: profileRow, error: profileError },
          { data: sessionRow, error: sessionError },
          { data: patientRow, error: patientError },
          { data: fileRows, error: fileError },
        ] = await Promise.all([
          supabase.from("provider_protocol_reviews").select(REVIEW_SELECT_FIELDS).eq("ai_protocol_assessment_id", nextAssessment.id).maybeSingle(),
          nextAssessment.vital_ai_profile_id
            ? supabase.from("vital_ai_profiles").select("*").eq("id", nextAssessment.vital_ai_profile_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from("vital_ai_sessions").select("*").eq("id", nextAssessment.vital_ai_session_id).maybeSingle(),
          nextAssessment.patient_id
            ? supabase
                .from("patients")
                .select("id,profile_id,clinic_id,location_id,first_name,last_name,phone,email,dob")
                .eq("id", nextAssessment.patient_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from("vital_ai_files").select("*").eq("session_id", nextAssessment.vital_ai_session_id).order("created_at", { ascending: false }),
        ]);

        if (reviewError) throw reviewError;
        if (profileError) throw profileError;
        if (sessionError) throw sessionError;
        if (patientError) throw patientError;
        if (fileError) throw fileError;

        const nextReview = (reviewRow as ProviderProtocolReviewRow | null) ?? null;
        const nextProfile = (profileRow as VitalAiProfileRow | null) ?? null;
        const nextSession = (sessionRow as VitalAiSessionRow | null) ?? null;
        const nextPatient = (patientRow as PatientRecord | null) ?? null;
        const nextFiles = (fileRows as VitalAiFileRow[] | null) ?? [];

        setReview(nextReview);
        setProfile(nextProfile);
        setSession(nextSession);
        setPatient(nextPatient);
        setFiles(nextFiles);

        if (nextSession?.pathway_id) {
          const { data: pathwayRow, error: pathwayError } = await supabase
            .from("vital_ai_pathways")
            .select("*")
            .eq("id", nextSession.pathway_id)
            .maybeSingle();
          if (pathwayError) throw pathwayError;
          setPathway((pathwayRow as VitalAiPathwayRow | null) ?? null);
        } else {
          setPathway(null);
        }

        setDraft(buildDraft(nextAssessment.structured_output_json, nextReview));
      } catch (loadError: unknown) {
        setErr(loadError instanceof Error ? loadError.message : "Failed to load the protocol review workspace.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [assessmentId, resumeKey]);

  const guide = buildProviderProtocolReviewGuide(!!review);
  const draftHasEdits = assessment
    ? hasProtocolSuggestionEdits({
        source: assessment.structured_output_json,
        draft: {
          suggestedProgram: draft.suggestedProgram,
          suggestedMedications: parseProtocolMedicationText(draft.suggestedMedications),
          suggestedDosage: draft.suggestedDosage,
          suggestedFrequency: draft.suggestedFrequency,
          suggestedDuration: draft.suggestedDuration,
        },
      })
    : false;

  const setDraftField = (key: keyof EditableDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submitDecision = async (nextDecision: ProviderProtocolDecision) => {
    if (!assessment || !user?.id) {
      setErr("A signed-in physician reviewer is required before this decision can be saved.");
      return;
    }

    setSaving(true);
    setSavingDecision(nextDecision);
    setErr(null);
    setSuccess(null);

    try {
      const signedAt = new Date().toISOString();
      const finalProtocolJson: ProviderProtocolReviewRow["final_protocol_json"] = buildProviderReviewedProtocolSuggestion({
        decision: nextDecision,
        source: assessment.structured_output_json,
        draft: {
          suggestedProgram: draft.suggestedProgram,
          suggestedMedications: parseProtocolMedicationText(draft.suggestedMedications),
          suggestedDosage: draft.suggestedDosage,
          suggestedFrequency: draft.suggestedFrequency,
          suggestedDuration: draft.suggestedDuration,
        },
        providerNotes: draft.providerNotes,
        reviewerId: user.id,
        reviewedAt: signedAt,
      });
      const workflowOutcome = getProtocolWorkflowOutcome(nextDecision);

      const reviewPayload = {
        ai_protocol_assessment_id: assessment.id,
        provider_id: user.id,
        clinic_id: assessment.clinic_id,
        decision: nextDecision,
        final_protocol_json: finalProtocolJson,
        provider_notes: draft.providerNotes.trim() || null,
        signed_at: signedAt,
      };

      const { data: savedReview, error: reviewError } = await supabase
        .from("provider_protocol_reviews")
        .upsert(reviewPayload, { onConflict: "ai_protocol_assessment_id" })
        .select(REVIEW_SELECT_FIELDS)
        .single();
      if (reviewError) throw reviewError;

      const followUpQueries = [
        supabase.from("ai_protocol_assessments").update({ status: workflowOutcome.assessmentStatus }).eq("id", assessment.id),
        supabase
          .from("vital_ai_review_tasks")
          .update({ status: "closed" })
          .eq("session_id", assessment.vital_ai_session_id)
          .in("task_type", workflowOutcome.closeTaskTypes),
      ];

      if (profile?.id) {
        followUpQueries.push(
          supabase
            .from("vital_ai_profiles")
            .update({ status: workflowOutcome.profileStatus })
            .eq("id", profile.id)
        );
      }

      if (workflowOutcome.leadStatus) {
        followUpQueries.push(
          supabase
            .from("vital_ai_leads")
            .update({ lead_status: workflowOutcome.leadStatus, next_action_at: null })
            .eq("session_id", assessment.vital_ai_session_id)
        );
      }

      const results = await Promise.all(followUpQueries);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      setReview(savedReview as ProviderProtocolReviewRow);
      setSuccess(
        nextDecision === "rejected"
          ? draftHasEdits
            ? "Protocol rejected and signed. The AI-assisted suggestion remains on file, and draft edits were not applied."
            : "Protocol rejected. The AI-assisted suggestion remains on file, and the physician rejection has been signed."
          : nextDecision === "modified"
          ? "Modified protocol signed and saved. Clinical decision remains physician-reviewed."
          : draftHasEdits
          ? "AI suggestion approved and signed. Draft edits were not applied; use Save Modifications to persist physician changes."
          : "Protocol approved and signed. Downstream routing can now use the physician-reviewed decision."
      );
    } catch (saveError: unknown) {
      setErr(saveError instanceof Error ? saveError.message : "Failed to save the physician review decision.");
    } finally {
      setSaving(false);
      setSavingDecision(null);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Protocol Review"
          subtitle="Review and sign off on the AI-assisted protocol suggestion."
          backTo={PROVIDER_ROUTES.protocolQueue}
          homeTo={PROVIDER_ROUTES.home}
        />

        <div className="space" />

        <VitalityHero
          title="Protocol Review"
          subtitle="AI-assisted suggestion plus physician-reviewed final decision, with provider approval required before anything moves forward."
          secondaryCta={{ label: "Back", to: PROVIDER_ROUTES.protocolQueue }}
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
            { label: "Back to Queue", to: PROVIDER_ROUTES.protocolQueue, tone: "primary" },
            profile ? { label: "Open Intake", to: providerVitalAiProfilePath(profile.id) } : { label: "Vital AI Requests", to: PROVIDER_ROUTES.vitalAi },
          ]}
        />

        <div className="space" />

        {err ? <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} /> : null}
        {success ? <InlineNotice message={success} tone="success" style={{ marginBottom: 12 }} /> : null}

        {loading ? (
          <div className="card card-pad">
            <div className="muted">Loading protocol review...</div>
          </div>
        ) : !assessment ? (
          <div className="card card-pad">
            <div className="muted">Protocol assessment not found.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div className="h2">{patientName(patient, profile)}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {pathway?.name ?? "Vital AI pathway"} | {formatProtocolServiceLineLabel(assessment.service_line)} |{" "}
                    {formatProtocolRecommendationTypeLabel(assessment.recommendation_type)}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <div className="v-chip">Assessment status: <strong>{assessment.status}</strong></div>
                  <div className="v-chip">{review ? formatProviderProtocolDecisionLabel(review.decision) : "Awaiting physician sign-off"}</div>
                </div>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="v-chip">Model: <strong>{assessment.model_key}</strong></div>
                <div className="v-chip">Generated: <strong>{new Date(assessment.created_at).toLocaleString()}</strong></div>
                {session?.current_step_key ? <div className="v-chip">Session step: <strong>{session.current_step_key}</strong></div> : null}
                {review?.signed_at ? <div className="v-chip">Signed: <strong>{new Date(review.signed_at).toLocaleString()}</strong></div> : null}
              </div>
            </div>

            {profile ? <ProfileSummaryCard profile={profile} /> : null}

            <div className="card card-pad card-light surface-light" style={{ color: "#241B3D" }}>
              <div className="h2">AI-Assisted Suggestion</div>
              <div className="space" />
              <div style={{ lineHeight: 1.7, color: "#3E355C" }}>{assessment.structured_output_json.rationale_summary}</div>
              <div className="space" />
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="v-chip">Program: <strong>{assessment.structured_output_json.suggested_program ?? "Physician to determine"}</strong></div>
                <div className="v-chip">Missing items: <strong>{assessment.structured_output_json.missing_required_labs.length}</strong></div>
                <div className="v-chip">Risk flags: <strong>{assessment.structured_output_json.risk_flags.length}</strong></div>
              </div>
            </div>

            {review ? (
              <div className="card card-pad card-light surface-light" style={{ background: "rgba(245,240,255,0.72)", color: "#241B3D" }}>
                <div className="h2">Saved Physician Decision</div>
                <div className="space" />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <div className="v-chip">Decision: <strong>{formatProviderProtocolDecisionLabel(review.decision)}</strong></div>
                  <div className="v-chip">Provider ID: <strong>{review.provider_id}</strong></div>
                  {review.signed_at ? <div className="v-chip">Signed at: <strong>{new Date(review.signed_at).toLocaleString()}</strong></div> : null}
                </div>
                {review.provider_notes ? (
                  <>
                    <div className="space" />
                    <div style={{ lineHeight: 1.6, color: "#3E355C" }}>{review.provider_notes}</div>
                  </>
                ) : null}
                <div className="space" />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <div className="v-chip">
                    Final program: <strong>{review.final_protocol_json.suggested_program ?? "Physician to determine"}</strong>
                  </div>
                  <div className="v-chip">
                    Recommendation source: <strong>{review.decision === "modified" ? "Physician-edited final recommendation" : "Original AI suggestion preserved"}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="card card-pad">
              <div className="h2">Physician Review Workspace</div>
              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  value={draft.suggestedProgram}
                  onChange={(event) => setDraftField("suggestedProgram", event.target.value)}
                  placeholder="Final program"
                  style={{ flex: "1 1 320px" }}
                />
                <input
                  className="input"
                  value={draft.suggestedMedications}
                  onChange={(event) => setDraftField("suggestedMedications", event.target.value)}
                  placeholder="Final medications or pathway notes"
                  style={{ flex: "2 1 420px" }}
                />
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  value={draft.suggestedDosage}
                  onChange={(event) => setDraftField("suggestedDosage", event.target.value)}
                  placeholder="Final dosage"
                  style={{ flex: "1 1 220px" }}
                />
                <input
                  className="input"
                  value={draft.suggestedFrequency}
                  onChange={(event) => setDraftField("suggestedFrequency", event.target.value)}
                  placeholder="Final frequency"
                  style={{ flex: "1 1 220px" }}
                />
                <input
                  className="input"
                  value={draft.suggestedDuration}
                  onChange={(event) => setDraftField("suggestedDuration", event.target.value)}
                  placeholder="Final duration"
                  style={{ flex: "1 1 220px" }}
                />
              </div>

              <div className="space" />

              <textarea
                className="input"
                style={{ width: "100%", minHeight: 96 }}
                value={draft.providerNotes}
                onChange={(event) => setDraftField("providerNotes", event.target.value)}
                placeholder="Physician notes and sign-off comments"
              />

              <div className="space" />

              <div className="card card-pad card-light surface-light" style={{ background: "rgba(250,247,255,0.7)", color: "#241B3D" }}>
                <div style={{ fontWeight: 800 }}>Decision behavior</div>
                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                  Approve signs the AI suggestion as-is. Save Modifications stores the edited recommendation as the physician-final protocol. Reject signs the review and removes the case from the approval queue.
                </div>
                {draftHasEdits ? (
                  <div style={{ marginTop: 8, color: "#5B4E86" }}>
                    Draft edits are present. Use Save Modifications if those changes should become the final physician recommendation.
                  </div>
                ) : null}
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light" style={{ background: "rgba(250,247,255,0.7)", color: "#241B3D" }}>
                <div style={{ fontWeight: 800 }}>Sign-off guardrail</div>
                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                  This is AI-assisted clinical decision support only. Provider approval is required, and the clinical decision remains with the licensed physician.
                </div>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDecision("approved")}
                >
                  {saving && savingDecision === "approved" ? "Saving..." : "Approve AI Suggestion"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDecision("modified")}
                >
                  {saving && savingDecision === "modified" ? "Saving..." : "Save Modifications"}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDecision("rejected")}
                >
                  {saving && savingDecision === "rejected" ? "Saving..." : "Reject"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => navigate(PROVIDER_ROUTES.protocolQueue)} disabled={saving}>
                  Back to Queue
                </button>
              </div>
            </div>

            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div className="card card-pad" style={{ flex: "1 1 320px" }}>
                <div className="h2">Missing Items</div>
                <div className="space" />
                {assessment.structured_output_json.missing_required_labs.length === 0 ? (
                  <div className="muted">No missing baseline items were detected.</div>
                ) : (
                  assessment.structured_output_json.missing_required_labs.map((item) => (
                    <div key={item} style={{ marginBottom: 4 }}>- {item}</div>
                  ))
                )}
              </div>

              <div className="card card-pad" style={{ flex: "1 1 320px" }}>
                <div className="h2">Risk Flags</div>
                <div className="space" />
                {assessment.structured_output_json.risk_flags.length === 0 ? (
                  <div className="muted">No additional risk flags were generated.</div>
                ) : (
                  assessment.structured_output_json.risk_flags.map((item) => (
                    <div key={item} style={{ marginBottom: 4 }}>- {item}</div>
                  ))
                )}
              </div>

              <div className="card card-pad" style={{ flex: "1 1 320px" }}>
                <div className="h2">Uploaded Files</div>
                <div className="space" />
                {files.length === 0 ? (
                  <div className="muted">No uploaded files were attached to this intake.</div>
                ) : (
                  files.map((file) => (
                    <div key={file.id} style={{ marginBottom: 4 }}>
                      - {file.category}: {file.filename}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
