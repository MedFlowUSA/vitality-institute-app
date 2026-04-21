import { useEffect, useMemo, useRef, useState } from "react";
import InlineNotice from "../InlineNotice";
import { renderElementPdfBlob } from "../../lib/pdf";
import { supabase } from "../../lib/supabase";
import { getSignedUrl, resolvePatientFileOwnerIds, uploadPatientFile } from "../../lib/patientFiles";
import { formatProviderStatusLabel } from "../../lib/provider/workspace";

type TreatmentPlanRecord = import("../../lib/provider/types").TreatmentPlanRecord;

type Props = {
  visitId: string;
  patientId: string;
  locationId: string;
};

type VisitRow = {
  id: string;
  created_at: string;
  visit_date: string | null;
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
  dob: string | null;
};

type WoundRow = {
  id: string;
  created_at: string;
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
  photo_file_id: string | null;
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

type TreatmentPlanRow = {
  id: string;
  created_at: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
  internal_notes: string | null;
  plan: TreatmentPlanRecord["plan"];
  signed_at: string | null;
};

type FileRow = {
  id: string;
  created_at: string;
  filename: string;
  category: string | null;
  bucket: string;
  path: string;
  content_type: string | null;
  visit_id: string | null;
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
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  area_cm2: number | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function fmtDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString();
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString();
}

function calcArea(length: number | null, width: number | null) {
  if (length == null || width == null) return null;
  return Number((Number(length) * Number(width)).toFixed(2));
}

function isImageFile(f: FileRow) {
  return (f.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.filename);
}

export default function VisitPacketSection({ visitId, patientId, locationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [packetMode, setPacketMode] = useState<"patient" | "clinical">("clinical");
  const [sendingToPortal, setSendingToPortal] = useState(false);

  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [wounds, setWounds] = useState<WoundRow[]>([]);
  const [soap, setSoap] = useState<SoapRow | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlanRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [healingCurve, setHealingCurve] = useState<HealingCurveRow[]>([]);

  const printRef = useRef<HTMLDivElement | null>(null);

  const patientName = useMemo(() => {
    if (!patient) return "Patient";
    return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  }, [patient]);

  const narrative = useMemo(() => {
    if (wounds.length === 0) return "";
    const primary = wounds[0];
    const area = calcArea(primary.length_cm, primary.width_cm);

    const parts: string[] = [];
    parts.push(
      `Patient presents with ${primary.wound_type ?? "a wound"}${primary.body_site ? ` at ${primary.body_site}` : ""}${primary.laterality ? ` on the ${primary.laterality}` : ""}.`
    );

    if (area != null) {
      parts.push(
        `Current measured surface area is approximately ${area} cm2 with dimensions ${primary.length_cm ?? "-"} x ${primary.width_cm ?? "-"} x ${primary.depth_cm ?? "-"} cm.`
      );
    }

    if (primary.exudate) parts.push(`Exudate is documented as ${primary.exudate}.`);
    if (primary.infection_signs) parts.push(`Infection-related findings include: ${primary.infection_signs}.`);
    if (soap?.assessment) parts.push(`Clinical assessment: ${soap.assessment}`);
    if (treatmentPlan?.summary) parts.push(`Treatment focus: ${treatmentPlan.summary}`);

    parts.push(
      "Continued skilled wound management, reassessment, and treatment planning remain medically appropriate based on wound characteristics and documented follow-up needs."
    );

    return parts.join(" ");
  }, [wounds, soap, treatmentPlan]);

  const patientSafeNarrative = useMemo(() => {
    if (wounds.length === 0) return "";

    const primary = wounds[0];
    const area = calcArea(primary.length_cm, primary.width_cm);

    const parts: string[] = [];

    parts.push(
      `Your care team documented ${primary.wound_type ?? "a wound"}${primary.body_site ? ` at ${primary.body_site}` : ""}${primary.laterality ? ` on the ${primary.laterality}` : ""}.`
    );

    if (area != null) {
      parts.push(`The current measured area is approximately ${area} cm^2.`);
    }

    if (treatmentPlan?.patient_instructions) {
      parts.push(`Instructions: ${treatmentPlan.patient_instructions}`);
    } else if (treatmentPlan?.summary) {
      parts.push(`Plan summary: ${treatmentPlan.summary}`);
    }

    parts.push(
      "Please continue following your care instructions and contact the clinic with any questions or changes."
    );

    return parts.join(" ");
  }, [wounds, treatmentPlan]);

  const visibleFiles = useMemo(
    () => (packetMode === "patient" ? files.filter((file) => isImageFile(file)) : files),
    [files, packetMode]
  );

  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      const { data: visitRow, error: visitErr } = await supabase
        .from("patient_visits")
        .select("id,created_at,visit_date,status,summary,appointment_id")
        .eq("id", visitId)
        .maybeSingle();
      if (visitErr) throw visitErr;
      setVisit((visitRow as VisitRow) ?? null);

      const { data: patientRow, error: patientErr } = await supabase
        .from("patients")
        .select("id,first_name,last_name,phone,email,dob")
        .eq("id", patientId)
        .maybeSingle();
      if (patientErr) throw patientErr;
      setPatient((patientRow as PatientRow) ?? null);

      const { data: woundRows, error: woundErr } = await supabase
        .from("wound_assessments")
        .select(`
          id,created_at,wound_label,body_site,laterality,wound_type,stage,
          length_cm,width_cm,depth_cm,exudate,odor,infection_signs,pain_score,notes,photo_file_id
        `)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });
      if (woundErr) throw woundErr;
      const woundList = (woundRows as WoundRow[]) ?? [];
      setWounds(woundList);

      const { data: soapRows, error: soapErr } = await supabase
        .from("patient_soap_notes")
        .select("id,created_at,subjective,objective,assessment,plan,is_signed,is_locked,signed_at")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (soapErr) throw soapErr;
      setSoap((soapRows?.[0] as SoapRow) ?? null);

      const { data: planRows, error: planErr } = await supabase
        .from("patient_treatment_plans")
        .select("id,created_at,status,summary,patient_instructions,internal_notes,plan,signed_at")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (planErr) throw planErr;
      setTreatmentPlan((planRows?.[0] as TreatmentPlanRow) ?? null);

      const patientFileOwnerIds = await resolvePatientFileOwnerIds(patientId);
      const { data: fileRows, error: fileErr } = await supabase
        .from("patient_files")
        .select("id,created_at,filename,category,bucket,path,content_type,visit_id")
        .in("patient_id", patientFileOwnerIds)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });
      if (fileErr) throw fileErr;
      const fileList = (fileRows as FileRow[]) ?? [];
      setFiles(fileList);

      const nextUrls: Record<string, string> = {};
      for (const f of fileList) {
        try {
          nextUrls[f.id] = await getSignedUrl(f.bucket, f.path);
        } catch {
          // ignore URL failures
        }
      }
      setFileUrls(nextUrls);

      const woundLabels = Array.from(new Set(woundList.map((w) => w.wound_label).filter(Boolean)));
      if (woundLabels.length > 0) {
        const { data: curveRows, error: curveErr } = await supabase
          .from("wound_assessments")
          .select(`
            id,created_at,visit_id,wound_label,body_site,laterality,wound_type,
            length_cm,width_cm,depth_cm
          `)
          .eq("patient_id", patientId)
          .in("wound_label", woundLabels)
          .order("created_at", { ascending: true });

        if (curveErr) throw curveErr;

        const normalized = (((curveRows as LegacyHealingCurveRow[]) ?? []).map((r) => ({
          ...r,
          area_cm2:
            r.length_cm != null && r.width_cm != null
              ? Number((Number(r.length_cm) * Number(r.width_cm)).toFixed(2))
              : null,
        })) as HealingCurveRow[]);

        setHealingCurve(normalized);
      } else {
        setHealingCurve([]);
      }
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load visit packet."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId, patientId, locationId]);

  const buildPatientPacketHtml = () => {
    const imageBlocks = files
      .filter((f) => isImageFile(f) && fileUrls[f.id])
      .map(
        (f) => `
        <div style="border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:700;">${f.filename}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">
            ${(f.category ?? "image")} | ${fmtDateTime(f.created_at)}
          </div>
          <img
            src="${fileUrls[f.id]}"
            alt="${f.filename}"
            style="margin-top:10px;width:100%;max-width:320px;border-radius:10px;border:1px solid #ddd;"
          />
        </div>
      `
      )
      .join("");

    return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Vitality Institute - Patient Visit Copy</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 24px;
            color: #111;
            background: #fff;
          }
          .title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .subtitle {
            color: #555;
            margin-bottom: 24px;
            font-size: 13px;
          }
          .section {
            border: 1px solid #ddd;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 10px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .mini {
            border: 1px solid #ddd;
            border-radius: 10px;
            padding: 10px;
            page-break-inside: avoid;
          }
          img {
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 10px;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="title">Vitality Institute - Patient Copy</div>
        <div class="subtitle">Patient-safe visit summary and care instructions.</div>

        <div class="section">
          <div class="section-title">Visit Header</div>
          <div class="grid">
            <div class="mini">
              <div style="color:#666;font-size:12px;">Patient</div>
              <div style="font-weight:800;">${patientName}</div>
            </div>
            <div class="mini">
              <div style="color:#666;font-size:12px;">DOB</div>
              <div>${fmtDate(patient?.dob)}</div>
            </div>
            <div class="mini">
              <div style="color:#666;font-size:12px;">Visit Date</div>
              <div>${fmtDateTime(visit?.visit_date ?? visit?.created_at)}</div>
            </div>
            <div class="mini">
              <div style="color:#666;font-size:12px;">Visit Status</div>
              <div>${formatProviderStatusLabel(visit?.status)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Wound Summary</div>
          ${
            wounds.length === 0
              ? `<div>No wound assessments found for this visit.</div>`
              : wounds
                  .map(
                    (w) => `
              <div class="mini" style="margin-bottom:12px;">
                <div style="font-weight:800;">${w.wound_label}</div>
                <div style="margin-top:6px;line-height:1.7;">
                  ${[w.body_site, w.laterality, w.wound_type, w.stage].filter(Boolean).join(" | ") || "-"}
                </div>
                <div style="margin-top:6px;">
                  Size: ${w.length_cm ?? "-"} x ${w.width_cm ?? "-"} x ${w.depth_cm ?? "-"} cm
                </div>
                <div>Area: ${calcArea(w.length_cm, w.width_cm) ?? "-"} cm^2</div>
                <div>Pain: ${w.pain_score ?? "-"}</div>
              </div>
            `
                  )
                  .join("")
          }
        </div>

        <div class="section">
          <div class="section-title">Care Instructions</div>
          ${
            !treatmentPlan
              ? `<div>No treatment plan available.</div>`
              : `
                <div><strong>Status:</strong> ${formatProviderStatusLabel(treatmentPlan.status)}</div>
                <div style="margin-top:10px;"><strong>Summary:</strong> ${treatmentPlan.summary ?? "-"}</div>
                <div style="margin-top:10px;white-space:pre-wrap;"><strong>Patient Instructions:</strong><br/>${treatmentPlan.patient_instructions ?? "-"}</div>
                <div style="margin-top:10px;"><strong>Signed:</strong> ${treatmentPlan.signed_at ? fmtDateTime(treatmentPlan.signed_at) : "-"}</div>
              `
          }
        </div>

        <div class="section">
          <div class="section-title">Visit Summary</div>
          <div style="line-height:1.7;">
            ${patientSafeNarrative || "No patient summary available."}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Visit Images</div>
          ${imageBlocks || "<div>No visit images available.</div>"}
        </div>
      </body>
    </html>
  `;
  };

  const sendPatientCopyToPortal = async () => {
    if (packetMode !== "patient") {
      setErr("Switch to Patient Copy before sending to portal.");
      return;
    }

    setErr(null);
    setActionMessage(null);
    setSendingToPortal(true);

    try {
      const html = buildPatientPacketHtml();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      wrapper.style.position = "fixed";
      wrapper.style.left = "-99999px";
      wrapper.style.top = "0";
      wrapper.style.width = "900px";
      wrapper.style.background = "#fff";
      document.body.appendChild(wrapper);

      try {
        const pdfBlob = await renderElementPdfBlob(wrapper, {
          filename: `patient-visit-copy-${visitId}.pdf`,
        });

        const pdfFile = new File(
          [pdfBlob],
          `patient-visit-copy-${visitId}.pdf`,
          { type: "application/pdf" }
        );

        await uploadPatientFile({
          patientId,
          locationId,
          visitId,
          appointmentId: visit?.appointment_id ?? null,
          category: "visit_packet_patient_copy",
          file: pdfFile,
        });
      } finally {
        document.body.removeChild(wrapper);
      }

      setActionMessage("Patient PDF copy sent to portal files.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send patient PDF to portal."));
    } finally {
      setSendingToPortal(false);
    }
  };

  const sendClinicalCopyToInternalFiles = async () => {
    if (packetMode !== "clinical") {
      setErr("Switch to Clinical Copy before sending to internal files.");
      return;
    }

    setErr(null);
    setActionMessage(null);
    setSendingToPortal(true);

    try {
      const node = printRef.current;
      if (!node) throw new Error("Packet content not available.");

      const wrapper = document.createElement("div");
      wrapper.innerHTML = node.innerHTML;
      wrapper.style.position = "fixed";
      wrapper.style.left = "-99999px";
      wrapper.style.top = "0";
      wrapper.style.width = "900px";
      wrapper.style.background = "#fff";
      document.body.appendChild(wrapper);

      try {
        const pdfBlob = await renderElementPdfBlob(wrapper, {
          filename: `clinical-visit-copy-${visitId}.pdf`,
        });

        const pdfFile = new File(
          [pdfBlob],
          `clinical-visit-copy-${visitId}.pdf`,
          { type: "application/pdf" }
        );

        await uploadPatientFile({
          patientId,
          locationId,
          visitId,
          appointmentId: visit?.appointment_id ?? null,
          category: "clinical_packet_internal",
          file: pdfFile,
        });
      } finally {
        document.body.removeChild(wrapper);
      }

      setActionMessage("Clinical PDF sent to internal files.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send clinical PDF."));
    } finally {
      setSendingToPortal(false);
    }
  };

  const handlePrint = () => {
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
        .title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .subtitle {
          color: #555;
          margin-bottom: 24px;
          font-size: 13px;
        }
        .section {
          border: 1px solid #ddd;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .mini {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 10px;
        }
        img {
          max-width: 100%;
          border: 1px solid #ddd;
          border-radius: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border-bottom: 1px solid #ddd;
          text-align: left;
          padding: 8px;
          font-size: 13px;
        }
      </style>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Visit Clinical Packet</title>
          ${styles}
        </head>
        <body>
          <div class="title">
            Vitality Institute - ${packetMode === "patient" ? "Patient Copy" : "Clinical Copy"}
          </div>
          <div class="subtitle">
            ${packetMode === "patient"
              ? "Patient-safe visit summary and care instructions."
              : "Printable visit summary for charting, referral support, and PDF export."}
          </div>
          ${node.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="h2">
            {packetMode === "patient" ? "Visit Packet - Patient Copy" : "Visit Packet - Clinical Copy"}
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Printable summary for wound documentation, treatment planning, and reimbursement support.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            className={packetMode === "patient" ? "btn btn-primary" : "btn btn-ghost"}
            type="button"
            onClick={() => setPacketMode("patient")}
          >
            Patient Copy
          </button>

          <button
            className={packetMode === "clinical" ? "btn btn-primary" : "btn btn-ghost"}
            type="button"
            onClick={() => setPacketMode("clinical")}
          >
            Clinical Copy
          </button>

          <button
            className="btn btn-ghost"
            type="button"
            onClick={sendPatientCopyToPortal}
            disabled={sendingToPortal || packetMode !== "patient"}
          >
            {sendingToPortal ? "Sending PDF..." : "Send Patient PDF to Portal"}
          </button>

          <button
            className="btn btn-ghost"
            type="button"
            onClick={sendClinicalCopyToInternalFiles}
            disabled={sendingToPortal || packetMode !== "clinical"}
          >
            {sendingToPortal ? "Sending PDF..." : "Send Clinical PDF to Internal Files"}
          </button>

          <button className="btn btn-primary" type="button" onClick={handlePrint}>
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="space" />

      {actionMessage && <InlineNotice message={actionMessage} tone="success" style={{ marginBottom: 12 }} />}
      {loading && <div className="muted">Loading packet...</div>}
      {err && <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} />}

      {!loading && !err && (
        <div ref={printRef}>
          <div className="section">
            <div className="section-title">Visit Header</div>
            <div className="grid">
              <div className="mini">
                <div className="muted">Patient</div>
                <div style={{ fontWeight: 800 }}>{patientName}</div>
              </div>
              <div className="mini">
                <div className="muted">DOB</div>
                <div>{fmtDate(patient?.dob)}</div>
              </div>
              <div className="mini">
                <div className="muted">Visit Date</div>
                <div>{fmtDateTime(visit?.visit_date ?? visit?.created_at)}</div>
              </div>
              <div className="mini">
                <div className="muted">Visit Status</div>
                <div>{formatProviderStatusLabel(visit?.status)}</div>
              </div>
              <div className="mini">
                <div className="muted">Phone</div>
                <div>{patient?.phone ?? "-"}</div>
              </div>
              <div className="mini">
                <div className="muted">Email</div>
                <div>{patient?.email ?? "-"}</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Visit Summary</div>
            <div style={{ lineHeight: 1.7 }}>{visit?.summary ?? "No visit summary available."}</div>
          </div>

          <div className="section">
            <div className="section-title">Wound Assessment Summary</div>
            {wounds.length === 0 ? (
              <div>No wound assessments found for this visit.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {wounds.map((w) => (
                  <div key={w.id} className="mini">
                    <div style={{ fontWeight: 800 }}>{w.wound_label}</div>
                    <div style={{ marginTop: 6, lineHeight: 1.7 }}>
                      {[w.body_site, w.laterality, w.wound_type, w.stage].filter(Boolean).join(" | ") || "-"}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Size: {w.length_cm ?? "-"} x {w.width_cm ?? "-"} x {w.depth_cm ?? "-"} cm
                    </div>
                    <div>Area: {calcArea(w.length_cm, w.width_cm) ?? "-"} cm^2</div>
                    <div>Exudate: {w.exudate ?? "-"}</div>
                    <div>Odor: {w.odor ?? "-"}</div>
                    <div>Infection Signs: {w.infection_signs ?? "-"}</div>
                    <div>Pain: {w.pain_score ?? "-"}</div>
                    <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{w.notes ?? ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title">Healing Curve Table</div>
            {healingCurve.length === 0 ? (
              <div>No healing history available.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Wound</th>
                    <th>Body Site</th>
                    <th>Type</th>
                    <th>L x W x D</th>
                    <th>Area</th>
                  </tr>
                </thead>
                <tbody>
                  {healingCurve.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDateTime(r.created_at)}</td>
                      <td>{r.wound_label}</td>
                      <td>{[r.body_site, r.laterality].filter(Boolean).join(" | ") || "-"}</td>
                      <td>{r.wound_type ?? "-"}</td>
                      <td>{r.length_cm ?? "-"} x {r.width_cm ?? "-"} x {r.depth_cm ?? "-"}</td>
                      <td>{r.area_cm2 ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {packetMode === "clinical" ? (
            <div className="section">
              <div className="section-title">SOAP Summary</div>
              {!soap ? (
                <div>No SOAP note available.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div><strong>Subjective:</strong> {soap.subjective ?? "-"}</div>
                  <div><strong>Objective:</strong> {soap.objective ?? "-"}</div>
                  <div><strong>Assessment:</strong> {soap.assessment ?? "-"}</div>
                  <div><strong>Plan:</strong> {soap.plan ?? "-"}</div>
                  <div><strong>Signed:</strong> {soap.signed_at ? fmtDateTime(soap.signed_at) : "-"}</div>
                </div>
              )}
            </div>
          ) : null}

          <div className="section">
            <div className="section-title">
              {packetMode === "patient" ? "Care Instructions" : "Treatment Plan"}
            </div>
            {!treatmentPlan ? (
              <div>No treatment plan available.</div>
            ) : packetMode === "patient" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div><strong>Status:</strong> {formatProviderStatusLabel(treatmentPlan.status)}</div>
                <div><strong>Summary:</strong> {treatmentPlan.summary ?? "-"}</div>
                <div><strong>Patient Instructions:</strong> {treatmentPlan.patient_instructions ?? "-"}</div>
                <div><strong>Signed:</strong> {treatmentPlan.signed_at ? fmtDateTime(treatmentPlan.signed_at) : "-"}</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div><strong>Status:</strong> {formatProviderStatusLabel(treatmentPlan.status)}</div>
                <div><strong>Summary:</strong> {treatmentPlan.summary ?? "-"}</div>
                <div><strong>Patient Instructions:</strong> {treatmentPlan.patient_instructions ?? "-"}</div>
                <div><strong>Internal Notes:</strong> {treatmentPlan.internal_notes ?? "-"}</div>
                <div><strong>Signed:</strong> {treatmentPlan.signed_at ? fmtDateTime(treatmentPlan.signed_at) : "-"}</div>
                <div>
                  <strong>Structured Plan:</strong>
                  <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }}>
                    {JSON.stringify(treatmentPlan.plan ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title">
              {packetMode === "patient" ? "Visit Summary" : "Clinical Narrative / Support"}
            </div>
            <div style={{ lineHeight: 1.7 }}>
              {packetMode === "patient"
                ? patientSafeNarrative || "No patient summary available."
                : narrative || "No narrative available."}
            </div>
          </div>

          <div className="section">
            <div className="section-title">
              {packetMode === "patient" ? "Visit Images" : "Attached Images / Files"}
            </div>
            {visibleFiles.length === 0 ? (
              <div>No attached visit files.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {visibleFiles.map((f) => (
                  <div key={f.id} className="mini">
                    <div style={{ fontWeight: 800 }}>{f.filename}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      {f.category ?? "file"} | {fmtDateTime(f.created_at)}
                    </div>
                    {isImageFile(f) && fileUrls[f.id] ? (
                      <img
                        src={fileUrls[f.id]}
                        alt={f.filename}
                        style={{ marginTop: 10, width: "100%", maxWidth: 320 }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
