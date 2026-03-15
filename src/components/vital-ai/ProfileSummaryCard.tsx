import type { CSSProperties } from "react";
import type { VitalAiProfileRow } from "../../lib/vitalAi/types";

export default function ProfileSummaryCard({ profile }: { profile: VitalAiProfileRow }) {
  const data = profile.profile_json ?? {};
  const patient = (data.patient ?? {}) as Record<string, unknown>;
  const detailChipStyle: CSSProperties = {
    padding: "6px 10px",
    fontSize: 12,
    borderRadius: 999,
    border: "1px solid rgba(184,164,255,0.24)",
    background: "rgba(244,239,255,0.92)",
    color: "#5B4E86",
  };

  return (
    <div className="card card-pad" style={{ color: "#241B3D" }}>
      <div className="h2" style={{ color: "#241B3D" }}>Profile Summary</div>
      <div className="space" />
      <div style={{ lineHeight: 1.7, color: "#3E355C" }}>{profile.summary ?? "No summary generated yet."}</div>
      <div className="space" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div style={detailChipStyle}>
          Triage: <strong style={{ color: "#241B3D" }}>{profile.triage_level ?? "-"}</strong>
        </div>
        <div style={detailChipStyle}>
          Status: <strong style={{ color: "#241B3D" }}>{profile.status}</strong>
        </div>
        <div style={detailChipStyle}>
          Patient: <strong style={{ color: "#241B3D" }}>{`${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "-"}</strong>
        </div>
      </div>
    </div>
  );
}
