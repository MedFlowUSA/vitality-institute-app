import { useMemo } from "react";
import { useClinicContext } from "./useClinicContext";

export function useClinicAccess() {
  const context = useClinicContext();

  return useMemo(
    () => ({
      ...context,
      canManageActiveClinic:
        context.activeClinicRole === "super_admin" ||
        context.activeClinicRole === "location_admin",
    }),
    [context]
  );
}
