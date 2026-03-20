import type { IntakeStep } from "../../lib/vitalAi/types";
import {
  guidedGhostButtonStyle,
  guidedHelperStyle,
  guidedMutedStyle,
  guidedPanelSoftStyle,
  guidedPanelStyle,
  guidedPrimaryButtonStyle,
} from "./guidedIntakeStyles";

export default function IntakeFlowShell({
  title,
  subtitle,
  steps,
  activeIndex,
  children,
  onBack,
  onNext,
  onReview,
  disableBack,
  disableNext,
  isLastStep,
  saveStateLabel,
  headerAside,
}: {
  title: string;
  subtitle?: string;
  steps: IntakeStep[];
  activeIndex: number;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  onReview: () => void;
  disableBack?: boolean;
  disableNext?: boolean;
  isLastStep?: boolean;
  saveStateLabel?: string;
  headerAside?: React.ReactNode;
}) {
  const totalSteps = steps.length;
  const currentStep = totalSteps === 0 ? 0 : activeIndex + 1;
  const progress = totalSteps === 0 ? 0 : Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div
        className="card card-pad"
        style={{
          flex: "0 0 280px",
          minWidth: 240,
          ...guidedPanelStyle,
          position: "sticky",
          top: 16,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="h2">{title}</div>
          <div className="v-chip">Step {currentStep} of {totalSteps}</div>
        </div>
        {subtitle ? (
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, ...guidedMutedStyle }}>
            {subtitle}
          </div>
        ) : null}

        <div className="space" />

        <div className="card card-pad" style={{ ...guidedPanelSoftStyle, padding: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>Progress</div>
            <div style={{ fontWeight: 800 }}>{progress}%</div>
          </div>
          <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #C8B6FF, #8B7CFF)",
                boxShadow: "0 0 18px rgba(139,124,255,0.35)",
              }}
            />
          </div>
        </div>

        {headerAside ? (
          <>
            <div className="space" />
            {headerAside}
          </>
        ) : null}

        <div className="space" />

        {steps.map((step, index) => {
          const active = index === activeIndex;
          return (
            <div
              key={step.key}
              className="card card-pad"
              style={{
                marginBottom: 10,
                background: active ? "linear-gradient(135deg, rgba(200,182,255,0.24), rgba(139,124,255,0.16))" : guidedPanelSoftStyle.background,
                border: active ? "1px solid rgba(200,182,255,0.42)" : "1px solid rgba(255,255,255,0.12)",
                boxShadow: active ? "0 10px 24px rgba(139,124,255,0.16)" : "none",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 800, color: "#F8FAFC" }}>
                  {index + 1}. {step.title}
                </div>
                {active ? <div className="v-chip">Current</div> : null}
              </div>
              {step.description ? (
                <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, ...guidedHelperStyle }}>
                  {step.description}
                </div>
              ) : null}
            </div>
          );
        })}

        {saveStateLabel ? (
          <>
            <div className="space" />
            <div
              className="card card-pad"
              style={{
                fontSize: 12,
                ...guidedPanelSoftStyle,
                color: "#F8FAFC",
              }}
            >
              {saveStateLabel}
            </div>
          </>
        ) : null}
      </div>

      <div
        className="card card-pad"
        style={{
          flex: "1 1 720px",
          minWidth: 320,
          ...guidedPanelStyle,
        }}
      >
        <div className="card card-pad" style={{ ...guidedPanelSoftStyle, marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>Guided Intake</div>
              <div style={{ marginTop: 6, fontWeight: 800 }}>Answer only what is needed for this section.</div>
            </div>
            <div className="v-chip">Current section: {steps[activeIndex]?.title ?? "Intake"}</div>
          </div>
        </div>

        {children}

        <div className="space" />

        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onBack}
            disabled={disableBack}
            style={{
              ...guidedGhostButtonStyle,
              opacity: disableBack ? 0.55 : 1,
            }}
          >
            Back
          </button>

          {isLastStep ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={onReview}
              disabled={disableNext}
              style={{
                ...guidedPrimaryButtonStyle,
                opacity: disableNext ? 0.55 : 1,
              }}
            >
              Review Submission
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              onClick={onNext}
              disabled={disableNext}
              style={{
                ...guidedPrimaryButtonStyle,
                opacity: disableNext ? 0.55 : 1,
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
