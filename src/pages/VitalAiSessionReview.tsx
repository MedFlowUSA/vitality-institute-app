import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import {
  guidedGhostButtonStyle,
  guidedPanelSoftStyle,
  guidedPanelStyle,
  guidedPrimaryButtonStyle,
} from "../components/vital-ai/guidedIntakeStyles";
import ReviewSummary from "../components/vital-ai/ReviewSummary";
import { useAuth } from "../auth/AuthProvider";
import { loadVitalAiPathwayById } from "../lib/vitalAi/pathways";
import { loadVitalAiFiles, loadVitalAiResponses, loadVitalAiSession, loadVitalAiSubmitArtifacts, resolveCurrentPatient, responsesToMap, submitVitalAiSession } from "../lib/vitalAi/submission";
import type { PatientRecord, VitalAiFileRow, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function VitalAiSessionReview() {
  const { sessionId = "" } = useParams();
  const { user, resumeKey } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [pathway, setPathway] = useState<VitalAiPathwayRow | null>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<VitalAiFileRow[]>([]);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!sessionId || !user?.id) return;
      setLoading(true);
      setErr(null);

      try {
        const nextSession = await loadVitalAiSession(sessionId);
        if (!nextSession) throw new Error("Intake session not found.");

        const [nextPathway, nextPatient, responseRows, fileRows] = await Promise.all([
          loadVitalAiPathwayById(nextSession.pathway_id),
          resolveCurrentPatient(user.id),
          loadVitalAiResponses(sessionId),
          loadVitalAiFiles(sessionId),
        ]);

        if (!nextPathway) throw new Error("Pathway not found.");
        const submitArtifacts = await loadVitalAiSubmitArtifacts(nextSession.id);
        if (nextSession.status === "submitted" && submitArtifacts.profile && submitArtifacts.lead && submitArtifacts.tasks.length >= 2) {
          navigate(`/intake/session/${nextSession.id}/complete`, { replace: true });
          return;
        }
        if (nextSession.status === "submitted" && (!submitArtifacts.profile || !submitArtifacts.lead || submitArtifacts.tasks.length < 2)) {
          setErr("Your intake was marked submitted, but provider routing is still incomplete. Submit once more to finish setup.");
        }

        setSession(nextSession);
        setPathway(nextPathway);
        setPatient(nextPatient);
        setAnswers(responsesToMap(responseRows));
        setFiles(fileRows);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load intake review.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [resumeKey, sessionId, user?.id]);

  const handleSubmit = async () => {
    if (!session || !pathway || submitting || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setErr(null);
    try {
      const result = await submitVitalAiSession({ session, pathway, patient, answers, files });
      if (!result.profile?.id || !result.lead?.id) {
        throw new Error("Your intake was saved, but provider review setup is still incomplete. Please try again.");
      }
      navigate(`/intake/session/${session.id}/complete`, { replace: true });
    } catch (e: any) {
      console.error("[VitalAI submit] review submit failed", {
        sessionId: session.id,
        error: e,
      });
      setErr(e?.message ?? "Failed to submit intake.");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Review Intake"
          subtitle="Review your answers before you submit."
          backTo={sessionId ? `/intake/session/${sessionId}` : "/intake"}
          homeTo="/patient/home"
        />

        <div className="space" />

        <VitalityHero
          title="Review Vital AI Intake"
          subtitle="Confirm your answers, then submit them to the Vitality team."
          secondaryCta={{ label: "Back to Session", to: sessionId ? `/intake/session/${sessionId}` : "/intake" }}
          showKpis={false}
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad" style={guidedPanelStyle}>
            <div className="muted" style={{ color: "rgba(226,232,240,0.82)" }}>Loading review...</div>
          </div>
        ) : !pathway || !session ? (
          <div className="card card-pad" style={guidedPanelStyle}>
            <div className="muted" style={{ color: "rgba(226,232,240,0.82)" }}>This intake review is unavailable.</div>
          </div>
        ) : (
          <>
            <VitalAiAvatarAssistant stepKey="consent" title="Review with Vital AI" pathwaySlug={pathway.slug} answers={answers} />

            <div className="space" />

            {err ? (
              <>
                <div className="card card-pad" style={{ color: "crimson" }}>
                  {err}
                </div>
                <div className="space" />
              </>
            ) : null}

            <ReviewSummary definition={pathway.definition_json} answers={answers} files={files} />

            <div className="space" />

            <div className="card card-pad" style={guidedPanelStyle}>
              <div className="card card-pad" style={{ ...guidedPanelSoftStyle, marginBottom: 14 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Final Check</div>
                    <div style={{ marginTop: 6, fontWeight: 800 }}>Submit only after you are comfortable with every answer and upload.</div>
                  </div>
                  <div className="v-chip">Pathway: {pathway.name}</div>
                </div>
              </div>
              <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-secondary" type="button" onClick={() => navigate(`/intake/session/${session.id}`)} style={{ ...guidedGhostButtonStyle, minHeight: 48, padding: "12px 16px" }}>
                  Edit Answers
                </button>
                <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={submitting} style={{ ...guidedPrimaryButtonStyle, minHeight: 48, padding: "12px 18px" }}>
                  {submitting ? "Submitting..." : "Submit Intake"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
