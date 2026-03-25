// src/pages/ProviderAI.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import DictationTextarea from "../components/DictationTextarea";
import { supabase } from "../lib/supabase";
import logo from "../assets/vitality-logo.png";

type LocationRow = { id: string; name: string };

type IntakeRow = {
  id: string;
  location_id: string;
  patient_id: string;
  status: string;
  answers: any;
};

type LabRow = {
  id: string;
  location_id: string;
  patient_id: string;
  panel_id: string;
  values: any;
  status: string;
};

type PanelRow = { id: string; name: string };

type AnalysisRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  intake_submission_id: string | null;
  lab_result_id: string | null;
  status: "draft" | "final";
  summary: string | null;
  risks: string[] | null;
  recommended_next_steps: string[] | null;
  created_by: string | null;
};

function safeList(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map((v) => String(v)).filter(Boolean);
  return String(x).split("\n").map((s) => s.trim()).filter(Boolean);
}

export default function ProviderAI() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const intakeId = params.get("intakeId") ?? "";
  const labId = params.get("labId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [panels, setPanels] = useState<PanelRow[]>([]);

  const [intake, setIntake] = useState<IntakeRow | null>(null);
  const [lab, setLab] = useState<LabRow | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);

  const [summary, setSummary] = useState("");
  const [risksText, setRisksText] = useState("");
  const [nextStepsText, setNextStepsText] = useState("");

  const [status, setStatus] = useState<"draft" | "final">("draft");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const loadBase = async () => {
    const { data: locs, error: locErr } = await supabase.from("locations").select("id,name").order("name");
    if (locErr) throw new Error(locErr.message);
    setLocations((locs as LocationRow[]) ?? []);

    const { data: p, error: pErr } = await supabase
      .from("lab_panels")
      .select("id,name")
      .eq("is_active", true)
      .order("name");
    if (pErr) throw new Error(pErr.message);
    setPanels((p as PanelRow[]) ?? []);
  };

  const loadIntake = async () => {
    if (!intakeId) return setIntake(null);
    const { data, error } = await supabase
      .from("intake_submissions")
      .select("id,location_id,patient_id,status,answers")
      .eq("id", intakeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    setIntake((data as any) ?? null);
  };

  const loadLab = async () => {
    if (!labId) return setLab(null);
    const { data, error } = await supabase
      .from("lab_results")
      .select("id,location_id,patient_id,panel_id,values,status")
      .eq("id", labId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    setLab((data as any) ?? null);
  };

  const loadExistingAnalysis = async () => {
    setAnalysis(null);

    // Try to load latest analysis matching intake/lab
    let q = supabase
      .from("ai_analyses")
      .select("id,created_at,location_id,patient_id,intake_submission_id,lab_result_id,status,summary,risks,recommended_next_steps,created_by")
      .order("created_at", { ascending: false })
      .limit(1);

    if (intakeId) q = q.eq("intake_submission_id", intakeId);
    if (labId) q = q.eq("lab_result_id", labId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const row = (data as AnalysisRow[] | null)?.[0] ?? null;
    setAnalysis(row);

    if (row) {
      setSummary(row.summary ?? "");
      setRisksText((row.risks ?? []).join("\n"));
      setNextStepsText((row.recommended_next_steps ?? []).join("\n"));
      setStatus(row.status);
    } else {
      setSummary("");
      setRisksText("");
      setNextStepsText("");
      setStatus("draft");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadBase();
        await loadIntake();
        await loadLab();
        await loadExistingAnalysis();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load AI module.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, intakeId, labId]);

  const buildDraft = () => {
    const answers = intake?.answers ?? {};
    const labValues = lab?.values ?? {};

    const name = answers?.full_name || answers?.name || "Patient";
    const therapy = answers?.therapy_type || answers?.therapy || "";
    const goals = answers?.goals || answers?.primary_goal || "";
    const meds = answers?.current_meds || answers?.medications || "";
    const allergies = answers?.allergies || "";

    const panelLabel = lab ? panelName(lab.panel_id) : "";

    const lines: string[] = [];
    lines.push(`Draft Summary for ${name}${therapy ? ` (${therapy})` : ""}`);
    if (goals) lines.push(`Goals: ${String(goals)}`);
    if (meds) lines.push(`Current meds: ${String(meds)}`);
    if (allergies) lines.push(`Allergies: ${String(allergies)}`);

    if (lab) {
      lines.push(`Labs: ${panelLabel} (${lab.status})`);
      for (const [k, v] of Object.entries(labValues)) {
        lines.push(`- ${k}: ${String(v)}`);
      }
    }

    lines.push("");
    lines.push("Notes:");
    lines.push("- This is a Phase-1 internal draft (not a diagnosis).");
    lines.push("- Confirm key items and follow clinic protocol.");

    setSummary(lines.join("\n"));

    // Very basic auto suggestions (you will tune this per clinic protocol)
    const risks: string[] = [];
    const next: string[] = [];

    if (String(allergies).trim()) risks.push("Allergy history present - confirm before prescribing.");
    if (lab && panelLabel.toLowerCase().includes("hormone")) risks.push("Hormone panel: confirm contraindications and follow TRT/HRT protocol.");
    if (lab && panelLabel.toLowerCase().includes("glp")) risks.push("GLP-1 baseline: confirm metabolic risk factors per protocol.");

    next.push("Confirm patient identity, goals, and contraindications.");
    next.push("If needed, request additional labs or follow-up visit.");
    next.push("Document plan and obtain provider sign-off.");

    setRisksText(risks.join("\n"));
    setNextStepsText(next.join("\n"));
    setStatus("draft");
  };

  const save = async () => {
    if (!user) return;
    setErr(null);
    setSaving(true);

    // Determine location/patient based on intake or lab
    const location_id = intake?.location_id ?? lab?.location_id ?? "";
    const patient_id = intake?.patient_id ?? lab?.patient_id ?? "";

    if (!location_id || !patient_id) {
      setSaving(false);
      return setErr("Need intakeId or labId to determine location/patient.");
    }

    const payload = {
      location_id,
      patient_id,
      intake_submission_id: intake?.id ?? null,
      lab_result_id: lab?.id ?? null,
      status,
      summary: summary || null,
      risks: safeList(risksText),
      recommended_next_steps: safeList(nextStepsText),
      created_by: user.id,
    };

    if (analysis?.id) {
      const { error } = await supabase.from("ai_analyses").update(payload).eq("id", analysis.id);
      setSaving(false);
      if (error) return setErr(error.message);
    } else {
      const { data, error } = await supabase
        .from("ai_analyses")
        .insert([payload])
        .select("id,created_at,location_id,patient_id,intake_submission_id,lab_result_id,status,summary,risks,recommended_next_steps,created_by")
        .maybeSingle();

      setSaving(false);
      if (error) return setErr(error.message);
      setAnalysis((data as any) ?? null);
    }

    alert("AI draft saved ");
    await loadExistingAnalysis();
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
        <div className="v-logo">
          <img src={logo} alt="Vitality Institute" />
        </div>

        <div className="v-brand-title">
          <div className="title">Vitality Institute</div>
          <div className="sub">Internal provider drafting workspace for treatment and communication prep.</div>
        </div>
      </div>

      <div className="v-chips">
        <div className="v-chip">
          Role: <strong>{role}</strong>
        </div>
        <div className="v-chip">
          Signed in: <strong>{user?.email ?? "-"}</strong>
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
      <button className="btn btn-ghost" onClick={signOut}>
        Sign out
      </button>
    </div>
  </div>

    <div className="v-statgrid">
    <div className="v-stat">
      <div className="k">Draft Type</div>
      <div className="v">{status === "final" ? "Final" : "Draft"}</div>
    </div>
    <div className="v-stat">
      <div className="k">Linked Intake</div>
      <div className="v">{intakeId || "None"}</div>
    </div>
    <div className="v-stat">
      <div className="k">Linked Lab</div>
      <div className="v">{labId || "None"}</div>
    </div>
    <div className="v-stat">
      <div className="k">Mode</div>
      <div className="v">Internal Draft</div>
    </div>
  </div>
</div>
<div className="space" />
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="h1">AI Draft (Phase-1)</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                This module stores internal drafts. No external AI API is called yet.
              </div>
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
          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="card card-pad" style={{ flex: "1 1 360px", minWidth: 320 }}>
                  <div className="h2">Context</div>

                  <div className="space" />

                  <div className="muted" style={{ fontSize: 12 }}>
                    Intake ID: {intakeId || "-"}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Lab ID: {labId || "-"}
                  </div>

                  <div className="space" />

                  <div className="muted" style={{ fontSize: 12 }}>
                    Location: {intake?.location_id ? locName(intake.location_id) : lab?.location_id ? locName(lab.location_id) : "-"}
                  </div>

                  <div className="space" />

                  <button className="btn btn-ghost" onClick={buildDraft} type="button">
                    Generate Draft From Intake/Labs
                  </button>

                  <div className="space" />

                  <div className="muted" style={{ fontSize: 12 }}>
                    Existing analysis: {analysis ? `${analysis.status} | ${fmt(analysis.created_at)}` : "None"}
                  </div>
                </div>

                <div className="card card-pad" style={{ flex: "2 1 620px", minWidth: 320 }}>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div className="h2">Draft Output</div>

                    <select className="input" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                      <option value="draft">draft</option>
                      <option value="final">final</option>
                    </select>
                  </div>

                  <div className="space" />

                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Summary
                  </div>
                  <DictationTextarea
                    value={summary}
                    onChange={setSummary}
                    placeholder="Draft summary..."
                    style={{ minHeight: 180 }}
                    helpText="You can type or dictate the provider summary."
                    unsupportedText="Microphone dictation is not available in this browser. You can keep typing the summary."
                    surface="light"
                  />

                  <div className="space" />

                  <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px" }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                        Risks (one per line)
                      </div>
                      <DictationTextarea
                        value={risksText}
                        onChange={setRisksText}
                        placeholder="Risk items..."
                        style={{ minHeight: 120 }}
                        helpText="You can type or dictate risk items."
                        unsupportedText="Microphone dictation is not available in this browser. You can keep typing risk items."
                        surface="light"
                      />
                    </div>

                    <div style={{ flex: "1 1 260px" }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                        Recommended next steps (one per line)
                      </div>
                      <DictationTextarea
                        value={nextStepsText}
                        onChange={setNextStepsText}
                        placeholder="Next steps..."
                        style={{ minHeight: 120 }}
                        helpText="You can type or dictate recommended next steps."
                        unsupportedText="Microphone dictation is not available in this browser. You can keep typing next steps."
                        surface="light"
                      />
                    </div>
                  </div>

                  <div className="space" />

                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                      {saving ? "Saving..." : "Save Draft"}
                    </button>
                  </div>
                </div>
              </div>

              {(intake || lab) && (
                <>
                  <div className="space" />

                  <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div className="card card-pad" style={{ flex: "1 1 460px", minWidth: 320 }}>
                      <div className="h2">Intake (JSON)</div>
                      <div className="space" />
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35 }}>
                        {JSON.stringify(intake?.answers ?? {}, null, 2)}
                      </pre>
                    </div>

                    <div className="card card-pad" style={{ flex: "1 1 460px", minWidth: 320 }}>
                      <div className="h2">Labs (JSON)</div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        {lab ? panelName(lab.panel_id) : ""}
                      </div>
                      <div className="space" />
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35 }}>
                        {JSON.stringify(lab?.values ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}



