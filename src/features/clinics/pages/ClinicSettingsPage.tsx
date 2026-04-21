import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import InlineNotice from "../../../components/InlineNotice";
import LocationPicker from "../../../components/LocationPicker";
import VitalityHero from "../../../components/VitalityHero";
import {
  getClinic,
  getClinicSettings,
  listClinicLocations,
  logClinicAuditEvent,
  saveClinicServiceToggle,
  saveClinicSettings,
} from "../api/clinicQueries";
import ClinicPicker from "../components/ClinicPicker";
import ClinicServicesSettings from "../components/ClinicServicesSettings";
import { useClinicServices } from "../hooks/useClinicServices";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function ClinicSettingsPage() {
  const navigate = useNavigate();
  const { clinicId = "" } = useParams<{ clinicId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("Clinic");
  const [mappedLocations, setMappedLocations] = useState<Awaited<ReturnType<typeof listClinicLocations>>>([]);
  const mappedLocationIds = useMemo(() => mappedLocations.map((location) => location.location_id), [mappedLocations]);
  const { services, loading: servicesLoading, refresh: refreshServices } = useClinicServices(
    clinicId,
    mappedLocationIds
  );
  const [settings, setSettings] = useState({
    intake_enabled: true,
    labs_enabled: true,
    ai_protocol_enabled: false,
    fulfillment_enabled: false,
    telehealth_enabled: true,
    default_programs_json: ["glp1", "trt", "wellness", "peptides", "wound-care"] as string[],
  });
  const [programDraft, setProgramDraft] = useState("glp1\ntrt\nwellness\npeptides\nwound-care");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [clinic, clinicSettings, locations] = await Promise.all([
        getClinic(clinicId),
        getClinicSettings(clinicId),
        listClinicLocations(clinicId),
      ]);
      if (!clinic) throw new Error("Clinic not found.");
      setClinicName(clinic.brand_name ?? clinic.name);
      setMappedLocations(locations);
      setSettings({
        intake_enabled: clinicSettings.intake_enabled,
        labs_enabled: clinicSettings.labs_enabled,
        ai_protocol_enabled: clinicSettings.ai_protocol_enabled,
        fulfillment_enabled: clinicSettings.fulfillment_enabled,
        telehealth_enabled: clinicSettings.telehealth_enabled,
        default_programs_json: clinicSettings.default_programs_json ?? [],
      });
      setProgramDraft((clinicSettings.default_programs_json ?? []).join("\n"));
    } catch (loadError: unknown) {
      setErr(getErrorMessage(loadError, "Failed to load clinic settings."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    void load();
  }, [clinicId, load]);

  const mappedLocationLabel = useMemo(() => {
    if (mappedLocations.length === 0) return "No mapped locations yet";
    return mappedLocations.map((location) => location.location_name).join(", ");
  }, [mappedLocations]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const normalizedPrograms = programDraft
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);

      const nextSettings = {
        ...settings,
        default_programs_json: normalizedPrograms,
      };

      await saveClinicSettings(clinicId, nextSettings);
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_settings_updated",
        payload: nextSettings,
      });
      setSettings(nextSettings);
      setMsg("Clinic settings saved.");
    } catch (saveError: unknown) {
      setErr(getErrorMessage(saveError, "Failed to save clinic settings."));
    } finally {
      setSaving(false);
    }
  };

  const handleServiceToggle = async (serviceKey: string, value: boolean) => {
    setErr(null);
    setMsg(null);
    try {
      await saveClinicServiceToggle({
        clinicId,
        serviceKey,
        isEnabled: value,
      });
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_service_toggled",
        payload: {
          serviceKey,
          isEnabled: value,
        },
      });
      await refreshServices();
      setMsg(`Updated ${serviceKey} service activation.`);
    } catch (toggleError: unknown) {
      setErr(getErrorMessage(toggleError, "Failed to update clinic service activation."));
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Clinic Settings"
          subtitle={`${clinicName} service activation, Vital AI enablement, and physician-workflow readiness controls.`}
          secondaryCta={{ label: "Back", to: `/admin/clinics/${clinicId}` }}
          primaryCta={{ label: "Clinic Members", to: `/admin/clinics/${clinicId}/users` }}
          showKpis={false}
        />

        <div className="space" />
        <ClinicPicker />
        <div className="space" />
        <LocationPicker />
        <div className="space" />

        {err ? <InlineNotice tone="error" message={err} /> : null}
        {msg ? <InlineNotice tone="success" message={msg} style={{ marginTop: 12 }} /> : null}

        {loading ? (
          <div className="card card-pad">
            <div className="muted">Loading clinic settings...</div>
          </div>
        ) : (
          <>
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div className="h2">Mapped Scope</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Clinic settings currently apply across: {mappedLocationLabel}
              </div>
            </div>

            <ClinicServicesSettings
              settings={settings}
              onSettingToggle={(key, value) => setSettings((current) => ({ ...current, [key]: value }))}
              services={services}
              onServiceToggle={(serviceKey, value) => void handleServiceToggle(serviceKey, value)}
            />

            <div className="space" />

            <div className="card card-pad">
              <div className="h2">Default Programs</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Keep this clinic’s default program list aligned with the physician infrastructure focus: GLP-1, TRT, wellness, peptides, and retained wound care support.
              </div>

              <div className="space" />

              <textarea
                className="input"
                style={{ minHeight: 180, width: "100%" }}
                value={programDraft}
                onChange={(event) => setProgramDraft(event.target.value)}
              />

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" type="button" onClick={handleSaveSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => navigate(`/admin/clinics/${clinicId}`)}>
                  Back to Clinic Detail
                </button>
              </div>

              {servicesLoading ? (
                <div className="muted" style={{ marginTop: 10 }}>
                  Refreshing clinic service catalog...
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
