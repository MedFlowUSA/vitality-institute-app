// src/pages/ProviderLabs.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import logo from "../assets/vitality-logo.png";

type LocationRow = { id: string; name: string };

type PanelRow = { id: string; name: string };

type LabRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  appointment_id: string | null;
  intake_submission_id: string | null;
  panel_id: string;
  status: "submitted" | "reviewed";
  collected_on: string | null;
  values: any;
  provider_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export default function ProviderLabs() {
  const { user, role, signOut, activeLocationId } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const prefillIntakeId = params.get("intakeId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [panels, setPanels] = useState<PanelRow[]>([]);
  const [rows, setRows] = useState<LabRow[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = useMemo(
    () => role === "super_admin" || role === "location_admin",
    [role]
  );

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const panelName = useMemo(() => {
    const m = new Map(panels.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id;
  }, [panels]);

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString();
  };

  const loadLocations = async () => {
    const { data, error } = await supabase.from("locations").select("id,name").order("name");
    if (error) throw new Error(error.message);
    setLocations((data as LocationRow[]) ?? []);
  };

  const loadAllowed = async () => {
    if (!user) return;

    if (isAdmin) {
      setAllowedLocationIds([]);
      return;
    }

    const { data, error } = await supabase
      .from("user_locations")
      .select("location_id")
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((r: any) => r.location_id).filter(Boolean);
    setAllowedLocationIds(ids);

    if (ids.length === 1) setLocationId(ids[0]);
  };

  const loadPanels = async () => {
    const { data, error } = await supabase
      .from("lab_panels")
      .select("id,name")
      .eq("is_active", true)
      .order("name");

    if (error) throw new Error(error.message);
    setPanels((data as PanelRow[]) ?? []);
  };

  const loadLabs = async () => {
    setErr(null);

    let q = supabase
      .from("lab_results")
      .select(
        "id,created_at,location_id,patient_id,appointment_id,intake_submission_id,panel_id,status,collected_on,values,provider_notes,reviewed_by,reviewed_at"
      )
      .order("created_at", { ascending: false })
      .limit(250);

    // If coming from intake review, show matching labs first by filtering intake id
    if (prefillIntakeId) q = q.eq("intake_submission_id", prefillIntakeId);

    if (activeLocationId) {
      q = q.eq("location_id", activeLocationId);
    } else if (isAdmin) {
      if (locationId) q = q.eq("location_id", locationId);
    } else {
      if (allowedLocationIds.length === 0) {
        setRows([]);
        return;
      }
      q = q.in("location_id", allowedLocationIds);
      if (locationId) q = q.eq("location_id", locationId);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const list = (data as LabRow[]) ?? [];
    setRows(list);

    if (!activeId && list.length > 0) setActiveId(list[0].id);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadLocations();
        await loadAllowed();
        await loadPanels();
        await loadLabs();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (activeLocationId) setLocationId(activeLocationId);
  }, [activeLocationId]);

  useEffect(() => {
    (async () => {
      try {
        await loadLabs();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load labs.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, allowedLocationIds.join(","), isAdmin, activeLocationId]);

  const active = rows.find((r) => r.id === activeId) ?? null;

  useEffect(() => {
    setNote(active?.provider_notes ?? "");
  }, [activeId]);

  const markReviewed = async () => {
    if (!user || !active) return;
    setBusy(true);
    setErr(null);

    const { error } = await supabase
      .from("lab_results")
      .update({
        status: "reviewed",
        provider_notes: note || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", active.id);

    if (error) {
      setBusy(false);
      return setErr(error.message);
    }

    // If this lab is linked to an intake, flip intake_submissions.lab_reviewed
    if (active.intake_submission_id) {
      await supabase
        .from("intake_submissions")
        .update({ lab_reviewed: true })
        .eq("id", active.intake_submission_id);
    }

    setBusy(false);
    await loadLabs();
  };

  const openAI = () => {
    if (!active) return;
    const intakeId = active.intake_submission_id ?? "";
    const labId = active.id;
    nav(`/provider/ai?labId=${encodeURIComponent(labId)}${intakeId ? `&intakeId=${encodeURIComponent(intakeId)}` : ""}`);
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
          <img src={logo} alt="Vitality Institute" />
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
      <div className="v">Intake • Booking • Messages</div>
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
              <div className="h1">Lab Review</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>
              {prefillIntakeId && (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Filtered by Intake ID: {prefillIntakeId}
                </div>
              )}
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => nav("/provider")}>
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
            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* LEFT: LIST */}
              <div className="card card-pad" style={{ flex: "1 1 340px", minWidth: 320 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div className="h2">Results</div>

                  <select
                    className="input"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    disabled={!isAdmin && allowedLocationIds.length <= 1}
                    title={!isAdmin && allowedLocationIds.length <= 1 ? "You’re assigned to one location." : "Filter by location"}
                    style={{ minWidth: 220 }}
                  >
                    <option value="">{isAdmin ? "All Locations" : "My Locations"}</option>
                    {locations
                      .filter((l) => (isAdmin ? true : allowedLocationIds.includes(l.id)))
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space" />

                {(!isAdmin && allowedLocationIds.length === 0) ? (
                  <div className="muted">No locations assigned yet.</div>
                ) : rows.length === 0 ? (
                  <div className="muted">No lab results found.</div>
                ) : (
                  rows.map((r) => {
                    const activeBtn = r.id === activeId;
                    const label = panelName(r.panel_id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={activeBtn ? "btn btn-primary" : "btn btn-ghost"}
                        style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
                        onClick={() => setActiveId(r.id)}
                      >
                        <span style={{ textAlign: "left" }}>
                          {label}
                          <span className="muted" style={{ display: "block", fontSize: 12 }}>
                            {locName(r.location_id)} • {r.status} • {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* RIGHT: DETAIL */}
              <div className="card card-pad" style={{ flex: "2 1 640px", minWidth: 320 }}>
                {!active ? (
                  <div className="muted">Select a lab result.</div>
                ) : (
                  <>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div className="h2" style={{ marginBottom: 2 }}>
                          {panelName(active.panel_id)} • {active.status}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          Submitted: {fmt(active.created_at)} • Location: {locName(active.location_id)}
                        </div>

                        {active.collected_on && (
                          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                            Collected on: {active.collected_on}
                          </div>
                        )}

                        {active.intake_submission_id && (
                          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                            Intake ID: {active.intake_submission_id}
                          </div>
                        )}

                        {active.appointment_id && (
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Appointment ID: {active.appointment_id}
                          </div>
                        )}

                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          Lab ID: {active.id}
                        </div>

                        <div className="space" />

                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          {active.intake_submission_id && (
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() => nav(`/provider/intakes?activeId=${encodeURIComponent(active.intake_submission_id!)}`)}
                            >
                              Open Intake
                            </button>
                          )}
                          <button className="btn btn-ghost" type="button" onClick={openAI}>
                            Open AI Draft
                          </button>
                        </div>
                      </div>

                      <div style={{ width: 420, maxWidth: "100%" }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                          Provider notes
                        </div>
                        <textarea
                          className="input"
                          style={{ width: "100%", minHeight: 110 }}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Notes, interpretation, follow-up…"
                        />

                        <div className="space" />

                        <button className="btn btn-primary" type="button" onClick={markReviewed} disabled={busy}>
                          {busy ? "Saving…" : "Mark Reviewed"}
                        </button>

                        {active.reviewed_at && (
                          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                            Reviewed at: {fmt(active.reviewed_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space" />

                    <div className="card card-pad">
                      <div className="h2">Values (JSON)</div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        These are mostly dropdown selections to keep patient input consistent.
                      </div>
                      <div className="space" />

                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35 }}>
                        {JSON.stringify(active.values ?? {}, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
