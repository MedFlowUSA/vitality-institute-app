import type { CSSProperties } from "react";

type InlineNoticeTone = "info" | "success" | "warning" | "error";

export default function InlineNotice({
  message,
  tone = "info",
  onDismiss,
  className = "",
  style,
}: {
  message: string;
  tone?: InlineNoticeTone;
  onDismiss?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`inline-notice inline-notice-${tone}${className ? ` ${className}` : ""}`}
      role={tone === "error" ? "alert" : "status"}
      style={style}
    >
      <div className="inline-notice-copy">{message}</div>
      {onDismiss ? (
        <button className="btn btn-secondary inline-notice-dismiss" type="button" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
