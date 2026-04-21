import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { loadClinicWorkspace, saveActiveClinic } from "../api/clinicQueries";
import type { ClinicMembershipRow, ClinicRow, ClinicLocationSummary } from "../types";
import { ClinicContext } from "./ClinicContextValue";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user, role, activeLocationId, resumeKey } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [memberships, setMemberships] = useState<ClinicMembershipRow[]>([]);
  const [locations, setLocations] = useState<ClinicLocationSummary[]>([]);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);
  const [activeClinicRole, setActiveClinicRole] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (!user?.id || !role) {
      setIsEnabled(false);
      setError(null);
      setClinics([]);
      setMemberships([]);
      setLocations([]);
      setActiveClinicIdState(null);
      setActiveClinicRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const state = await loadClinicWorkspace({
        userId: user.id,
        role,
        activeLocationId,
      });

      setIsEnabled(state.available);
      setClinics(state.clinics);
      setMemberships(state.memberships);
      setLocations(state.locations);
      setActiveClinicIdState(state.activeClinicId);
      setActiveClinicRole(state.activeClinicRole);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Failed to load clinic context."));
      setIsEnabled(false);
      setClinics([]);
      setMemberships([]);
      setLocations([]);
      setActiveClinicIdState(null);
      setActiveClinicRole(null);
    } finally {
      setLoading(false);
    }
  }, [activeLocationId, role, user?.id]);

  useEffect(() => {
    void loadState();
  }, [loadState, resumeKey]);

  const setActiveClinicId = useCallback(
    async (clinicId: string | null) => {
      if (!user?.id) return;
      await saveActiveClinic(user.id, clinicId);
      setActiveClinicIdState(clinicId);
      const nextRole = memberships.find((membership) => membership.clinic_id === clinicId)?.role ?? (role === "super_admin" ? role : null);
      setActiveClinicRole(nextRole);
    },
    [memberships, role, user?.id]
  );

  const activeClinic = useMemo(
    () => clinics.find((clinic) => clinic.id === activeClinicId) ?? null,
    [activeClinicId, clinics]
  );

  const activeClinicLocations = useMemo(
    () => locations.filter((location) => location.clinic_id === activeClinicId),
    [activeClinicId, locations]
  );

  const hasClinicAccess = useCallback(
    (clinicId: string | null | undefined) => {
      if (!clinicId) return false;
      if (role === "super_admin") return true;
      return memberships.some((membership) => membership.clinic_id === clinicId && membership.is_active);
    },
    [memberships, role]
  );

  const value = useMemo(
    () => ({
      isEnabled,
      loading,
      error,
      clinics,
      memberships,
      activeClinicId,
      activeClinic,
      activeClinicRole,
      activeClinicLocations,
      refreshClinics: loadState,
      setActiveClinicId,
      hasClinicAccess,
    }),
    [
      activeClinic,
      activeClinicId,
      activeClinicLocations,
      activeClinicRole,
      clinics,
      error,
      hasClinicAccess,
      isEnabled,
      loading,
      memberships,
      loadState,
      setActiveClinicId,
    ]
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}
