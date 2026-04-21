import { useMemo } from "react";
import MarketGroupedSelect from "../../../components/locations/MarketGroupedSelect";
import { buildMarketOptionGroups } from "../../../lib/locationMarkets";
import { useClinicContext } from "../hooks/useClinicContext";

export default function ClinicPicker() {
  const { isEnabled, loading, error, clinics, activeClinicId, activeClinic, setActiveClinicId } = useClinicContext();

  const activeLabel = useMemo(() => {
    if (!activeClinic) return "No clinic";
    const status = activeClinic.status === "active" ? "" : ` • ${activeClinic.status}`;
    return `${activeClinic.brand_name ?? activeClinic.name}${status}`;
  }, [activeClinic]);

  const clinicGroups = useMemo(
    () =>
      buildMarketOptionGroups(clinics, {
        valueOf: (clinic) => clinic.id,
        labelOf: (clinic) => clinic.brand_name ?? clinic.name,
        includeComingSoon: false,
      }),
    [clinics]
  );

  if (!isEnabled && !loading) return null;

  if (loading) {
    return (
      <div className="v-chip">
        Clinic: <strong className="muted">Loading...</strong>
      </div>
    );
  }

  if (clinics.length === 0) {
    return (
      <div className="v-chip" title={error ?? ""}>
        Clinic: <strong className="muted">{error ? "Error" : "None linked"}</strong>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div className="v-chip">
        Clinic: <strong>{activeLabel}</strong>
      </div>

      <MarketGroupedSelect
        label="Clinic"
        value={activeClinicId ?? ""}
        onChange={(value) => void setActiveClinicId(value || null)}
        groups={clinicGroups}
        placeholder="Select clinic..."
        helperText="Operational clinic pickers only surface live clinic records."
        style={{ width: 320 }}
      />

      {error ? (
        <div className="muted" style={{ fontSize: 12, color: "crimson" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
