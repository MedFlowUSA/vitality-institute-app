import type { ReactNode } from "react";
import logo from "../assets/vitality-logo.png";

type VitalityHeaderProps = {
  title: string;
  subtitle?: string;
  chips?: ReactNode;
  actions?: ReactNode;
};

export default function VitalityHeader({
  title,
  subtitle,
  chips,
  actions,
}: VitalityHeaderProps) {
  return (
    <div className="v-hero">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        {/* LEFT SIDE */}
        <div style={{ flex: "1 1 520px" }}>
          <div className="v-brand">
            <div className="v-logo">
              <img src={logo} alt="Vitality Institute" />
            </div>

            <div className="v-brand-title">
              <div className="title">{title}</div>
              {subtitle && <div className="sub">{subtitle}</div>}
            </div>
          </div>

          {chips && <div className="v-chips">{chips}</div>}
        </div>

        {/* RIGHT SIDE */}
        {actions && (
          <div
            className="row"
            style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}
          >
            {actions}
          </div>
        )}
      </div>

    </div>
  );
}
