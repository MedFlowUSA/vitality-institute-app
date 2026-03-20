// src/pages/ProviderIntake.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import DictationTextarea from "../components/DictationTextarea";
import ProviderGuidePanel from "../components/provider/ProviderGuidePanel";
import ProviderWorkspaceNav from "../components/provider/ProviderWorkspaceNav";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import { buildProviderIntakeGuide } from "../lib/provider/providerGuide";
import { getSignedUrl } from "../lib/patientFiles";

type LocationRow = { id: string; name: string };

type IntakeStatus = "submitted" | "approved" | "needs_info" | "locked" | "rejected" | string;

type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type WoundUpload = {
  bucket: string;
  path: string;
  filename: string;
  category: string;
};

type WoundData = {
  wound_location?: string;
  wound_duration?: string;
  wound_cause?: string;
  prior_treatments?: string;
  current_dressing?: string;
  pain_level?: number;
  has_diabetes?: string;
  smokes?: string;
  uploads?: WoundUpload[];
};

type WoundIntakeRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string; // patients.id
  service_type: string;
  status: IntakeStatus;

  wound_data: WoundData | null;
  medications: string | null;

  provider_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  locked_at: string | null;
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function badgeStyle(status: string) {
  const s = (status || "").toLowerCase();
  const base: React.CSSProperties = {
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(255,255,255,.08)",
    display: "inline-block",
  };
  if (s === "locked") return { ...base, background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.35)" };
  if (s === "approved") return { ...base, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)" };
  if (s === "needs_info") return { ...base, background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.35)" };
  if (s === "submitted") return { ...base, background: "rgba(148,163,184,.18)", border: "1px solid rgba(148,163,184,.35)" };
  if (s === "rejected") return { ...base, background: "rgba(239,68,68,.18)", border: "1px solid rgba(239,68,68,.35)" };
  return base;
}

const intakeLightCardStyle: React.CSSProperties = {
  color: "#241B3D",
};

const intakeLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#5B4E86",
};

const intakeValueStyle: React.CSSProperties = {
  color: "#2F2748",
  lineHeight: 1.65,
};

export default function ProviderIntake() {
  const { user, role, signOut, resumeKey } = useAuth();
  const [params] = useSearchParams();

  const prefillActiveId = params.get("activeId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<string>(""); // "", submitted, needs_info, approved, locked
  const [rows, setRows] = useState<WoundIntakeRow[]>([]);
  const [activeId, setActiveId] = useState<string>(prefillActiveId);

  const [patientsById, setPatientsById] = useState<Record<string, PatientRow>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = useMemo(() => role === "super_admin" || role === "location_admin", [role]);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const active = rows.find((r) => r.id === activeId) ?? null;
  const guide = buildProviderIntakeGuide(!!active);

  const loadAllowedLocations = async () => {
    if (!user?.id) {
      setAllowedLocationIds([]);
      return [] as string[];
    }

    if (isAdmin) {
      setAllowedLocationIds([]);
      return [] as string[];
    }

    // prefer user_location_roles; fallback to user_locations
    let ids: string[] = [];

    const { data: ulr, error: ulrErr } = await supabase
      .from("user_location_roles")
      .select("location_id")
      .eq("user_id", user.id);

    if (!ulrErr && ulr && ulr.length > 0) {
      ids = (ulr ?? []).map((r: any) => r.location_id).filter(Boolean);
    } else {
      const { data: ul, error: ulErr2 } = await supabase
        .from("user_locations")
        .select("location_id")
        .eq("user_id", user.id);

      if (ulErr2) throw new Error(ulErr2.message);
      ids = (ul ?? []).map((r: any) => r.location_id).filter(Boolean);
    }

    setAllowedLocationIds(ids);

    if (!locationId && ids.length > 0) setLocationId(ids[0]);

    return ids;
  };

  const loadLocations = async (allowedIds: string[]) => {
    if (isAdmin) {
      const { data, error } = await supabase.from("locations").select("id,name").order("name");
      if (error) throw new Error(error.message);
      setLocations((data as LocationRow[]) ?? []);
      return;
    }

    if (allowedIds.length === 0) {
      setLocations([]);
      return;
    }

    const { data, error } = await supabase.from("locations").select("id,name").in("id", allowedIds).order("name");
    if (error) throw new Error(error.message);
    setLocations((data as LocationRow[]) ?? []);
  };

  const loadPatientsForRows = async (list: WoundIntakeRow[]) => {
    const ids = Array.from(new Set(list.map((r) => r.patient_id).filter(Boolean)));
    if (ids.length === 0) {
      setPatientsById({});
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .select("id,first_name,last_name,email,phone")
      .in("id", ids);

    if (error) throw new Error(error.message);

    const map: Record<string, PatientRow> = {};
    (data as PatientRow[] | null)?.forEach((p) => {
      map[p.id] = p;
    });
    setPatientsById(map);
  };

  const loadIntakes = async (allowedIds: string[]) => {
    setErr(null);

    let q = supabase
      .from("patient_intakes")
      .select(
        [
          "id",
          "created_at",
          "location_id",
          "patient_id",
          "service_type",
          "status",
          "wound_data",
          "medications",
          "provider_notes",
          "reviewed_by",
          "reviewed_at",
          "locked_at",
        ].join(",")
      )
      .eq("service_type", "wound_care")
      .order("created_at", { ascending: false })
      .limit(250);

    if (isAdmin) {
      if (locationId) q = q.eq("location_id", locationId);
    } else {
      if (allowedIds.length === 0) {
        setRows([]);
        return;
      }
      q = q.in("location_id", allowedIds);
      if (locationId) q = q.eq("location_id", locationId);
    }

    if (statusFilter) q = q.eq("status", statusFilter);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const list = ((data ?? []) as unknown as WoundIntakeRow[]);
    setRows(list);

    await loadPatientsForRows(list);

    if (!activeId && list.length > 0) setActiveId(list[0].id);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) return;
      setLoading(true);
      setErr(null);

      try {
        const allowed = await loadAllowedLocations();
        if (cancelled) return;

        await loadLocations(allowed);
        if (cancelled) return;

        await loadIntakes(allowed);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load wound intake review.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeKey, user?.id, isAdmin]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) return;
      try {
        const allowed = isAdmin ? [] : allowedLocationIds;
        await loadIntakes(allowed);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to refresh intakes.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, statusFilter, isAdmin, allowedLocationIds.join(","), resumeKey]);

  const updateStatus = async (id: string, status: string, providerNotes: string) => {
    if (!user?.id) return;

    // Prefer RPC if you have it; fallback to direct update.
    // NOTE: RPC requires app auth context (won’t work in SQL editor).
    const tryRpc = async () => {
      const { error } = await supabase.rpc("provider_set_intake_status", {
        p_intake_id: id,
        p_status: status,
        p_provider_notes: providerNotes || null,
      } as any);
      if (error) throw error;
    };

    const tryDirect = async () => {
      const patch: any = {
        status,
        provider_notes: providerNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (status === "locked") patch.locked_at = new Date().toISOString();

      const { error } = await supabase.from("patient_intakes").update(patch).eq("id", id);
      if (error) throw error;
    };

    try {
      // Try RPC first (if function exists)
      await tryRpc();
    } catch {
      // Fallback to direct update
      try {
        await tryDirect();
      } catch (e: any) {
        alert(e?.message ?? "Failed to update intake.");
        return;
      }
    }

    const allowed = isAdmin ? [] : allowedLocationIds;
    await loadIntakes(allowed);
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Intake Review"
          subtitle="Review and work submitted wound intakes."
          backTo="/provider"
          homeTo="/provider"
          rightAction={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
        />

        <div className="space" />

        <VitalityHero
          title="Vitality Institute"
          subtitle="Review wound care intakes and move them through approval."
          secondaryCta={{ label: "Back", to: "/provider" }}
          primaryCta={{ label: "Queue", to: "/provider/queue" }}
          rightActions={null}
          showKpis={false}
        />

        <div className="space" />

        <ProviderWorkspaceNav compact />

        <div className="space" />

        <ProviderGuidePanel
          title={guide.title}
          description={guide.description}
          workflowState={guide.workflowState}
          nextAction={guide.nextAction}
          actions={[
            { label: "Open Queue", to: "/provider/queue", tone: "primary" },
            active ? { label: "Open Patient Center", to: `/provider/patients/${active.patient_id}` } : { label: "Vital AI Requests", to: "/provider/vital-ai" },
          ]}
        />

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* LEFT LIST */}
              <div className="card card-pad card-light surface-light" style={{ flex: "1 1 360px", minWidth: 320 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em" }}>Incoming Queue</div>
                    <div className="h2" style={{ marginTop: 6 }}>Wound Submissions</div>
                  </div>
                </div>

                <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                  Review urgent wound history, status, and uploads before moving the intake into approval or lock.
                </div>

                <div className="space" />

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <select
                    className="input"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    disabled={!isAdmin && allowedLocationIds.length <= 1}
                    title={!isAdmin && allowedLocationIds.length <= 1 ? "You’re assigned to one location." : "Filter by location"}
                    style={{ flex: "1 1 220px", minWidth: 220 }}
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

                  <select
                    className="input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ flex: "1 1 180px", minWidth: 180 }}
                    title="Filter by status"
                  >
                    <option value="">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="needs_info">Needs Info</option>
                    <option value="approved">Approved</option>
                    <option value="locked">Locked</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space" />

                {!isAdmin && allowedLocationIds.length === 0 ? (
                  <div className="muted">No locations assigned yet.</div>
                ) : rows.length === 0 ? (
                  <div className="muted">No wound intakes found.</div>
                ) : (
                  rows.map((r) => {
                    const activeBtn = r.id === activeId;
                    const p = patientsById[r.patient_id];

                    const patientLabel =
                      (p?.first_name || p?.last_name)
                        ? `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim()
                        : `Patient • ${r.patient_id.slice(0, 8)}…`;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        className="card card-pad card-light surface-light"
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          textAlign: "left",
                          cursor: "pointer",
                          border: activeBtn ? "1px solid rgba(124,58,237,0.38)" : "1px solid rgba(184,164,255,0.16)",
                          background: activeBtn
                            ? "linear-gradient(135deg, rgba(232,224,255,0.98), rgba(245,240,255,0.96))"
                            : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,245,255,0.94))",
                          boxShadow: activeBtn ? "0 16px 34px rgba(139,124,255,0.14)" : "0 10px 24px rgba(15,23,42,0.06)",
                        }}
                        onClick={() => setActiveId(r.id)}
                      >
                        <span style={{ textAlign: "left" }}>
                          <span style={{ fontWeight: 700 }}>WOUND CARE</span> • <span style={badgeStyle(r.status)}>{r.status.toUpperCase()}</span>
                          <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 6 }}>
                            {patientLabel} • {locName(r.location_id)}
                          </span>
                          <span className="muted" style={{ display: "block", fontSize: 12 }}>
                            {new Date(r.created_at).toLocaleDateString()} • {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* RIGHT DETAIL */}
              <div className="card card-pad card-light surface-light" style={{ flex: "2 1 680px", minWidth: 320 }}>
                {!active ? (
                  <div className="muted">Select a submission.</div>
                ) : (
                  <WoundIntakeDetail
                    row={active}
                    patient={patientsById[active.patient_id] ?? null}
                    locationName={locName(active.location_id)}
                    onUpdate={updateStatus}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space" />

        <div className="muted" style={{ fontSize: 12 }}>
          Tip: “Locked” should be your final step once intake is clinically approved — it triggers downstream Visit/SOAP automation (per your DB functions).
        </div>
      </div>
    </div>
  );
}

function WoundIntakeDetail({
  row,
  patient,
  locationName,
  onUpdate,
}: {
  row: WoundIntakeRow;
  patient: PatientRow | null;
  locationName: string;
  onUpdate: (id: string, status: string, notes: string) => Promise<void>;
}) {
  const [note, setNote] = useState(row.provider_notes ?? "");
  const [busy, setBusy] = useState(false);

  const [signedUploads, setSignedUploads] = useState<
    { filename: string; category: string; url: string }[]
  >([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const lock = (row.status || "").toLowerCase() === "locked" || !!row.locked_at;

  useEffect(() => {
    setNote(row.provider_notes ?? "");
  }, [row.id]);

  const wound = (row.wound_data ?? {}) as WoundData;
  const uploads = (wound.uploads ?? []) as WoundUpload[];

  const patientLabel =
    (patient?.first_name || patient?.last_name)
      ? `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim()
      : `Patient • ${row.patient_id.slice(0, 8)}…`;

  const doUpdate = async (status: string) => {
    setBusy(true);
    try {
      await onUpdate(row.id, status, note);
    } finally {
      setBusy(false);
    }
  };

  const loadLinks = async () => {
    if (uploads.length === 0) return;
    setLoadingLinks(true);
    try {
      const out: { filename: string; category: string; url: string }[] = [];
      for (const u of uploads) {
        if (!u?.bucket || !u?.path) continue;
        const url = await getSignedUrl(u.bucket, u.path);
        out.push({ filename: u.filename ?? u.path.split("/").pop() ?? "file", category: u.category ?? "file", url });
      }
      setSignedUploads(out);
    } catch {
      // ignore; will show raw filenames instead
      setSignedUploads([]);
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    setSignedUploads([]);
    setLoadingLinks(false);
    // don’t auto-fetch links on every selection; keep it user-triggered for speed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div className="h2" style={{ marginBottom: 2, color: "#241B3D" }}>
            WOUND CARE • <span style={badgeStyle(row.status)}>{row.status.toUpperCase()}</span>
          </div>
          <div className="muted" style={{ fontSize: 13, color: "#5B4E86" }}>
            Submitted: {fmt(row.created_at)} • Location: {locationName}
          </div>

          <div className="space" />

          <div className="card card-pad" style={intakeLightCardStyle}>
            <div className="h2" style={{ color: "#241B3D" }}>Patient</div>
            <div className="muted" style={{ marginTop: 6, color: "#2F2748" }}>
              <strong style={{ color: "#241B3D" }}>{patientLabel}</strong>
            </div>
            {patient?.email ? <div className="muted" style={{ color: "#3E355C" }}>Email: {patient.email}</div> : null}
            {patient?.phone ? <div className="muted" style={{ color: "#3E355C" }}>Phone: {patient.phone}</div> : null}
            <div className="muted" style={{ fontSize: 12, marginTop: 8, color: "#5B4E86" }}>
              Intake ID: {row.id}
            </div>
          </div>
        </div>

        <div style={{ width: 420, maxWidth: "100%" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6, color: "#5B4E86" }}>
            Provider notes
          </div>

          <DictationTextarea
            value={note}
            onChange={setNote}
            placeholder={lock ? "Locked after approval." : "Add notes / what you need from patient / plan..."}
            disabled={lock}
            style={{ minHeight: 110 }}
            helpText="You can type or dictate provider review notes."
            unsupportedText="Microphone dictation is not available in this browser. You can keep typing provider notes."
            surface="light"
          />

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" type="button" onClick={() => doUpdate("needs_info")} disabled={busy || lock}>
              Needs Info
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => doUpdate("rejected")} disabled={busy || lock}>
              Reject
            </button>
            <button className="btn btn-primary" type="button" onClick={() => doUpdate("approved")} disabled={busy || lock}>
              Approve
            </button>
          </div>

          <div className="space" />

          <button
            className="btn btn-primary"
            type="button"
            onClick={() => doUpdate("locked")}
            disabled={busy || lock || (row.status || "").toLowerCase() !== "approved"}
            title={(row.status || "").toLowerCase() !== "approved" ? "Approve first, then lock." : "Lock intake (final)."}
          >
            {busy ? "Saving…" : "Lock Intake"}
          </button>

          {row.reviewed_at ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 10, color: "#5B4E86" }}>
              Reviewed: {fmt(row.reviewed_at)}
            </div>
          ) : null}

          {row.locked_at ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 6, color: "#5B4E86" }}>
              Locked: {fmt(row.locked_at)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad" style={intakeLightCardStyle}>
        <div className="h2" style={{ color: "#241B3D" }}>Wound Details</div>
        <div className="space" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 240px", minWidth: 240 }}>
            <div className="muted" style={intakeLabelStyle}>Location</div>
            <div style={{ marginTop: 6, fontWeight: 700, ...intakeValueStyle }}>{wound.wound_location || "—"}</div>
          </div>

          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 240px", minWidth: 240 }}>
            <div className="muted" style={intakeLabelStyle}>Duration</div>
            <div style={{ marginTop: 6, fontWeight: 700, ...intakeValueStyle }}>{wound.wound_duration || "—"}</div>
          </div>

          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 240px", minWidth: 240 }}>
            <div className="muted" style={intakeLabelStyle}>Pain (0–10)</div>
            <div style={{ marginTop: 6, fontWeight: 700, ...intakeValueStyle }}>
              {typeof wound.pain_level === "number" ? wound.pain_level : "—"}
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 320px", minWidth: 280 }}>
            <div className="muted" style={intakeLabelStyle}>Cause</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", ...intakeValueStyle }}>{wound.wound_cause || "—"}</div>
          </div>

          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 320px", minWidth: 280 }}>
            <div className="muted" style={intakeLabelStyle}>Prior Treatments</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", ...intakeValueStyle }}>{wound.prior_treatments || "—"}</div>
          </div>

          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 320px", minWidth: 280 }}>
            <div className="muted" style={intakeLabelStyle}>Current Dressing / Care</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", ...intakeValueStyle }}>{wound.current_dressing || "—"}</div>
          </div>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 240px", minWidth: 240 }}>
            <div className="muted" style={intakeLabelStyle}>Diabetes</div>
            <div style={{ marginTop: 6, fontWeight: 700, ...intakeValueStyle }}>{wound.has_diabetes || "—"}</div>
          </div>

          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "1 1 240px", minWidth: 240 }}>
            <div className="muted" style={intakeLabelStyle}>Smoking</div>
            <div style={{ marginTop: 6, fontWeight: 700, ...intakeValueStyle }}>{wound.smokes || "—"}</div>
          </div>

          <div className="card card-pad" style={{ ...intakeLightCardStyle, flex: "2 1 420px", minWidth: 280 }}>
            <div className="muted" style={intakeLabelStyle}>Medications</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", ...intakeValueStyle }}>{row.medications || "—"}</div>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad" style={intakeLightCardStyle}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="h2" style={{ color: "#241B3D" }}>Uploads</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 12, color: "#5B4E86" }}>
              ID / insurance / wound photos (if provided)
            </div>
          </div>

          <button className="btn btn-ghost" type="button" onClick={loadLinks} disabled={loadingLinks || uploads.length === 0}>
            {loadingLinks ? "Loading…" : "Load file links"}
          </button>
        </div>

        <div className="space" />

        {uploads.length === 0 ? (
          <div className="muted" style={intakeValueStyle}>No uploads attached to this intake.</div>
        ) : signedUploads.length > 0 ? (
          <ul className="text-sm list-disc pl-5" style={{ color: "#2F2748" }}>
            {signedUploads.map((u, idx) => (
              <li key={`${u.url}-${idx}`}>
                <span className="muted" style={{ color: "#5B4E86" }}>{u.category}:</span>{" "}
                <a className="link" href={u.url} target="_blank" rel="noreferrer">
                  {u.filename}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="text-sm list-disc pl-5" style={{ color: "#2F2748" }}>
            {uploads.map((u, idx) => (
              <li key={`${u.path}-${idx}`}>
                <span className="muted" style={{ color: "#5B4E86" }}>{u.category}:</span> {u.filename || u.path}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space" />

      <div className="card card-pad" style={intakeLightCardStyle}>
        <div className="h2" style={{ color: "#241B3D" }}>Raw Intake JSON</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12, color: "#5B4E86" }}>
          Stored raw wound_data.
        </div>
        <div className="space" />
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35, color: "#2F2748" }}>
          {JSON.stringify(row.wound_data ?? {}, null, 2)}
        </pre>
      </div>
    </>
  );
}
