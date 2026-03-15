import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

type Props = {
  visitId: string;
  patientId: string;
  locationId: string;
};

type PlanRow = {
  id: string;
  visit_id: string;
  patient_id: string;
  location_id: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
  internal_notes: string | null;
  plan: any;
  signed_by: string | null;
  signed_at: string | null;
  is_locked: boolean | null;
  created_at: string;
  updated_at: string;
};

type LatestWoundAssessmentRow = {
  id: string;
  wound_label: string;
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
  stage: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  exudate: string | null;
  odor: string | null;
  infection_signs: string | null;
  pain_score: number | null;
  notes: string | null;
};

const TREATMENT_PLAN_SELECT_FIELDS =
  "id,visit_id,patient_id,location_id,status,summary,patient_instructions,internal_notes,plan,signed_by,signed_at,is_locked,created_at,updated_at";

function pretty(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "{}";
  }
}

export default function TreatmentPlanSection({ visitId, patientId, locationId }: Props) {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [row, setRow] = useState<PlanRow | null>(null);

  const [status, setStatus] = useState("draft");
  const [summary, setSummary] = useState("");
  const [patientInstructions, setPatientInstructions] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [dressingPlan, setDressingPlan] = useState("");
  const [frequency, setFrequency] = useState("");
  const [offloading, setOffloading] = useState("");
  const [followUpDays, setFollowUpDays] = useState("");
  const [orders, setOrders] = useState("");
  const [medications, setMedications] = useState("");
  const [latestWoundAssessment, setLatestWoundAssessment] = useState<LatestWoundAssessmentRow | null>(null);
  const [loadingWoundAssessment, setLoadingWoundAssessment] = useState(false);

  const canEdit = useMemo(() => !!user?.id && !!role && role !== "patient", [user?.id, role]);
  const isLocked = !!row?.is_locked;

  const buildPlanJson = () => ({
    dressing_plan: dressingPlan || null,
    frequency: frequency || null,
    offloading: offloading || null,
    follow_up_days: followUpDays ? Number(followUpDays) : null,
    orders: orders || null,
    medications: medications || null,
  });

  const hydrateFromRow = (r: PlanRow) => {
    const p = r.plan ?? {};
    setStatus(r.status ?? "draft");
    setSummary(r.summary ?? "");
    setPatientInstructions(r.patient_instructions ?? "");
    setInternalNotes(r.internal_notes ?? "");
    setDressingPlan(p.dressing_plan ?? "");
    setFrequency(p.frequency ?? "");
    setOffloading(p.offloading ?? "");
    setFollowUpDays(p.follow_up_days ? String(p.follow_up_days) : "");
    setOrders(p.orders ?? "");
    setMedications(p.medications ?? "");
  };

  const resetDraft = () => {
    setStatus("draft");
    setSummary("");
    setPatientInstructions("");
    setInternalNotes("");
    setDressingPlan("");
    setFrequency("");
    setOffloading("");
    setFollowUpDays("");
    setOrders("");
    setMedications("");
  };

  const loadPlan = async () => {
    setErr(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("patient_treatment_plans")
        .select(TREATMENT_PLAN_SELECT_FIELDS)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const found = (data as PlanRow | null) ?? null;
      setRow(found);

      if (found) {
        hydrateFromRow(found);
      } else {
        resetDraft();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load treatment plan.");
    } finally {
      setLoading(false);
    }
  };

  const loadLatestWoundAssessment = async () => {
    if (!visitId) {
      setLatestWoundAssessment(null);
      setLoadingWoundAssessment(false);
      return;
    }

    setLoadingWoundAssessment(true);

    try {
      const { data, error } = await supabase
        .from("wound_assessments")
        .select(
          "id,wound_label,body_site,laterality,wound_type,stage,length_cm,width_cm,depth_cm,exudate,odor,infection_signs,pain_score,notes"
        )
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setLatestWoundAssessment((data as LatestWoundAssessmentRow | null) ?? null);
    } catch (e) {
      console.error("Failed to load latest wound assessment", e);
      setLatestWoundAssessment(null);
    } finally {
      setLoadingWoundAssessment(false);
    }
  };

  const applyQuickTemplate = (template: "standard_wound" | "post_procedure" | "maintenance") => {
    if (!canEdit || isLocked) return;

    setStatus("active");

    if (template === "standard_wound") {
      setSummary("Ongoing wound management with dressing care, pressure protection, and routine follow-up.");
      setDressingPlan("Cleanse wound and apply appropriate dressing based on wound bed condition, drainage, and provider judgment.");
      setFrequency("Change dressing as directed based on wound condition.");
      setOffloading("Protect affected area from pressure, friction, and trauma.");
      setFollowUpDays("7");
      setOrders("Continue wound assessment, document measurements, and monitor for drainage, pain, and infection concerns.");
      setMedications("Topical therapies and supportive wound products per provider evaluation.");
      setPatientInstructions("Keep the wound clean and protected. Follow dressing change instructions exactly and report worsening pain, drainage, redness, odor, fever, or other concerning symptoms.");
      setInternalNotes("Standard wound treatment template applied.");
      return;
    }

    if (template === "post_procedure") {
      setSummary("Post-procedure wound care with dressing support and short-interval reassessment.");
      setDressingPlan("Cleanse procedural site gently and apply dressing that maintains protection and moisture balance.");
      setFrequency("Change dressing daily or as directed based on drainage and procedural site status.");
      setOffloading("Protect the treatment area from trauma, pressure, and excess moisture.");
      setFollowUpDays("3");
      setOrders("Monitor procedural site healing, drainage, pain, and signs of infection. Reinforce post-procedure precautions.");
      setMedications("Topical or supportive therapies per provider evaluation and procedural plan.");
      setPatientInstructions("Keep the area clean, dry, and protected. Follow dressing instructions and contact the clinic for bleeding, fever, increased pain, redness, drainage, or other worsening symptoms.");
      setInternalNotes("Post-procedure treatment template applied.");
      return;
    }

    setSummary("Maintenance wound plan focused on continued protection and surveillance.");
    setDressingPlan("Continue maintenance dressing regimen and adjust only if wound status changes.");
    setFrequency("Change dressing per established maintenance schedule.");
    setOffloading("Continue pressure relief and skin protection measures.");
    setFollowUpDays("14");
    setOrders("Maintain surveillance for drainage, pain, skin breakdown, and delayed healing.");
    setMedications("Continue supportive wound products as clinically indicated.");
    setPatientInstructions("Continue the current wound care routine and notify the clinic if symptoms worsen or the wound changes.");
    setInternalNotes("Maintenance treatment template applied.");
  };

  const generateFromWoundAssessment = () => {
    if (!latestWoundAssessment || !canEdit || isLocked) return;

    const area =
      latestWoundAssessment.length_cm != null && latestWoundAssessment.width_cm != null
        ? Number((latestWoundAssessment.length_cm * latestWoundAssessment.width_cm).toFixed(2))
        : null;

    const woundLabel = latestWoundAssessment.wound_label || "wound";
    const site = [latestWoundAssessment.laterality, latestWoundAssessment.body_site]
      .filter(Boolean)
      .join(" ");
    const woundType = latestWoundAssessment.wound_type || "wound";
    const exudate = latestWoundAssessment.exudate || "unspecified exudate";
    const infection = latestWoundAssessment.infection_signs?.trim();
    const pain =
      latestWoundAssessment.pain_score != null
        ? `${latestWoundAssessment.pain_score}/10`
        : "not documented";

    setStatus("active");
    setSummary(
      `Ongoing management for ${woundLabel}${site ? ` at ${site}` : ""}${area != null ? ` measuring approximately ${area} cm2` : ""}.`
    );
    setDressingPlan(
      `Cleanse ${woundLabel.toLowerCase()} and apply appropriate dressing based on tissue condition, drainage level, and provider judgment.`
    );
    setFrequency(
      latestWoundAssessment.exudate === "high"
        ? "Daily dressing changes or as clinically indicated"
        : latestWoundAssessment.exudate === "moderate"
          ? "Change dressing every 1-2 days or as directed"
          : "Change dressing as directed based on wound condition"
    );
    setOffloading(
      site
        ? `Protect and offload pressure from ${site}. Avoid friction, trauma, and prolonged pressure to the affected area.`
        : "Protect affected area from pressure, friction, and trauma."
    );
    setFollowUpDays(infection ? "3" : "7");
    setOrders(
      [
        `Continue wound assessment and monitoring for ${woundType}.`,
        exudate ? `Monitor exudate level: ${exudate}.` : null,
        infection ? `Monitor for infection concerns: ${infection}.` : null,
        latestWoundAssessment.odor ? `Monitor odor changes: ${latestWoundAssessment.odor}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
    setMedications(
      infection
        ? "Consider antimicrobial or topical therapy per provider evaluation and wound status."
        : "Topical therapies and supportive wound products per provider evaluation."
    );
    setPatientInstructions(
      [
        "Keep the wound area clean and protected.",
        "Follow all dressing change instructions exactly as directed.",
        `Pain level noted: ${pain}.`,
        infection
          ? "Contact the clinic promptly for worsening redness, drainage, odor, fever, increased pain, or other signs of infection."
          : "Report increased pain, drainage, redness, odor, fever, or any worsening symptoms.",
      ].join(" ")
    );
    setInternalNotes(
      [
        "Generated from latest wound assessment.",
        latestWoundAssessment.notes?.trim() ? `Assessment note: ${latestWoundAssessment.notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
  };

  useEffect(() => {
    loadPlan();
    loadLatestWoundAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const savePlan = async () => {
    if (!canEdit) return;
    setErr(null);
    setSaving(true);

    try {
      const payload = {
        visit_id: visitId,
        patient_id: patientId,
        location_id: locationId,
        status,
        summary: summary.trim() || null,
        patient_instructions: patientInstructions.trim() || null,
        internal_notes: internalNotes.trim() || null,
        plan: buildPlanJson(),
      };

      if (row?.id) {
        const { error } = await supabase
          .from("patient_treatment_plans")
          .update(payload)
          .eq("id", row.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_treatment_plans")
          .insert([payload]);

        if (error) throw error;
      }

      await loadPlan();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save treatment plan.");
    } finally {
      setSaving(false);
    }
  };

  const signPlan = async () => {
    if (!row?.id || !user?.id || !canEdit) return;
    setErr(null);
    setSigning(true);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("patient_treatment_plans")
        .update({
          is_locked: true,
          signed_by: user.id,
          signed_at: now,
          status: "signed",
        })
        .eq("id", row.id);

      if (error) throw error;
      await loadPlan();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to sign treatment plan.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="card card-pad">
        <div className="h2">Treatment Plan</div>
        <div className="space" />
        <div className="muted">Loading treatment plan...</div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Treatment Plan</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Structured wound plan + patient instructions
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="v-chip">
            Status: <strong>{row?.status ?? status}</strong>
          </span>
          <span className="v-chip">
            Locked: <strong>{isLocked ? "Yes" : "No"}</strong>
          </span>
        </div>
      </div>

      {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}

      <div className="space" />

      <div className="card card-pad" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="h2" style={{ fontSize: 16 }}>Quick Templates</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          Start from a preset or draft directly from the latest wound assessment for this visit.
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!canEdit || isLocked}
            onClick={() => applyQuickTemplate("standard_wound")}
          >
            Standard Wound
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!canEdit || isLocked}
            onClick={() => applyQuickTemplate("post_procedure")}
          >
            Post-Procedure
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!canEdit || isLocked}
            onClick={() => applyQuickTemplate("maintenance")}
          >
            Maintenance
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!canEdit || isLocked || loadingWoundAssessment || !latestWoundAssessment}
            onClick={generateFromWoundAssessment}
          >
            {loadingWoundAssessment ? "Loading Wound..." : "Generate From Wound"}
          </button>
        </div>

        {latestWoundAssessment ? (
          <>
            <div className="space" />
            <div className="card card-pad" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="muted" style={{ marginBottom: 8 }}>Latest Wound Assessment</div>
              <div style={{ fontWeight: 800 }}>{latestWoundAssessment.wound_label}</div>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                {[latestWoundAssessment.laterality, latestWoundAssessment.body_site, latestWoundAssessment.wound_type]
                  .filter(Boolean)
                  .join(" | ")}
              </div>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Size: {latestWoundAssessment.length_cm ?? "-"} x {latestWoundAssessment.width_cm ?? "-"} x {latestWoundAssessment.depth_cm ?? "-"} cm
              </div>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Exudate: {latestWoundAssessment.exudate ?? "-"} | Infection Signs: {latestWoundAssessment.infection_signs ?? "-"} | Pain: {latestWoundAssessment.pain_score ?? "-"}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <select
          className="input"
          style={{ flex: "1 1 220px" }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={!canEdit || isLocked}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="hold">hold</option>
          <option value="completed">completed</option>
        </select>

        <input
          className="input"
          style={{ flex: "2 1 420px" }}
          placeholder="Plan summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={!canEdit || isLocked}
        />
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: "1 1 240px" }}
          placeholder="Dressing plan"
          value={dressingPlan}
          onChange={(e) => setDressingPlan(e.target.value)}
          disabled={!canEdit || isLocked}
        />

        <input
          className="input"
          style={{ flex: "1 1 220px" }}
          placeholder="Frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={!canEdit || isLocked}
        />

        <input
          className="input"
          style={{ flex: "1 1 220px" }}
          placeholder="Offloading / precautions"
          value={offloading}
          onChange={(e) => setOffloading(e.target.value)}
          disabled={!canEdit || isLocked}
        />

        <input
          className="input"
          style={{ flex: "0 0 140px" }}
          placeholder="Follow-up days"
          value={followUpDays}
          onChange={(e) => setFollowUpDays(e.target.value)}
          disabled={!canEdit || isLocked}
        />
      </div>

      <div className="space" />

      <textarea
        className="input"
        style={{ width: "100%", minHeight: 90 }}
        placeholder="Orders / procedures"
        value={orders}
        onChange={(e) => setOrders(e.target.value)}
        disabled={!canEdit || isLocked}
      />

      <div className="space" />

      <textarea
        className="input"
        style={{ width: "100%", minHeight: 90 }}
        placeholder="Medications / topical therapies"
        value={medications}
        onChange={(e) => setMedications(e.target.value)}
        disabled={!canEdit || isLocked}
      />

      <div className="space" />

      <textarea
        className="input"
        style={{ width: "100%", minHeight: 110 }}
        placeholder="Patient instructions"
        value={patientInstructions}
        onChange={(e) => setPatientInstructions(e.target.value)}
        disabled={!canEdit || isLocked}
      />

      <div className="space" />

      <textarea
        className="input"
        style={{ width: "100%", minHeight: 90 }}
        placeholder="Internal notes"
        value={internalNotes}
        onChange={(e) => setInternalNotes(e.target.value)}
        disabled={!canEdit || isLocked}
      />

      <div className="space" />

      <details>
        <summary className="muted" style={{ cursor: "pointer" }}>
          Structured plan preview
        </summary>
        <pre
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            background: "rgba(0,0,0,0.20)",
            overflowX: "auto",
            fontSize: 12,
          }}
        >
          {pretty(buildPlanJson())}
        </pre>
      </details>

      <div className="space" />

      <div className="row" style={{ justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" type="button" onClick={() => { void loadPlan(); void loadLatestWoundAssessment(); }}>
          Refresh
        </button>

        {!isLocked ? (
          <>
            <button className="btn btn-ghost" type="button" onClick={savePlan} disabled={!canEdit || saving}>
              {saving ? "Saving..." : row?.id ? "Save Plan" : "Create Plan"}
            </button>

            <button
              className="btn btn-primary"
              type="button"
              onClick={signPlan}
              disabled={!row?.id || !canEdit || signing}
            >
              {signing ? "Signing..." : "Sign Plan"}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" type="button" disabled>
            Signed (Locked)
          </button>
        )}
      </div>

      {row?.signed_at ? (
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Signed: {new Date(row.signed_at).toLocaleString()}
          {row.signed_by ? ` | Signed By: ${row.signed_by}` : ""}
        </div>
      ) : null}
    </div>
  );
}
