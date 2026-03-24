// src/components/SoapNotePanel.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type SoapRow = {
  id: string;
  visit_id: string;
  patient_id: string;
  location_id: string;
  provider_profile_id: string | null;
  created_by: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_signed: boolean | null;
  is_locked: boolean | null;
  locked_at: string | null;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  updated_at: string;

  amended_from_id: string | null;
  amendment_reason: string | null;
  amendment_at: string | null;
  amendment_by: string | null;
};

type Props = {
  visitId: string;
  patientId: string;
  locationId: string;
};

type Template = {
  id: string;
  label: string;
  apply: (current: Pick<SoapRow, "subjective" | "objective" | "assessment" | "plan">) => Partial<SoapRow>;
};

function safeJoin(parts: Array<string | null | undefined>, sep = "\n") {
  const cleaned = parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  return cleaned.join(sep);
}

function appendBlock(existing: string | null, block: string) {
  const a = (existing ?? "").trim();
  const b = block.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n\n${b}`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const SOAP_SELECT_FIELDS =
  "id,visit_id,patient_id,location_id,provider_profile_id,created_by,subjective,objective,assessment,plan,is_signed,is_locked,locked_at,signed_at,signed_by,created_at,updated_at,amended_from_id,amendment_reason,amendment_at,amendment_by";

export default function SoapNotePanel({ visitId, patientId, locationId }: Props) {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [amending, setAmending] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<SoapRow | null>(null);

  const [showAmend, setShowAmend] = useState(false);
  const [amendReason, setAmendReason] = useState("");

  const canEdit = useMemo(() => {
    if (!user?.id) return false;
    if (!role) return false;
    return role !== "patient";
  }, [role, user?.id]);

  const isSigned = !!row?.is_signed || !!row?.signed_at;
  const statusLabel = row ? (isSigned ? "signed" : "draft") : "draft";

  const templates: Template[] = useMemo(
    () => [
      {
        id: "wound_baseline",
        label: "Wound Care Baseline",
        apply: (cur) => ({
          subjective: appendBlock(
            cur.subjective ?? "",
            safeJoin([
              "Patient presents for wound care follow-up.",
              "Reports drainage/pain changes since last visit (if any).",
              "Denies fever/chills (unless otherwise noted).",
            ])
          ),
          objective: appendBlock(
            cur.objective ?? "",
            safeJoin([
              "Focused wound exam performed.",
              "Wound characteristics documented: size, depth, drainage, odor, peri-wound condition.",
              "No acute distress noted (unless otherwise noted).",
            ])
          ),
          assessment: appendBlock(cur.assessment ?? "", "Chronic wound requiring ongoing management."),
          plan: appendBlock(
            cur.plan ?? "",
            safeJoin([
              "Cleanse wound and apply appropriate dressing.",
              "Reinforce offloading/elevation as indicated.",
              "Return to clinic for re-evaluation.",
            ])
          ),
        }),
      },
      {
        id: "debridement",
        label: "Debridement",
        apply: (cur) => ({
          objective: appendBlock(
            cur.objective ?? "",
            safeJoin([
              "Debridement performed as clinically indicated.",
              "Tissue removed: devitalized/non-viable tissue.",
              "Hemostasis achieved; patient tolerated procedure.",
            ])
          ),
          assessment: appendBlock(cur.assessment ?? "", "Non-viable tissue burden addressed with debridement."),
          plan: appendBlock(
            cur.plan ?? "",
            safeJoin([
              "Post-debridement dressing applied per protocol.",
              "Monitor for signs of infection; wound care instructions provided.",
            ])
          ),
        }),
      },
      {
        id: "graft_applied",
        label: "Graft Applied",
        apply: (cur) => ({
          objective: appendBlock(
            cur.objective ?? "",
            safeJoin([
              "Wound bed prepared and graft applied per manufacturer protocol.",
              "Graft secured and covered with secondary dressing.",
              "Patient tolerated application without complication.",
            ])
          ),
          assessment: appendBlock(cur.assessment ?? "", "Advanced wound care graft applied to promote healing."),
          plan: appendBlock(
            cur.plan ?? "",
            safeJoin(["Keep dressing intact; avoid disturbing graft site.", "Follow-up visit scheduled for reassessment."])
          ),
        }),
      },
      {
        id: "infection_watch",
        label: "Infection Watch",
        apply: (cur) => ({
          assessment: appendBlock(cur.assessment ?? "", "Monitor for infection given wound risk factors."),
          plan: appendBlock(
            cur.plan ?? "",
            safeJoin([
              "Educated patient on red flags: increased pain, redness, warmth, purulent drainage, fever.",
              "Escalate care if symptoms worsen.",
            ])
          ),
        }),
      },
      {
        id: "offloading",
        label: "Offloading",
        apply: (cur) => ({
          plan: appendBlock(
            cur.plan ?? "",
            safeJoin([
              "Offloading emphasized (footwear/boot/assist device as indicated).",
              "Limit pressure on affected area; elevation instructions provided.",
            ])
          ),
        }),
      },
      {
        id: "clear_fields",
        label: "Clear Fields",
        apply: () => ({
          subjective: "",
          objective: "",
          assessment: "",
          plan: "",
        }),
      },
    ],
    []
  );

  const loadNote = async () => {
    if (!visitId) return;
    if (!patientId || !locationId || !user?.id) return;

    setErr(null);
    setLoading(true);

    // check if SOAP exists
    const { data: existing, error } = await supabase
      .from("patient_soap_notes")
      .select(SOAP_SELECT_FIELDS)
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setErr(error.message ?? "Failed to load SOAP note.");
      setLoading(false);
      return;
    }

    // if exists -> load it
    if (existing) {
      setRow(existing as SoapRow);
      setLoading(false);
      return;
    }

    // if not -> create draft automatically
    const { data: newNote, error: createErr } = await supabase
      .from("patient_soap_notes")
      .insert({
        visit_id: visitId,
        patient_id: patientId,
        location_id: locationId,
        provider_profile_id: user.id,
        created_by: user.id,
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        is_signed: false,
        is_locked: false,
        locked_at: null,
        signed_at: null,
        signed_by: null,
      })
      .select(SOAP_SELECT_FIELDS)
      .single();

    if (createErr) {
      console.error(createErr);
      setErr(createErr.message ?? "Failed to create SOAP draft.");
      setRow(null);
    } else {
      setRow(newNote as SoapRow);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const updateField = (key: keyof Pick<SoapRow, "subjective" | "objective" | "assessment" | "plan">, val: string) => {
    setRow((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: val } as SoapRow;
    });
  };

  const applyTemplate = (tpl: Template) => {
    if (!row) return;
    if (!canEdit || isSigned) return;

    const next = tpl.apply({
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan,
    });

    setRow((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subjective: next.subjective ?? prev.subjective,
        objective: next.objective ?? prev.objective,
        assessment: next.assessment ?? prev.assessment,
        plan: next.plan ?? prev.plan,
      };
    });
  };

  const saveDraft = async () => {
    if (!row?.id) return;
    if (!canEdit) return;
    if (isSigned) return;

    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from("patient_soap_notes")
        .update({
          subjective: row.subjective ?? null,
          objective: row.objective ?? null,
          assessment: row.assessment ?? null,
          plan: row.plan ?? null,
          is_signed: false,
          is_locked: false,
          locked_at: null,
        })
        .eq("id", row.id);

      if (error) throw error;
      await loadNote();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save SOAP note.");
    } finally {
      setSaving(false);
    }
  };

  const signNote = async () => {
    if (!row?.id) return;
    if (!user?.id) return;
    if (!canEdit) return;
    if (isSigned) return;

    setSigning(true);
    setErr(null);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("patient_soap_notes")
        .update({
          is_signed: true,
          is_locked: true,
          locked_at: now,
          signed_at: now,
          signed_by: user.id,
        })
        .eq("id", row.id);

      if (error) throw error;
      await loadNote();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to sign SOAP note.");
    } finally {
      setSigning(false);
    }
  };

  const createAmendmentDraft = async () => {
    if (!row) return;
    if (!user?.id) return;
    if (!canEdit) return;
    if (!row.signed_at) return;

    const reason = amendReason.trim();
    if (!reason) {
      setErr("Amendment reason is required.");
      return;
    }

    setAmending(true);
    setErr(null);

    try {
      const { data: created, error } = await supabase
        .from("patient_soap_notes")
        .insert([
          {
            visit_id: row.visit_id,
            patient_id: row.patient_id,
            location_id: row.location_id,
            provider_profile_id: user.id,
            created_by: user.id,
            is_signed: false,
            is_locked: false,
            locked_at: null,
            subjective: row.subjective ?? null,
            objective: row.objective ?? null,
            assessment: row.assessment ?? null,
            plan: row.plan ?? null,
            amended_from_id: row.id,
            amendment_reason: reason,
            amendment_at: new Date().toISOString(),
            amendment_by: user.id,
          },
        ])
        .select(SOAP_SELECT_FIELDS)
        .single();

      if (error) throw error;

      setShowAmend(false);
      setAmendReason("");
      setRow(created as SoapRow);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create amendment draft.");
    } finally {
      setAmending(false);
    }
  };

  const exportPrintPdf = async () => {
    if (!row) return;

    setPrinting(true);
    setErr(null);
    try {
      const title = "Vitality Institute â€” SOAP Note";
      const createdAt = row.created_at ? new Date(row.created_at).toLocaleString() : "â€”";
      const updatedAt = row.updated_at ? new Date(row.updated_at).toLocaleString() : "â€”";
      const signedAt = row.signed_at ? new Date(row.signed_at).toLocaleString() : "â€”";

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0b1020; }
    h1 { margin: 0 0 6px; font-size: 18px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
    .box { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .label { font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #222; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0; line-height: 1.45; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; }
    .pill { display: inline-block; border: 1px solid #ddd; padding: 6px 10px; border-radius: 999px; font-size: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div class="row">
      <span class="pill">Visit ID: ${escapeHtml(visitId)}</span>
      <span class="pill">Patient ID: ${escapeHtml(patientId)}</span>
      <span class="pill">Location ID: ${escapeHtml(locationId)}</span>
      <span class="pill">Status: ${escapeHtml(statusLabel)}</span>
    </div>
    <div style="margin-top:10px">
      Created: ${escapeHtml(createdAt)} â€¢ Updated: ${escapeHtml(updatedAt)}<br/>
      Signed: ${escapeHtml(signedAt)} â€¢ Signed By: ${escapeHtml(row.signed_by ?? "â€”")}
    </div>
    ${
      row.amended_from_id
        ? `<div style="margin-top:10px"><strong>Amendment:</strong> from ${escapeHtml(
            row.amended_from_id
          )}<br/>Reason: ${escapeHtml(row.amendment_reason ?? "")}</div>`
        : ""
    }
  </div>

  <div class="box">
    <div class="label">Subjective</div>
    <pre>${escapeHtml(row.subjective ?? "")}</pre>
  </div>

  <div class="box">
    <div class="label">Objective</div>
    <pre>${escapeHtml(row.objective ?? "")}</pre>
  </div>

  <div class="box">
    <div class="label">Assessment</div>
    <pre>${escapeHtml(row.assessment ?? "")}</pre>
  </div>

  <div class="box">
    <div class="label">Plan</div>
    <pre>${escapeHtml(row.plan ?? "")}</pre>
  </div>

  <script>
    window.onload = () => { window.focus(); window.print(); };
  </script>
</body>
</html>`;

      const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=900");
      if (!w) throw new Error("Popup blocked. Allow popups to export PDF/print.");
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to export print/PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const pill = (label: string, value: string) => (
    <span
      className="muted"
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.18)",
        background: "rgba(255,255,255,.06)",
        whiteSpace: "nowrap",
      }}
    >
      {label}: <strong style={{ color: "rgba(255,255,255,.95)" }}>{value}</strong>
    </span>
  );

  const auditLine = () => {
    if (!row) return null;
    const signedAt = row.signed_at ? new Date(row.signed_at).toLocaleString() : null;

    return (
      <div
        className="muted"
        style={{
          fontSize: 12,
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.16)",
        }}
      >
        <div>
          <strong style={{ color: "rgba(255,255,255,.92)" }}>Audit</strong>
        </div>
        <div style={{ marginTop: 6 }}>
          Status: <strong style={{ color: "rgba(255,255,255,.92)" }}>{statusLabel}</strong>
          {" â€¢ "}
          Created: {new Date(row.created_at).toLocaleString()}
          {" â€¢ "}
          Updated: {new Date(row.updated_at).toLocaleString()}
        </div>
        <div style={{ marginTop: 4 }}>
          Signed: <strong style={{ color: "rgba(255,255,255,.92)" }}>{signedAt ?? "No"}</strong>
          {signedAt ? (
            <>
              {" â€¢ "}Signed By:{" "}
              <strong style={{ color: "rgba(255,255,255,.92)" }}>{row.signed_by ?? "â€”"}</strong>
            </>
          ) : null}
        </div>

        {row.amended_from_id ? (
          <div style={{ marginTop: 8 }}>
            <strong style={{ color: "rgba(255,255,255,.92)" }}>Amendment</strong>
            <div style={{ marginTop: 4 }}>
              From: <strong style={{ color: "rgba(255,255,255,.92)" }}>{row.amended_from_id}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              Reason: <strong style={{ color: "rgba(255,255,255,.92)" }}>{row.amendment_reason ?? "â€”"}</strong>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card card-pad">
        <div className="h2">SOAP Note</div>
        <div className="space" />
        <div className="muted">Loading SOAP noteâ€¦</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="card card-pad">
        <div className="h2">SOAP Note</div>
        <div className="space" />
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>
        <div className="space" />
        <button className="btn btn-ghost" type="button" onClick={loadNote}>
          Retry
        </button>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="card card-pad">
        <div className="h2">SOAP Note</div>
        <div className="space" />
        <div className="muted">No SOAP record.</div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="h2">SOAP Note</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Visit ID: {visitId}
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {pill("Status", statusLabel)}
          {pill("Signed", row.signed_at ? "Yes" : "No")}
          {row.amended_from_id ? pill("Type", "Amendment") : pill("Type", "Original")}
        </div>
      </div>

      {auditLine()}

      <div className="hr-soft" />

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="muted" style={{ fontSize: 12, marginRight: 6 }}>
          Quick Templates:
        </div>

        {templates.map((t) => (
          <button
            key={t.id}
            className="btn btn-ghost"
            type="button"
            disabled={!canEdit || isSigned}
            onClick={() => applyTemplate(t)}
            title={isSigned ? "Signed notes are locked." : !canEdit ? "Not authorized." : "Apply template"}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,.18)",
              borderColor: "rgba(255,255,255,.18)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Subjective
          </div>
          <textarea
            className="input"
            rows={4}
            value={row.subjective ?? ""}
            onChange={(e) => updateField("subjective", e.target.value)}
            disabled={!canEdit || isSigned}
            placeholder="Patient complaints, HPI, symptomsâ€¦"
          />
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Objective
          </div>
          <textarea
            className="input"
            rows={4}
            value={row.objective ?? ""}
            onChange={(e) => updateField("objective", e.target.value)}
            disabled={!canEdit || isSigned}
            placeholder="Vitals, exam findings, wound measurementsâ€¦"
          />
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Assessment
          </div>
          <textarea
            className="input"
            rows={3}
            value={row.assessment ?? ""}
            onChange={(e) => updateField("assessment", e.target.value)}
            disabled={!canEdit || isSigned}
            placeholder="Dx, clinical impression, problem listâ€¦"
          />
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Plan
          </div>
          <textarea
            className="input"
            rows={4}
            value={row.plan ?? ""}
            onChange={(e) => updateField("plan", e.target.value)}
            disabled={!canEdit || isSigned}
            placeholder="Orders, procedures, follow-up, educationâ€¦"
          />
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" type="button" onClick={loadNote}>
          Refresh
        </button>

        <button
          className="btn btn-ghost"
          type="button"
          onClick={exportPrintPdf}
          disabled={printing}
          title="Opens print dialog. Choose Save as PDF."
        >
          {printing ? "Preparingâ€¦" : "Print / PDF"}
        </button>

        {!isSigned ? (
          <>
            <button className="btn btn-ghost" type="button" onClick={saveDraft} disabled={!canEdit || saving}>
              {saving ? "Savingâ€¦" : "Save Draft"}
            </button>

            <button className="btn btn-primary" type="button" onClick={signNote} disabled={!canEdit || signing}>
              {signing ? "Signingâ€¦" : "Sign Note"}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!canEdit}
              onClick={() => {
                setErr(null);
                setAmendReason("");
                setShowAmend(true);
              }}
              title={!canEdit ? "Not authorized." : "Create an amendment draft linked to this signed note."}
            >
              Amend Note
            </button>

            <button className="btn btn-primary" type="button" disabled>
              Signed (Locked)
            </button>
          </>
        )}
      </div>

      {showAmend ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => {
            if (!amending) setShowAmend(false);
          }}
        >
          <div className="card card-pad" style={{ width: "min(720px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="h2">Create Amendment Draft</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              This will create a new draft SOAP note copied from the signed note, linked by amended_from_id.
            </div>

            <div className="space" />

            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Amendment Reason (required)
            </div>
            <textarea
              className="input"
              rows={4}
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              placeholder="Example: Corrected objective wound measurement. Added missing plan detail."
              disabled={amending}
            />

            <div className="space" />

            <div className="row" style={{ justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" disabled={amending} onClick={() => setShowAmend(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={amending} onClick={createAmendmentDraft}>
                {amending ? "Creatingâ€¦" : "Create Amendment Draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSigned ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Signed notes are locked. Use Amend Note to create a linked revision draft.
        </div>
      ) : null}
    </div>
  );
}
