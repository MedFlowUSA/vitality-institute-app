import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import PathwaySelector from "../components/vital-ai/PathwaySelector";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { loadVitalAiPathways } from "../lib/vitalAi/pathways";
import { createVitalAiSession, resolveCurrentPatient } from "../lib/vitalAi/submission";
import type { PatientRecord, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function VitalAiIntakeHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pathways, setPathways] = useState<VitalAiPathwayRow[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [drafts, setDrafts] = useState<VitalAiSessionRow[]>([]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErr(null);

    try {
      const [pathwayRows, patientRow, draftRows] = await Promise.all([
        loadVitalAiPathways(),
        resolveCurrentPatient(user.id),
        supabase
          .from("vital_ai_sessions")
          .select("*")
          .eq("profile_id", user.id)
          .eq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(10),
      ]);

      if (draftRows.error) throw draftRows.error;

      setPathways(pathwayRows);
      setPatient(patientRow);
      setDrafts((draftRows.data as VitalAiSessionRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load Vital AI intake options.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const startPathway = async (pathway: VitalAiPathwayRow) => {
    if (!user?.id) return;
    setBusySlug(pathway.slug);
    setErr(null);

    try {
      const session = await createVitalAiSession({ pathway, patient, profileId: user.id });
      navigate(`/intake/session/${session.id}`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start intake.");
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vital AI Intake"
          subtitle="Choose the right pathway, save your progress, and submit everything your care team needs."
          secondaryCta={{ label: "Back", to: "/patient" }}
          showKpis={false}
        />

        <div className="space" />

        {err ? (
          <>
            <div className="card card-pad" style={{ color: "crimson" }}>
              {err}
            </div>
            <div className="space" />
          </>
        ) : null}

        <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
            <div className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.82)" }}>
              Welcome to Vital AI
            </div>
            <div className="h2" style={{ marginTop: 6 }}>A guided intake experience</div>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, color: "rgba(226,232,240,0.84)" }}>
              Vital AI helps you move step by step, saves your progress automatically, and routes your intake to the right care team for review.
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <div className="v-chip">General Consultation</div>
              <div className="v-chip">Wound Care</div>
              <div className="v-chip">Draft Resume</div>
              <div className="v-chip">Secure Uploads</div>
            </div>
          </div>

          <div style={{ flex: "1 1 340px", minWidth: 300 }}>
            <VitalAiAvatarAssistant stepKey="contact" title="Vital AI Guide" />
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">Choose Your Intake Pathway</div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Phase 1 includes general consultation and wound care. Your progress is saved automatically once you begin.
          </div>

          <div className="space" />

          {loading ? <div className="muted">Loading pathways...</div> : <PathwaySelector pathways={pathways} busySlug={busySlug} onSelect={startPathway} />}
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">Resume Draft Intake</div>
          <div className="space" />
          {loading ? (
            <div className="muted">Loading drafts...</div>
          ) : drafts.length === 0 ? (
            <div className="muted">No draft intakes yet.</div>
          ) : (
            drafts.map((draft) => (
              <button
                key={draft.id}
                className="btn btn-ghost"
                type="button"
                style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left" }}
                onClick={() => navigate(`/intake/session/${draft.id}`)}
              >
                <span>
                  <div style={{ fontWeight: 800 }}>{draft.current_step_key || "Continue intake"}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Last saved {new Date(draft.last_saved_at).toLocaleString()}
                  </div>
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Resume
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
