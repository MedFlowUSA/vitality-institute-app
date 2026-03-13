// src/pages/ProviderPatientCenter.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import SystemStatusBar from "../components/SystemStatusBar";
import InsightRibbon from "../components/InsightRibbon";
import { uploadPatientFile, getSignedUrl } from "../lib/patientFiles";
import { auditWrite } from "../lib/audit";

import SoapNotePanel from "../components/SoapNotePanel";
import TreatmentPlanSection from "../components/provider/TreatmentPlanSection";
import VisitTimelinePanel from "../components/VisitTimelinePanel";
import WoundPhotosPanel from "../components/provider/WoundPhotosPanel";
import WoundAssessmentPanel from "../components/provider/WoundAssessmentPanel";
import WoundHealingCurvePanel from "../components/provider/WoundHealingCurvePanel";
import IVRPacketPanel from "../components/provider/IVRPacketPanel";
import ChargeCapturePanel from "../components/provider/ChargeCapturePanel";
import { calculateHealingTrend, getWoundHistory, type WoundObservation } from "../lib/vital-ai/woundTracking";

type VisitRow = {
  id: string;
  patient_id: string;
  location_id: string;
  appointment_id: string | null;
  visit_date: string; // timestamptz
  status: string | null;
  summary: string | null;
  created_at: string;
};

// If your view exists, we prefer this
type VisitTimelineRow = {
  visit_id: string;
  patient_id: string;
  location_id: string;
  visit_date: string;
  visit_status: string | null;
  summary: string | null;

  soap_id: string | null;
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
  soap_created_at: string | null;
};

type FileRow = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_id: string | null;
  uploaded_by: string | null;
  bucket: string;
  path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  category: string | null;
  is_internal: boolean;
  notes: string | null;
  created_at: string;
};

type NoteRow = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_id: string | null;
  note_type: string | null;
  body: string;
  created_at: string;
  created_by: string;
};

type DemoRow = {
  patient_id: string;
  dob: string | null; // date
  sex: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type InsuranceRow = {
  id: string;
  patient_id: string;
  payer_name: string | null;
  member_id: string | null;
  group_id: string | null;
  plan_name: string | null;
  is_primary: boolean;
  created_at: string;
};

type AlertRow = {
  id: string;
  patient_id: string;
  alert_type: string | null;
  label: string;
  severity: string | null; // low/medium/high
  is_active: boolean;
  created_at: string;
};

type LabRow = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_id: string | null;
  lab_name: string;
  status: string;
  ordered_at: string;
  result_file_id: string | null; // references patient_files.id
  result_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PatientTab = "overview" | "wound" | "soap" | "plan" | "labs" | "notes" | "files" | "photos" | "ivr" | "charges";

export default function ProviderPatientCenter() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const params = useParams<{ patientId?: string; visitId?: string }>();
  const patientIdFromRoute = params.patientId ?? "";
  const visitIdFromRoute = params.visitId ?? "";
  const [resolvedPatientId, setResolvedPatientId] = useState<string>(patientIdFromRoute);
  const patientId = resolvedPatientId || patientIdFromRoute;

  const [tab, setTab] = useState<PatientTab>("overview");

  // Timeline (prefer v_patient_visit_timeline; fallback to patient_visits)
  const [timeline, setTimeline] = useState<VisitTimelineRow[]>([]);
  const [visitsFallback, setVisitsFallback] = useState<VisitRow[]>([]);
  const [activeVisitId, setActiveVisitId] = useState<string>("");

  const [files, setFiles] = useState<FileRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [labs, setLabs] = useState<LabRow[]>([]);

  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [insurance, setInsurance] = useState<InsuranceRow | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [woundHistory, setWoundHistory] = useState<WoundObservation[]>([]);
  const [woundImageUrls, setWoundImageUrls] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // NOTES (create)
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState<"clinical" | "admin" | "billing">("clinical");
  const [savingNote, setSavingNote] = useState(false);

  // FILES (upload)
  const [uploading, setUploading] = useState(false);
  const [fileNotes, setFileNotes] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  // LABS (create)
  const [labName, setLabName] = useState("");
  const [labStatus, setLabStatus] = useState<"ordered" | "collected" | "resulted" | "reviewed" | "cancelled">(
    "ordered"
  );
  const [labSaving, setLabSaving] = useState(false);
  const [labUpdatingId, setLabUpdatingId] = useState<string | null>(null);

  // LABS v2 (per-row upload + summary)
  const [labPickedFiles, setLabPickedFiles] = useState<Record<string, File | null>>({});
  const [labUploadingId, setLabUploadingId] = useState<string | null>(null);
  const [labSummaryDrafts, setLabSummaryDrafts] = useState<Record<string, string>>({});
  const [labBusyId, setLabBusyId] = useState<string | null>(null);

  const authNotReady = !role;

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const calcAge = (dob?: string | null) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const fmtDob = (dob?: string | null) => {
    if (!dob) return "—";
    const d = new Date(dob);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  const addrLine = () => {
    if (!demo) return "—";
    const parts = [
      demo.address_line1,
      demo.address_line2,
      [demo.city, demo.state, demo.zip].filter(Boolean).join(" "),
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };

  const filesByVisit = useMemo(() => {
    const map = new Map<string, FileRow[]>();
    for (const f of files) {
      const key = f.visit_id ?? "general";
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      map.set(k, arr);
    }
    return map;
  }, [files]);

  const notesByVisit = useMemo(() => {
    const map = new Map<string, NoteRow[]>();
    for (const n of notes) {
      const key = n.visit_id ?? "general";
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      map.set(k, arr);
    }
    return map;
  }, [notes]);

  const labsByVisit = useMemo(() => {
    const map = new Map<string, LabRow[]>();
    for (const l of labs) {
      const key = l.visit_id ?? "general";
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      map.set(k, arr);
    }
    return map;
  }, [labs]);

  const activeTimelineVisit = timeline.find((t) => t.visit_id === activeVisitId) ?? null;
  const activeVisitFallback = visitsFallback.find((v) => v.id === activeVisitId) ?? null;

  const activeVisit = useMemo(() => {
    if (activeTimelineVisit) {
      return {
        id: activeTimelineVisit.visit_id,
        patient_id: activeTimelineVisit.patient_id,
        location_id: activeTimelineVisit.location_id,
        visit_date: activeTimelineVisit.visit_date,
        status: activeTimelineVisit.visit_status,
        summary: activeTimelineVisit.summary,
      };
    }
    if (activeVisitFallback) {
      return {
        id: activeVisitFallback.id,
        patient_id: activeVisitFallback.patient_id,
        location_id: activeVisitFallback.location_id,
        visit_date: activeVisitFallback.visit_date,
        status: activeVisitFallback.status,
        summary: activeVisitFallback.summary,
      };
    }
    return null;
  }, [activeTimelineVisit, activeVisitFallback]);

  const locationId = activeVisit?.location_id ?? timeline[0]?.location_id ?? visitsFallback[0]?.location_id ?? "";

  const snapshot = useMemo(() => {
    const vid = activeVisitId || "general";
    const vLabs = labsByVisit.get(vid) ?? [];
    const vNotes = notesByVisit.get(vid) ?? [];
    const vFiles = filesByVisit.get(vid) ?? [];

    const tl = timeline.find((x) => x.visit_id === activeVisitId) ?? null;
    const soapVal = !activeVisitId
      ? "—"
      : tl?.soap_id
      ? tl.is_locked || tl.is_signed
        ? "Signed"
        : "Draft"
      : "None";

    return {
      soap: soapVal,
      labs: vLabs.length,
      notes: vNotes.length,
      files: vFiles.length,
    };
  }, [activeVisitId, timeline, labsByVisit, notesByVisit, filesByVisit]);

  const woundTrend = useMemo(() => calculateHealingTrend(woundHistory), [woundHistory]);

  const TabButton = ({ id, label }: { id: PatientTab; label: string }) => {
    const active = tab === id;
    return (
      <button
        type="button"
        className={active ? "btn btn-primary" : "btn btn-ghost"}
        onClick={() => setTab(id)}
        disabled={!activeVisitId && id !== "overview"}
        title={!activeVisitId && id !== "overview" ? "Select a visit first" : undefined}
      >
        {label}
      </button>
    );
  };

  const loadAll = async (opts?: { setDefaultActiveVisit?: boolean }) => {
    if (!patientId) return;
    setErr(null);
    setLoading(true);

    try {
      // DEMO
      const { data: d, error: dErr } = await supabase
        .from("patient_demographics")
        .select("patient_id,dob,sex,email,phone,address_line1,address_line2,city,state,zip")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (dErr) throw dErr;
      setDemo((d as DemoRow) ?? null);

      // INSURANCE
      const { data: ins, error: insErr } = await supabase
        .from("patient_insurance")
        .select("id,patient_id,payer_name,member_id,group_id,plan_name,is_primary,created_at")
        .eq("patient_id", patientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (insErr) throw insErr;
      setInsurance((ins?.[0] as InsuranceRow) ?? null);

      // ALERTS
      const { data: al, error: alErr } = await supabase
        .from("patient_alerts")
        .select("id,patient_id,alert_type,label,severity,is_active,created_at")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (alErr) throw alErr;
      setAlerts((al as AlertRow[]) ?? []);

      // TIMELINE (preferred)
      let timelineRows: VisitTimelineRow[] = [];
      let hasTimelineView = true;

      const { data: tl, error: tlErr } = await supabase
        .from("v_patient_visit_timeline")
        .select(
          "visit_id,patient_id,location_id,visit_date,visit_status,summary,soap_id,is_signed,is_locked,signed_at,soap_created_at"
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      if (tlErr) {
        // View missing or column mismatch — fall back to patient_visits
        hasTimelineView = false;
        setTimeline([]);
        console.warn("v_patient_visit_timeline not available, falling back to patient_visits:", tlErr.message);

        const { data: v, error: vErr } = await supabase
          .from("patient_visits")
          .select("id,patient_id,location_id,appointment_id,visit_date,status,summary,created_at")
          .eq("patient_id", patientId)
          .order("visit_date", { ascending: false });

        if (vErr) throw vErr;
        const visitRows = (v as VisitRow[]) ?? [];
        setVisitsFallback(visitRows);

        if (opts?.setDefaultActiveVisit && !activeVisitId && visitRows.length > 0) {
          setActiveVisitId(visitRows[0].id);
        }
      } else {
        timelineRows = (tl as VisitTimelineRow[]) ?? [];
        setTimeline(timelineRows);
        setVisitsFallback([]); // we don’t need fallback if view works

        if (opts?.setDefaultActiveVisit && !activeVisitId && timelineRows.length > 0) {
          setActiveVisitId(timelineRows[0].visit_id);
        }
      }

      // FILES
      const { data: f, error: fErr } = await supabase
        .from("patient_files")
        .select(
          "id,created_at,location_id,patient_id,visit_id,uploaded_by,bucket,path,filename,content_type,size_bytes,category,is_internal,notes"
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (fErr) throw fErr;
      setFiles((f as FileRow[]) ?? []);

      // NOTES
      const { data: n, error: nErr } = await supabase
        .from("patient_visit_notes")
        .select("id,patient_id,location_id,visit_id,note_type,body,created_at,created_by")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (nErr) throw nErr;
      setNotes((n as NoteRow[]) ?? []);

      // LABS
      const { data: l, error: lErr } = await supabase
        .from("patient_labs")
        .select(
          "id,patient_id,location_id,visit_id,lab_name,status,ordered_at,result_file_id,result_summary,created_by,created_at,updated_at"
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (lErr) throw lErr;

      const labRows = (l as LabRow[]) ?? [];
      setLabs(labRows);

      const nextWoundHistory = await getWoundHistory(patientId);
      setWoundHistory(nextWoundHistory);

      // seed drafts once
      const seeded: Record<string, string> = {};
      for (const r of labRows) {
        if (r.result_summary && !seeded[r.id]) seeded[r.id] = r.result_summary;
      }
      setLabSummaryDrafts((prev) => ({ ...seeded, ...prev }));

      // if timeline view exists and is empty, still keep a clean state
      if (hasTimelineView && timelineRows.length === 0) {
        // leave activeVisitId as-is
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load patient center.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResolvedPatientId(patientIdFromRoute);
  }, [patientIdFromRoute]);

  useEffect(() => {
    if (!visitIdFromRoute) return;

    let cancelled = false;

    (async () => {
      const { data: visit, error: vErr } = await supabase
        .from("patient_visits")
        .select("id,patient_id,location_id,appointment_id,visit_date,status")
        .eq("id", visitIdFromRoute)
        .maybeSingle();

      if (cancelled) return;

      if (vErr) {
        setErr(vErr.message);
        return;
      }

      if (!visit?.id || !visit.patient_id) {
        setErr("Visit not found.");
        return;
      }

      setResolvedPatientId(visit.patient_id);
      setActiveVisitId(visit.id);

      await auditWrite({
        event_type: "visit_opened",
        location_id: visit.location_id,
        patient_id: visit.patient_id,
        visit_id: visit.id,
        entity_type: "patient_visits",
        entity_id: visit.id,
        metadata: { route_visit_id: visitIdFromRoute },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [visitIdFromRoute]);

  useEffect(() => {
    if (!patientId) return;
    loadAll({ setDefaultActiveVisit: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;

    const loadWoundImageUrls = async () => {
      const imageFiles = woundHistory.flatMap((entry) => entry.images);
      if (imageFiles.length === 0) {
        setWoundImageUrls({});
        return;
      }

      const entries = await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const url = await getSignedUrl(file.bucket, file.path, 120);
            return [file.id, url] as const;
          } catch {
            return [file.id, ""] as const;
          }
        })
      );

      if (cancelled) return;
      setWoundImageUrls(
        entries.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, {})
      );
    };

    loadWoundImageUrls();

    return () => {
      cancelled = true;
    };
  }, [woundHistory]);

  const createVisit = async () => {
    if (!patientId) return;
    setErr(null);

    const fallbackLocationId =
      locationId ||
      timeline[0]?.location_id ||
      visitsFallback[0]?.location_id ||
      null;

    if (!fallbackLocationId) {
      setErr("No location found for this patient yet. Create a visit from an appointment or set a location.");
      return;
    }

    const { data, error } = await supabase
      .from("patient_visits")
      .insert([
        {
          patient_id: patientId,
          location_id: fallbackLocationId,
          visit_date: new Date().toISOString(),
          status: "open",
          summary: "New visit",
        },
      ])
      .select("id,patient_id,location_id,appointment_id,visit_date,status,summary,created_at")
      .maybeSingle();

    if (error) return setErr(error.message);

    // Reload so timeline view picks up the new visit (and any soap joins)
    await loadAll({ setDefaultActiveVisit: false });

    const newVisitId = (data as VisitRow | null)?.id ?? null;
    if (newVisitId) {
      setActiveVisitId(newVisitId);
      setTab("overview");
    }
  };

  const addNote = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!noteBody.trim()) return;
    if (!activeVisitId) return setErr("Select a visit first.");

    const locId = activeVisit?.location_id ?? locationId ?? null;
    if (!locId) return setErr("Missing location for note.");

    setSavingNote(true);
    setErr(null);

    const { error } = await supabase.from("patient_visit_notes").insert([
      {
        patient_id: patientId,
        location_id: locId,
        visit_id: activeVisitId,
        note_type: noteType,
        body: noteBody.trim(),
        created_by: user.id,
      },
    ]);

    setSavingNote(false);
    if (error) return setErr(error.message);

    await auditWrite({
      event_type: "note_created",
      location_id: locId,
      patient_id: patientId,
      visit_id: activeVisitId,
      entity_type: "patient_visit_notes",
      metadata: { note_type: noteType },
    });

    setNoteBody("");
    await loadAll();
  };

  const openFile = async (f: FileRow) => {
    try {
      const url = await getSignedUrl(f.bucket, f.path, 120);
      await auditWrite({
        event_type: "file_opened",
        location_id: f.location_id,
        patient_id: f.patient_id,
        visit_id: f.visit_id,
        entity_type: "patient_files",
        entity_id: f.id,
        metadata: { filename: f.filename, category: f.category },
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to open file.");
    }
  };

  const upload = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!pickedFile) return;
    if (!patientId) return;
    if (!activeVisitId) return setErr("Select a visit first.");

    const locId = activeVisit?.location_id ?? locationId ?? null;
    if (!locId) return setErr("Missing location for upload.");

    setUploading(true);
    setErr(null);

    try {
      const { bucket, path } = await uploadPatientFile({
        file: pickedFile,
        locationId: locId,
        patientId,
        visitId: activeVisitId,
        category: "general",
      });

      const { error } = await supabase.from("patient_files").insert([
        {
          patient_id: patientId,
          location_id: locId,
          visit_id: activeVisitId,
          uploaded_by: user.id,
          bucket,
          path,
          filename: pickedFile.name,
          content_type: pickedFile.type || null,
          size_bytes: pickedFile.size || null,
          category: null,
          is_internal: false,
          notes: fileNotes.trim() || null,
        },
      ]);

      if (error) throw error;

      setPickedFile(null);
      setFileNotes("");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // LABS
  const createLab = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!activeVisitId) return setErr("Select a visit first.");
    if (!labName.trim()) return;

    const locId = activeVisit?.location_id ?? locationId ?? null;
    if (!locId) return setErr("Missing location for lab order.");

    setLabSaving(true);
    setErr(null);

    try {
      const { error } = await supabase.from("patient_labs").insert([
        {
          patient_id: patientId,
          location_id: locId,
          visit_id: activeVisitId,
          lab_name: labName.trim(),
          status: labStatus,
          created_by: user.id,
        },
      ]);
      if (error) throw error;

      await auditWrite({
        event_type: "lab_created",
        location_id: locId,
        patient_id: patientId,
        visit_id: activeVisitId,
        entity_type: "patient_labs",
        metadata: { lab_name: labName.trim(), status: labStatus },
      });

      setLabName("");
      setLabStatus("ordered");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create lab order.");
    } finally {
      setLabSaving(false);
    }
  };

  const updateLabStatus = async (labId: string, status: string) => {
    setLabUpdatingId(labId);
    setErr(null);
    try {
      const { error } = await supabase.from("patient_labs").update({ status }).eq("id", labId);
      if (error) throw error;
      const locId = activeVisit?.location_id ?? locationId ?? null;
      if (locId) {
        await auditWrite({
          event_type: "lab_status_updated",
          location_id: locId,
          patient_id: patientId,
          visit_id: activeVisitId,
          entity_type: "patient_labs",
          entity_id: labId,
          metadata: { status },
        });
      }
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update lab.");
    } finally {
      setLabUpdatingId(null);
    }
  };

  const attachResultFile = async (labId: string, fileId: string | null) => {
    setLabBusyId(labId);
    setErr(null);
    try {
      const { error } = await supabase.from("patient_labs").update({ result_file_id: fileId }).eq("id", labId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to attach result file.");
    } finally {
      setLabBusyId(null);
    }
  };

  const saveLabSummary = async (labId: string, summary: string) => {
    setLabBusyId(labId);
    setErr(null);
    try {
      const { error } = await supabase
        .from("patient_labs")
        .update({ result_summary: summary.trim() || null })
        .eq("id", labId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save lab summary.");
    } finally {
      setLabBusyId(null);
    }
  };

  const openLabResult = async (lab: LabRow) => {
    if (!lab.result_file_id) return;
    const f = files.find((x) => x.id === lab.result_file_id);
    if (!f) return setErr("Result file not found.");
    await openFile(f);
  };

  const uploadLabResult = async (lab: LabRow) => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!activeVisitId) return setErr("Select a visit first.");

    const file = labPickedFiles?.[lab.id] ?? null;
    if (!file) return;

    setLabUploadingId(lab.id);
    setErr(null);

    try {
      const { bucket, path } = await uploadPatientFile({
        file,
        locationId: lab.location_id,
        patientId,
        visitId: lab.visit_id || activeVisitId,
        category: "lab_result",
      });

      const { data: inserted, error: insErr } = await supabase
        .from("patient_files")
        .insert([
          {
            patient_id: patientId,
            location_id: lab.location_id,
            visit_id: lab.visit_id || activeVisitId,
            uploaded_by: user.id,
            bucket,
            path,
            filename: file.name,
            content_type: file.type || null,
            size_bytes: file.size || null,
            category: "lab_result",
            is_internal: false,
            notes: `Lab result: ${lab.lab_name}`,
          },
        ])
        .select("id")
        .maybeSingle();

      if (insErr) throw insErr;
      const fileId = inserted?.id as string | undefined;
      if (!fileId) throw new Error("Could not create patient_files row.");

      const { error: linkErr } = await supabase.from("patient_labs").update({ result_file_id: fileId }).eq("id", lab.id);
      if (linkErr) throw linkErr;

      await auditWrite({
        event_type: "lab_result_uploaded",
        location_id: lab.location_id,
        patient_id: patientId,
        visit_id: lab.visit_id || activeVisitId,
        entity_type: "patient_labs",
        entity_id: lab.id,
        metadata: { lab_name: lab.lab_name, file_id: fileId },
      });

      setLabPickedFiles((prev) => ({ ...prev, [lab.id]: null }));
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to upload lab result.");
    } finally {
      setLabUploadingId(null);
    }
  };

  const visitFilesForAttach = useMemo(() => {
    const visitSpecific = filesByVisit.get(activeVisitId || "general") ?? [];
    const general = filesByVisit.get("general") ?? [];
    const merged = [...visitSpecific, ...general];
    const seen = new Set<string>();
    return merged.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }, [filesByVisit, activeVisitId]);

  const age = calcAge(demo?.dob);


  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Patient Center"
          subtitle="Visits • SOAP • Plan • Labs • Notes • Files"
          secondaryCta={{ label: "Back", to: "/provider" }}
          primaryCta={{ label: "AI Plan Builder", to: "/provider/ai" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={true}
        />

        <SystemStatusBar />
        <div className="space" />

        <InsightRibbon
          title="Patient Center"
          subtitle="High-signal snapshot for the active visit"
          status={activeVisit ? "Visit Active" : "No Visit Selected"}
          kpis={[
            { label: "SOAP", value: snapshot.soap },
            { label: "Labs", value: String(snapshot.labs) },
            { label: "Notes", value: String(snapshot.notes) },
            { label: "Files", value: String(snapshot.files) },
          ]}
          right={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => setTab("soap")} disabled={!activeVisitId}>
                Go SOAP
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setTab("plan")} disabled={!activeVisitId}>
                Go Plan
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setTab("labs")} disabled={!activeVisitId}>
                Go Labs
              </button>
            </>
          }
        />

        <div className="space" />

        {authNotReady ? (
          <div className="card card-pad">
            <div className="h2">Finalizing profile…</div>
            <div className="muted" style={{ marginTop: 6 }}>
              If this doesn’t clear, your AuthProvider is waiting on a profile row that’s missing or blocked by RLS.
            </div>
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Patient ID: {patientId || "—"}
            </div>
          </div>
        ) : (
          <>
            <div className="card card-pad">
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}
              >
                <div style={{ flex: "1 1 520px" }}>
                  <div className="h1">Patient</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    ID: {patientId}
                  </div>

                  <div className="space" />

                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div className="v-chip">
                      DOB: <strong>{fmtDob(demo?.dob)}</strong>
                    </div>
                    <div className="v-chip">
                      Age: <strong>{age ?? "—"}</strong>
                    </div>
                    <div className="v-chip">
                      Phone: <strong>{demo?.phone ?? "—"}</strong>
                    </div>
                    <div className="v-chip">
                      Email: <strong>{demo?.email ?? "—"}</strong>
                    </div>
                    <div className="v-chip">
                      Insurance:{" "}
                      <strong>
                        {insurance?.payer_name
                          ? `${insurance.payer_name}${insurance.plan_name ? ` • ${insurance.plan_name}` : ""}`
                          : "—"}
                      </strong>
                    </div>
                    {insurance?.member_id ? (
                      <div className="v-chip">
                        Member ID: <strong>{insurance.member_id}</strong>
                      </div>
                    ) : null}
                  </div>

                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    Address: {addrLine()}
                  </div>

                  <div className="muted" style={{ marginTop: 6 }}>
                    Role: {role}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/chat")}>
                    Messages
                  </button>
                  <button className="btn btn-primary" type="button" onClick={createVisit}>
                    + New Visit
                  </button>
                </div>
              </div>

              {alerts.length > 0 && (
                <>
                  <div className="space" />
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    {alerts.slice(0, 8).map((a) => (
                      <div key={a.id} className="v-chip" title={a.alert_type ?? ""}>
                        Alert: <strong>{a.label}</strong>
                        {a.severity ? <span className="muted"> • {a.severity}</span> : null}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {err && <div style={{ color: "crimson", marginTop: 12 }}>{err}</div>}
            </div>

            <div className="space" />

            {/* TABS BAR */}
            <div className="card card-pad">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <TabButton id="overview" label="Overview" />
                <TabButton id="wound" label="Wound" />
                <TabButton id="soap" label="SOAP" />
                <TabButton id="plan" label="Plan" />
                <TabButton id="labs" label="Labs" />
                <TabButton id="notes" label="Notes" />
                <TabButton id="files" label="Files" />
                <TabButton id="photos" label="Photos" />
                <TabButton id="ivr" label="IVR Packet" />
                <TabButton id="charges" label="Charges" />
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {activeVisit ? (
                  <>
                    Active visit: <strong>{new Date(activeVisit.visit_date).toLocaleDateString()}</strong>{" "}
                    {activeVisit.status ? `• ${activeVisit.status}` : ""}{" "}
                    {activeVisit.summary ? `• ${activeVisit.summary}` : ""}
                  </>
                ) : (
                  "Select a visit in the timeline to unlock SOAP/Plan/Labs/Notes/Files."
                )}
              </div>
            </div>

            <div className="space" />

            <div className="card card-pad">
              {loading ? (
                <div className="muted">Loading…</div>
              ) : (
                <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* LEFT: Timeline */}
                  <div className="card card-pad" style={{ flex: "1 1 340px", minWidth: 320 }}>
                    <div className="h2">Visit Timeline</div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Click a visit to view SOAP + plan + labs + notes + files.
                    </div>

                    <div className="space" />

                    <VisitTimelinePanel
                      patientId={patientId}
                      locationId={locationId}
                      activeVisitId={activeVisitId}
                      onSelectVisit={(id) => {
                        setActiveVisitId(id);
                        setTab("overview");
                      }}
                    />

                    <div className="space" />

                    <div className="h2" style={{ marginTop: 8 }}>
                      General Files
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Files not tied to a specific visit.
                    </div>

                    <div className="space" />

                    {(filesByVisit.get("general") ?? []).length === 0 ? (
                      <div className="muted">No general files.</div>
                    ) : (
                      (filesByVisit.get("general") ?? []).slice(0, 8).map((f) => (
                        <button
                          key={f.id}
                          className="btn btn-ghost"
                          type="button"
                          style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
                          onClick={() => openFile(f)}
                        >
                          <span style={{ textAlign: "left" }}>
                            {f.filename}
                            <span className="muted" style={{ display: "block", fontSize: 12 }}>
                              {fmt(f.created_at)}
                            </span>
                          </span>
                          <span className="muted" style={{ fontSize: 12 }}>Open</span>
                        </button>
                      ))
                    )}
                  </div>

                  {/* RIGHT: Tab Content */}
                  <div className="card card-pad" style={{ flex: "2 1 620px", minWidth: 340 }}>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                    >
                      <div>
                        <div className="h2">{activeVisit ? `Visit: ${fmt(activeVisit.visit_date)}` : "Select a visit"}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {activeVisit
                            ? `${activeVisit.status ?? "—"} • ${activeVisit.summary ?? ""}`
                            : "Pick a visit from the timeline."}
                        </div>
                      </div>

                      {activeVisit ? (
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <div className="v-chip">
                            SOAP: <strong>{snapshot.soap}</strong>
                          </div>
                          <div className="v-chip">
                            Labs: <strong>{snapshot.labs}</strong>
                          </div>
                          <div className="v-chip">
                            Notes: <strong>{snapshot.notes}</strong>
                          </div>
                          <div className="v-chip">
                            Files: <strong>{snapshot.files}</strong>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space" />

                    {/* OVERVIEW */}
                    {tab === "overview" && (
                      <div className="card card-pad">
                        <div className="h2">Visit Snapshot</div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Jump into the work for this visit.
                        </div>

                        <div className="space" />

                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                          <div className="v-chip">
                            SOAP: <strong>{snapshot.soap}</strong>
                          </div>
                          <div className="v-chip">
                            Labs: <strong>{snapshot.labs}</strong>
                          </div>
                          <div className="v-chip">
                            Notes: <strong>{snapshot.notes}</strong>
                          </div>
                          <div className="v-chip">
                            Files: <strong>{snapshot.files}</strong>
                          </div>
                        </div>

                        <div className="space" />

                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost" type="button" onClick={() => setTab("soap")} disabled={!activeVisitId}>
                            Go SOAP
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => setTab("plan")} disabled={!activeVisitId}>
                            Go Plan
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => setTab("labs")} disabled={!activeVisitId}>
                            Go Labs
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => setTab("notes")} disabled={!activeVisitId}>
                            Go Notes
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => setTab("files")} disabled={!activeVisitId}>
                            Go Files
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/wound-timeline/${patientId}`)}>
                            Wound Timeline
                          </button>
                        </div>

                        {!activeVisitId ? (
                          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                            Select a visit in the timeline to begin.
                          </div>
                        ) : null}
                      </div>
                    )}

                    {tab === "wound" && (
                      <div className="card card-pad">
                        {!activeVisit ? (
                          <div className="muted">Select a visit first.</div>
                        ) : (
                          <>
                            <div
                              className="card card-pad"
                              style={{ marginBottom: 16, background: "rgba(124, 58, 237, 0.08)", border: "1px solid rgba(196, 181, 253, 0.26)" }}
                            >
                              <div className="h2">Wound Healing Progress</div>
                              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                Derived from completed Vital AI wound intake sessions for this patient.
                              </div>

                              <div className="space" />

                              {woundHistory.length === 0 ? (
                                <div className="muted">No Vital AI wound observations are available yet.</div>
                              ) : (
                                <>
                                  <div
                                    className="row"
                                    style={{
                                      gap: 12,
                                      flexWrap: "wrap",
                                      alignItems: "stretch",
                                      marginBottom: 14,
                                    }}
                                  >
                                    <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                                      <div className="muted" style={{ fontSize: 12 }}>Healing Trend</div>
                                      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, textTransform: "capitalize" }}>
                                        {woundTrend.direction}
                                      </div>
                                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                        {woundTrend.percentChange == null
                                          ? "Add wound length and width across multiple sessions to calculate a trend."
                                          : woundTrend.direction === "improving"
                                          ? `${Math.abs(woundTrend.percentChange)}% reduction`
                                          : woundTrend.direction === "worsening"
                                          ? `${Math.abs(woundTrend.percentChange)}% increase`
                                          : `${Math.abs(woundTrend.percentChange)}% change`}
                                      </div>
                                    </div>

                                    <div className="card card-pad" style={{ flex: "1 1 220px" }}>
                                      <div className="muted" style={{ fontSize: 12 }}>Observation Count</div>
                                      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800 }}>{woundHistory.length}</div>
                                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                        {woundHistory.reduce((sum, item) => sum + item.images.length, 0)} linked wound image
                                        {woundHistory.reduce((sum, item) => sum + item.images.length, 0) === 1 ? "" : "s"}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: "grid", gap: 12 }}>
                                    {woundHistory.map((entry) => (
                                      <div
                                        key={entry.sessionId}
                                        className="card card-pad"
                                        style={{ background: "rgba(255,255,255,0.02)" }}
                                      >
                                        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                          <div style={{ flex: "1 1 280px" }}>
                                            <div style={{ fontWeight: 800 }}>{new Date(entry.timestamp).toLocaleDateString()}</div>
                                            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                              {entry.woundLocation ?? "Wound location not captured"}
                                            </div>
                                          </div>

                                          <div
                                            className="row"
                                            style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "flex-end" }}
                                          >
                                            <div>
                                              <div className="muted" style={{ fontSize: 12 }}>Area</div>
                                              <div style={{ marginTop: 4, fontWeight: 800 }}>
                                                {entry.area == null ? "Not measured" : `${entry.area} cm2`}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="muted" style={{ fontSize: 12 }}>Dimensions</div>
                                              <div style={{ marginTop: 4, fontWeight: 800 }}>
                                                {entry.length == null && entry.width == null
                                                  ? "Not captured"
                                                  : `${entry.length ?? "-"} x ${entry.width ?? "-"} cm`}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="muted" style={{ fontSize: 12 }}>Images</div>
                                              <div style={{ marginTop: 4, fontWeight: 800 }}>
                                                {entry.images.length}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {entry.duration ? (
                                          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                                            Reported duration: {entry.duration}
                                          </div>
                                        ) : null}

                                        {entry.images.length > 0 ? (
                                          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                                            {entry.images.map((image) => {
                                              const imageUrl = woundImageUrls[image.id];
                                              return imageUrl ? (
                                                <a
                                                  key={image.id}
                                                  href={imageUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  style={{ display: "block" }}
                                                >
                                                  <img
                                                    src={imageUrl}
                                                    alt={image.filename}
                                                    style={{
                                                      width: 72,
                                                      height: 72,
                                                      borderRadius: 16,
                                                      objectFit: "cover",
                                                      border: "1px solid rgba(255,255,255,0.12)",
                                                    }}
                                                  />
                                                </a>
                                              ) : (
                                                <div
                                                  key={image.id}
                                                  className="card"
                                                  style={{
                                                    width: 72,
                                                    height: 72,
                                                    borderRadius: 16,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    fontSize: 11,
                                                    color: "var(--muted)",
                                                  }}
                                                >
                                                  Image
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>

                            <WoundHealingCurvePanel
                              patientId={activeVisit.patient_id}
                              locationId={activeVisit.location_id}
                              visitId={activeVisit.id}
                            />
                            <div className="space" />
                            <WoundAssessmentPanel
                              patientId={activeVisit.patient_id}
                              locationId={activeVisit.location_id}
                              visitId={activeVisit.id}
                            />
                          </>
                        )}
                      </div>
                    )}

                    {/* SOAP (single source of truth = SoapNotePanel) */}
                    {tab === "soap" && (
                      <div className="card card-pad">
                        {!activeVisit ? (
                          <div className="muted">Select a visit first.</div>
                        ) : (
                          <SoapNotePanel
                            visitId={activeVisit.id}
                            patientId={activeVisit.patient_id}
                            locationId={activeVisit.location_id}
                          />
                        )}
                      </div>
                    )}

                    {/* PLAN */}
                    {tab === "plan" && (
                      <div className="card card-pad">
                        {!activeVisit ? (
                          <div className="muted">Select a visit first.</div>
                        ) : (
                          <TreatmentPlanSection
                            visitId={activeVisit.id}
                            patientId={activeVisit.patient_id}
                            locationId={activeVisit.location_id}
                          />
                        )}
                      </div>
                    )}

                    {/* LABS */}
                    {tab === "labs" && (
                      <div className="card card-pad">
                        <div className="h2">Labs</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                          Create lab orders, track status, upload results per row, and attach to the visit.
                        </div>

                        <div className="space" />

                        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <input
                            className="input"
                            placeholder="Lab name (e.g., CBC, CMP, A1c, Testosterone, Lipid Panel)…"
                            value={labName}
                            onChange={(e) => setLabName(e.target.value)}
                            style={{ flex: "1 1 320px" }}
                            disabled={!activeVisitId}
                          />

                          <select
                            className="input"
                            value={labStatus}
                            onChange={(e) => setLabStatus(e.target.value as any)}
                            style={{ flex: "0 0 180px" }}
                            disabled={!activeVisitId}
                          >
                            <option value="ordered">ordered</option>
                            <option value="collected">collected</option>
                            <option value="resulted">resulted</option>
                            <option value="reviewed">reviewed</option>
                            <option value="cancelled">cancelled</option>
                          </select>

                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={createLab}
                            disabled={labSaving || !labName.trim() || !activeVisitId}
                            title={!activeVisitId ? "Select a visit first" : undefined}
                          >
                            {labSaving ? "Creating…" : "Add Lab Order"}
                          </button>
                        </div>

                        <div className="space" />

                        <div className="card card-pad" style={{ maxHeight: 420, overflow: "auto" }}>
                          {(labsByVisit.get(activeVisitId || "general") ?? []).length === 0 ? (
                            <div className="muted">No labs for this visit yet.</div>
                          ) : (
                            (labsByVisit.get(activeVisitId || "general") ?? []).map((l) => {
                              const resultFile = l.result_file_id ? files.find((x) => x.id === l.result_file_id) : null;
                              const rowPicked = labPickedFiles?.[l.id] ?? null;
                              const rowSummary = labSummaryDrafts?.[l.id] ?? "";

                              return (
                                <div key={l.id} style={{ marginBottom: 16 }}>
                                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                    <div style={{ flex: "1 1 320px" }}>
                                      <div style={{ fontWeight: 750 }}>{l.lab_name}</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                                        Status: <strong>{l.status}</strong> • Ordered: {fmt(l.ordered_at)}
                                      </div>

                                      {resultFile ? (
                                        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                                          Result file: <strong>{resultFile.filename}</strong>
                                        </div>
                                      ) : null}

                                      {l.result_summary ? (
                                        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                                          Saved summary: {l.result_summary}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                      <select
                                        className="input"
                                        value={l.status}
                                        onChange={(e) => updateLabStatus(l.id, e.target.value)}
                                        disabled={labUpdatingId === l.id}
                                        style={{ flex: "0 0 160px" }}
                                      >
                                        <option value="ordered">ordered</option>
                                        <option value="collected">collected</option>
                                        <option value="resulted">resulted</option>
                                        <option value="reviewed">reviewed</option>
                                        <option value="cancelled">cancelled</option>
                                      </select>

                                      <input
                                        type="file"
                                        className="input"
                                        style={{ flex: "0 0 260px" }}
                                        onChange={(e) => {
                                          const f = e.target.files?.[0] ?? null;
                                          setLabPickedFiles((prev) => ({ ...prev, [l.id]: f }));
                                        }}
                                      />

                                      <button
                                        className="btn btn-primary"
                                        type="button"
                                        disabled={!rowPicked || labUploadingId === l.id}
                                        onClick={() => uploadLabResult(l)}
                                      >
                                        {labUploadingId === l.id ? "Uploading…" : "Upload Result"}
                                      </button>

                                      <button className="btn btn-ghost" type="button" disabled={!l.result_file_id} onClick={() => openLabResult(l)}>
                                        Open Result
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space" />

                                  <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <select
                                      className="input"
                                      value={l.result_file_id ?? ""}
                                      onChange={(e) => attachResultFile(l.id, e.target.value ? e.target.value : null)}
                                      disabled={labBusyId === l.id}
                                      style={{ flex: "1 1 340px" }}
                                    >
                                      <option value="">Or attach an existing uploaded file…</option>
                                      {visitFilesForAttach.map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f.filename}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space" />

                                  <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <input
                                      className="input"
                                      placeholder="Optional summary (e.g., A1c 7.2, LDL elevated, etc.)"
                                      value={rowSummary}
                                      onChange={(e) => setLabSummaryDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                      style={{ flex: "1 1 320px" }}
                                    />
                                    <button
                                      className="btn btn-ghost"
                                      type="button"
                                      onClick={() => saveLabSummary(l.id, rowSummary)}
                                      disabled={labBusyId === l.id || !rowSummary.trim()}
                                    >
                                      Save Summary
                                    </button>
                                  </div>

                                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", marginTop: 16 }} />
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* NOTES */}
                    {tab === "notes" && (
                      <div className="card card-pad">
                        <div className="h2">Notes</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                          Add clinical/admin/billing notes.
                        </div>

                        <div className="space" />

                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <select
                            className="input"
                            value={noteType}
                            onChange={(e) => setNoteType(e.target.value as any)}
                            style={{ flex: "0 0 200px" }}
                            disabled={!activeVisitId}
                          >
                            <option value="clinical">Clinical</option>
                            <option value="admin">Admin</option>
                            <option value="billing">Billing</option>
                          </select>

                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={addNote}
                            disabled={savingNote || !noteBody.trim() || !activeVisitId}
                            title={!activeVisitId ? "Select a visit first" : undefined}
                          >
                            {savingNote ? "Saving…" : "Add Note"}
                          </button>
                        </div>

                        <div className="space" />

                        <textarea
                          className="input"
                          style={{ width: "100%", minHeight: 90 }}
                          placeholder="Type note…"
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value)}
                          disabled={!activeVisitId}
                        />

                        <div className="space" />

                        <div className="card card-pad" style={{ maxHeight: 260, overflow: "auto" }}>
                          {(notesByVisit.get(activeVisitId || "general") ?? []).length === 0 ? (
                            <div className="muted">No notes yet.</div>
                          ) : (
                            (notesByVisit.get(activeVisitId || "general") ?? []).map((n) => (
                              <div key={n.id} style={{ marginBottom: 10 }}>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  {n.note_type ?? "note"} • {fmt(n.created_at)}
                                </div>
                                <div>{n.body}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* FILES */}
                    {tab === "files" && (
                      <div className="card card-pad">
                        <div className="h2">Files</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                          Upload files to this visit.
                        </div>

                        <div className="space" />

                        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <input
                            type="file"
                            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                            className="input"
                            style={{ flex: "1 1 320px" }}
                            disabled={!activeVisitId}
                          />
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={upload}
                            disabled={uploading || !pickedFile || !activeVisitId}
                            title={!activeVisitId ? "Select a visit first" : undefined}
                          >
                            {uploading ? "Uploading…" : "Upload"}
                          </button>
                        </div>

                        <div className="space" />

                        <input
                          className="input"
                          placeholder="Optional file notes (e.g. Lab results, consent, imaging)…"
                          value={fileNotes}
                          onChange={(e) => setFileNotes(e.target.value)}
                          disabled={!activeVisitId}
                        />

                        <div className="space" />

                        <div className="card card-pad" style={{ maxHeight: 320, overflow: "auto" }}>
                          {(filesByVisit.get(activeVisitId || "general") ?? []).length === 0 ? (
                            <div className="muted">No files yet.</div>
                          ) : (
                            (filesByVisit.get(activeVisitId || "general") ?? []).map((f) => (
                              <button
                                key={f.id}
                                className="btn btn-ghost"
                                type="button"
                                style={{
                                  width: "100%",
                                  justifyContent: "space-between",
                                  marginBottom: 8,
                                  textAlign: "left",
                                }}
                                onClick={() => openFile(f)}
                              >
                                <span>
                                  <div style={{ fontWeight: 700 }}>{f.filename}</div>
                                  <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                                    {fmt(f.created_at)} {f.notes ? `• ${f.notes}` : ""}
                                  </div>
                                </span>
                                <span className="muted" style={{ fontSize: 12 }}>Open</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* PHOTOS */}
                    {tab === "photos" && (
                      <div className="card card-pad">
                        {!activeVisit ? (
                          <div className="muted">Select a visit first.</div>
                        ) : (
                          <WoundPhotosPanel
                            patientId={activeVisit.patient_id}
                            locationId={activeVisit.location_id}
                            visitId={activeVisit.id}
                          />
                        )}
                      </div>
                    )}

                    {tab === "ivr" && (
                      <div className="card card-pad">
                        {!activeVisit ? (
                          <div className="muted">Select a visit first.</div>
                        ) : (
                          <>
                            <div className="row" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => window.open(`/provider/ivr/print/${activeVisitId}`, "_blank")}
                                disabled={!activeVisitId}
                              >
                                Export PDF
                              </button>
                            </div>
                            <div className="space" />
                            <IVRPacketPanel
                              patientId={activeVisit.patient_id}
                              locationId={activeVisit.location_id}
                              visitId={activeVisit.id}
                            />
                          </>
                        )}
                      </div>
                    )}

                    {tab === "charges" && (
                      <div className="card card-pad">
                        {!activeVisit ? (
                          <div className="muted">Select a visit first.</div>
                        ) : (
                          <ChargeCapturePanel
                            patientId={activeVisit.patient_id}
                            locationId={activeVisit.location_id}
                            visitId={activeVisit.id}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space" />
          </>
        )}
      </div>
    </div>
  );
}
