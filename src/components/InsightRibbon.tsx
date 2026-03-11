// src/components/InsightRibbon.tsx
import React from "react";

type Kpi = {
  label: string;
  value: string;
  hint?: string;
};

export default function InsightRibbon({
  title = "Today",
  subtitle = "Operational snapshot",
  kpis = [],
  status = "Live",
  right,
}: {
  title?: string;
  subtitle?: string;
  kpis?: Kpi[];
  status?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="v-ribbon">
      <div className="v-ribbon-inner">
        <div className="v-ribbon-left">
          <div className="v-ribbon-title">
            <span className="v-ribbon-dot" />
            <span className="v-ribbon-title-text">{title}</span>
            <span className="v-badge">{status}</span>
          </div>
          <div className="v-ribbon-sub">{subtitle}</div>
        </div>

        <div className="v-ribbon-kpis" role="list" aria-label="Key performance indicators">
          {kpis.map((k) => (
            <div key={k.label} className="v-kpi" role="listitem" title={k.hint ?? ""}>
              <div className="v-kpi-label">{k.label}</div>
              <div className="v-kpi-value">{k.value}</div>
              {k.hint ? <div className="v-kpi-hint">{k.hint}</div> : null}
            </div>
          ))}
        </div>

        {right ? <div className="v-ribbon-right">{right}</div> : null}
      </div>
    </div>
  );
}