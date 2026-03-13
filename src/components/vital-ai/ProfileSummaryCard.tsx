import type { VitalAiProfileRow } from "../../lib/vitalAi/types";

export default function ProfileSummaryCard({ profile }: { profile: VitalAiProfileRow }) {
  const data = profile.profile_json ?? {};
  const patient = (data.patient ?? {}) as Record<string, unknown>;

  return (
    <div className="card card-pad">
      <div className="h2">Profile Summary</div>
      <div className="space" />
      <div>{profile.summary ?? "No summary generated yet."}</div>
      <div className="space" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="v-chip">Triage: <strong>{profile.triage_level ?? "-"}</strong></div>
        <div className="v-chip">Status: <strong>{profile.status}</strong></div>
        <div className="v-chip">Patient: <strong>{`${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "-"}</strong></div>
      </div>
    </div>
  );
}
