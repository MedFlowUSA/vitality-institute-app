import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import PathwaySelector from "../components/vital-ai/PathwaySelector";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { loadVitalAiPathways } from "../lib/vitalAi/pathways";
import { createVitalAiSession, resolveCurrentPatient } from "../lib/vitalAi/submission";
import type { PatientRecord, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function VitalAiIntakeHome() {
  const { user, resumeKey } = useAuth();
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
  }, [resumeKey, user?.id]);

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
        <RouteHeader
          title="Vital AI Intake"
          subtitle="Move between intake, your dashboard, and saved drafts without relying on browser navigation."
          backTo="/patient"
          homeTo="/patient"
        />

        <div className="space" />

        <VitalityHero
          title="Vital AI"
          subtitle="Start or resume your intake so our care team can prepare for your visit with the right information ahead of time."
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
          <div
            className="card card-pad"
            style={{
              flex: "1 1 420px",
              minWidth: 320,
              background: "rgba(8,15,28,0.98)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
            }}
          >
            <div className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.78)" }}>
              Welcome to Vital AI
            </div>
            <div className="h2" style={{ marginTop: 6, color: "#F8FAFC" }}>A guided intake experience</div>
            <div style={{ marginTop: 8, lineHeight: 1.7, color: "rgba(226,232,240,0.86)" }}>
              Vital AI helps you move step by step, saves your progress automatically, and routes your intake to the right care team for review.
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <div className="v-chip" style={{ background: "rgba(200,182,255,0.18)", border: "1px solid rgba(200,182,255,0.34)", color: "#F8FAFC" }}>General Consultation</div>
              <div className="v-chip" style={{ background: "rgba(200,182,255,0.18)", border: "1px solid rgba(200,182,255,0.34)", color: "#F8FAFC" }}>Wound Care</div>
              <div className="v-chip" style={{ background: "rgba(200,182,255,0.18)", border: "1px solid rgba(200,182,255,0.34)", color: "#F8FAFC" }}>Draft Resume</div>
              <div className="v-chip" style={{ background: "rgba(200,182,255,0.18)", border: "1px solid rgba(200,182,255,0.34)", color: "#F8FAFC" }}>Secure Uploads</div>
            </div>
          </div>

          <div style={{ flex: "1 1 340px", minWidth: 300 }}>
            <VitalAiAvatarAssistant stepKey="contact" title="Vital AI Guide" />
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad" style={{ background: "rgba(8,15,28,0.98)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Choose Your Intake Pathway</div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, color: "rgba(226,232,240,0.84)" }}>
            Vital AI now supports general consultation, wound care, wellness, peptides, and GLP-1. Your progress is saved automatically once you begin.
          </div>

          <div className="space" />

          {loading ? <div className="muted">Loading pathways...</div> : <PathwaySelector pathways={pathways} busySlug={busySlug} onSelect={startPathway} />}
        </div>

        <div className="space" />

        <div className="card card-pad" style={{ background: "rgba(8,15,28,0.98)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Resume Draft Intake</div>
          <div className="space" />
          {loading ? (
            <div className="muted" style={{ color: "rgba(226,232,240,0.82)" }}>Loading drafts...</div>
          ) : drafts.length === 0 ? (
            <div className="muted" style={{ color: "rgba(226,232,240,0.82)" }}>No draft intakes yet.</div>
          ) : (
            drafts.map((draft) => (
              <button
                key={draft.id}
                className="btn btn-ghost"
                type="button"
                style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "#F8FAFC", minHeight: 52 }}
                onClick={() => navigate(`/intake/session/${draft.id}`)}
              >
                <span>
                  <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{draft.current_step_key || "Continue intake"}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, color: "rgba(226,232,240,0.8)" }}>
                    Last saved {new Date(draft.last_saved_at).toLocaleString()}
                  </div>
                </span>
                <span className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.8)" }}>
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
