import type { ReactNode } from "react";
import type { ConversationListItem } from "../../lib/messaging/conversationService";

type ConversationListProps = {
  title: string;
  helper: string;
  items: ConversationListItem[];
  selectedId: string;
  onSelect: (conversationId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  emptyLabel: string;
  action?: ReactNode;
  showPatientName?: boolean;
};

export default function ConversationList({
  title,
  helper,
  items,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  emptyLabel,
  action,
  showPatientName = false,
}: ConversationListProps) {
  return (
    <div className="card card-pad" style={{ flex: "1 1 320px", minWidth: 300 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">{title}</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            {helper}
          </div>
        </div>
        {action}
      </div>

      <div className="space" />

      <input
        className="input"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search conversations"
        style={{ width: "100%" }}
      />

      <div className="space" />

      {items.length === 0 ? (
        <div className="muted">{emptyLabel}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                className="card card-pad"
                onClick={() => onSelect(item.id)}
                style={{
                  textAlign: "left",
                  border: active ? "1px solid rgba(120,80,255,0.46)" : "1px solid rgba(255,255,255,0.10)",
                  background: active ? "rgba(120,80,255,0.16)" : "rgba(255,255,255,0.03)",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{item.title}</span>
                      {item.unread ? (
                        <span
                          style={{
                            display: "inline-flex",
                            minWidth: 10,
                            height: 10,
                            borderRadius: 999,
                            background: "#8b5cf6",
                          }}
                        />
                      ) : null}
                    </div>
                    {showPatientName ? (
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        {item.patient_name}
                      </div>
                    ) : null}
                    {item.last_message_preview ? (
                      <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
                        {item.last_message_preview}
                      </div>
                    ) : null}
                    <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      <span className="v-chip">{item.status === "open" ? "Open" : "Closed"}</span>
                      {item.context_type ? <span className="v-chip">{item.context_type}</span> : null}
                      {item.appointment_id ? <span className="v-chip">Appointment</span> : null}
                      {item.intake_submission_id ? <span className="v-chip">Intake</span> : null}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
