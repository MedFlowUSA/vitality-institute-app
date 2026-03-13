import { useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";

export default function VitalAiSessionComplete() {
  const { sessionId = "" } = useParams();

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

        <VitalAiAvatarAssistant stepKey="complete" isComplete />

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
      </div>
    </div>
  );
}
