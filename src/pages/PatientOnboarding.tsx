import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { buildFollowUpMessage, resolveBookingRequestLead } from "../lib/publicFollowUpEngine";
import { readPublicBookingDraft } from "../lib/publicBookingDraft";
import { buildAuthRoute, normalizeRedirectTarget } from "../lib/routeFlow";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type LocationRow = { id: string; name: string; city: string | null; state: string | null };

export default function PatientOnboarding() {
  const { user, role, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = useMemo(() => normalizeRedirectTarget(searchParams.get("next"), "/patient"), [searchParams]);
  const handoff = searchParams.get("handoff");
  const bookingDraft = useMemo(() => readPublicBookingDraft(), []);
  const bookingFollowUp = useMemo(() => {
    return buildFollowUpMessage(
      resolveBookingRequestLead({
        serviceName: bookingDraft?.serviceName,
        notes: bookingDraft?.notes,
      }).leadType,
      resolveBookingRequestLead({
        serviceName: bookingDraft?.serviceName,
        notes: bookingDraft?.notes,
      }).urgencyLevel
    );
  }, [bookingDraft?.notes, bookingDraft?.serviceName]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const canSave = useMemo(() => {
    return !!(user?.id && firstName.trim() && lastName.trim() && locationId);
  }, [user?.id, firstName, lastName, locationId]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (authLoading) return;

      if (!user?.id) {
        nav(buildAuthRoute({ mode: "login", next: nextPath, handoff }), { replace: true });
        return;
      }

      if (role && role !== "patient") {
        nav(role === "super_admin" || role === "location_admin" ? "/admin" : "/provider", { replace: true });
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const { data: existing, error: exErr } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email, phone, dob, location_id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (exErr) throw exErr;

        if (existing?.id) {
          nav(nextPath, { replace: true });
          return;
        }

        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name,city,state")
          .order("name");

        if (locErr) throw locErr;

        if (cancelled) return;

        setLocations((locs as LocationRow[]) ?? []);
        setEmail(user.email ?? "");
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to start onboarding.";
          setErr(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, [authLoading, handoff, nav, nextPath, role, user?.email, user?.id]);

  const save = async () => {
    if (!user?.id) return;
    if (!canSave) return;

    setSaving(true);
    setErr(null);

    try {
      const { data: created, error: pErr } = await supabase
        .from("patients")
        .insert([
          {
            profile_id: user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            dob: dob ? dob : null,
            phone: phone.trim() || null,
            email: (email || user.email || "").trim() || null,
            location_id: locationId,
          },
        ])
        .select("id")
        .maybeSingle();

      if (pErr) throw pErr;

      const patientId = created?.id as string | undefined;
      if (!patientId) throw new Error("Could not create patient record.");

      const { error: dErr } = await supabase.from("patient_demographics").upsert(
        [
          {
            patient_id: patientId,
            dob: dob ? dob : null,
            email: (email || user.email || "").trim() || null,
            phone: phone.trim() || null,
          },
        ],
        { onConflict: "patient_id" }
      );

      if (dErr) throw dErr;

      nav(nextPath, { replace: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save onboarding.";
      setErr(message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="app-bg">
        <div className="shell">
          <div className="card card-pad">
            <div className="muted">Loading onboarding...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero title="Patient Onboarding" subtitle="Create your portal profile to continue" />

        <div className="space" />

        <div className="card card-pad" style={{ maxWidth: 760, margin: "0 auto" }}>
          {handoff === "booking_request" && bookingDraft?.requestId ? (
            <>
              <div
                className="card card-pad card-light surface-light"
                style={{ marginBottom: 14 }}
              >
                <div className="h2">Your visit request is already saved</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                  {bookingFollowUp.patientMessage} Finish your profile so we can continue into intake and keep your request connected to the right patient account.
                </div>
                <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
                  Reference: {bookingDraft.requestId}. {bookingDraft.serviceName || "Your selected service"}{bookingDraft.locationName ? ` at ${bookingDraft.locationName}` : ""} is waiting for clinic review. {bookingFollowUp.supportingLine}
                </div>
              </div>
            </>
          ) : null}

          {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 240px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                First name
              </div>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>

            <label style={{ flex: "1 1 240px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Last name
              </div>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 220px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Date of birth (optional)
              </div>
              <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>

            <label style={{ flex: "1 1 220px" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Phone (optional)
              </div>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(###) ###-####" />
            </label>
          </div>

          <div className="space" />

          <label style={{ display: "block" }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Email
            </div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <div className="space" />

          <label style={{ display: "block" }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Choose your clinic location
            </div>
            <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.city ? ` - ${l.city}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="space" />

          <button className="btn btn-primary" type="button" disabled={!canSave || saving} onClick={save}>
            {saving ? "Saving..." : "Finish onboarding"}
          </button>

          <div className="space" />

          <div className="muted" style={{ fontSize: 12 }}>
            This creates your patient profile so you can continue into guided intake, request visits, and message the clinic.
          </div>
        </div>
      </div>
    </div>
  );
}
