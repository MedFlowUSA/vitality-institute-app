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
  logClinicAuditEvent,
} from "../api/clinicQueries";
import ClinicPicker from "../components/ClinicPicker";
import ClinicUsersPanel from "../components/ClinicUsersPanel";
import { useClinicContext } from "../hooks/useClinicContext";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
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
      const [clinic, clinicMembers, clinicLocations, assignableProfiles] = await Promise.all([
        getClinic(clinicId),
        listClinicMembers(clinicId),
        listClinicLocations(clinicId),
        listAssignableProfiles(),
      ]);
      if (!clinic) throw new Error("Clinic not found.");
      setClinicName(clinic.brand_name ?? clinic.name);
      setMembers(clinicMembers);
      setLocations(clinicLocations);
      setProfiles(assignableProfiles);
      setExistingLocationId(clinicLocations.find((location) => location.is_primary)?.location_id ?? clinicLocations[0]?.location_id ?? "");
      setNewLocationId(clinicLocations.find((location) => location.is_primary)?.location_id ?? clinicLocations[0]?.location_id ?? "");
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
              <div className="h2">Assign Existing Staff</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Add an existing platform user to this clinic without disturbing the current role-based routing model.
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
              <div className="h2">Create New Clinic Staff Account</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Create the auth user, profile, location assignment, and clinic membership together.
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
                {saving ? "Creating..." : "Create Staff Account"}
              </button>
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
