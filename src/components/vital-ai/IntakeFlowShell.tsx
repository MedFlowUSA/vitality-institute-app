import type { IntakeStep } from "../../lib/vitalAi/types";

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
  return (
    <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div
        className="card card-pad"
        style={{
          flex: "0 0 280px",
          minWidth: 240,
          background: "rgba(7,13,25,0.96)",
          border: "1px solid rgba(200,182,255,0.18)",
        }}
      >
        <div className="h2">{title}</div>
        {subtitle ? (
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, color: "rgba(226,232,240,0.84)" }}>
            {subtitle}
          </div>
        ) : null}

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
                background: active ? "linear-gradient(135deg, rgba(200,182,255,0.24), rgba(139,124,255,0.16))" : "rgba(255,255,255,0.06)",
                border: active ? "1px solid rgba(200,182,255,0.42)" : "1px solid rgba(255,255,255,0.12)",
                boxShadow: active ? "0 10px 24px rgba(139,124,255,0.16)" : "none",
              }}
            >
              <div style={{ fontWeight: 800, color: "#F8FAFC" }}>
                {index + 1}. {step.title}
              </div>
              {step.description ? (
                <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "rgba(226,232,240,0.78)" }}>
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
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
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
          background: "rgba(8,15,28,0.98)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {children}

        <div className="space" />

        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onBack}
            disabled={disableBack}
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#F8FAFC",
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
                background: "linear-gradient(135deg, #C8B6FF, #8B7CFF)",
                color: "#140F24",
                border: "1px solid rgba(184,164,255,0.38)",
                boxShadow: "0 14px 28px rgba(139,124,255,0.22)",
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
                background: "linear-gradient(135deg, #C8B6FF, #8B7CFF)",
                color: "#140F24",
                border: "1px solid rgba(184,164,255,0.38)",
                boxShadow: "0 14px 28px rgba(139,124,255,0.22)",
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
