import { getVirtualVisitState, type AppointmentVirtualFields, virtualVisitBadgeStyle } from "../lib/virtualVisits";

export default function VirtualVisitBadge({
  appointment,
}: {
  appointment: Partial<AppointmentVirtualFields> | null | undefined;
}) {
  const state = getVirtualVisitState(appointment);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        ...virtualVisitBadgeStyle(state.badgeTone),
      }}
    >
      {state.badgeLabel}
    </span>
  );
}
