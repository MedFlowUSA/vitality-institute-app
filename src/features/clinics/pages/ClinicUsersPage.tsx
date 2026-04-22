import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import InlineNotice from "../../../components/InlineNotice";
import LocationPicker from "../../../components/LocationPicker";
import VitalityHero from "../../../components/VitalityHero";
import {
  STAFF_ROLE_OPTIONS,
  addExistingClinicUser,
  createClinicStaffMember,
  getClinic,
  listAssignableProfiles,
  listClinicLocations,
  listClinicMembers,
  listClinicProviderProfiles,
  logClinicAuditEvent,
  saveClinicProviderProfile,
} from "../api/clinicQueries";
import ClinicPicker from "../components/ClinicPicker";
import ClinicUsersPanel from "../components/ClinicUsersPanel";
import { useClinicContext } from "../hooks/useClinicContext";
import type { ClinicProviderProfileRow } from "../types";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function formatMemberName(member: { first_name: string | null; last_name: string | null; user_id: string }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  return name || member.user_id;
}

type ProviderFormState = {
  specialty: string;
  credentials: string;
  npi: string;
  licenseNumber: string;
  contactPhone: string;
  contactEmail: string;
  bio: string;
  acceptingNewPatients: boolean;
};

function createProviderFormState(profile?: ClinicProviderProfileRow | null): ProviderFormState {
  return {
    specialty: profile?.specialty ?? "",
    credentials: profile?.credentials ?? "",
    npi: profile?.npi ?? "",
    licenseNumber: profile?.license_number ?? "",
    contactPhone: profile?.contact_phone ?? "",
    contactEmail: profile?.contact_email ?? "",
    bio: profile?.bio ?? "",
    acceptingNewPatients: profile?.accepting_new_patients ?? true,
  };
}

export default function ClinicUsersPage() {
  const navigate = useNavigate();
  const { clinicId = "" } = useParams<{ clinicId: string }>();
  const { user } = useAuth();
  const { refreshClinics } = useClinicContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("Clinic");
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listClinicMembers>>>([]);
  const [locations, setLocations] = useState<Awaited<ReturnType<typeof listClinicLocations>>>([]);
  const [profiles, setProfiles] = useState<Awaited<ReturnType<typeof listAssignableProfiles>>>([]);
  const [providerProfiles, setProviderProfiles] = useState<Awaited<ReturnType<typeof listClinicProviderProfiles>>>([]);
  const [providerForms, setProviderForms] = useState<Record<string, ProviderFormState>>({});
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [existingUserId, setExistingUserId] = useState("");
  const [existingRole, setExistingRole] = useState("provider");
  const [existingLocationId, setExistingLocationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newRole, setNewRole] = useState("provider");
  const [newLocationId, setNewLocationId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [clinic, clinicMembers, clinicLocations, assignableProfiles, clinicProviderProfiles] = await Promise.all([
        getClinic(clinicId),
        listClinicMembers(clinicId),
        listClinicLocations(clinicId),
        listAssignableProfiles(),
        listClinicProviderProfiles(clinicId),
      ]);
      if (!clinic) throw new Error("Clinic not found.");
      setClinicName(clinic.brand_name ?? clinic.name);
      setMembers(clinicMembers);
      setLocations(clinicLocations);
      setProfiles(assignableProfiles);
      setProviderProfiles(clinicProviderProfiles);
      setExistingLocationId(clinicLocations.find((location) => location.is_primary)?.location_id ?? clinicLocations[0]?.location_id ?? "");
      setNewLocationId(clinicLocations.find((location) => location.is_primary)?.location_id ?? clinicLocations[0]?.location_id ?? "");

      const profileMap = new Map(clinicProviderProfiles.map((profile) => [profile.user_id, profile]));
      const nextProviderForms: Record<string, ProviderFormState> = {};
      for (const member of clinicMembers) {
        if (member.role !== "provider") continue;
        nextProviderForms[member.user_id] = createProviderFormState(profileMap.get(member.user_id));
      }
      setProviderForms(nextProviderForms);
    } catch (loadError: unknown) {
      setErr(getErrorMessage(loadError, "Failed to load clinic users."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    void load();
  }, [clinicId, load]);

  const availableProfiles = useMemo(() => {
    const memberUserIds = new Set(members.map((member) => member.user_id));
    return profiles.filter((profile) => !memberUserIds.has(profile.id));
  }, [members, profiles]);

  const doctorCoverageByLocation = useMemo(() => {
    return locations.map((location) => ({
      locationId: location.location_id,
      locationName: location.location_name,
      doctors: members.filter(
        (member) => member.role === "provider" && member.active_location_id === location.location_id
      ),
    }));
  }, [locations, members]);

  const providerProfileMap = useMemo(() => {
    return new Map(providerProfiles.map((profile) => [profile.user_id, profile]));
  }, [providerProfiles]);

  const providerMembers = useMemo(() => {
    return members.filter((member) => member.role === "provider");
  }, [members]);

  const handleAssignExisting = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      if (!existingUserId) throw new Error("Choose an existing staff profile.");
      await addExistingClinicUser({
        clinicId,
        userId: existingUserId,
        role: existingRole,
        invitedBy: user?.id ?? null,
        primaryLocationId: existingLocationId || null,
      });
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_user_assigned",
        payload: {
          userId: existingUserId,
          role: existingRole,
          primaryLocationId: existingLocationId || null,
        },
      });
      setExistingUserId("");
      await refreshClinics();
      await load();
      setMsg("Existing user assigned to clinic.");
    } catch (assignError: unknown) {
      setErr(getErrorMessage(assignError, "Failed to assign existing clinic user."));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStaff = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      if (!firstName.trim()) throw new Error("First name is required.");
      if (!lastName.trim()) throw new Error("Last name is required.");
      if (!email.trim()) throw new Error("Email is required.");
      if (!tempPassword.trim() || tempPassword.trim().length < 8) {
        throw new Error("Temporary password must be at least 8 characters.");
      }
      if (!newLocationId) throw new Error("Choose a primary clinic location.");

      const result = await createClinicStaffMember({
        clinicId,
        firstName,
        lastName,
        email,
        tempPassword,
        role: newRole,
        locationId: newLocationId,
      });
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_user_created",
        payload: {
          userId: result?.user_id ?? null,
          email,
          role: newRole,
          primaryLocationId: newLocationId,
        },
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setTempPassword("");
      await refreshClinics();
      await load();
      setMsg("New clinic staff account created.");
    } catch (createError: unknown) {
      setErr(getErrorMessage(createError, "Failed to create clinic staff member."));
    } finally {
      setSaving(false);
    }
  };

  const handleProviderFormChange = (userId: string, patch: Partial<ProviderFormState>) => {
    setProviderForms((current) => ({
      ...current,
      [userId]: {
        ...createProviderFormState(),
        ...current[userId],
        ...patch,
      },
    }));
  };

  const handleSaveProviderProfile = async (userId: string) => {
    const form = providerForms[userId];
    if (!form) return;

    setSavingProviderId(userId);
    setErr(null);
    setMsg(null);
    try {
      await saveClinicProviderProfile({
        clinicId,
        userId,
        specialty: form.specialty,
        credentials: form.credentials,
        npi: form.npi,
        licenseNumber: form.licenseNumber,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        bio: form.bio,
        acceptingNewPatients: form.acceptingNewPatients,
      });
      await logClinicAuditEvent({
        clinicId,
        actorUserId: user?.id ?? null,
        eventType: "clinic_provider_profile_saved",
        payload: {
          userId,
          specialty: form.specialty || null,
          credentials: form.credentials || null,
        },
      });
      await load();
      setMsg("Doctor profile saved.");
    } catch (saveError: unknown) {
      setErr(getErrorMessage(saveError, "Failed to save doctor profile."));
    } finally {
      setSavingProviderId(null);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Clinic Members"
          subtitle={`${clinicName} membership, staffing, and location-aware clinic access assignment.`}
          secondaryCta={{ label: "Back", to: `/admin/clinics/${clinicId}` }}
          primaryCta={{ label: "Clinic Settings", to: `/admin/clinics/${clinicId}/settings` }}
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
            <div className="muted">Loading clinic members...</div>
          </div>
        ) : (
          <>
            <div className="card card-pad">
              <div className="h2">Assign Existing Staff Or Doctors</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Add an existing platform user to this clinic without disturbing the current role-based routing model. Set the role to `provider` when you are intakeing a doctor for a specific location.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "2 1 280px" }} value={existingUserId} onChange={(event) => setExistingUserId(event.target.value)}>
                  <option value="">Select staff profile</option>
                  {availableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {[profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.id} • {profile.role ?? "role not set"}
                    </option>
                  ))}
                </select>
                <select className="input" style={{ flex: "1 1 180px" }} value={existingRole} onChange={(event) => setExistingRole(event.target.value)}>
                  {STAFF_ROLE_OPTIONS.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {roleOption}
                    </option>
                  ))}
                </select>
                <select className="input" style={{ flex: "1 1 220px" }} value={existingLocationId} onChange={(event) => setExistingLocationId(event.target.value)}>
                  <option value="">Select primary location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.location_id}>
                      {location.location_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              <button className="btn btn-primary" type="button" onClick={handleAssignExisting} disabled={saving}>
                {saving ? "Saving..." : "Assign Existing User"}
              </button>
            </div>

            <div className="space" />

            <div className="card card-pad">
              <div className="h2">Doctor Intake And Staff Creation</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Create the auth user, profile, location assignment, and clinic membership together. This is the fastest way to onboard a doctor directly into the right clinic location.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" style={{ flex: "1 1 220px" }} placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                <input className="input" style={{ flex: "1 1 220px" }} placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" style={{ flex: "2 1 260px" }} placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <input className="input" style={{ flex: "1 1 220px" }} type="password" placeholder="Temporary password" value={tempPassword} onChange={(event) => setTempPassword(event.target.value)} />
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "1 1 180px" }} value={newRole} onChange={(event) => setNewRole(event.target.value)}>
                  {STAFF_ROLE_OPTIONS.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {roleOption}
                    </option>
                  ))}
                </select>
                <select className="input" style={{ flex: "1 1 220px" }} value={newLocationId} onChange={(event) => setNewLocationId(event.target.value)}>
                  <option value="">Select primary location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.location_id}>
                      {location.location_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              <button className="btn btn-primary" type="button" onClick={handleCreateStaff} disabled={saving}>
                {saving ? "Creating..." : "Save Doctor Or Staff Intake"}
              </button>
            </div>

            <div className="space" />

            <div className="card card-pad">
              <div className="h2">Doctor Coverage By Location</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Review which doctors are attached to each clinic location so operations and physician routing stay location-aware.
              </div>

              <div className="space" />

              {doctorCoverageByLocation.length === 0 ? (
                <div className="muted">No clinic locations are available yet.</div>
              ) : (
                doctorCoverageByLocation.map((entry) => (
                  <div key={entry.locationId} className="card card-pad" style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ fontWeight: 700 }}>{entry.locationName}</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      {entry.doctors.length === 0
                        ? "No doctors assigned yet."
                        : `${entry.doctors.length} doctor${entry.doctors.length === 1 ? "" : "s"} assigned`}
                    </div>
                    {entry.doctors.length > 0 ? (
                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        {entry.doctors.map((doctor) => (
                          <div key={doctor.id} className="card card-pad" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontWeight: 700 }}>{formatMemberName(doctor)}</div>
                            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                              {providerProfileMap.get(doctor.user_id)?.specialty || "Specialty not added yet"}
                              {providerProfileMap.get(doctor.user_id)?.credentials
                                ? ` • ${providerProfileMap.get(doctor.user_id)?.credentials}`
                                : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="space" />

            <div className="card card-pad">
              <div className="h2">Doctor Directory Intake</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Capture specialty, credentials, licensing, contact details, and bio for each doctor assigned to this clinic.
              </div>

              <div className="space" />

              {providerMembers.length === 0 ? (
                <div className="muted">Add a provider to this clinic before entering doctor details.</div>
              ) : (
                providerMembers.map((provider) => {
                  const form = providerForms[provider.user_id] ?? createProviderFormState();
                  return (
                    <div key={provider.id} className="card card-pad" style={{ marginBottom: 12, background: "rgba(255,255,255,0.05)" }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div className="h2" style={{ marginBottom: 4 }}>{formatMemberName(provider)}</div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Primary location: <strong>{locations.find((location) => location.location_id === provider.active_location_id)?.location_name ?? "No location set"}</strong>
                          </div>
                        </div>
                        <div className="v-chip">{providerProfileMap.get(provider.user_id)?.specialty || "Doctor profile pending"}</div>
                      </div>

                      <div className="space" />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <input
                          className="input"
                          style={{ flex: "1 1 220px" }}
                          placeholder="Specialty"
                          value={form.specialty}
                          onChange={(event) => handleProviderFormChange(provider.user_id, { specialty: event.target.value })}
                        />
                        <input
                          className="input"
                          style={{ flex: "1 1 220px" }}
                          placeholder="Credentials"
                          value={form.credentials}
                          onChange={(event) => handleProviderFormChange(provider.user_id, { credentials: event.target.value })}
                        />
                      </div>

                      <div className="space" />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <input
                          className="input"
                          style={{ flex: "1 1 180px" }}
                          placeholder="NPI"
                          value={form.npi}
                          onChange={(event) => handleProviderFormChange(provider.user_id, { npi: event.target.value })}
                        />
                        <input
                          className="input"
                          style={{ flex: "1 1 180px" }}
                          placeholder="License number"
                          value={form.licenseNumber}
                          onChange={(event) => handleProviderFormChange(provider.user_id, { licenseNumber: event.target.value })}
                        />
                        <input
                          className="input"
                          style={{ flex: "1 1 180px" }}
                          placeholder="Contact phone"
                          value={form.contactPhone}
                          onChange={(event) => handleProviderFormChange(provider.user_id, { contactPhone: event.target.value })}
                        />
                        <input
                          className="input"
                          style={{ flex: "1 1 220px" }}
                          placeholder="Contact email"
                          value={form.contactEmail}
                          onChange={(event) => handleProviderFormChange(provider.user_id, { contactEmail: event.target.value })}
                        />
                      </div>

                      <div className="space" />

                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 100, resize: "vertical" }}
                        placeholder="Doctor bio or location-specific notes"
                        value={form.bio}
                        onChange={(event) => handleProviderFormChange(provider.user_id, { bio: event.target.value })}
                      />

                      <div className="space" />

                      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={form.acceptingNewPatients}
                            onChange={(event) => handleProviderFormChange(provider.user_id, { acceptingNewPatients: event.target.checked })}
                          />
                          Accepting new patients
                        </label>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={savingProviderId === provider.user_id}
                          onClick={() => void handleSaveProviderProfile(provider.user_id)}
                        >
                          {savingProviderId === provider.user_id ? "Saving..." : "Save Doctor Profile"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space" />

            <ClinicUsersPanel members={members} locations={locations} />

            <div className="space" />

            <button className="btn btn-secondary" type="button" onClick={() => navigate(`/admin/clinics/${clinicId}`)}>
              Back to Clinic Detail
            </button>
          </>
        )}
      </div>
    </div>
  );
}
