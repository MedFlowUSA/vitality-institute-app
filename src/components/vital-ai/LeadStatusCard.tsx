import type { VitalAiLeadRow } from "../../lib/vitalAi/types";

export default function LeadStatusCard({ lead }: { lead: VitalAiLeadRow }) {
  const data = lead.lead_json ?? {};
  const contact = (data.contact ?? {}) as Record<string, unknown>;

  return (
    <div className="card card-pad">
      <div className="h2">Lead Status</div>
      <div className="space" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="v-chip">Status: <strong>{lead.lead_status}</strong></div>
        <div className="v-chip">Priority: <strong>{lead.priority ?? "-"}</strong></div>
        <div className="v-chip">Next Action: <strong>{lead.next_action_at ? new Date(lead.next_action_at).toLocaleDateString() : "-"}</strong></div>
      </div>
      <div className="space" />
      <div className="muted" style={{ fontSize: 12 }}>Preferred Contact</div>
      <div style={{ marginTop: 4 }}>{String(contact.preferred_contact ?? "Not specified")}</div>
    </div>
  );
}
