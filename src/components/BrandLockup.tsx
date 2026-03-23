import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/vitality-logo.png";

type BrandLockupProps = {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  to?: string;
  compact?: boolean;
  aside?: ReactNode;
};

export default function BrandLockup({
  title = "Vitality Institute",
  subtitle,
  eyebrow,
  to,
  compact = false,
  aside,
}: BrandLockupProps) {
  const content = (
    <div
      className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}
      style={{ width: "100%", maxWidth: compact ? 360 : 520 }}
    >
      <div
        className="brand-lockup-mark"
        style={{
          width: compact ? 36 : 42,
          height: compact ? 36 : 42,
          minWidth: compact ? 36 : 42,
          minHeight: compact ? 36 : 42,
        }}
      >
        <img
          src={logo}
          alt="Vitality Institute"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>
      <div className="brand-lockup-copy">
        {eyebrow ? <div className="brand-lockup-eyebrow">{eyebrow}</div> : null}
        <div className="brand-lockup-title">{title}</div>
        {subtitle ? <div className="brand-lockup-subtitle">{subtitle}</div> : null}
      </div>
      {aside ? <div className="brand-lockup-aside">{aside}</div> : null}
    </div>
  );

  if (!to) return content;

  return (
    <Link to={to} className="brand-lockup-link">
      {content}
    </Link>
  );
}
