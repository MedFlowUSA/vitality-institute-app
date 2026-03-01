// src/pages/PatientLabs.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

type PanelRow = { id: string; name: string };
type MarkerRow = {
  id: string;
  panel_id: string;
  key: string;
  label: string;
  input_type: "select" | "number";
  unit: string | null;
  options: string[] | null;
};

type AppointmentRow = {
  id: string;
  location_id: string;
  start_time: string;
  status: string;
};

type LocationRow = { id: string; name: string };

export default function PatientLabs() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const prefillIntakeId = params.get("intakeId") ?? "";
  const prefillApptId = params.get("appointmentId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);

  const [panels, setPanels] = useState<PanelRow[]>([]);
  const [markers, setMarkers] = useState<MarkerRow[]>([]);

  const [panelId, setPanelId] = useState("");
  const [appointmentId, setAppointmentId] = useState(prefillApptId);
  const [intakeId, setIntakeId] = useState(prefillIntakeId);

  const [collectedOn, setCollectedOn] = useState<string>("");

  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const panelName = useMemo(() => {
    const m = new Map(panels.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id;
  }, [panels]);

  const panelMarkers = useMemo(
    () => markers.filter((m) => m.panel_id === panelId),
    [markers, panelId]
  );

  const setVal = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));

  const load = async () => {
    setErr(null);
    setLoading(true);

    const { data: locs, error: locErr } = await supabase
      .from("locations")
      .select("id,name")
      .order("name");

    if (locErr) {
      setErr(locErr.message);
      setLoading(false);
      return;
    }
    setLocations((locs as LocationRow[]) ?? []);

    if (user) {
      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select("id,location_id,start_time,status")
        .eq("patient_id", user.id)
        .order("start_time", { ascending: false })
        .limit(25);

      if (apptErr) {
        setErr(apptErr.message);
        setLoading(false);
        return;
      }
      setAppointments((appts as AppointmentRow[]) ?? []);
    }

    const { data: p, error: pErr } = await supabase
      .from("lab_panels")
      .select("id,name")
      .eq("is_active", true)
      .order("name");
    if (pErr) {
      setErr(pErr.message);
      setLoading(false);
      return;
    }
    setPanels((p as PanelRow[]) ?? []);
    if (!panelId && (p?.length ?? 0) > 0) setPanelId((p as any)[0].id);

    const { data: m, error: mErr } = await supabase
      .from("lab_markers")
      .select("id,panel_id,key,label,input_type,unit,options")
      .eq("is_active", true)
      .order("label");
    if (mErr) {
      setErr(mErr.message);
      setLoading(false);
      return;
    }
    setMarkers((m as MarkerRow[]) ?? []);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // reset values when panel changes
    setValues({});
  }, [panelId]);

  const submit = async () => {
    setErr(null);
    if (!user) return;

    if (!panelId) return setErr("Please select a lab panel.");
    if (!appointmentId && locations.length === 0) return setErr("No locations found.");

    const appt = appointments.find((a) => a.id === appointmentId) ?? null;
    const locationId = appt?.location_id ?? locations[0]?.id ?? "";

    if (!locationId) return setErr("No location could be determined.");

    // validate minimal: require value for every marker in that panel
    for (const mk of panelMarkers) {
      const v = values[mk.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        return setErr(`Please complete: ${mk.label}`);
      }
    }

    setSaving(true);

    const { error } = await supabase.from("lab_results").insert([
      {
        location_id: locationId,
        patient_id: user.id,
        appointment_id: appointmentId || null,
        intake_submission_id: intakeId || null,
        panel_id: panelId,
        status: "submitted",
        collected_on: collectedOn || null,
        values,
      },
    ]);

    setSaving(false);

    if (error) return setErr(error.message);

    alert("Labs submitted ✅");
    nav("/patient", { replace: true });
  };

  return (
    <div className="app-bg">
      <div className="shell">
        {/* =========================
    Vitality Hero Header
========================= */}
<div className="v-hero">
  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
    <div style={{ flex: "1 1 520px" }}>
      <div className="v-brand">
        {/* If you have logo imported in this page, show it.
           Example: import logo from "../assets/vitality-logo.png"; */}
        {"logo" in (globalThis as any) ? null : null}
        <div className="v-logo">
          <img src="/logo.png" alt="Vitality Institute" />
        </div>

        <div className="v-brand-title">
          <div className="title">Vitality Institute</div>
          <div className="sub">Patient & Provider Platform • Secure Intake • Scheduling • Messaging • Labs</div>
        </div>
      </div>

      <div className="v-chips">
        <div className="v-chip">
          Role: <strong>{role}</strong>
        </div>
        <div className="v-chip">
          Signed in: <strong>{user?.email ?? "—"}</strong>
        </div>
        <div className="v-chip">
          Status: <strong>Active</strong>
        </div>
      </div>
    </div>

    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {/* Replace these buttons per page */}
      <button className="btn btn-ghost" type="button" onClick={() => nav(-1)}>
        Back
      </button>
      <button className="btn btn-primary" type="button" onClick={() => alert("Coming next: AI Summary + Plan Builder")}>
        AI Plan Builder
      </button>
      <button className="btn btn-ghost" onClick={signOut}>
        Sign out
      </button>
    </div>
  </div>

  <div className="v-statgrid">
    <div className="v-stat">
      <div className="k">Modules Built</div>
      <div className="v">7</div>
    </div>
    <div className="v-stat">
      <div className="k">Patient Flows</div>
      <div className="v">Intake • Booking • Chat</div>
    </div>
    <div className="v-stat">
      <div className="k">Provider Tools</div>
      <div className="v">Review • Sign-Off</div>
    </div>
    <div className="v-stat">
      <div className="k">Next Upgrade</div>
      <div className="v">AI + Labs</div>
    </div>
  </div>
</div>
<div className="space" />
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="h1">Labs</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => nav("/patient")}>
                Back
              </button>
              <button className="btn btn-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="h2">Submit Lab Snapshot</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Mostly dropdown selections to minimize freehand input.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "1 1 260px" }} value={panelId} onChange={(e) => setPanelId(e.target.value)}>
                  {panels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  style={{ flex: "2 1 340px" }}
                  value={appointmentId}
                  onChange={(e) => setAppointmentId(e.target.value)}
                >
                  <option value="">Link to appointment (optional)</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.start_time).toLocaleString()} — {locName(a.location_id)} — {a.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  type="date"
                  value={collectedOn}
                  onChange={(e) => setCollectedOn(e.target.value)}
                  placeholder="Collected on (optional)"
                />

                <input
                  className="input"
                  style={{ flex: "2 1 320px" }}
                  value={intakeId}
                  onChange={(e) => setIntakeId(e.target.value)}
                  placeholder="Link to Intake ID (optional)"
                />
              </div>

              <div className="space" />

              <div className="card card-pad">
                <div className="h2">{panelName(panelId)}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Complete each item below.
                </div>

                <div className="space" />

                {panelMarkers.length === 0 ? (
                  <div className="muted">No markers configured yet for this panel.</div>
                ) : (
                  panelMarkers.map((mk) => {
                    const v = values[mk.key];

                    if (mk.input_type === "number") {
                      return (
                        <div key={mk.id} style={{ marginBottom: 12 }}>
                          <div className="muted" style={{ marginBottom: 6 }}>
                            {mk.label} {mk.unit ? `(${mk.unit})` : ""}
                          </div>
                          <input
                            className="input"
                            type="number"
                            value={v ?? ""}
                            onChange={(e) => setVal(mk.key, e.target.value)}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={mk.id} style={{ marginBottom: 12 }}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          {mk.label} {mk.unit ? `(${mk.unit})` : ""}
                        </div>
                        <select className="input" value={v ?? ""} onChange={(e) => setVal(mk.key, e.target.value)}>
                          <option value="">Select…</option>
                          {(mk.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space" />

              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? "Submitting…" : "Submit Labs"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
