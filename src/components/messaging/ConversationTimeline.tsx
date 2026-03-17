import type { ConversationMessage } from "../../lib/messaging/conversationService";

type ConversationTimelineProps = {
  messages: ConversationMessage[];
  currentUserId?: string | null;
  emptyLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
};

function renderMentionedBody(message: ConversationMessage) {
  if (!message.mentions.length) return <span>{message.body}</span>;

  const labels = message.mentions.map((mention) => `@${mention.display_name}`);
  const pattern = new RegExp(`(${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const parts = message.body.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        if (labels.includes(part)) {
          return (
            <mark
              key={`${part}-${index}`}
              style={{
                background: "rgba(139,92,246,0.20)",
                color: "inherit",
                borderRadius: 8,
                padding: "0 4px",
              }}
            >
              {part}
            </mark>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

export default function ConversationTimeline({
  messages,
  currentUserId,
  emptyLabel,
  search,
  onSearchChange,
}: ConversationTimelineProps) {
  const visibleMessages = search.trim()
    ? messages.filter((message) => message.body.toLowerCase().includes(search.trim().toLowerCase()))
    : messages;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          Chat history
        </div>
        <input
          className="input"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search this conversation"
          style={{ width: "min(260px, 100%)" }}
        />
      </div>

      <div className="space" />

      <div
        className="card card-pad"
        style={{
          maxHeight: 440,
          overflow: "auto",
          background: "rgba(255,255,255,0.03)",
          display: "grid",
          gap: 12,
        }}
      >
        {visibleMessages.length === 0 ? (
          <div className="muted">{emptyLabel}</div>
        ) : (
          visibleMessages.map((message) => {
            const mine = message.sender_user_id === currentUserId;
            const isInternal = message.visibility === "staff_internal";
            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: isInternal
                      ? "rgba(245,158,11,0.16)"
                      : mine
                      ? "rgba(120,80,255,0.18)"
                      : "rgba(255,255,255,0.08)",
                    border: isInternal
                      ? "1px solid rgba(245,158,11,0.32)"
                      : mine
                      ? "1px solid rgba(120,80,255,0.34)"
                      : "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
                    {message.visibility === "staff_internal" ? "Internal note" : message.sender_name} •{" "}
                    {new Date(message.created_at).toLocaleString()}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{renderMentionedBody(message)}</div>

                  {message.attachments.length ? (
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      {message.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.file_url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="card card-pad card-light"
                          style={{ display: "block", textDecoration: "none" }}
                        >
                          <div className="h2" style={{ fontSize: 14 }}>
                            {attachment.file_name}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {attachment.mime_type ?? "Attachment"}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
