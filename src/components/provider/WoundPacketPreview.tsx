import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import InlineNotice from "../InlineNotice";
import { supabase } from "../../lib/supabase";
import { getSignedUrl } from "../../lib/patientFiles";
import { analyzeWoundRisk } from "../../lib/woundRiskAlerts";
import { analyzeWoundImage } from "../../lib/woundImageAnalysis";

type TreatmentPlanRecord = import("../../lib/provider/types").TreatmentPlanRecord;

const LazyWoundHealingGraph = lazy(() => import("./WoundHealingGraph"));

type Props = {
  visitId: string;
  patientId: string;
  locationId: string;
};

type VisitRow = {
  id: string;
  created_at: string;
  visit_date: string;
  status: string | null;
  summary: string | null;
  appointment_id: string | null;
};

type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dob?: string | null;
};

type WoundRow = {
  id: string;
  created_at: string;
  wound_label: string;
  wound_series_id?: string | null;
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
  photo_file_id: string | null;
};

type HealingCurveRow = {
  id: string;
  created_at: string;
  visit_id: string;
  wound_label: string;
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  area_cm2: number | null;
};

type LegacyHealingCurveRow = {
  id: string;
  created_at: string;
  visit_id: string;
  wound_label: string;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
  area_cm2: number | null;
};

type SoapRow = {
  id: string;
  created_at: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
};

type PlanRow = {
  id: string;
  created_at: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
  internal_notes: string | null;
  plan: TreatmentPlanRecord["plan"];
};

type FileRow = {
  id: string;
  created_at: string;
  filename: string;
  category: string | null;
  bucket: string;
  path: string;
  content_type: string | null;
  size_bytes: number | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function isImageFile(f: FileRow) {
  return (f.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.filename);
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}

function calcArea(length: number | null, width: number | null) {
  if (length == null || width == null) return null;
  return Number((Number(length) * Number(width)).toFixed(2));
}

export default function WoundPacketPreview({ visitId, patientId, locationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [wound, setWound] = useState<WoundRow | null>(null);
  const [soap, setSoap] = useState<SoapRow | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [priorPhotoUrl, setPriorPhotoUrl] = useState<string>("");
  const [healingRows, setHealingRows] = useState<HealingCurveRow[]>([]);
  const [aiNarrative, setAiNarrative] = useState<string>("");
  const [insuranceJustification, setInsuranceJustification] = useState<string>("");
  const [sendingSoap, setSendingSoap] = useState(false);
  const [sendingPlan, setSendingPlan] = useState(false);

  const woundArea = useMemo(() => {
    if (!wound) return null;
    return calcArea(wound.length_cm, wound.width_cm);
  }, [wound]);

  const fileStats = useMemo(() => {
    const imageCount = files.filter(isImageFile).length;
    const latestFileDate = files.length > 0 ? files[0].created_at : null;
    return {
      total: files.length,
      images: imageCount,
      latestFileDate,
    };
  }, [files]);

  const healingStats = useMemo(() => {
    if (healingRows.length === 0) {
      return {
        entries: 0,
        firstArea: null as number | null,
        latestArea: null as number | null,
        improvementPct: null as number | null,
      };
    }

    const withArea = healingRows.filter((r) => r.area_cm2 != null);
    const firstArea = withArea[0]?.area_cm2 ?? null;
    const latestArea = withArea[withArea.length - 1]?.area_cm2 ?? null;

    let improvementPct: number | null = null;
    if (firstArea != null && latestArea != null && firstArea > 0) {
      improvementPct = Number((((firstArea - latestArea) / firstArea) * 100).toFixed(1));
    }

    return {
      entries: healingRows.length,
      firstArea,
      latestArea,
      improvementPct,
    };
  }, [healingRows]);

  const healingClassification = useMemo(() => {
    if (healingRows.length < 2 || healingStats.improvementPct == null) {
      return {
        label: "Insufficient Data",
        detail: "Not enough historical measurements to classify wound healing trend.",
      };
    }

    const pct = healingStats.improvementPct;

    if (pct >= 20) {
      return {
        label: "Improving",
        detail: `${pct}% reduction in wound area across ${healingStats.entries} measurements.`,
      };
    }

    if (pct >= 5) {
      return {
        label: "Stable",
        detail: `${pct}% reduction in wound area across ${healingStats.entries} measurements.`,
      };
    }

    if (pct > -10) {
      return {
        label: "Delayed Healing",
        detail: `Minimal interval change (${pct}%) across ${healingStats.entries} measurements.`,
      };
    }

    return {
      label: "Deteriorating",
      detail: `${Math.abs(pct)}% increase in wound area across ${healingStats.entries} measurements.`,
    };
  }, [healingRows, healingStats]);

  const riskAlerts = useMemo(() => {
    if (!healingRows?.length) return []
    return analyzeWoundRisk(healingRows)
  }, [healingRows]);

  const imageAnalysis = useMemo(() => {
    const currentArea = woundArea;
    const priorWithArea = healingRows
      .filter((r) => r.area_cm2 != null)
      .slice(0, -1);

    const priorArea =
      priorWithArea.length > 0
        ? priorWithArea[priorWithArea.length - 1].area_cm2
        : null;

    return analyzeWoundImage({
      hasCurrentImage: !!photoUrl,
      hasPriorImage: !!priorPhotoUrl,
      currentAreaCm2: currentArea,
      priorAreaCm2: priorArea,
      exudate: wound?.exudate ?? null,
      infectionSigns: wound?.infection_signs ?? null,
      painScore: wound?.pain_score ?? null,
    });
  }, [photoUrl, priorPhotoUrl, woundArea, healingRows, wound]);

  useEffect(() => {
    if (!wound) {
      setAiNarrative("");
      return;
    }

    const parts: string[] = [];

    parts.push(
      `Patient presented with a ${wound.wound_type ?? "wound"} located at ${wound.body_site ?? "an unspecified site"}${wound.laterality ? ` on the ${wound.laterality} side` : ""}.`
    );

    if (woundArea != null) {
      parts.push(
        `Current wound measurements are approximately ${wound.length_cm ?? "-"} cm by ${wound.width_cm ?? "-"} cm with a surface area of about ${woundArea} cm^2.`
      );
    }

    if (healingStats.entries > 1 && healingStats.improvementPct != null) {
      if (healingStats.improvementPct >= 0) {
        parts.push(
          `Comparison with prior assessments indicates approximately ${healingStats.improvementPct}% improvement in wound surface area over ${healingStats.entries} documented visits.`
        );
      } else {
        parts.push(
          `Recent measurements indicate an increase in wound surface area of approximately ${Math.abs(healingStats.improvementPct)}% compared with earlier visits, suggesting delayed healing.`
        );
      }
    }
    parts.push(`Healing trend is currently classified as ${healingClassification.label.toLowerCase()}.`);

    if (wound.exudate) {
      parts.push(`Exudate level is described as ${wound.exudate}.`);
    }

    if (wound.infection_signs) {
      parts.push(`Clinical observations include possible infection indicators: ${wound.infection_signs}.`);
    }

    if (soap?.assessment) {
      parts.push(`Clinical assessment notes: ${soap.assessment}`);
    }

    if (plan?.summary) {
      parts.push(`Current treatment plan focuses on ${plan.summary}.`);
    }

    parts.push(
      "Continued monitoring and wound management are recommended to support ongoing tissue repair and reduce complications."
    );

    setAiNarrative(parts.join(" "));
  }, [wound, healingStats, woundArea, soap, plan, healingClassification]);

  useEffect(() => {
    if (!wound) {
      setInsuranceJustification("");
      return;
    }

    const parts: string[] = [];

    parts.push(
      `The patient is under active treatment for a ${wound.wound_type ?? "chronic wound"} involving ${wound.body_site ?? "the affected area"}${wound.laterality ? ` on the ${wound.laterality} side` : ""}.`
    );

    if (woundArea != null) {
      parts.push(
        `Current documented wound dimensions are ${wound.length_cm ?? "-"} cm x ${wound.width_cm ?? "-"} cm x ${wound.depth_cm ?? "-"} cm with an approximate surface area of ${woundArea} cm^2.`
      );
    }

    if (healingStats.entries > 1 && healingStats.improvementPct != null) {
      if (healingStats.improvementPct >= 0) {
        parts.push(
          `Serial wound measurements demonstrate approximately ${healingStats.improvementPct}% improvement over ${healingStats.entries} documented assessments, supporting the value of continued skilled wound management.`
        );
      } else {
        parts.push(
          `Serial wound measurements show interval worsening of approximately ${Math.abs(healingStats.improvementPct)}%, indicating delayed healing and the need for continued advanced wound care oversight.`
        );
      }
    } else {
      parts.push(
        "There is limited historical comparison currently available, and continued documentation is medically appropriate to monitor treatment response and wound progression."
      );
    }

    if (wound.exudate) {
      parts.push(`Documented exudate burden is ${wound.exudate}.`);
    }

    if (wound.infection_signs) {
      parts.push(`Clinical concern for infection or inflammatory burden includes: ${wound.infection_signs}.`);
    }

    if (wound.pain_score != null) {
      parts.push(`The patient reports a pain score of ${wound.pain_score}/10 associated with the wound.`);
    }

    if (soap?.objective) {
      parts.push(`Objective clinical findings note: ${soap.objective}`);
    }

    if (plan?.summary) {
      parts.push(`The current treatment strategy includes ${plan.summary}.`);
    }

    parts.push(
      `Current healing classification is ${healingClassification.label.toLowerCase()}, which supports the need for continued skilled wound assessment and management.`
    );

    parts.push(
      "Based on wound characteristics, objective measurements, and continued need for skilled assessment and treatment planning, ongoing medically necessary wound care services are supported."
    );

    setInsuranceJustification(parts.join(" "));
  }, [wound, woundArea, healingStats, soap, plan, healingClassification]);

  useEffect(() => {
    const load = async () => {
      if (!visitId || !patientId || !locationId) {
        setErr("Missing visit context.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const { data: v, error: vErr } = await supabase
          .from("patient_visits")
          .select("id,created_at,visit_date,status,summary,appointment_id")
          .eq("id", visitId)
          .maybeSingle();

        if (vErr) throw vErr;
        setVisit((v as VisitRow) ?? null);

        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id,first_name,last_name,phone,email,dob")
          .eq("id", patientId)
          .maybeSingle();

        if (pErr) throw pErr;
        setPatient((p as PatientRow) ?? null);

        const { data: w, error: wErr } = await supabase
          .from("wound_assessments")
          .select(`
            id,created_at,wound_label,wound_series_id,body_site,laterality,wound_type,stage,
            length_cm,width_cm,depth_cm,exudate,odor,infection_signs,pain_score,notes,photo_file_id
          `)
          .eq("visit_id", visitId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (wErr) throw wErr;
        const woundRow = (w?.[0] as WoundRow) ?? null;
        setWound(woundRow);

        if (woundRow?.wound_series_id) {
          const { data: hr, error: hrErr } = await supabase
            .from("wound_assessments")
            .select(`
              id,created_at,visit_id,wound_label,
              length_cm,width_cm,depth_cm,
              body_site,laterality,wound_type
            `)
            .eq("wound_series_id", woundRow.wound_series_id)
            .order("created_at", { ascending: true });

          if (hrErr) throw hrErr;

          const curveRows: HealingCurveRow[] = ((hr as LegacyHealingCurveRow[]) ?? []).map((r) => ({
            ...r,
            area_cm2:
              r.length_cm != null && r.width_cm != null
                ? Number((Number(r.length_cm) * Number(r.width_cm)).toFixed(2))
                : null,
          }));

          setHealingRows(curveRows);
        } else if (woundRow?.wound_label) {
          const { data: hr, error: hrErr } = await supabase
            .from("wound_assessments")
            .select(`
              id,created_at,visit_id,wound_label,
              length_cm,width_cm,depth_cm,
              body_site,laterality,wound_type
            `)
            .eq("patient_id", patientId)
            .eq("wound_label", woundRow.wound_label)
            .order("created_at", { ascending: true });

          if (hrErr) throw hrErr;

          const curveRows: HealingCurveRow[] = ((hr as LegacyHealingCurveRow[]) ?? []).map((r) => ({
            ...r,
            area_cm2:
              r.length_cm != null && r.width_cm != null
                ? Number((Number(r.length_cm) * Number(r.width_cm)).toFixed(2))
                : null,
          }));

          setHealingRows(curveRows);
        } else {
          setHealingRows([]);
        }

        const { data: s, error: sErr } = await supabase
          .from("patient_soap_notes")
          .select("id,created_at,subjective,objective,assessment,plan,is_signed,is_locked,signed_at")
          .eq("visit_id", visitId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (sErr) throw sErr;
        setSoap((s?.[0] as SoapRow) ?? null);

        const { data: tp, error: tpErr } = await supabase
          .from("patient_treatment_plans")
          .select("id,created_at,status,summary,patient_instructions,internal_notes,plan")
          .eq("visit_id", visitId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (tpErr) throw tpErr;
        setPlan((tp?.[0] as PlanRow) ?? null);

        const { data: f, error: fErr } = await supabase
          .from("patient_files")
          .select("id,created_at,filename,category,bucket,path,content_type,size_bytes")
          .eq("visit_id", visitId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (fErr) throw fErr;
        const fileRows = (f as FileRow[]) ?? [];
        setFiles(fileRows);

        if (woundRow?.photo_file_id) {
          const linked = fileRows.find((x) => x.id === woundRow.photo_file_id);
          if (linked) {
            try {
              const url = await getSignedUrl(linked.bucket, linked.path);
              setPhotoUrl(url);
            } catch {
              setPhotoUrl("");
            }
          } else {
            setPhotoUrl("");
          }
        } else {
          setPhotoUrl("");
        }

        if (woundRow?.wound_label) {
          const { data: priorRows, error: priorErr } = await supabase
            .from("wound_assessments")
            .select("id,created_at,photo_file_id,visit_id")
            .eq("patient_id", patientId)
            .eq("wound_label", woundRow.wound_label)
            .not("photo_file_id", "is", null)
            .neq("visit_id", visitId)
            .order("created_at", { ascending: false })
            .limit(1);

          if (priorErr) throw priorErr;

          const priorPhotoFileId = (priorRows as Array<{ photo_file_id?: string | null }> | null)?.[0]?.photo_file_id ?? null;

          if (priorPhotoFileId) {
            const { data: priorFile, error: priorFileErr } = await supabase
              .from("patient_files")
              .select("id,bucket,path")
              .eq("id", priorPhotoFileId)
              .maybeSingle();

            if (priorFileErr) throw priorFileErr;

            const priorFileRow = priorFile as { id?: string; bucket?: string; path?: string } | null;

            if (priorFileRow?.id && priorFileRow.bucket && priorFileRow.path) {
              try {
                const priorUrl = await getSignedUrl(priorFileRow.bucket, priorFileRow.path);
                setPriorPhotoUrl(priorUrl);
              } catch {
                setPriorPhotoUrl("");
              }
            } else {
              setPriorPhotoUrl("");
            }
          } else {
            setPriorPhotoUrl("");
          }
        } else {
          setPriorPhotoUrl("");
        }
      } catch (error: unknown) {
        setErr(getErrorMessage(error, "Failed to load packet preview."));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [visitId, patientId, locationId]);

  const patientName = useMemo(() => {
    if (!patient) return "Patient";
    return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  }, [patient]);

  const handlePrintPacket = () => {
    const node = printRef.current;
    if (!node) return;

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) return;

    const styles = `
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        margin: 24px;
        color: #111;
        background: #fff;
      }
      h1, h2, h3 {
        margin: 0 0 10px 0;
      }
      .packet-title {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .packet-subtitle {
        font-size: 13px;
        color: #555;
        margin-bottom: 24px;
      }
      .section {
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        page-break-inside: avoid;
      }
      .section-title {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .label {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      }
      .value {
        font-size: 14px;
        margin-bottom: 12px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .grid-4 {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .mini-card {
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 12px;
      }
      img {
        max-width: 100%;
        border-radius: 10px;
        border: 1px solid #ddd;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
      }
      @media print {
        body {
          margin: 12px;
        }
      }
    </style>
  `;

    printWindow.document.write(`
    <html>
      <head>
        <title>Wound Packet Preview</title>
        ${styles}
      </head>
      <body>
        <div class="packet-title">Vitality Institute - Wound Packet</div>
        <div class="packet-subtitle">Generated packet preview for clinical review and reimbursement support.</div>
        ${node.innerHTML}
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage("Copied to clipboard.");
    } catch {
      setErr("Copy failed.");
    }
  };

  const sendNarrativeToSoap = async () => {
    if (!soap?.id || !aiNarrative) {
      setErr("No SOAP note or narrative available.");
      return;
    }

    setSendingSoap(true);
    setErr(null);
    setActionMessage(null);
    try {
      const existing = soap.assessment?.trim() ?? "";
      const nextValue = existing
        ? `${existing}\n\n--- Packet Narrative ---\n${aiNarrative}`
        : `--- Packet Narrative ---\n${aiNarrative}`;

      const { error } = await supabase
        .from("patient_soap_notes")
        .update({ assessment: nextValue })
        .eq("id", soap.id);

      if (error) throw error;

      setSoap((prev) =>
        prev
          ? {
              ...prev,
              assessment: nextValue,
            }
          : prev
      );

      setActionMessage("Narrative sent to SOAP assessment.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send narrative to SOAP."));
    } finally {
      setSendingSoap(false);
    }
  };

  const sendJustificationToPlan = async () => {
    if (!plan?.id || !insuranceJustification) {
      setErr("No treatment plan or justification available.");
      return;
    }

    setSendingPlan(true);
    setErr(null);
    setActionMessage(null);
    try {
      const existing = plan.internal_notes?.trim() ?? "";
      const nextValue = existing
        ? `${existing}\n\n--- Insurance Justification ---\n${insuranceJustification}`
        : `--- Insurance Justification ---\n${insuranceJustification}`;

      const { error } = await supabase
        .from("patient_treatment_plans")
        .update({ internal_notes: nextValue })
        .eq("id", plan.id);

      if (error) throw error;

      setPlan((prev) =>
        prev
          ? {
              ...prev,
              internal_notes: nextValue,
            }
          : prev
      );

      setActionMessage("Justification sent to treatment plan internal notes.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send justification to treatment plan."));
    } finally {
      setSendingPlan(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="h2">Wound Packet Preview</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Current visit summary for documentation, reimbursement, and packet assembly.
          </div>
        </div>

        <button className="btn btn-primary" type="button" onClick={handlePrintPacket}>
          Print / Save PDF
        </button>
      </div>

      <div className="space" />
      {loading && <div className="muted">Loading packet preview...</div>}
      {actionMessage && <InlineNotice message={actionMessage} tone="success" style={{ marginBottom: 12 }} />}
      {err && <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} />}

      {!loading && !err && (
        <div ref={printRef}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div className="card card-pad" style={{ flex: "1 1 320px", minWidth: 280 }}>
              <div className="h2">Visit Snapshot</div>
              <div className="space" />

              <div className="muted">Patient</div>
              <div style={{ fontWeight: 700 }}>{patientName}</div>

              <div className="space" />
              <div className="muted">DOB</div>
              <div>{fmtDate(patient?.dob)}</div>

              <div className="space" />
              <div className="muted">Phone</div>
              <div>{patient?.phone ?? "-"}</div>

              <div className="space" />
              <div className="muted">Email</div>
              <div>{patient?.email ?? "-"}</div>

              <div className="space" />
              <div className="muted">Visit Date</div>
              <div>{fmtDateTime(visit?.visit_date)}</div>

              <div className="space" />
              <div className="muted">Status</div>
              <div>{visit?.status ?? "-"}</div>

              <div className="space" />
              <div className="muted">Visit Summary</div>
              <div>{visit?.summary ?? "-"}</div>
            </div>

            <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
              <div className="h2">Wound Snapshot</div>
              <div className="space" />

              <div className="muted">Wound Label</div>
              <div style={{ fontWeight: 700 }}>{wound?.wound_label ?? "-"}</div>

              <div className="space" />
              <div className="muted">Body Site / Laterality / Type</div>
              <div>
                {wound?.body_site ?? "-"}
                {wound?.laterality ? ` - ${wound.laterality}` : ""}
                {wound?.wound_type ? ` - ${wound.wound_type}` : ""}
              </div>

              <div className="space" />
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="card card-pad" style={{ flex: "1 1 140px" }}>
                  <div className="muted">Length</div>
                  <div style={{ fontWeight: 700 }}>{wound?.length_cm ?? "-"} cm</div>
                </div>
                <div className="card card-pad" style={{ flex: "1 1 140px" }}>
                  <div className="muted">Width</div>
                  <div style={{ fontWeight: 700 }}>{wound?.width_cm ?? "-"} cm</div>
                </div>
                <div className="card card-pad" style={{ flex: "1 1 140px" }}>
                  <div className="muted">Depth</div>
                  <div style={{ fontWeight: 700 }}>{wound?.depth_cm ?? "-"} cm</div>
                </div>
                <div className="card card-pad" style={{ flex: "1 1 160px" }}>
                  <div className="muted">Area</div>
                  <div style={{ fontWeight: 700 }}>{woundArea == null ? "-" : `${woundArea} cm^2`}</div>
                </div>
              </div>

              <div className="space" />
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="card card-pad" style={{ flex: "1 1 160px" }}>
                  <div className="muted">Stage</div>
                  <div>{wound?.stage ?? "-"}</div>
                </div>
                <div className="card card-pad" style={{ flex: "1 1 160px" }}>
                  <div className="muted">Exudate</div>
                  <div>{wound?.exudate ?? "-"}</div>
                </div>
                <div className="card card-pad" style={{ flex: "1 1 160px" }}>
                  <div className="muted">Pain</div>
                  <div>{wound?.pain_score ?? "-"}</div>
                </div>
              </div>

              <div className="space" />
              <div className="muted">Infection Signs</div>
              <div>{wound?.infection_signs ?? "-"}</div>

              <div className="space" />
              <div className="muted">Odor</div>
              <div>{wound?.odor ?? "-"}</div>

              <div className="space" />
              <div className="muted">Clinical Notes</div>
              <div>{wound?.notes ?? "-"}</div>

              <div className="space" />
              <div className="muted">Linked Photo</div>
              <div className="space" />

              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Linked wound"
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    height: 260,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.10)",
                  }}
                />
              ) : (
                <div className="muted">No linked wound photo for this visit.</div>
              )}

              <div className="space" />

              <div className="card card-pad">
                <div className="h2" style={{ fontSize: 18 }}>Image Analysis</div>
                <div className="space" />

                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                  <div className="card card-pad" style={{ flex: "1 1 180px" }}>
                    <div className="muted">Photo Quality</div>
                    <div style={{ fontWeight: 700 }}>{imageAnalysis.quality}</div>
                  </div>

                  <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                    <div className="muted">Comparison Status</div>
                    <div style={{ fontWeight: 700 }}>{imageAnalysis.comparison}</div>
                  </div>
                </div>

                <div className="space" />
                <div className="muted">Visual Notes</div>
                <div>{imageAnalysis.visual_notes}</div>

                <div className="space" />
                <div className="muted">Documentation Prompt</div>
                <div>{imageAnalysis.documentation_prompt}</div>

                <div className="space" />
                <div className="muted">Escalation Prompt</div>
                <div>{imageAnalysis.escalation_prompt}</div>
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="card card-pad">
            <div className="h2">Healing Curve Snapshot</div>
            <div className="space" />

            {healingRows.length === 0 ? (
              <div className="muted">No healing history available for this wound label yet.</div>
            ) : (
              <>
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                  <div className="card card-pad" style={{ flex: "1 1 180px" }}>
                    <div className="muted">Entries</div>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{healingStats.entries}</div>
                  </div>

                  <div className="card card-pad" style={{ flex: "1 1 180px" }}>
                    <div className="muted">Initial Area</div>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>
                      {healingStats.firstArea == null ? "-" : `${healingStats.firstArea} cm^2`}
                    </div>
                  </div>

                  <div className="card card-pad" style={{ flex: "1 1 180px" }}>
                    <div className="muted">Latest Area</div>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>
                      {healingStats.latestArea == null ? "-" : `${healingStats.latestArea} cm^2`}
                    </div>
                  </div>

                  <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                    <div className="muted">Overall Change</div>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>
                      {healingStats.improvementPct == null
                        ? "-"
                        : healingStats.improvementPct >= 0
                        ? `+${healingStats.improvementPct}% improved`
                        : `${healingStats.improvementPct}%`}
                    </div>
                  </div>
                </div>

                <div className="space" />

                <div className="card card-pad">
                  <div className="muted">Healing Status</div>
                  <div style={{ fontWeight: 800, fontSize: 24, marginTop: 6 }}>
                    {healingClassification.label}
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {healingClassification.detail}
                  </div>
                </div>

                <div className="space" />

                <Suspense
                  fallback={
                    <div className="card card-pad">
                      <div className="muted">Loading healing graph...</div>
                    </div>
                  }
                >
                  <LazyWoundHealingGraph
                    rows={healingRows}
                    currentVisitId={visitId}
                    title="Wound Area Trend"
                  />
                </Suspense>

                <div className="space" />

                <div className="card card-pad" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <th style={{ padding: "10px 8px" }}>Date</th>
                        <th style={{ padding: "10px 8px" }}>Visit</th>
                        <th style={{ padding: "10px 8px" }}>Body Site</th>
                        <th style={{ padding: "10px 8px" }}>Type</th>
                        <th style={{ padding: "10px 8px" }}>L x W x D</th>
                        <th style={{ padding: "10px 8px" }}>Area</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healingRows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <td style={{ padding: "10px 8px" }}>{fmtDateTime(row.created_at)}</td>
                          <td style={{ padding: "10px 8px" }}>
                            {row.visit_id === visitId ? "Current Visit" : row.visit_id.slice(0, 8)}
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            {row.body_site ?? "-"}
                            {row.laterality ? ` - ${row.laterality}` : ""}
                          </td>
                          <td style={{ padding: "10px 8px" }}>{row.wound_type ?? "-"}</td>
                          <td style={{ padding: "10px 8px" }}>
                            {row.length_cm ?? "-"} x {row.width_cm ?? "-"} x {row.depth_cm ?? "-"}
                          </td>
                          <td style={{ padding: "10px 8px", fontWeight: 700 }}>
                            {row.area_cm2 == null ? "-" : `${row.area_cm2} cm^2`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="space" />

          {riskAlerts.length > 0 && (
            <div className="card card-pad">
              <div className="muted">Risk Alerts</div>

              {riskAlerts.map((a, i) => (
                <div key={i} style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600 }}>
                    {a.level === "high" && "Alert: "}
                    {a.title}
                  </div>

                  <div className="muted">{a.message}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space" />

          <div className="card card-pad">
            <div
              className="row"
              style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}
            >
              <div className="h2">Clinical Narrative</div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => copyText(aiNarrative)}
                  disabled={!aiNarrative}
                >
                  Copy Narrative
                </button>

                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={sendNarrativeToSoap}
                  disabled={!aiNarrative || !soap?.id || sendingSoap}
                >
                  {sendingSoap ? "Sending..." : "Send to SOAP"}
                </button>
              </div>
            </div>
            <div className="space" />

            {aiNarrative ? (
              <div style={{ lineHeight: 1.6 }}>
                {aiNarrative}
              </div>
            ) : (
              <div className="muted">Narrative unavailable.</div>
            )}
          </div>

          <div className="space" />

          <div className="card card-pad">
            <div
              className="row"
              style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}
            >
              <div className="h2">Insurance Justification</div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => copyText(insuranceJustification)}
                  disabled={!insuranceJustification}
                >
                  Copy Justification
                </button>

                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={sendJustificationToPlan}
                  disabled={!insuranceJustification || !plan?.id || sendingPlan}
                >
                  {sendingPlan ? "Sending..." : "Send to Treatment"}
                </button>
              </div>
            </div>
            <div className="space" />

            {insuranceJustification ? (
              <div style={{ lineHeight: 1.6 }}>
                {insuranceJustification}
              </div>
            ) : (
              <div className="muted">Insurance justification unavailable.</div>
            )}
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
              <div className="h2">SOAP Snapshot</div>
              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="v-chip">{soap ? "On File" : "Missing"}</div>
                {soap?.is_signed ? <div className="v-chip">Signed</div> : null}
                {soap?.is_locked ? <div className="v-chip">Locked</div> : null}
              </div>

              <div className="space" />
              <div className="muted">Signed At</div>
              <div>{fmtDateTime(soap?.signed_at)}</div>

              <div className="space" />
              <div className="muted">Subjective</div>
              <div>{soap?.subjective ?? "-"}</div>

              <div className="space" />
              <div className="muted">Objective</div>
              <div>{soap?.objective ?? "-"}</div>

              <div className="space" />
              <div className="muted">Assessment</div>
              <div>{soap?.assessment ?? "-"}</div>

              <div className="space" />
              <div className="muted">Plan</div>
              <div>{soap?.plan ?? "-"}</div>
            </div>

            <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
              <div className="h2">Treatment Snapshot</div>
              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="v-chip">{plan ? "On File" : "Missing"}</div>
                {plan?.status ? <div className="v-chip">{plan.status}</div> : null}
              </div>

              <div className="space" />
              <div className="muted">Summary</div>
              <div>{plan?.summary ?? "-"}</div>

              <div className="space" />
              <div className="muted">Patient Instructions</div>
              <div>{plan?.patient_instructions ?? "-"}</div>

              <div className="space" />
              <div className="muted">Internal Notes</div>
              <div>{plan?.internal_notes ?? "-"}</div>

              <div className="space" />
              <div className="muted">Structured Plan</div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              >
                {plan?.plan ? JSON.stringify(plan.plan, null, 2) : "-"}
              </pre>
            </div>
          </div>

          <div className="space" />

          <div className="card card-pad">
            <div className="h2">File Summary</div>
            <div className="space" />

            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="card card-pad" style={{ flex: "1 1 200px" }}>
                <div className="muted">Total Files</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>{fileStats.total}</div>
              </div>

              <div className="card card-pad" style={{ flex: "1 1 200px" }}>
                <div className="muted">Images</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>{fileStats.images}</div>
              </div>

              <div className="card card-pad" style={{ flex: "1 1 260px" }}>
                <div className="muted">Latest Upload</div>
                <div style={{ fontWeight: 700 }}>{fmtDateTime(fileStats.latestFileDate)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
