import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import InlineNotice from "../../../components/InlineNotice";
import LocationPicker from "../../../components/LocationPicker";
import VitalityHero from "../../../components/VitalityHero";
import { createClinic, listAllLocations } from "../api/clinicQueries";
import ClinicPicker from "../components/ClinicPicker";
import { useClinicContext } from "../hooks/useClinicContext";

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

export default function ClinicListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { clinics, isEnabled, loading, refreshClinics } = useClinicContext();
  const [allLocations, setAllLocations] = useState<LocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [brandName, setBrandName] = useState("Vitality Institute");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [defaultTimezone, setDefaultTimezone] = useState("America/Los_Angeles");
  const [primaryLocationId, setPrimaryLocationId] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const showCreateForm = useMemo(() => location.pathname.endsWith("/new"), [location.pathname]);

  useEffect(() => {
    void (async () => {
      try {
        setAllLocations(await listAllLocations());
      } catch (loadError: unknown) {
        setErr(getErrorMessage(loadError, "Failed to load locations."));
      }
    })();
  }, []);

  const toggleLocation = (locationId: string, checked: boolean) => {
    setSelectedLocationIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, locationId]));
      }
      return current.filter((value) => value !== locationId);
    });
    if (!checked && primaryLocationId === locationId) {
      setPrimaryLocationId("");
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      if (!name.trim()) throw new Error("Clinic name is required.");
      if (selectedLocationIds.length > 0 && !primaryLocationId) {
        throw new Error("Choose a primary location when you map clinic locations.");
      }

      const clinic = await createClinic({
        name,
        slug,
        brandName,
        supportEmail,
        supportPhone,
        defaultTimezone,
        primaryLocationId: primaryLocationId || null,
        additionalLocationIds: selectedLocationIds.filter((locationId) => locationId !== primaryLocationId),
        actorUserId: user?.id ?? null,
      });

      await refreshClinics();
      setMsg("Clinic created successfully.");
      navigate(`/admin/clinics/${clinic.id}`);
    } catch (createError: unknown) {
      setErr(getErrorMessage(createError, "Failed to create clinic."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Clinic Management"
          subtitle="Create and manage multi-clinic physician infrastructure on top of the existing Vitality Institute platform."
          secondaryCta={{ label: "Back", to: "/admin" }}
          primaryCta={{ label: "New Clinic", to: "/admin/clinics/new" }}
          showKpis={false}
        />

        <div className="space" />
        <ClinicPicker />
        <div className="space" />
        <LocationPicker />
        <div className="space" />

        {!isEnabled && !loading ? (
          <InlineNotice
            tone="error"
            message="Clinic foundation is not available yet. Apply the Phase 1 clinic migration before using this workspace."
          />
        ) : null}

        {err ? <InlineNotice tone="error" message={err} style={{ marginTop: 12 }} /> : null}
        {msg ? <InlineNotice tone="success" message={msg} style={{ marginTop: 12 }} /> : null}

        {showCreateForm ? (
          <>
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Clinic Onboarding</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Set up the clinic tenant first, then layer location access, members, and service controls on top.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 260px" }}
                  placeholder="Clinic name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  placeholder="Clinic slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  placeholder="Brand name"
                  value={brandName}
                  onChange={(event) => setBrandName(event.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  placeholder="Support email"
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: "1 1 180px" }}
                  placeholder="Support phone"
                  value={supportPhone}
                  onChange={(event) => setSupportPhone(event.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: "1 1 180px" }}
                  placeholder="Default timezone"
                  value={defaultTimezone}
                  onChange={(event) => setDefaultTimezone(event.target.value)}
                />
              </div>

              <div className="space" />

              <div className="h2" style={{ marginBottom: 10 }}>Map Existing Locations</div>
              <div className="muted" style={{ marginBottom: 12 }}>
                Reuse the existing location model. One clinic can own one or many operational locations.
              </div>

              {allLocations.length === 0 ? (
                <div className="muted">No locations are available yet.</div>
              ) : (
                allLocations.map((row) => {
                  const checked = selectedLocationIds.includes(row.id);
                  return (
                    <label
                      key={row.id}
                      className="card card-pad"
                      style={{ display: "block", marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{row.name}</div>
                          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                            {[row.city, row.state].filter(Boolean).join(", ") || "Location available"}
                          </div>
                        </div>

                        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleLocation(row.id, event.target.checked)}
                            />
                            Include
                          </label>

                          <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="radio"
                              name="primary_clinic_location"
                              checked={primaryLocationId === row.id}
                              disabled={!checked}
                              onChange={() => setPrimaryLocationId(row.id)}
                            />
                            Primary
                          </label>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" type="button" onClick={handleCreate} disabled={saving}>
                  {saving ? "Creating..." : "Create Clinic"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => navigate("/admin/clinics")}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="h2">Active Clinics</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Clinics sit above the current location model and control tenant membership, settings, and service activation.
              </div>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => void refreshClinics()}>
              Refresh
            </button>
          </div>

          <div className="space" />

          {loading ? (
            <div className="muted">Loading clinics...</div>
          ) : clinics.length === 0 ? (
            <div className="muted">No clinics are configured yet.</div>
          ) : (
            clinics.map((clinic) => (
              <div key={clinic.id} className="card card-pad" style={{ marginBottom: 12, background: "rgba(255,255,255,0.05)" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="h2" style={{ marginBottom: 4 }}>{clinic.brand_name ?? clinic.name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {clinic.slug} • {clinic.status} • {clinic.default_timezone ?? "Timezone not set"}
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {clinic.support_email ?? "No support email"} • {clinic.support_phone ?? "No support phone"}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-secondary" type="button" onClick={() => navigate(`/admin/clinics/${clinic.id}`)}>
                      Manage
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => navigate(`/admin/clinics/${clinic.id}/users`)}>
                      Members
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => navigate(`/admin/clinics/${clinic.id}/settings`)}>
                      Settings
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
