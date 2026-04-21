import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import InlineNotice from "../../../components/InlineNotice";
import LocationPicker from "../../../components/LocationPicker";
import VitalityHero from "../../../components/VitalityHero";
import {
  getClinic,
  linkClinicLocation,
  listAllLocations,
  listClinicLocations,
  logClinicAuditEvent,
  removeClinicLocation,
  updateClinic,
} from "../api/clinicQueries";
import ClinicPicker from "../components/ClinicPicker";
import { useClinicContext } from "../hooks/useClinicContext";
import { useAuth } from "../../../auth/AuthProvider";

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function ClinicDetailPage() {
  const navigate = useNavigate();
  const { clinicId = "" } = useParams<{ clinicId: string }>();
  const { user } = useAuth();
  const { refreshClinics } = useClinicContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [allLocations, setAllLocations] = useState<LocationRow[]>([]);
  const [mappedLocations, setMappedLocations] = useState<Awaited<ReturnType<typeof listClinicLocations>>>([]);
  const [clinicName, setClinicName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("active");
  const [brandName, setBrandName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [defaultTimezone, setDefaultTimezone] = useState("America/Los_Angeles");
  const [newLocationId, setNewLocationId] = useState("");
  const [makePrimary, setMakePrimary] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [clinic, locations, mapped] = await Promise.all([
        getClinic(clinicId),
        listAllLocations(),
        listClinicLocations(clinicId),
      ]);
      if (!clinic) throw new Error("Clinic not found.");
      setClinicName(clinic.name);
      setSlug(clinic.slug);
      setStatus(clinic.status);
      setBrandName(clinic.brand_name ?? clinic.name);
      setSupportEmail(clinic.support_email ?? "");
      setSupportPhone(clinic.support_phone ?? "");
      setDefaultTimezone(clinic.default_timezone ?? "America/Los_Angeles");
      setAllLocations(locations);
      setMappedLocations(mapped);
    } catch (loadError: unknown) {
      setErr(getErrorMessage(loadError, "Failed to load clinic."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    void load();
  }, [clinicId, load]);

  const availableLocations = useMemo(() => {
    const mappedIds = new Set(mappedLocations.map((location) => location.location_id));
    return allLocations.filter((location) => !mappedIds.has(location.id));
  }, [allLocations, mappedLocations]);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await updateClinic(clinicId, {
        name: clinicName,
        slug,
        status,
        brandName,
        supportEmail,
        supportPhone,
        defaultTimezone,
      });
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_updated",
        payload: {
          name: clinicName,
          slug,
          status,
          brandName,
        },
      });
      await refreshClinics();
      setMsg("Clinic details saved.");
      await load();
    } catch (saveError: unknown) {
      setErr(getErrorMessage(saveError, "Failed to save clinic details."));
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationId) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await linkClinicLocation(clinicId, newLocationId, makePrimary || mappedLocations.length === 0);
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_location_added",
        payload: {
          locationId: newLocationId,
          isPrimary: makePrimary || mappedLocations.length === 0,
        },
      });
      setNewLocationId("");
      setMakePrimary(false);
      await refreshClinics();
      await load();
      setMsg("Location linked to clinic.");
    } catch (linkError: unknown) {
      setErr(getErrorMessage(linkError, "Failed to link clinic location."));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLocation = async (locationId: string) => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await removeClinicLocation(clinicId, locationId);
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_location_removed",
        payload: { locationId },
      });
      await refreshClinics();
      await load();
      setMsg("Location removed from clinic.");
    } catch (removeError: unknown) {
      setErr(getErrorMessage(removeError, "Failed to remove clinic location."));
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (locationId: string) => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await linkClinicLocation(clinicId, locationId, true);
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_primary_location_changed",
        payload: { locationId },
      });
      await refreshClinics();
      await load();
      setMsg("Primary clinic location updated.");
    } catch (primaryError: unknown) {
      setErr(getErrorMessage(primaryError, "Failed to update primary clinic location."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Clinic Detail"
          subtitle="Manage tenant identity, linked locations, and the operational boundaries that sit above the current location model."
          secondaryCta={{ label: "Back", to: "/admin/clinics" }}
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
            <div className="muted">Loading clinic...</div>
          </div>
        ) : (
          <>
            <div className="card card-pad">
              <div className="h2">Identity & Support</div>
              <div className="muted" style={{ marginTop: 6 }}>
                This defines the tenant record while preserving existing Vitality Institute branding conventions and operational structure.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" style={{ flex: "1 1 220px" }} value={clinicName} onChange={(event) => setClinicName(event.target.value)} />
                <input className="input" style={{ flex: "1 1 220px" }} value={slug} onChange={(event) => setSlug(event.target.value)} />
                <select className="input" style={{ flex: "1 1 180px" }} value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" style={{ flex: "1 1 220px" }} value={brandName} onChange={(event) => setBrandName(event.target.value)} />
                <input className="input" style={{ flex: "1 1 220px" }} value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
                <input className="input" style={{ flex: "1 1 180px" }} value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} />
                <input className="input" style={{ flex: "1 1 180px" }} value={defaultTimezone} onChange={(event) => setDefaultTimezone(event.target.value)} />
              </div>

              <div className="space" />

              <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Clinic"}
              </button>
            </div>

            <div className="space" />

            <div className="card card-pad">
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div className="h2">Mapped Locations</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Locations remain the physical and operational access layer. Clinics decide which locations belong together.
                  </div>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => navigate(`/admin/clinics/${clinicId}/settings`)}>
                  Settings & Services
                </button>
              </div>

              <div className="space" />

              {mappedLocations.length === 0 ? (
                <div className="muted">No locations are mapped to this clinic yet.</div>
              ) : (
                mappedLocations.map((location) => (
                  <div key={location.id} className="card card-pad" style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{location.location_name}</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                          {[location.city, location.state].filter(Boolean).join(", ") || "Location linked"}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <button className={location.is_primary ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => void handleSetPrimary(location.location_id)}>
                          {location.is_primary ? "Primary Location" : "Make Primary"}
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => void handleRemoveLocation(location.location_id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select className="input" style={{ flex: "1 1 260px" }} value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)}>
                  <option value="">Add existing location</option>
                  {availableLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
                <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={makePrimary} onChange={(event) => setMakePrimary(event.target.checked)} />
                  Set as primary
                </label>
                <button className="btn btn-primary" type="button" onClick={handleAddLocation} disabled={saving || !newLocationId}>
                  Link Location
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
