import type { ClinicLocationSummary, ClinicMemberSummary } from "../types";

function formatMemberName(member: ClinicMemberSummary) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  return name || member.user_id;
}

function locationName(locationId: string | null, locations: ClinicLocationSummary[]) {
  if (!locationId) return "No primary location";
  return locations.find((location) => location.location_id === locationId)?.location_name ?? locationId;
}

export default function ClinicUsersPanel({
  members,
  locations,
  title = "Clinic Members",
  emptyLabel = "No clinic users assigned yet.",
}: {
  members: ClinicMemberSummary[];
  locations: ClinicLocationSummary[];
  title?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="card card-pad">
      <div className="h2">{title}</div>
      <div className="muted" style={{ marginTop: 6 }}>
        Members assigned to this clinic with their current clinic role and primary location.
      </div>

      <div className="space" />

      {members.length === 0 ? (
        <div className="muted">{emptyLabel}</div>
      ) : (
        members.map((member) => (
          <div
            key={member.id}
            className="card card-pad"
            style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h2" style={{ marginBottom: 4 }}>
                  {formatMemberName(member)}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Clinic role: <strong>{member.role}</strong>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Location: <strong>{locationName(member.active_location_id, locations)}</strong>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  User ID: {member.user_id}
                </div>
              </div>

              <div className="v-chip">{member.is_active ? "Active" : "Inactive"}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
