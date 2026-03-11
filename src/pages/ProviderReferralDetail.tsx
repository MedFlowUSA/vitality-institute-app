import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import SystemStatusBar from "../components/SystemStatusBar";

type ReferralRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string | null;

  status: string;
  urgency_score: number;

  referral_source_type: string | null;
  referral_source_name: string | null;
  referral_contact_name: string | null;
  referral_contact_phone: string | null;
  referral_contact_email: string | null;

  reason: string | null;
  notes: string | null;
  external_ref: string | null;
};

type TaskRow = {
  id: string;
  created_at: string;
  referral_id: string;
  location_id: string;
  title: string;
  category: string;
  is_required: boolean;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

type DocRow = {
  id: string;
  created_at: string;
  referral_id: string;
  location_id: string;
  doc_type: string;
  title: string;
  url: string | null;
  notes: string | null;
  added_by: string;
};

type HistoryRow = {
  id: string;
  created_at: string;
  referral_id: string;
  location_id: string;
  changed_by: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
};

const STATUS_OPTIONS = [
  "new",
  "triage",
  "needs_docs",
  "auth_submitted",
  "scheduled",
  "active",
  "closed",
  "rejected",
] as const;

const PREAUTH_TASK_TEMPLATE = [
  { title: "Copy of insurance (front/back)", category: "preauth", required: true },
  { title: "Face sheet / demographics", category: "preauth", required: true },
  { title: "Wound photos (current)", category: "clinical", required: true },
  { title: "Wound measurements + description", category: "clinical", required: true },
  { title: "Provider order / prescription for treatment", category: "preauth", required: true },
  { title: "Recent progress notes", category: "clinical", required: false },
  { title: "Prior treatments tried (failed conservative care)", category: "clinical", required: true },
  { title: "Schedule evaluation visit", category: "scheduling", required: true },
] as const;

export default function ProviderReferralDetail() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { referralId } = useParams<{ referralId: string }>();

  const [referral, setReferral] = useState<ReferralRow | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // add doc
  const [docType, setDocType] = useState("insurance");
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docNotes, setDocNotes] = useState("");

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  const load = async () => {
    if (!user?.id) return;
    if (!referralId) return;

    setErr(null);
    setLoading(true);

    try {
      const { data: r, error: rErr } = await supabase
        .from("referrals")
        .select(
          "id,created_at,location_id,patient_id,status,urgency_score,referral_source_type,referral_source_name,referral_contact_name,referral_contact_phone,referral_contact_email,reason,notes,external_ref"
        )
        .eq("id", referralId)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!r?.id) throw new Error("Referral not found.");
      setReferral(r as ReferralRow);

      const { data: t, error: tErr } = await supabase
        .from("referral_tasks")
        .select(
          "id,created_at,referral_id,location_id,title,category,is_required,status,due_at,completed_at,completed_by"
        )
        .eq("referral_id", referralId)
        .order("created_at", { ascending: true });
      if (tErr) throw tErr;
      setTasks((t as TaskRow[]) ?? []);

      const { data: d, error: dErr } = await supabase
        .from("referral_documents")
        .select("id,created_at,referral_id,location_id,doc_type,title,url,notes,added_by")
        .eq("referral_id", referralId)
        .order("created_at", { ascending: false });
      if (dErr) throw dErr;
      setDocs((d as DocRow[]) ?? []);

      const { data: h, error: hErr } = await supabase
        .from("referral_status_history")
        .select("id,created_at,referral_id,location_id,changed_by,from_status,to_status,note")
        .eq("referral_id", referralId)
        .order("created_at", { ascending: false });
      if (hErr) throw hErr;
      setHistory((h as HistoryRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load referral.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, referralId]);

  const updateReferral = async (patch: Partial<ReferralRow>, noteForHistory?: string) => {
    if (!user?.id) return;
    if (!referral?.id) return;

    setSaving(true);
    setErr(null);

    try {
      const fromStatus = referral.status;
      const toStatus = patch.status ?? fromStatus;

      const { error: updErr } = await supabase.from("referrals").update(patch).eq("id", referral.id);
      if (updErr) throw updErr;

      if (patch.status && patch.status !== fromStatus) {
        const { error: hErr } = await supabase.from("referral_status_history").insert([
          {
            referral_id: referral.id,
            location_id: referral.location_id,
            changed_by: user.id,
            from_status: fromStatus,
            to_status: toStatus,
            note: noteForHistory ?? null,
          },
        ]);
        if (hErr) throw hErr;
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const seedPreauthTasks = async () => {
    if (!user?.id) return;
    if (!referral?.id) return;

    setSaving(true);
    setErr(null);
    try {
      // avoid duplicating template if tasks already exist
      if (tasks.length > 0) {
        setErr("Tasks already exist for this referral.");
        return;
      }

      const payload = PREAUTH_TASK_TEMPLATE.map((x) => ({
        referral_id: referral.id,
        location_id: referral.location_id,
        title: x.title,
        category: x.category,
        is_required: x.required,
        status: "open",
      }));

      const { error } = await supabase.from("referral_tasks").insert(payload);
      if (error) throw error;

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create tasks.");
    } finally {
      setSaving(false);
    }
  };

  const setTaskDone = async (taskId: string, done: boolean) => {
    if (!user?.id) return;
    setErr(null);

    try {
      const patch = done
        ? { status: "done", completed_at: new Date().toISOString(), completed_by: user.id }
        : { status: "open", completed_at: null, completed_by: null };

      const { error } = await supabase.from("referral_tasks").update(patch).eq("id", taskId);
      if (error) throw error;

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update task.");
    }
  };

  const addDoc = async () => {
    if (!user?.id) return;
    if (!referral?.id) return;

    if (!docTitle.trim()) {
      setErr("Document title required.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const { error } = await supabase.from("referral_documents").insert([
        {
          referral_id: referral.id,
          location_id: referral.location_id,
          doc_type: docType,
          title: docTitle.trim(),
          url: docUrl.trim() || null,
          notes: docNotes.trim() || null,
          added_by: user.id,
        },
      ]);
      if (error) throw error;

      setDocTitle("");
      setDocUrl("");
      setDocNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add document.");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Referral"
          subtitle="Triage - Pre-auth checklist - Scheduling handoff"
          secondaryCta={{ label: "Back to Referrals", onClick: () => nav("/provider/referrals") }}
          primaryCta={{ label: "Open Tasks", onClick: () => document.getElementById("tasks")?.scrollIntoView({ behavior: "smooth" }) }}
          showKpis={false}
        />

        <SystemStatusBar />
        <div className="space" />

        {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

        {loading || !referral ? (
          <div className="card card-pad">
            <div className="muted">{loading ? "Loading..." : "Referral not found."}</div>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 520px" }}>
                  <div className="h1" style={{ marginBottom: 4 }}>
                    {referral.referral_source_name || "Referral"}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Created: {fmt(referral.created_at)} - Referral ID: {referral.id}
                  </div>

                  <div className="space" />

                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="v-chip">
                      Status: <strong>{referral.status}</strong>
                    </span>
                    <span className="v-chip">
                      Urgency: <strong>{referral.urgency_score}</strong>
                    </span>
                    <span className="v-chip">
                      Open tasks: <strong>{openTasks.length}</strong>
                    </span>
                    <span className="v-chip">
                      Docs: <strong>{docs.length}</strong>
                    </span>
                  </div>

                  {referral.reason ? (
                    <div className="muted" style={{ marginTop: 10 }}>
                      Reason: <strong>{referral.reason}</strong>
                    </div>
                  ) : null}

                  {referral.notes ? (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Notes: {referral.notes}
                    </div>
                  ) : null}
                </div>

                <div className="card card-pad" style={{ background: "rgba(0,0,0,.18)", minWidth: 320 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Update status
                  </div>

                  <select
                    className="input"
                    value={referral.status}
                    onChange={(e) => updateReferral({ status: e.target.value }, "Status updated")}
                    disabled={saving}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <div className="space" />

                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Urgency score (0-100)
                  </div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={referral.urgency_score}
                    onChange={(e) => updateReferral({ urgency_score: Number(e.target.value || 0) })}
                    disabled={saving}
                  />

                  <div className="space" />

                  <button className="btn btn-primary" type="button" onClick={seedPreauthTasks} disabled={saving}>
                    {saving ? "Working..." : "Seed Pre-Auth Checklist"}
                  </button>

                  {referral.patient_id ? (
                    <>
                      <div className="space" />
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => nav(`/provider/patients/${referral.patient_id}`)}
                      >
                        Open Patient
                      </button>
                    </>
                  ) : (
                    <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                      Patient not linked yet (OK for V1).
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space" />

            {/* TASKS */}
            <div id="tasks" className="card card-pad">
              <div className="h2">Pre-Auth / Intake Tasks</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                This is the "closed loop" hospitals want: tasks become your denial-prevention + scheduling engine.
              </div>

              <div className="space" />

              {tasks.length === 0 ? (
                <div className="muted">No tasks yet. Click "Seed Pre-Auth Checklist".</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {tasks.map((t) => (
                    <div key={t.id} className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 420px" }}>
                          <div style={{ fontWeight: 800 }}>
                            {t.title}{" "}
                            {t.is_required ? <span className="muted" style={{ fontWeight: 600 }}>(required)</span> : null}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Category: <strong>{t.category}</strong> - Status: <strong>{t.status}</strong>
                          </div>
                        </div>

                        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {t.status === "done" ? (
                            <button className="btn btn-ghost" type="button" onClick={() => setTaskDone(t.id, false)}>
                              Reopen
                            </button>
                          ) : (
                            <button className="btn btn-primary" type="button" onClick={() => setTaskDone(t.id, true)}>
                              Mark Done
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tasks.length > 0 && openTasks.length === 0 ? (
                <>
                  <div className="space" />
                  <div className="v-chip">
                    Checklist complete ? Now move status to <strong>auth_submitted</strong> or <strong>scheduled</strong>.
                  </div>
                </>
              ) : null}
            </div>

            <div className="space" />

            {/* DOCUMENTS */}
            <div className="card card-pad">
              <div className="h2">Documents (V1: link registry)</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                V2 will add direct uploads + "Generate Pre-Auth Packet" PDF from these docs.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)} style={{ flex: "0 0 180px" }}>
                  <option value="insurance">insurance</option>
                  <option value="face_sheet">face_sheet</option>
                  <option value="wound_photos">wound_photos</option>
                  <option value="md_order">md_order</option>
                  <option value="op_note">op_note</option>
                  <option value="labs">labs</option>
                  <option value="other">other</option>
                </select>

                <input
                  className="input"
                  placeholder="Title (e.g., Insurance Front/Back)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  style={{ flex: "1 1 260px" }}
                />

                <input
                  className="input"
                  placeholder="URL (optional)"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  style={{ flex: "1 1 280px" }}
                />

                <button className="btn btn-primary" type="button" onClick={addDoc} disabled={saving || !docTitle.trim()}>
                  Add Doc
                </button>
              </div>

              <div className="space" />

              <input
                className="input"
                placeholder="Notes (optional)"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
              />

              <div className="space" />

              {docs.length === 0 ? (
                <div className="muted">No documents yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {docs.map((d) => (
                    <div key={d.id} className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
                      <div style={{ fontWeight: 800 }}>
                        {d.title} <span className="muted" style={{ fontWeight: 600 }}>({d.doc_type})</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Added: {fmt(d.created_at)}
                      </div>
                      {d.url ? (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          URL:{" "}
                          <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                            Open
                          </a>
                        </div>
                      ) : null}
                      {d.notes ? <div className="muted" style={{ marginTop: 6 }}>{d.notes}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space" />

            {/* HISTORY */}
            <div className="card card-pad">
              <div className="h2">Status History</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Hospitals love this because it proves closed-loop handoffs (and helps defend denials).
              </div>

              <div className="space" />

              {history.length === 0 ? (
                <div className="muted">No history yet.</div>
              ) : (
                history.slice(0, 12).map((h) => (
                  <div key={h.id} className="card card-pad" style={{ background: "rgba(0,0,0,.18)", marginBottom: 10 }}>
                    <div style={{ fontWeight: 800 }}>
                      {h.from_status ? `${h.from_status} -> ` : ""}{h.to_status}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {fmt(h.created_at)}
                    </div>
                    {h.note ? <div className="muted" style={{ marginTop: 6 }}>{h.note}</div> : null}
                  </div>
                ))
              )}
            </div>

            <div className="space" />
          </>
        )}
      </div>
    </div>
  );
}


