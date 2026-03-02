// src/pages/PatientOnboarding.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

type LocationRow = { id: string; name: string | null };

type PatientRow = {
  id: string;
  organization_id: string | null;
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null; // date
  phone: string | null;
  email: string | null;
  location_id: string | null;
  created_at: string;
};

function normalizePhone(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  return cleaned;
}

export default function PatientOnboarding() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [patient, setPatient] = useState<PatientRow | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [locationId, setLocationId] = useState<string>("");

  const canSave = useMemo(() => {
    if (!user?.id) return false;
    if (!firstName.trim()) return false;
    if (!lastName.trim()) return false;
    if (!dob.trim()) return false;
    if (!locationId) return false;
    return true;
  }, [user?.id, firstName, lastName, dob, locationId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        if (authLoading) return;
        if (!user?.id) {
          nav("/login");
          return;
        }

        setLoading(true);

        // Load locations for dropdown
        const locRes = await supabase.from("locations").select("id,name").order("name", { ascending: true });
        if (locRes.error) throw locRes.error;
        if (!cancelled) setLocations((locRes.data as LocationRow[]) ?? []);

        // Load existing patient row (if already onboarded)
        const pRes = await supabase.from("patients").select("*").eq("profile_id", user.id).maybeSingle();
        if (pRes.error) throw pRes.error;

        const existing = (pRes.data as PatientRow | null) ?? null;
        if (!cancelled) setPatient(existing);

        // Prefill from patients if exists
        if (existing) {
          if (!cancelled) {
            setFirstName(existing.first_name ?? "");
            setLastName(existing.last_name ?? "");
            setDob(existing.dob ?? "");
            setPhone(existing.phone ?? "");
            setEmail(existing.email ?? "");
            setLocationId(existing.location_id ?? "");
          }
          return;
        }

        // optional prefill
        try {
          const profRes = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
          if (!profRes.error && profRes.data) {
            const pr: any = profRes.data;
            if (!cancelled) {
              setFirstName((pr.first_name ?? pr.firstName ?? "") as string);
              setLastName((pr.last_name ?? pr.lastName ?? "") as string);
              setPhone((pr.phone ?? "") as string);
              setEmail((pr.email ?? user.email ?? "") as string);
            }
          } else {
            if (!cancelled) setEmail(user.email ?? "");
          }
        } catch {
          if (!cancelled) setEmail(user.email ?? "");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load onboarding data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, user?.email, nav]);

  async function onSave() {
    try {
      setError(null);
      if (!user?.id) throw new Error("Not authenticated.");

      if (!canSave) {
        setError("Please complete required fields (name, DOB, location).");
        return;
      }

      setSaving(true);

      const organizationId = patient?.organization_id ?? null;

      const payload = {
        profile_id: user.id,
        organization_id: organizationId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dob.trim(),
        phone: normalizePhone(phone),
        email: email.trim() || user.email || null,
        location_id: locationId,
      };

      const upRes = await supabase
        .from("patients")
        .upsert(payload, { onConflict: "profile_id" })
        .select("*")
        .single();

      if (upRes.error) throw upRes.error;

      const savedPatient = upRes.data as PatientRow;
      setPatient(savedPatient);

      // ✅ Ensure membership exists (patient_location_memberships)
      if (savedPatient?.id && locationId) {
        const { data: existingMembership, error: memCheckErr } = await supabase
          .from("patient_location_memberships")
          .select("id")
          .eq("patient_id", savedPatient.id)
          .eq("location_id", locationId)
          .maybeSingle();

        if (memCheckErr) throw memCheckErr;

        if (!existingMembership?.id) {
          const { error: memInsertErr } = await supabase
            .from("patient_location_memberships")
            .insert([{ patient_id: savedPatient.id, location_id: locationId }]);

          if (memInsertErr) throw memInsertErr;
        }
      }

      nav("/patient");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save patient profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <VitalityHero title="Patient Onboarding" subtitle="Loading..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <VitalityHero title="Complete Your Profile" subtitle="This helps the clinic verify your information and coordinate care." />

      {error ? <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-medium mb-1">First Name *</div>
            <input className="input input-bordered w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-1">Last Name *</div>
            <input className="input input-bordered w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-medium mb-1">Date of Birth *</div>
          <input type="date" className="input input-bordered w-full" value={dob} onChange={(e) => setDob(e.target.value)} />
        </label>

        <label className="block">
          <div className="text-sm font-medium mb-1">Phone</div>
          <input className="input input-bordered w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+19094961916" autoComplete="tel" />
        </label>

        <label className="block">
          <div className="text-sm font-medium mb-1">Email</div>
          <input className="input input-bordered w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" autoComplete="email" />
        </label>

        <label className="block">
          <div className="text-sm font-medium mb-1">Preferred Clinic Location *</div>
          <select className="select select-bordered w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Select a location…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? l.id}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">This sets your default clinic for appointments and messaging.</div>
        </label>

        <div className="mt-2 flex gap-3">
          <button className="btn btn-primary" onClick={onSave} disabled={!canSave || saving} type="button">
            {saving ? "Saving..." : "Save & Continue"}
          </button>

          <button className="btn btn-ghost" type="button" onClick={() => nav("/patient")}>
            Skip for now
          </button>
        </div>

        {patient ? (
          <div className="text-xs text-gray-500 mt-2">Patient record linked to profile_id: {patient.profile_id}</div>
        ) : null}
      </div>
    </div>
  );
}