import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import { uploadPatientFile, getSignedUrl } from "../lib/patientFiles";
import TreatmentPlanSection from "../components/provider/TreatmentPlanSection";

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
  note_type: string | null; // clinical/admin/billing etc
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

type SoapRow = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: string | null;
  locked: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  signed_by: string | null;
  signed_at: string | null;
};

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
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

type PatientTab = "overview" | "soap" | "plan" | "labs" | "notes" | "files";

export default function ProviderPatientCenter() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId ?? "";

  const [tab, setTab] = useState<PatientTab>("overview");

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [activeVisitId, setActiveVisitId] = useState<string>("");

  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [insurance, setInsurance] = useState<InsuranceRow | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState<"clinical" | "admin" | "billing">("clinical");
  const [savingNote, setSavingNote] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [fileNotes, setFileNotes] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  // SOAP
  const [soap, setSoap] = useState<SoapRow | null>(null);
  const [soapDraft, setSoapDraft] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [soapLoading, setSoapLoading] = useState(false);
  const [soapSaving, setSoapSaving] = useState(false);
  const [soapSigning, setSoapSigning] = useState(false);

  // Profiles mini cache
  const [profileMap, setProfileMap] = useState<Record<string, ProfileMini>>({});

  // LABS
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [labName, setLabName] = useState("");
  const [labStatus, setLabStatus] = useState<"ordered" | "collected" | "resulted" | "reviewed" | "cancelled">(
    "ordered"
  );
  const [labSaving, setLabSaving] = useState(false);
  const [labUpdatingId, setLabUpdatingId] = useState<string | null>(null);

  // LABS v2 (per-row upload + per-row summary draft)
  const [labPickedFiles, setLabPickedFiles] = useState<Record<string, File | null>>({});
  const [labUploadingId, setLabUploadingId] = useState<string | null>(null);
  const [labSummaryDrafts, setLabSummaryDrafts] = useState<Record<string, string>>({});
  const [labAttachId, setLabAttachId] = useState<string | null>(null);

  // Helpers
  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const isStaff = useMemo(() => role !== "patient", [role]);

  const calcAge = (dob?: string | null) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const age = calcAge(demo?.dob);

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

  const activeVisit = visits.find((v) => v.id === activeVisitId) ?? null;

  const loadProfilesMini = async (ids: Array<string | null | undefined>) => {
    const uniq = Array.from(new Set(ids.filter(Boolean) as string[])).filter((id) => !profileMap[id]);
    if (uniq.length === 0) return;

    const { data, error } = await supabase.from("profiles").select("id,full_name,email").in("id", uniq);
    if (error) {
      console.error("profiles mini load error:", error);
      return;
    }

    const next: Record<string, ProfileMini> = {};
    for (const p of (data as ProfileMini[]) ?? []) next[p.id] = p;
    setProfileMap((prev) => ({ ...prev, ...next }));
  };

  const displayName = (id?: string | null) => {
    if (!id) return "—";
    const p = profileMap[id];
    return p?.full_name?.trim() || p?.email?.trim() || id.slice(0, 8);
  };

  const loadAll = async (opts?: { setDefaultActiveVisit?: boolean }) => {
    if (!patientId) return;
    setErr(null);
    setLoading(true);

    try {
      const { data: d, error: dErr } = await supabase
        .from("patient_demographics")
        .select("patient_id,dob,sex,email,phone,address_line1,address_line2,city,state,zip")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (dErr) throw dErr;
      setDemo((d as DemoRow) ?? null);

      const { data: ins, error: insErr } = await supabase
        .from("patient_insurance")
        .select("id,patient_id,payer_name,member_id,group_id,plan_name,is_primary,created_at")
        .eq("patient_id", patientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (insErr) throw insErr;
      setInsurance((ins?.[0] as InsuranceRow) ?? null);

      const { data: al, error: alErr } = await supabase
        .from("patient_alerts")
        .select("id,patient_id,alert_type,label,severity,is_active,created_at")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (alErr) throw alErr;
      setAlerts((al as AlertRow[]) ?? []);

      const { data: v, error: vErr } = await supabase
        .from("patient_visits")
        .select("id,patient_id,location_id,appointment_id,visit_date,status,summary,created_at")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });
      if (vErr) throw vErr;

      const visitRows = (v as VisitRow[]) ?? [];
      setVisits(visitRows);

      if (opts?.setDefaultActiveVisit && visitRows.length > 0) {
        setActiveVisitId(visitRows[0].id);
      }

      const { data: f, error: fErr } = await supabase
        .from("patient_files")
        .select(
          "id,created_at,location_id,patient_id,visit_id,uploaded_by,bucket,path,filename,content_type,size_bytes,category,is_internal,notes"
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (fErr) throw fErr;
      setFiles((f as FileRow[]) ?? []);

      const { data: n, error: nErr } = await supabase
        .from("patient_visit_notes")
        .select("id,patient_id,location_id,visit_id,note_type,body,created_at,created_by")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (nErr) throw nErr;
      setNotes((n as NoteRow[]) ?? []);

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

      const seeded: Record<string, string> = {};
      for (const r of labRows) {
        if (r.result_summary && !seeded[r.id]) seeded[r.id] = r.result_summary;
      }
      setLabSummaryDrafts((prev) => ({ ...seeded, ...prev }));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load patient center.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!patientId) return;
    loadAll({ setDefaultActiveVisit: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // SOAP load for selected visit
  useEffect(() => {
    const loadSoap = async () => {
      if (!activeVisitId) {
        setSoap(null);
        setSoapDraft({ subjective: "", objective: "", assessment: "", plan: "" });
        return;
      }

      setSoapLoading(true);

      const { data, error } = await supabase
        .from("patient_soap_notes")
        .select(
          "id,patient_id,location_id,visit_id,subjective,objective,assessment,plan,status,locked,created_by,created_at,updated_at,signed_by,signed_at"
        )
        .eq("visit_id", activeVisitId)
        .maybeSingle();

      setSoapLoading(false);

      if (error) {
        console.error("SOAP load error:", error);
        setSoap(null);
        return;
      }

      const row = (data as SoapRow) ?? null;
      setSoap(row);
      setSoapDraft({
        subjective: row?.subjective ?? "",
        objective: row?.objective ?? "",
        assessment: row?.assessment ?? "",
        plan: row?.plan ?? "",
      });
    };

    loadSoap();
  }, [activeVisitId]);

  useEffect(() => {
    loadProfilesMini([soap?.created_by, soap?.signed_by]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soap?.id, soap?.created_by, soap?.signed_by]);

  const soapLocked = !!soap?.locked;
  const soapHasChanges =
    (soapDraft.subjective ?? "") !== (soap?.subjective ?? "") ||
    (soapDraft.objective ?? "") !== (soap?.objective ?? "") ||
    (soapDraft.assessment ?? "") !== (soap?.assessment ?? "") ||
    (soapDraft.plan ?? "") !== (soap?.plan ?? "");

  const createVisit = async () => {
    if (!patientId) return;
    setErr(null);

    const fallbackLocationId = visits[0]?.location_id ?? null;
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

    const newVisit = data as VisitRow;
    setVisits((prev) => [newVisit, ...prev]);
    setActiveVisitId(newVisit.id);
    setTab("overview");
  };

  const addNote = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!noteBody.trim()) return;

    const visit = activeVisitId ? visits.find((v) => v.id === activeVisitId) : null;
    const locationId = visit?.location_id ?? visits[0]?.location_id ?? null;
    if (!locationId) return setErr("Missing location for note.");

    setSavingNote(true);
    setErr(null);

    const { error } = await supabase.from("patient_visit_notes").insert([
      {
        patient_id: patientId,
        location_id: locationId,
        visit_id: activeVisitId || null,
        note_type: noteType,
        body: noteBody.trim(),
        created_by: user.id,
      },
    ]);

    setSavingNote(false);
    if (error) return setErr(error.message);

    setNoteBody("");
    await loadAll();
  };

  const openFile = async (f: FileRow) => {
    try {
      const url = await getSignedUrl(f.bucket, f.path, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to open file.");
    }
  };

  const upload = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!pickedFile) return;
    if (!patientId) return;

    const visit = activeVisitId ? visits.find((v) => v.id === activeVisitId) : null;
    const locationId = visit?.location_id ?? visits[0]?.location_id ?? null;
    if (!locationId) return setErr("Missing location for upload.");

    setUploading(true);
    setErr(null);

    try {
      const { bucket, path } = await uploadPatientFile({
        file: pickedFile,
        locationId,
        patientId,
        visitId: activeVisitId || null,
      });

      const { error } = await supabase.from("patient_files").insert([
        {
          patient_id: patientId,
          location_id: locationId,
          visit_id: activeVisitId || null,
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

  const saveSoap = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!activeVisitId) return setErr("Select a visit first.");
    if (!activeVisit?.location_id) return setErr("Missing location for this visit.");
    if (soapLocked) return setErr("This SOAP note is signed/locked.");

    setSoapSaving(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("patient_soap_notes")
        .upsert(
          [
            {
              ...(soap?.id ? { id: soap.id } : {}),
              patient_id: patientId,
              location_id: activeVisit.location_id,
              visit_id: activeVisitId,
              subjective: soapDraft.subjective.trim() || null,
              objective: soapDraft.objective.trim() || null,
              assessment: soapDraft.assessment.trim() || null,
              plan: soapDraft.plan.trim() || null,
              status: soap?.status ?? "draft",
              locked: false,
              created_by: soap?.created_by ?? user.id,
            },
          ],
          { onConflict: "visit_id" }
        )
        .select(
          "id,patient_id,location_id,visit_id,subjective,objective,assessment,plan,status,locked,created_by,created_at,updated_at,signed_by,signed_at"
        )
        .maybeSingle();

      if (error) throw error;
      setSoap((data as SoapRow) ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save SOAP.");
    } finally {
      setSoapSaving(false);
    }
  };

  const signSoap = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!activeVisitId) return setErr("Select a visit first.");
    if (!activeVisit?.location_id) return setErr("Missing location for this visit.");
    if (soapLocked) return;

    setSoapSigning(true);
    setErr(null);

    try {
      if (!soap?.id) await saveSoap();

      let target = soap;
      if (!target?.id) {
        const { data, error } = await supabase
          .from("patient_soap_notes")
          .select(
            "id,patient_id,location_id,visit_id,subjective,objective,assessment,plan,status,locked,created_by,created_at,updated_at,signed_by,signed_at"
          )
          .eq("visit_id", activeVisitId)
          .maybeSingle();
        if (error) throw error;
        target = (data as SoapRow) ?? null;
      }

      if (!target?.id) throw new Error("Could not find SOAP note to sign.");

      const { data: signed, error: sErr } = await supabase
        .from("patient_soap_notes")
        .update({
          locked: true,
          status: "signed",
          signed_by: user.id,
          signed_at: new Date().toISOString(),
        })
        .eq("id", target.id)
        .select(
          "id,patient_id,location_id,visit_id,subjective,objective,assessment,plan,status,locked,created_by,created_at,updated_at,signed_by,signed_at"
        )
        .maybeSingle();

      if (sErr) throw sErr;
      setSoap((signed as SoapRow) ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to sign SOAP.");
    } finally {
      setSoapSigning(false);
    }
  };

  const resetSoapDraft = () => {
    setSoapDraft({
      subjective: soap?.subjective ?? "",
      objective: soap?.objective ?? "",
      assessment: soap?.assessment ?? "",
      plan: soap?.plan ?? "",
    });
  };

  // LABS actions
  const createLab = async () => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!activeVisit?.location_id && !visits[0]?.location_id) return setErr("Missing location for lab order.");
    if (!labName.trim()) return;

    const locationId = activeVisit?.location_id ?? visits[0]?.location_id;

    setLabSaving(true);
    setErr(null);

    try {
      const { error } = await supabase.from("patient_labs").insert([
        {
          patient_id: patientId,
          location_id: locationId,
          visit_id: activeVisitId || null,
          lab_name: labName.trim(),
          status: labStatus,
          created_by: user.id,
        },
      ]);
      if (error) throw error;

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
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update lab.");
    } finally {
      setLabUpdatingId(null);
    }
  };

  const attachResultFile = async (labId: string, fileId: string | null) => {
    setLabAttachId(labId);
    setErr(null);
    try {
      const { error } = await supabase.from("patient_labs").update({ result_file_id: fileId }).eq("id", labId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to attach result file.");
    } finally {
      setLabAttachId(null);
    }
  };

  const saveLabSummary = async (labId: string, summary: string) => {
    setLabAttachId(labId);
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
      setLabAttachId(null);
    }
  };

  const openLabResult = async (lab: LabRow) => {
    if (!lab.result_file_id) return;
    const f = files.find((x) => x.id === lab.result_file_id);
    if (!f) return setErr("Result file not found.");
    await openFile(f);
  };

  // LABS v2: upload result file from the lab row, create patient_files row, link result_file_id
  const uploadLabResult = async (lab: LabRow) => {
    if (!user) return setErr("You must be signed in.");
    if (!patientId) return;
    if (!lab.id) return;
    if (!lab.location_id) return setErr("Missing location for lab.");

    const file = labPickedFiles?.[lab.id] ?? null;
    if (!file) return;

    setLabUploadingId(lab.id);
    setErr(null);

    try {
      const { bucket, path } = await uploadPatientFile({
        file,
        locationId: lab.location_id,
        patientId,
        visitId: lab.visit_id || null,
      });

      const { data: inserted, error: insErr } = await supabase
        .from("patient_files")
        .insert([
          {
            patient_id: patientId,
            location_id: lab.location_id,
            visit_id: lab.visit_id || null,
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

      setLabPickedFiles((prev) => ({ ...prev, [lab.id]: null }));
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to upload lab result.");
    } finally {
      setLabUploadingId(null);
    }
  };

  // FIX: attach list should be files for *this visit*, plus general files
  const visitFilesForAttach = useMemo(() => {
    const visitSpecific = filesByVisit.get(activeVisitId || "general") ?? [];
    const general = filesByVisit.get("general") ?? [];
    const merged = [...visitSpecific, ...general];
    const seen = new Set<string>();
    return merged.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }, [filesByVisit, activeVisitId]);

  const authNotReady = !role;

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

  const snapshot = useMemo(() => {
    const vid = activeVisitId || "general";
    const vLabs = labsByVisit.get(vid) ?? [];
    const vNotes = notesByVisit.get(vid) ?? [];
    const vFiles = filesByVisit.get(vid) ?? [];
    return {
      soap: soap?.id ? (soapLocked ? "Signed" : "Draft") : "None",
      labs: vLabs.length,
      notes: vNotes.length,
      files: vFiles.length,
    };
  }, [activeVisitId, labsByVisit, notesByVisit, filesByVisit, soap?.id, soapLocked]);

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
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 14,
                  flexWrap: "wrap",
                }}
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
                    Role: {role} • Staff Access: {isStaff ? "Yes" : "No"}
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
                <TabButton id="soap" label="SOAP" />
                <TabButton id="plan" label="Plan" />
                <TabButton id="labs" label="Labs" />
                <TabButton id="notes" label="Notes" />
                <TabButton id="files" label="Files" />
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

                    {visits.length === 0 ? (
                      <div className="muted">No visits yet. Create a new visit to begin.</div>
                    ) : (
                      visits.map((v) => {
                        const active = v.id === activeVisitId;
                        const visitFiles = filesByVisit.get(v.id) ?? [];
                        const visitNotes = notesByVisit.get(v.id) ?? [];
                        const visitLabs = labsByVisit.get(v.id) ?? [];

                        return (
                          <button
                            key={v.id}
                            type="button"
                            className={active ? "btn btn-primary" : "btn btn-ghost"}
                            style={{
                              width: "100%",
                              justifyContent: "space-between",
                              marginBottom: 8,
                              textAlign: "left",
                            }}
                            onClick={() => {
                              setActiveVisitId(v.id);
                              setTab("overview");
                            }}
                          >
                            <span>
                              <div style={{ fontWeight: 750 }}>{new Date(v.visit_date).toLocaleDateString()}</div>
                              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                                {v.status ?? "—"} • {visitLabs.length} labs • {visitNotes.length} notes •{" "}
                                {visitFiles.length} files
                              </div>
                            </span>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {v.summary ?? ""}
                            </span>
                          </button>
                        );
                      })
                    )}

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
                          <span className="muted" style={{ fontSize: 12 }}>
                            Open
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {/* RIGHT: Tab Content */}
                  <div className="card card-pad" style={{ flex: "2 1 620px", minWidth: 340 }}>
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div className="h2">{activeVisit ? `Visit: ${fmt(activeVisit.visit_date)}` : "Select a visit"}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {activeVisit ? `${activeVisit.status ?? "—"} • ${activeVisit.summary ?? ""}` : "Pick a visit from the timeline."}
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
                        </div>

                        {!activeVisitId ? (
                          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                            Select a visit in the timeline to begin.
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* SOAP */}
                    {tab === "soap" && (
                      <div className="card card-pad">
                        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div className="h2">SOAP Note</div>
                            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                              {soapLoading ? (
                                "Loading SOAP…"
                              ) : soapLocked ? (
                                <>
                                  <div>
                                    <strong>Signed/Locked</strong>
                                    {soap?.signed_at ? ` • ${fmt(soap.signed_at)}` : ""}
                                    {soap?.signed_by ? ` • by ${displayName(soap.signed_by)}` : ""}
                                  </div>
                                  <div style={{ marginTop: 4 }}>
                                    Created by {displayName(soap?.created_by)} {soap?.created_at ? `• ${fmt(soap.created_at)}` : ""}
                                  </div>
                                </>
                              ) : soap?.id ? (
                                <>
                                  <div>Draft • Save anytime • Sign to lock</div>
                                  <div style={{ marginTop: 4 }}>
                                    Created by {displayName(soap?.created_by)} {soap?.created_at ? `• ${fmt(soap.created_at)}` : ""}
                                  </div>
                                </>
                              ) : (
                                "No SOAP yet • Start writing and save"
                              )}
                            </div>
                          </div>

                          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="btn btn-ghost"
                              type="button"
                              disabled={!activeVisitId || soapLocked || soapSaving || soapLoading}
                              onClick={resetSoapDraft}
                            >
                              Reset
                            </button>

                            <button
                              className="btn btn-primary"
                              type="button"
                              disabled={!activeVisitId || soapLocked || soapSaving || soapLoading}
                              onClick={saveSoap}
                            >
                              {soapSaving ? "Saving…" : "Save SOAP"}
                            </button>

                            <button
                              className="btn btn-primary"
                              type="button"
                              disabled={!activeVisitId || soapLocked || soapSigning || soapLoading}
                              onClick={signSoap}
                            >
                              {soapLocked ? "Locked" : soapSigning ? "Signing…" : "Sign & Lock"}
                            </button>
                          </div>
                        </div>

                        <div className="space" />

                        {!soapLocked && soapHasChanges ? (
                          <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
                            Unsaved changes.
                          </div>
                        ) : null}

                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                          {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                            <div key={k} style={{ flex: "1 1 260px", minWidth: 260 }}>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                                {k.charAt(0).toUpperCase() + k.slice(1)}
                              </div>
                              <textarea
                                className="input"
                                style={{ width: "100%", minHeight: 110 }}
                                value={(soapDraft as any)[k]}
                                onChange={(e) => setSoapDraft((s) => ({ ...s, [k]: e.target.value }))}
                                disabled={!activeVisitId || soapLocked || soapLoading}
                                placeholder={
                                  k === "subjective"
                                    ? "Patient-reported symptoms, concerns, history…"
                                    : k === "objective"
                                    ? "Exam findings, vitals, wound measurements, labs…"
                                    : k === "assessment"
                                    ? "Dx, wound status, clinical impression…"
                                    : "Treatment plan, grafts, offloading, follow-up, orders…"
                                }
                              />
                            </div>
                          ))}
                        </div>
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
                          />

                          <select
                            className="input"
                            value={labStatus}
                            onChange={(e) => setLabStatus(e.target.value as any)}
                            style={{ flex: "0 0 180px" }}
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

                                      <button
                                        className="btn btn-ghost"
                                        type="button"
                                        disabled={!l.result_file_id}
                                        onClick={() => openLabResult(l)}
                                      >
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
                                      disabled={labAttachId === l.id}
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
                                      disabled={labAttachId === l.id || !rowSummary.trim()}
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
                                <span className="muted" style={{ fontSize: 12 }}>
                                  Open
                                </span>
                              </button>
                            ))
                          )}
                        </div>
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