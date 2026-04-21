import { createContext } from "react";
import type { ClinicLocationSummary, ClinicMembershipRow, ClinicRow } from "../types";

export type ClinicContextValue = {
  isEnabled: boolean;
  loading: boolean;
  error: string | null;
  clinics: ClinicRow[];
  memberships: ClinicMembershipRow[];
  activeClinicId: string | null;
  activeClinic: ClinicRow | null;
  activeClinicRole: string | null;
  activeClinicLocations: ClinicLocationSummary[];
  refreshClinics: () => Promise<void>;
  setActiveClinicId: (clinicId: string | null) => Promise<void>;
  hasClinicAccess: (clinicId: string | null | undefined) => boolean;
};

export const ClinicContext = createContext<ClinicContextValue | null>(null);
