import type { ClinicServiceCatalogRow, ClinicSettingsRow } from "../types";

export default function ClinicServicesSettings({
  settings,
  onSettingToggle,
  services,
  onServiceToggle,
}: {
  settings: Pick<
    ClinicSettingsRow,
    "intake_enabled" | "labs_enabled" | "ai_protocol_enabled" | "fulfillment_enabled" | "telehealth_enabled"
  >;
  onSettingToggle: (key: keyof Pick<
    ClinicSettingsRow,
    "intake_enabled" | "labs_enabled" | "ai_protocol_enabled" | "fulfillment_enabled" | "telehealth_enabled"
  >, value: boolean) => void;
  services: ClinicServiceCatalogRow[];
  onServiceToggle: (serviceKey: string, value: boolean) => void;
}) {
  const settingRows: Array<{
    key: keyof Pick<
      ClinicSettingsRow,
      "intake_enabled" | "labs_enabled" | "ai_protocol_enabled" | "fulfillment_enabled" | "telehealth_enabled"
    >;
    label: string;
    detail: string;
  }> = [
    {
      key: "intake_enabled",
      label: "Vital AI intake",
      detail: "Allow the clinic to accept guided Vital AI intake submissions.",
    },
    {
      key: "labs_enabled",
      label: "Labs workflow",
      detail: "Allow lab upload and provider-side lab review workflows.",
    },
    {
      key: "ai_protocol_enabled",
      label: "AI-assisted protocol suggestions",
      detail: "Enable provider-facing structured protocol suggestion workflows.",
    },
    {
      key: "fulfillment_enabled",
      label: "Fulfillment support",
      detail: "Enable downstream order-routing and fulfillment support after physician approval.",
    },
    {
      key: "telehealth_enabled",
      label: "Telehealth support",
      detail: "Allow clinic programs to route into telehealth-ready visit types.",
    },
  ];

  return (
    <>
      <div className="card card-pad">
        <div className="h2">Clinic Settings</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Configure which clinic capabilities are active before deeper intake and physician workflow expansion.
        </div>

        <div className="space" />

        {settingRows.map((row) => (
          <label
            key={row.key}
            className="card card-pad"
            style={{ display: "block", marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.label}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                  {row.detail}
                </div>
              </div>

              <input
                type="checkbox"
                checked={settings[row.key]}
                onChange={(event) => onSettingToggle(row.key, event.target.checked)}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="h2">Clinic Service Activation</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Keep wound care supported while promoting GLP-1, TRT, wellness, and peptide service lines for clinic operations.
        </div>

        <div className="space" />

        {services.length === 0 ? (
          <div className="muted">No clinic service catalog rows are available yet for the mapped locations.</div>
        ) : (
          services.map((service) => (
            <label
              key={service.service_key}
              className="card card-pad"
              style={{ display: "block", marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{service.label}</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    {service.category ?? service.service_group ?? "General"} • {service.location_count} mapped location
                    {service.location_count === 1 ? "" : "s"}
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    Key: {service.service_key}
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={service.is_enabled}
                  onChange={(event) => onServiceToggle(service.service_key, event.target.checked)}
                />
              </div>
            </label>
          ))
        )}
      </div>
    </>
  );
}
