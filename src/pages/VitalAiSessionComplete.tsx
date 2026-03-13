import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import VitalAI from "../lib/vital-ai/vitalAiService";
import { loadVitalAiResponses, loadVitalAiSession } from "../lib/vitalAi/submission";
import { loadVitalAiPathwayById } from "../lib/vitalAi/pathways";
import type { VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function VitalAiSessionComplete() {
  const { sessionId = "" } = useParams();
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [pathway, setPathway] = useState<VitalAiPathwayRow | null>(null);
  const [guidance, setGuidance] = useState<ReturnType<typeof VitalAI.generatePatientGuidance> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionId) return;
      try {
        const nextSession = await loadVitalAiSession(sessionId);
        if (!nextSession) return;
        const [nextPathway, nextResponses] = await Promise.all([
          loadVitalAiPathwayById(nextSession.pathway_id),
          loadVitalAiResponses(sessionId),
        ]);
        setSession(nextSession);
        setPathway(nextPathway);
        const sessionWithPathway = {
          ...nextSession,
          current_step_key: nextPathway?.slug ?? nextSession.current_step_key,
        };
        setGuidance(VitalAI.generatePatientGuidance(sessionWithPathway, nextResponses));
      } catch {
        // keep completion screen resilient even if enrichment data fails to load
      }
    };

    load();
  }, [sessionId]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vital AI Intake Submitted"
          subtitle="Your intake has been received and routed for staff follow-up and provider review."
          secondaryCta={{ label: "Back to Patient Home", to: "/patient" }}
          showKpis={false}
        />

        <div className="space" />

        <VitalAiAvatarAssistant stepKey="complete" isComplete pathwaySlug={pathway?.slug} answers={undefined} />

        <div className="space" />

        <div className="card card-pad" style={{ background: "rgba(8,15,28,0.98)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Submission Complete</div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, color: "rgba(226,232,240,0.82)" }}>
            Session ID: <strong>{sessionId}</strong>
          </div>
          <div className="space" />
          <div style={{ lineHeight: 1.7, color: "#F8FAFC" }}>
            The Vitality team now has your submitted intake, uploads, and pathway details. Staff follow-up and provider review tasks were created automatically.
          </div>
        </div>

        {guidance ? (
          <>
            <div className="space" />
            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, rgba(245,240,255,0.96), rgba(234,226,255,0.94))",
                border: "1px solid rgba(184,164,255,0.34)",
                boxShadow: "0 16px 38px rgba(17,24,39,0.16)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#5B4E86" }}>
                Vital AI Guidance
              </div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#241B3D" }}>{guidance.title}</div>
              <div style={{ marginTop: 10, lineHeight: 1.8, color: "#3E355C", maxWidth: 760 }}>
                {guidance.body}
              </div>
              {session?.completed_at ? (
                <div className="muted" style={{ marginTop: 12, color: "#5B4E86" }}>
                  Submitted {new Date(session.completed_at).toLocaleString()}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
