import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

const cardStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,241,255,0.92))",
  border: "1px solid rgba(184,164,255,0.22)",
  color: "#241B3D",
} as const;

const eyebrowStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6D5BA8",
  textTransform: "uppercase" as const,
  letterSpacing: ".08em",
};

export default function PatientBilling() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Basket & Payment Methods"
          subtitle="This area is reserved for future patient checkout, saved payment methods, and basket review."
          secondaryCta={{ label: "Back to Dashboard", to: "/patient/home" }}
          rightActions={
            <button className="btn btn-secondary" type="button" onClick={signOut}>
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad card-light surface-light" style={cardStyle}>
          <div style={eyebrowStyle}>Placeholder</div>
          <div className="h2" style={{ marginTop: 8 }}>Checkout is not live yet.</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            We are reserving this section for a future patient basket, saved payment methods,
            and service checkout experience. For now, booking and clinic follow-up still happen
            through the appointment and intake workflow.
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn btn-primary" type="button" onClick={() => navigate("/patient/services")}>
              Browse Services
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/patient/book")}>
              Book a Visit
            </button>
          </div>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          <div className="card card-pad card-light surface-light" style={{ ...cardStyle, flex: "1 1 320px", minWidth: 280 }}>
            <div style={eyebrowStyle}>Basket</div>
            <div className="h2" style={{ marginTop: 8 }}>Your future service basket</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
              Selected services, packages, or recommended follow-up items will appear here once
              checkout is enabled. This placeholder keeps the patient flow visible without implying
              that charges can be processed today.
            </div>
            <div className="space" />
            <div className="v-chip">Coming Soon</div>
          </div>

          <div className="card card-pad card-light surface-light" style={{ ...cardStyle, flex: "1 1 320px", minWidth: 280 }}>
            <div style={eyebrowStyle}>Payment Methods</div>
            <div className="h2" style={{ marginTop: 8 }}>Saved cards and payment options</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
              Saved cards, HSA/FSA-friendly reminders, and other payment-method controls will live
              here later. Until then, payment handling remains outside this patient portal placeholder.
            </div>
            <div className="space" />
            <div className="v-chip">Coming Soon</div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad card-light surface-light" style={cardStyle}>
          <div style={eyebrowStyle}>What To Expect</div>
          <div className="h2" style={{ marginTop: 8 }}>What this section will eventually support</div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 16, alignItems: "stretch" }}>
            <div className="card card-pad" style={{ flex: "1 1 220px", minWidth: 220, background: "rgba(255,255,255,0.72)" }}>
              <div style={{ fontWeight: 800, color: "#241B3D" }}>Service Basket</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                Review selected services before final confirmation.
              </div>
            </div>
            <div className="card card-pad" style={{ flex: "1 1 220px", minWidth: 220, background: "rgba(255,255,255,0.72)" }}>
              <div style={{ fontWeight: 800, color: "#241B3D" }}>Payment Methods</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                Store and manage future patient payment preferences.
              </div>
            </div>
            <div className="card card-pad" style={{ flex: "1 1 220px", minWidth: 220, background: "rgba(255,255,255,0.72)" }}>
              <div style={{ fontWeight: 800, color: "#241B3D" }}>Checkout Summary</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                See item totals and payment-ready summaries when checkout goes live.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
