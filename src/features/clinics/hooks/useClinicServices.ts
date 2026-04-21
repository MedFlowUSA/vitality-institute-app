import { useCallback, useEffect, useMemo, useState } from "react";
import { listClinicServiceCatalog } from "../api/clinicQueries";
import { useClinicContext } from "./useClinicContext";
import type { ClinicServiceCatalogRow } from "../types";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function useClinicServices(clinicId?: string | null, locationIds?: string[]) {
  const { activeClinicId, activeClinicLocations } = useClinicContext();
  const targetClinicId = clinicId ?? activeClinicId;
  const effectiveLocationIds = useMemo(
    () => locationIds ?? activeClinicLocations.map((location) => location.location_id),
    [activeClinicLocations, locationIds]
  );
  const [services, setServices] = useState<ClinicServiceCatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!targetClinicId) {
      setServices([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextServices = await listClinicServiceCatalog(
        targetClinicId,
        effectiveLocationIds
      );
      setServices(nextServices);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Failed to load clinic services."));
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationIds, targetClinicId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    services,
    loading,
    error,
    refresh,
  };
}
