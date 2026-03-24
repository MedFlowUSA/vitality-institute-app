type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
};

export default function ProviderPrerequisiteCard({
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: Props) {
  return (
    <div
      className="card card-pad"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="h2">{title}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
        {message}
      </div>
      {actionLabel || secondaryLabel ? (
        <>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {actionLabel && onAction ? (
              <button className="btn btn-primary" type="button" onClick={onAction}>
                {actionLabel}
              </button>
            ) : null}
            {secondaryLabel && onSecondaryAction ? (
              <button className="btn btn-ghost" type="button" onClick={onSecondaryAction}>
                {secondaryLabel}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
