// src/pages/PatientLabs.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getPatientRecordIdForProfile } from "../lib/patientRecords";
import { uploadPatientFile } from "../lib/patientFiles";
import { supabase } from "../lib/supabase";
import logo from "../assets/vitality-logo.png";

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
type PatientSummaryRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "-";
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? value : next.toLocaleDateString();
}

function formatDisplayDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? value : next.toLocaleString();
}

async function renderPdfBlob(element: HTMLElement, filename: string) {
  const { default: html2pdf } = await import("html2pdf.js");

  return (await html2pdf()
    .set({
      margin: 0.35,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: {
        unit: "in",
        format: "letter",
        orientation: "portrait",
      },
    })
    .from(element)
    .outputPdf("blob")) as Blob;
}

export default function PatientLabs() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const prefillIntakeId = params.get("intakeId") ?? "";
  const prefillApptId = params.get("appointmentId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [patientSummary, setPatientSummary] = useState<PatientSummaryRow | null>(null);

  const [panels, setPanels] = useState<PanelRow[]>([]);
  const [markers, setMarkers] = useState<MarkerRow[]>([]);

  const [panelId, setPanelId] = useState("");
  const [appointmentId, setAppointmentId] = useState(prefillApptId);
  const [intakeId, setIntakeId] = useState(prefillIntakeId);
  const [labSource, setLabSource] = useState("");
  const [labSourceOther, setLabSourceOther] = useState("");

  const [collectedOn, setCollectedOn] = useState<string>("");

  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

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
  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === appointmentId) ?? null,
    [appointmentId, appointments]
  );
  const resolvedLocationId = useMemo(
    () => selectedAppointment?.location_id ?? locations[0]?.id ?? "",
    [locations, selectedAppointment]
  );
  const resolvedLocationName = useMemo(
    () => (resolvedLocationId ? locName(resolvedLocationId) : "-"),
    [locName, resolvedLocationId]
  );
  const selectedLabSourceLabel = useMemo(() => {
    if (!labSource) return "-";
    if (labSource === "Other local lab" && labSourceOther.trim()) return labSourceOther.trim();
    return labSource;
  }, [labSource, labSourceOther]);
  const patientName = useMemo(() => {
    if (!patientSummary) return user?.email ?? "Patient";
    const fullName = `${patientSummary.first_name ?? ""} ${patientSummary.last_name ?? ""}`.trim();
    return fullName || patientSummary.email || user?.email || "Patient";
  }, [patientSummary, user?.email]);

  const setVal = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));

  const openPrintPreview = () => {
    const node = printRef.current;
    if (!node) return;

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setErr("Popup blocked. Allow popups to print or save the lab PDF.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Touch of Vitality Lab Form</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; background: #fff; }
            .pdf-shell { max-width: 900px; margin: 0 auto; }
            .pdf-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
            .pdf-header img { width: 72px; height: 72px; object-fit: contain; }
            .pdf-title { font-size: 28px; font-weight: 700; }
            .pdf-sub { color: #555; font-size: 13px; margin-top: 4px; }
            .pdf-section { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
            .pdf-section h3 { margin: 0 0 12px; font-size: 18px; }
            .pdf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .pdf-mini { border: 1px solid #ddd; border-radius: 10px; padding: 10px; }
            .pdf-mini-label { color: #666; font-size: 12px; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 8px; font-size: 13px; }
          </style>
        </head>
        <body>
          ${node.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const uploadInternalPdf = async (patientId: string, locationId: string, resultId: string) => {
    const node = printRef.current;
    if (!node) throw new Error("Lab form preview is not available.");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = node.innerHTML;
    wrapper.style.position = "fixed";
    wrapper.style.left = "-99999px";
    wrapper.style.top = "0";
    wrapper.style.width = "900px";
    wrapper.style.background = "#fff";
    document.body.appendChild(wrapper);

    try {
      const panelLabel = panelName(panelId).replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "lab-panel";
      const pdfBlob = await renderPdfBlob(wrapper, `touch-of-vitality-lab-form-${panelLabel}.pdf`);
      const pdfFile = new File(
        [pdfBlob],
        `touch-of-vitality-lab-form-${panelLabel}-${resultId}.pdf`,
        { type: "application/pdf" }
      );

      await uploadPatientFile({
        patientId,
        locationId,
        visitId: null,
        appointmentId: appointmentId || null,
        category: "lab_form_internal",
        file: pdfFile,
      });
    } finally {
      document.body.removeChild(wrapper);
    }
  };

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
      const patientId = await getPatientRecordIdForProfile(user.id);
      if (!patientId) {
        setErr("Patient record not found.");
        setLoading(false);
        return;
      }

      const { data: patientRow, error: patientErr } = await supabase
        .from("patients")
        .select("id,first_name,last_name,email")
        .eq("id", patientId)
        .maybeSingle();

      if (patientErr) {
        setErr(patientErr.message);
        setLoading(false);
        return;
      }
      setPatientSummary((patientRow as PatientSummaryRow) ?? null);

      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select("id,location_id,start_time,status")
        .eq("patient_id", patientId)
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
    if (!labSource) return setErr("Please select the lab source.");
    if (labSource === "Other local lab" && !labSourceOther.trim()) return setErr("Please enter the lab name.");
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

    const patientId = await getPatientRecordIdForProfile(user.id);
    if (!patientId) {
      setSaving(false);
      return setErr("Patient record not found.");
    }

    try {
      const { data, error } = await supabase
        .from("lab_results")
        .insert([
          {
            location_id: locationId,
            patient_id: patientId,
            appointment_id: appointmentId || null,
            intake_submission_id: intakeId || null,
            panel_id: panelId,
            lab_source: labSource || null,
            lab_source_other: labSource === "Other local lab" ? labSourceOther.trim() || null : null,
            status: "submitted",
            collected_on: collectedOn || null,
            values,
          },
        ])
        .select("id")
        .single();

      if (error) return setErr(error.message);

      setPdfBusy(true);
      await uploadInternalPdf(patientId, locationId, data.id);

      nav("/patient/home", { replace: true, state: { patientNotice: "Labs submitted successfully. An internal PDF copy was also saved.", patientNoticeTone: "success" } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save the internal PDF copy.";
      setErr(message);
    } finally {
      setPdfBusy(false);
      setSaving(false);
    }
  };

  const formSurfaceStyle = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(233,225,255,0.05))",
    border: "1px solid rgba(214,197,255,0.16)",
  };

  const markerGroupStyle = {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(248,245,255,0.05)",
    border: "1px solid rgba(214,197,255,0.12)",
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
          <div className="sub">Patient lab intake and appointment-linked lab submissions.</div>
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
      <div className="k">Submission Mode</div>
      <div className="v">Patient Entered</div>
    </div>
    <div className="v-stat">
      <div className="k">Linked Appointment</div>
      <div className="v">{appointmentId ? "Attached" : "Optional"}</div>
    </div>
    <div className="v-stat">
      <div className="k">Intake Context</div>
      <div className="v">{intakeId ? "Linked" : "Optional"}</div>
    </div>
    <div className="v-stat">
      <div className="k">Status</div>
      <div className="v">Ready to Submit</div>
    </div>
  </div>
</div>
<div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="h2">Submit Lab Snapshot</div>
              <div className="muted patient-section-intro">
                Mostly dropdown selections to minimize freehand input.
              </div>
              <div className="muted patient-helper-text">
                If your results came from Labcorp or Quest, use this form to capture the panel values. If they came from another local lab,
                you can still submit them here.
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "1 1 260px" }} value={panelId} onChange={(e) => setPanelId(e.target.value)}>
                  <option value="">Select a lab panel</option>
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
                      {new Date(a.start_time).toLocaleString()} - {locName(a.location_id)} - {a.status}
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

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "1 1 260px" }} value={labSource} onChange={(e) => setLabSource(e.target.value)}>
                  <option value="">Select Labcorp, Quest, or another local lab</option>
                  <option value="Labcorp">Labcorp</option>
                  <option value="Quest">Quest</option>
                  <option value="Other local lab">Other local lab</option>
                </select>

                {labSource === "Other local lab" ? (
                  <input
                    className="input"
                    style={{ flex: "2 1 320px" }}
                    value={labSourceOther}
                    onChange={(e) => setLabSourceOther(e.target.value)}
                    placeholder="Enter the lab name if it was not Labcorp or Quest"
                  />
                ) : null}
              </div>

              <div className="muted patient-helper-text">
                Common sources include Labcorp, Quest, and other local labs.
              </div>

              <div className="space" />

              <div className="card card-pad" style={formSurfaceStyle}>
                <div className="h2">{panelName(panelId)}</div>
                <div className="muted patient-section-intro patient-mini-note">
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
                        <div key={mk.id} style={markerGroupStyle}>
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
                      <div key={mk.id} style={markerGroupStyle}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          {mk.label} {mk.unit ? `(${mk.unit})` : ""}
                        </div>
                        <select className="input" value={v ?? ""} onChange={(e) => setVal(mk.key, e.target.value)}>
                          <option value="">Select...</option>
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

              <div className="card card-pad" style={formSurfaceStyle}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="h2">Lab Form PDF Preview</div>
                    <div className="muted patient-section-intro patient-mini-note">
                      After submission, this completed form will be converted into an internal PDF copy for Touch of Vitality.
                    </div>
                  </div>

                  <button className="btn btn-ghost" type="button" onClick={openPrintPreview} disabled={!panelId}>
                    Print / Save PDF
                  </button>
                </div>

                <div className="space" />

                <div ref={printRef} className="pdf-shell" style={{ background: "#fff", color: "#111" }}>
                  <div className="pdf-header" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                    <img src={logo} alt="Vitality Institute" style={{ width: 72, height: 72, objectFit: "contain" }} />
                    <div>
                      <div className="pdf-title" style={{ fontSize: 28, fontWeight: 700 }}>Touch of Vitality Lab Form</div>
                      <div className="pdf-sub" style={{ color: "#555", fontSize: 13, marginTop: 4 }}>
                        Completed patient lab snapshot for internal review and PDF filing.
                      </div>
                    </div>
                  </div>

                  <div className="pdf-section section">
                    <div className="section-title">Patient and Order Details</div>
                    <div className="pdf-grid grid">
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Patient</div>
                        <div>{patientName}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Email</div>
                        <div>{patientSummary?.email ?? user?.email ?? "-"}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Panel</div>
                        <div>{panelName(panelId)}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Lab source</div>
                        <div>{selectedLabSourceLabel}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Collected on</div>
                        <div>{formatDisplayDate(collectedOn)}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Location</div>
                        <div>{resolvedLocationName}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Appointment</div>
                        <div>{selectedAppointment ? formatDisplayDateTime(selectedAppointment.start_time) : "Not linked"}</div>
                      </div>
                      <div className="pdf-mini mini">
                        <div className="pdf-mini-label muted">Intake ID</div>
                        <div>{intakeId || "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pdf-section section">
                    <div className="section-title">Submitted Lab Values</div>
                    {panelMarkers.length === 0 ? (
                      <div className="muted">No markers selected yet.</div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Marker</th>
                            <th>Value</th>
                            <th>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {panelMarkers.map((marker) => (
                            <tr key={marker.id}>
                              <td>{marker.label}</td>
                              <td>{values[marker.key] ?? "-"}</td>
                              <td>{marker.unit ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <div className="space" />

              <button className="btn btn-primary" onClick={submit} disabled={saving || pdfBusy}>
                {saving || pdfBusy ? "Submitting..." : "Submit Labs and Save Internal PDF"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}




