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

      {/* STAT GRID */}
      <div className="v-statgrid">
        <div className="v-stat">
          <div className="k">Modules Built</div>
          <div className="v">7</div>
        </div>

        <div className="v-stat">
          <div className="k">Patient Flows</div>
          <div className="v">Intake • Booking • Messages</div>
        </div>

        <div className="v-stat">
          <div className="k">Provider Tools</div>
          <div className="v">Review • Sign-Off</div>
        </div>

        <div className="v-stat">
          <div className="k">Next Upgrade</div>
          <div className="v">AI + Labs</div>
        </div>
      </div>
    </div>
  );
}
