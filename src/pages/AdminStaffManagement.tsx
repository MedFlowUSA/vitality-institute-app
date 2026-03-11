import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type LocationRow = {
  id: string;
  name: string;
};

type StaffRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  active_location_id: string | null;
};

const ROLE_OPTIONS = [
  "super_admin",
  "location_admin",
  "provider",
  "clinical_staff",
  "billing",
  "front_desk",
] as const;

export default function AdminStaffManagement() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const [loadingBase, setLoadingBase] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [role, setRole] = useState<string>("provider");
  const [locationId, setLocationId] = useState("");

  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? "—";

  const loadBase = async () => {
    setLoadingBase(true);
    setErr(null);

    try {
      const [{ data: locs, error: locErr }, { data: profiles, error: profErr }] =
        await Promise.all([
          supabase.from("locations").select("id,name").order("name"),
          supabase
            .from("profiles")
            .select("id,first_name,last_name,role,active_location_id")
            .in("role", [...ROLE_OPTIONS])
            .order("first_name"),
        ]);

      if (locErr) throw locErr;
      if (profErr) throw profErr;

      setLocations((locs as LocationRow[]) ?? []);
      setStaff((profiles as StaffRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load staff management.");
    } finally {
      setLoadingBase(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setTempPassword("");
    setRole("provider");
    setLocationId("");
  };

  const createStaff = async () => {
    setSubmitting(true);
    setErr(null);
    setMsg(null);

    try {
      if (!firstName.trim()) throw new Error("First name is required.");
      if (!lastName.trim()) throw new Error("Last name is required.");
      if (!email.trim()) throw new Error("Email is required.");
      if (!tempPassword.trim() || tempPassword.trim().length < 8) {
        throw new Error("Temporary password must be at least 8 characters.");
      }
      if (!locationId) throw new Error("Location is required.");

      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          temp_password: tempPassword.trim(),
          role,
          location_id: locationId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMsg("Staff account created successfully.");
      resetForm();
      await loadBase();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create staff account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Staff Management"
          subtitle="Create internal provider and staff accounts"
          secondaryCta={{ label: "Back", to: "/admin" }}
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">Create Staff Account</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Internal-only access. Assign role and primary location at creation.
          </div>

          <div className="space" />

          {loadingBase && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}
          {msg && <div style={{ color: "green", marginBottom: 12 }}>{msg}</div>}

          {!loadingBase && (
            <>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />

                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div className="space" />

              <input
                className="input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="space" />

              <input
                className="input"
                type="password"
                placeholder="Temporary password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
              />

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <select
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              <button
                className="btn btn-primary"
                type="button"
                onClick={createStaff}
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Create Staff Account"}
              </button>
            </>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">Current Staff</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Current internal profiles with mapped roles.
          </div>

          <div className="space" />

          {loadingBase ? (
            <div className="muted">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="muted">No staff profiles found.</div>
          ) : (
            staff.map((s) => (
              <div
                key={s.id}
                className="card card-pad"
                style={{ marginBottom: 10, background: "rgba(255,255,255,0.05)" }}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="h2" style={{ marginBottom: 4 }}>
                      {`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.id}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Role: <strong>{s.role ?? "—"}</strong>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      Location: <strong>{locationName(s.active_location_id)}</strong>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      ID: {s.id}
                    </div>
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
