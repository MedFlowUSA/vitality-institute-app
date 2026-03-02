// src/pages/ProviderCommandCenter.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

type LocationRow = { id: string; name: string | null; city: string | null; state: string | null };

type ApptRow = {
  id: string;
  location_id: string;
  patient_id: string;
  start_time: string;
  status: string;
  service_id: string | null;
  notes: string | null;
};

type IntakeRow = {
  id: string;
  patient_id: string;
  location_id: string;
  service_type: string;
  status: string;
  created_at: string;
  locked_at: string | null;
};

type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
};

function sameDayLocalIsoRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function badgeStyle(status: string) {
  const s = (status || "").toLowerCase();
  const base: React.CSSProperties = {
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(255,255,255,.08)",
  };

  if (s === "locked") return { ...base, background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.35)" };
  if (s === "approved") return { ...base, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)" };
  if (s === "needs_info") return { ...base, background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.35)" };
  if (s === "submitted") return { ...base, background: "rgba(148,163,184,.18)", border: "1px solid rgba(148,163,184,.35)" };

  return base;
}

function patientLabel(p?: PatientRow | null) {
  if (!p) return "Unknown patient";
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return name || p.email || p.phone || "Patient";
}

export default function ProviderCommandCenter() {
  const nav = useNavigate();
  const { user, role, signOut } = useAuth();

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);

  const [appts, setAppts] = useState<ApptRow[]>([]);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);

  const [patientsById, setPatientsById] = useState<Record<string, PatientRow>>({});

  const locationName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name ?? l.id]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  async function ensureChatThreadForAppointment(appt: ApptRow) {
    // 1) try existing
    const { data: existing, error: exErr } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("appointment_id", appt.id)
      .maybeSingle();

    if (exErr) throw exErr;

    let threadId = existing?.id as string | undefined;

    // 2) create if missing
    if (!threadId) {
      const subject = `Appointment • ${new Date(appt.start_time).toLocaleString()}`;
      const { data: created, error: crErr } = await supabase
        .from("chat_threads")
        .insert([
          {
            location_id: appt.location_id,
            patient_id: appt.patient_id,
            appointment_id: appt.id,
            subject,
            status: "open",
          },
        ])
        .select("id")
        .maybeSingle();

      if (crErr) throw crErr;
      threadId = created?.id as string | undefined;
    }

    if (!threadId) throw new Error("Could not open or create chat thread.");
    return threadId;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.id) return;

      setErr(null);
      setLoading(true);

      try {
        // 1) Load locations (for labels)
        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name,city,state")
          .order("name");

        if (locErr) throw locErr;
        if (cancelled) return;
        setLocations((locs as LocationRow[]) ?? []);

        // 2) Determine provider allowed locations
        // We support either user_locations or user_location_roles.
        // If both exist, we use the union.
        const ids = new Set<string>();

        const ul = await supabase
          .from("user_locations")
          .select("location_id")
          .eq("user_id", user.id);

        if (!ul.error) {
          (ul.data as any[] | null)?.forEach((r) => r?.location_id && ids.add(r.location_id));
        }

        const ulr = await supabase
          .from("user_location_roles")
          .select("location_id")
          .eq("user_id", user.id);

        if (!ulr.error) {
          (ulr.data as any[] | null)?.forEach((r) => r?.location_id && ids.add(r.location_id));
        }

        const allowed = Array.from(ids);

        // Fallback: if nothing returned, allow all (dev mode)
        const finalAllowed = allowed.length ? allowed : (locs ?? []).map((l: any) => l.id);

        if (cancelled) return;
        setAllowedLocationIds(finalAllowed);

        // 3) Load today’s appointments (for allowed locations)
        const { startIso, endIso } = sameDayLocalIsoRange(new Date());

        const apptRes = await supabase
          .from("appointments")
          .select("id,location_id,patient_id,start_time,status,service_id,notes")
          .in("location_id", finalAllowed)
          .gte("start_time", startIso)
          .lte("start_time", endIso)
          .order("start_time", { ascending: true });

        if (apptRes.error) throw apptRes.error;
        if (cancelled) return;

        const apptRows = (apptRes.data as ApptRow[]) ?? [];
        setAppts(apptRows);

        // 4) Load latest wound intakes (queue)
        const intakeRes = await supabase
          .from("patient_intakes")
          .select("id,patient_id,location_id,service_type,status,created_at,locked_at")
          .in("location_id", finalAllowed)
          .eq("service_type", "wound_care")
          .order("created_at", { ascending: false })
          .limit(25);

        if (intakeRes.error) throw intakeRes.error;
        if (cancelled) return;

        const intakeRows = (intakeRes.data as IntakeRow[]) ?? [];
        setIntakes(intakeRows);

        // 5) Hydrate patient labels (patients table)
        const patientIds = new Set<string>();
        apptRows.forEach((a) => a.patient_id && patientIds.add(a.patient_id));
        intakeRows.forEach((i) => i.patient_id && patientIds.add(i.patient_id));

        const uniquePatientIds = Array.from(patientIds);

        if (uniquePatientIds.length) {
          const pRes = await supabase
            .from("patients")
            .select("id,first_name,last_name,dob,phone,email")
            .in("id", uniquePatientIds);

          // If RLS blocks this for providers, the page still works with “Unknown patient”
          if (!pRes.error && pRes.data) {
            const map: Record<string, PatientRow> = {};
            (pRes.data as PatientRow[]).forEach((p) => (map[p.id] = p));
            if (!cancelled) setPatientsById(map);
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load Provider Command Center.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const quickBtnProps = {
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    type: "button" as const,
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Command Center"
          subtitle="Today’s schedule • Intake queue • Messaging"
          rightActions={
            <>
              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => nav("/provider/intake")}>
                Intake Review
              </button>
              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => nav("/provider/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </>
          }
          activityItems={[
            { t: "Today", m: "Review appointments + prep visits", s: "Schedule" },
            { t: "Queue", m: "Process wound intakes fast", s: "Intake" },
            { t: "Secure", m: "Message patients by appointment", s: "Messaging" },
          ]}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="h1">Provider Portal</div>
          <div className="muted">Role: {role}</div>
          <div className="muted">Signed in: {user?.email}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Allowed locations: {allowedLocationIds.length ? allowedLocationIds.map(locationName).join(", ") : "—"}
          </div>
        </div>

        <div className="space" />

        {loading ? <div className="muted">Loading…</div> : null}
        {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

        {!loading && (
          <>
            <div className="card card-pad">
              <div className="h2">Today’s Appointments</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Tap “Open Chat” to message the patient for that appointment.
              </div>

              <div className="space" />

              {appts.length === 0 ? (
                <div className="muted">No appointments for today.</div>
              ) : (
                appts.map((a) => {
                  const p = patientsById[a.patient_id] ?? null;
                  return (
                    <div key={a.id} className="card card-pad" style={{ marginBottom: 12 }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div className="h2">{new Date(a.start_time).toLocaleString()}</div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            Location: {locationName(a.location_id)}
                          </div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            Patient: <strong>{patientLabel(p)}</strong>
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Status: <strong>{a.status}</strong>
                          </div>
                          {a.notes ? (
                            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                              Notes: {a.notes}
                            </div>
                          ) : null}
                          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                            Appointment ID: {a.id}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={async () => {
                              try {
                                const threadId = await ensureChatThreadForAppointment(a);
                                nav(`/provider/chat?threadId=${threadId}`);
                              } catch (e: any) {
                                alert(e?.message ?? "Failed to open chat.");
                              }
                            }}
                          >
                            Open Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space" />

            <div className="card card-pad">
              <div className="h2">Wound Intake Queue</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Latest 25 wound care intakes for your locations.
              </div>

              <div className="space" />

              {intakes.length === 0 ? (
                <div className="muted">No intakes found.</div>
              ) : (
                intakes.map((i) => {
                  const p = patientsById[i.patient_id] ?? null;
                  return (
                    <div key={i.id} className="card card-pad" style={{ marginBottom: 12 }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div className="h2">{patientLabel(p)}</div>
                            <span style={badgeStyle(i.status)}>{(i.status || "").toUpperCase()}</span>
                          </div>

                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            Location: {locationName(i.location_id)}
                          </div>

                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Submitted: {new Date(i.created_at).toLocaleString()}
                          </div>

                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Intake ID: {i.id}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => nav(`/provider/intake?intakeId=${i.id}`)}
                          >
                            Review Intake
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}