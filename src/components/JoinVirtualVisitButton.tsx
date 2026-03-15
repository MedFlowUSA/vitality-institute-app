import type { MouseEvent } from "react";
import { getVirtualVisitState, type AppointmentVirtualFields } from "../lib/virtualVisits";

export default function JoinVirtualVisitButton({
  appointment,
  className = "btn btn-primary",
  label = "Join Virtual Visit",
  onClick,
}: {
  appointment: Partial<AppointmentVirtualFields> | null | undefined;
  className?: string;
  label?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const state = getVirtualVisitState(appointment);

  if (!state.isVirtual || !state.hasMeetingUrl) return null;

  const buttonLabel = state.canJoin
    ? label
    : state.joinWindowLabel
    ? `Join opens ${state.joinWindowLabel}`
    : "Join window not open";

  return (
    <button
      className={className}
      type="button"
      disabled={!state.canJoin}
      onClick={(event) => {
        if (!state.canJoin || !appointment?.meeting_url) return;
        onClick?.(event);
        window.open(appointment.meeting_url, "_blank", "noopener,noreferrer");
      }}
      title={!state.canJoin ? buttonLabel : label}
    >
      {buttonLabel}
    </button>
  );
}
