type Props = {
  visitType: "in_person" | "virtual";
  onVisitTypeChange: (value: "in_person" | "virtual") => void;
  meetingUrl: string;
  onMeetingUrlChange: (value: string) => void;
  virtualInstructions: string;
  onVirtualInstructionsChange: (value: string) => void;
  joinWindowLocal: string;
  onJoinWindowLocalChange: (value: string) => void;
  meetingProvider: string;
  onMeetingProviderChange: (value: string) => void;
  meetingStatus: string;
  onMeetingStatusChange: (value: string) => void;
  disabled?: boolean;
};

export default function VirtualVisitFormFields({
  visitType,
  onVisitTypeChange,
  meetingUrl,
  onMeetingUrlChange,
  virtualInstructions,
  onVirtualInstructionsChange,
  joinWindowLocal,
  onJoinWindowLocalChange,
  meetingProvider,
  onMeetingProviderChange,
  meetingStatus,
  onMeetingStatusChange,
  disabled = false,
}: Props) {
  const isVirtual = visitType === "virtual";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ flex: "1 1 220px" }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Visit Type
        </div>
        <select
          className="input"
          value={visitType}
          onChange={(event) => onVisitTypeChange(event.target.value as "in_person" | "virtual")}
          disabled={disabled}
        >
          <option value="in_person">In Person</option>
          <option value="virtual">Virtual</option>
        </select>
      </div>

      {isVirtual ? (
        <>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "2 1 320px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Meeting Link *
              </div>
              <input
                className="input"
                type="url"
                placeholder="https://your-meeting-link"
                value={meetingUrl}
                onChange={(event) => onMeetingUrlChange(event.target.value)}
                disabled={disabled}
              />
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Join Window Opens
              </div>
              <input
                className="input"
                type="datetime-local"
                value={joinWindowLocal}
                onChange={(event) => onJoinWindowLocalChange(event.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 220px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Meeting Provider
              </div>
              <select
                className="input"
                value={meetingProvider}
                onChange={(event) => onMeetingProviderChange(event.target.value)}
                disabled={disabled}
              >
                <option value="external_link">External Link</option>
              </select>
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Meeting Status
              </div>
              <select
                className="input"
                value={meetingStatus}
                onChange={(event) => onMeetingStatusChange(event.target.value)}
                disabled={disabled}
              >
                <option value="not_started">Not Started</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
              </select>
            </div>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Virtual Visit Instructions
            </div>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 96 }}
              placeholder="Add any pre-visit instructions, device guidance, or check-in notes."
              value={virtualInstructions}
              onChange={(event) => onVirtualInstructionsChange(event.target.value)}
              disabled={disabled}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
