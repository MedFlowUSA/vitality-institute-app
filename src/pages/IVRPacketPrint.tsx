import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getSignedUrl } from "../lib/patientFiles";

type VisitRow = { id: string; patient_id: string; location_id: string; visit_date: string; summary: string | null };
type DemoRow = { dob: string | null; sex: string | null; email: string | null; phone: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; zip: string | null; };
type InsuranceRow = { payer_name: string | null; plan_name: string | null; member_id: string | null; group_id: string | null; };
type WoundRow = { wound_label: string; body_site: string | null; laterality: string | null; wound_type: string | null; stage: string | null; length_cm: number | null; width_cm: number | null; depth_cm: number | null; exudate: string | null; infection_signs: string | null; notes: string | null; };
type FileRow = { id: string; bucket: string; path: string; filename: string; content_type: string | null; category: string | null; created_at: string; visit_id: string | null; };
type SoapRow = { subjective: string | null; objective: string | null; assessment: string | null; plan: string | null; signed_at: string | null; is_signed: boolean | null; is_locked: boolean | null; };
type PlanItem = { name: string; qty?: string | null; notes?: string | null };

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function fmtDob(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}
function calcAge(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}
function addr(d: DemoRow | null) {
  if (!d) return "—";
  const parts = [d.address_line1, d.address_line2, [d.city, d.state, d.zip].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}
function areaCm2(l?: number | null, w?: number | null) {
  if (l == null || w == null) return null;
  const a = Number(l) * Number(w);
  return Number.isFinite(a) ? Number(a.toFixed(2)) : null;
}

async function trySelect<T = any>(tableOrView: string, select: string, build: (q: any) => any): Promise<T[] | null> {
  try {
    let q = supabase.from(tableOrView).select(select);
    q = build(q);
    const { data, error } = await q;
    if (error) return null;
    return (data as T[]) ?? [];
  } catch {
    return null;
  }
}

export default function IVRPacketPrint() {
  const { visitId } = useParams<{ visitId: string }>();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [ins, setIns] = useState<InsuranceRow | null>(null);
  const [wounds, setWounds] = useState<WoundRow[]>([]);
  const [soap, setSoap] = useState<SoapRow | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [photos, setPhotos] = useState<FileRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visitId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: v, error: vErr } = await supabase
          .from("patient_visits")
          .select("id,patient_id,location_id,visit_date,summary")
          .eq("id", visitId)
          .maybeSingle();
        if (vErr) throw vErr;
        if (!v?.id) throw new Error("Visit not found.");
        setVisit(v as VisitRow);

        const pid = (v as VisitRow).patient_id;

        const { data: d, error: dErr } = await supabase
          .from("patient_demographics")
          .select("dob,sex,email,phone,address_line1,address_line2,city,state,zip")
          .eq("patient_id", pid)
          .maybeSingle();
        if (dErr) throw dErr;
        setDemo((d as DemoRow) ?? null);

        const { data: insRows, error: iErr } = await supabase
          .from("patient_insurance")
          .select("payer_name,plan_name,member_id,group_id,is_primary,created_at")
          .eq("patient_id", pid)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);
        if (iErr) throw iErr;
        setIns((insRows?.[0] as InsuranceRow) ?? null);

        const { data: w, error: wErr } = await supabase
          .from("wound_assessments")
          .select("wound_label,body_site,laterality,wound_type,stage,length_cm,width_cm,depth_cm,exudate,infection_signs,notes,created_at")
          .eq("patient_id", pid)
          .eq("visit_id", visitId)
          .order("created_at", { ascending: false });
        if (wErr) throw wErr;
        setWounds((w as unknown as WoundRow[]) ?? []);

        // Optional SOAP table
        const soap1 = await trySelect<SoapRow>(
          "patient_soap_notes",
          "subjective,objective,assessment,plan,signed_at,is_signed,is_locked,created_at",
          (q) => q.eq("visit_id", visitId).order("created_at", { ascending: false }).limit(1)
        );
        setSoap(soap1 && soap1.length ? soap1[0] : null);

        // Optional plan tables
        let items: PlanItem[] = [];
        const p1 = await trySelect<any>(
          "visit_treatment_items",
          "name,qty,notes,created_at",
          (q) => q.eq("visit_id", visitId).order("created_at", { ascending: false })
        );
        if (p1) items = p1.map((x) => ({ name: x.name, qty: x.qty ?? null, notes: x.notes ?? null }));

        if (!items.length) {
          const p2 = await trySelect<any>(
            "patient_treatment_plans",
            "treatment_name,quantity,notes,created_at",
            (q) => q.eq("visit_id", visitId).order("created_at", { ascending: false })
          );
          if (p2) items = p2.map((x) => ({ name: x.treatment_name, qty: x.quantity ?? null, notes: x.notes ?? null }));
        }
        setPlanItems(items);

        // Photos (visit first, then patient)
        const { data: f, error: fErr } = await supabase
          .from("patient_files")
          .select("id,bucket,path,filename,content_type,category,created_at,visit_id")
          .eq("patient_id", pid)
          .order("created_at", { ascending: false });
        if (fErr) throw fErr;

        const allFiles = (f as FileRow[]) ?? [];
        const isImage = (x: FileRow) => (x.content_type || "").startsWith("image/");
        const isWoundCat = (x: FileRow) => ["wound_photo", "clinical_image"].includes(String(x.category || ""));
        const visitImgs = allFiles.filter((x) => x.visit_id === visitId && isImage(x) && isWoundCat(x));
        const anyImgs = allFiles.filter((x) => isImage(x) && isWoundCat(x));

        const chosen = (visitImgs.length ? visitImgs : anyImgs).slice(0, 6);
        setPhotos(chosen);

        // Signed URLs
        const map: Record<string, string> = {};
        for (const p of chosen) {
          try {
            map[p.id] = await getSignedUrl(p.bucket, p.path, 300);
          } catch {}
        }
        setPhotoUrls(map);

        // Auto-trigger print after render
        setTimeout(() => window.print(), 400);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to build packet preview.");
      } finally {
        setLoading(false);
      }
    })();
  }, [visitId]);

  const age = calcAge(demo?.dob);

  if (loading) return <div style={{ padding: 24, fontFamily: "system-ui" }}>Loading packet preview…</div>;
  if (err) return <div style={{ padding: 24, fontFamily: "system-ui", color: "crimson" }}>{err}</div>;
  if (!visit) return <div style={{ padding: 24, fontFamily: "system-ui" }}>Visit not found.</div>;

  return (
    <div style={{ padding: 28, fontFamily: "system-ui", color: "#111" }}>
      <style>
        {`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .page { page-break-after: always; }
          }
          .h1 { font-size: 20px; font-weight: 800; }
          .h2 { font-size: 14px; font-weight: 800; margin-top: 16px; }
          .muted { color: #555; font-size: 12px; }
          .box { border: 1px solid #ddd; border-radius: 10px; padding: 12px; margin-top: 10px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .row { display: flex; gap: 10px; flex-wrap: wrap; }
          .chip { padding: 6px 10px; border: 1px solid #ddd; border-radius: 999px; font-size: 12px; }
          img { max-width: 100%; border-radius: 10px; border: 1px solid #eee; }
        `}
      </style>

      <div className="no-print" style={{ marginBottom: 12 }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px" }}>Print / Save as PDF</button>
      </div>

      <div className="h1">IVR / Wound Care Justification Packet</div>
      <div className="muted">Generated: {new Date().toLocaleString()}</div>

      <div className="box">
        <div className="h2">Patient</div>
        <div className="grid">
          <div>
            <div className="muted">Patient ID</div>
            <div>{visit.patient_id}</div>
          </div>
          <div>
            <div className="muted">Visit</div>
            <div>{fmtDate(visit.visit_date)}</div>
          </div>
          <div>
            <div className="muted">DOB / Age / Sex</div>
            <div>{fmtDob(demo?.dob)}{age != null ? ` • ${age}` : ""} • {demo?.sex ?? "—"}</div>
          </div>
          <div>
            <div className="muted">Phone / Email</div>
            <div>{demo?.phone ?? "—"} • {demo?.email ?? "—"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="muted">Address</div>
            <div>{addr(demo)}</div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="h2">Insurance</div>
        <div className="row">
          <div className="chip">Payer: <strong>{ins?.payer_name ?? "—"}</strong></div>
          <div className="chip">Plan: <strong>{ins?.plan_name ?? "—"}</strong></div>
          <div className="chip">Member ID: <strong>{ins?.member_id ?? "—"}</strong></div>
          <div className="chip">Group: <strong>{ins?.group_id ?? "—"}</strong></div>
        </div>
      </div>

      <div className="box">
        <div className="h2">Wound Assessment (this visit)</div>
        {wounds.length === 0 ? (
          <div className="muted">No structured wound measurements recorded for this visit.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {wounds.map((w, idx) => {
              const a = areaCm2(w.length_cm, w.width_cm);
              return (
                <div key={idx} style={{ borderTop: idx ? "1px solid #eee" : "none", paddingTop: idx ? 10 : 0 }}>
                  <div><strong>{w.wound_label}</strong></div>
                  <div className="muted">
                    {[w.laterality, w.body_site].filter(Boolean).join(" ") || "—"}
                    {w.wound_type ? ` • ${w.wound_type}` : ""}{w.stage ? ` • Stage ${w.stage}` : ""}
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <div className="chip">L×W×D (cm): <strong>{w.length_cm ?? "—"} × {w.width_cm ?? "—"} × {w.depth_cm ?? "—"}</strong></div>
                    <div className="chip">Area (cm²): <strong>{a ?? "—"}</strong></div>
                    {w.exudate ? <div className="chip">Exudate: <strong>{w.exudate}</strong></div> : null}
                    {w.infection_signs ? <div className="chip">Infection: <strong>{w.infection_signs}</strong></div> : null}
                  </div>
                  {w.notes ? <div style={{ marginTop: 8 }}><span className="muted">Notes: </span>{w.notes}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="box">
        <div className="h2">SOAP (if available)</div>
        {!soap ? (
          <div className="muted">No SOAP note found for this visit.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div><strong>Subjective:</strong> {soap.subjective || "—"}</div>
            <div><strong>Objective:</strong> {soap.objective || "—"}</div>
            <div><strong>Assessment:</strong> {soap.assessment || "—"}</div>
            <div><strong>Plan:</strong> {soap.plan || "—"}</div>
            <div className="muted">
              {soap.is_signed || soap.is_locked ? `Signed/Locked • ${fmtDate(soap.signed_at)}` : "Draft (not signed)"}
            </div>
          </div>
        )}
      </div>

      <div className="box">
        <div className="h2">Treatment Plan (if available)</div>
        {planItems.length === 0 ? (
          <div className="muted">No plan items found.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {planItems.map((p, idx) => (
              <li key={idx}>
                <strong>{p.name}</strong>
                {p.qty ? ` • Qty: ${p.qty}` : ""}
                {p.notes ? ` • ${p.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="box page">
        <div className="h2">Photo Documentation</div>
        {photos.length === 0 ? (
          <div className="muted">No wound photos found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            {photos.map((p) => (
              <div key={p.id}>
                {photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.filename} /> : <div className="muted">Image unavailable</div>}
                <div className="muted" style={{ marginTop: 6 }}>{p.filename} • {fmtDate(p.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="box">
        <div className="h2">Justification Narrative (editable)</div>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
          Patient presents with a chronic/non-healing wound requiring advanced wound care. Clinical assessment, measurements,
          and photographic documentation support medical necessity. Requested treatment is intended to accelerate closure,
          reduce infection risk, and prevent complications. Please approve the proposed treatment plan based on the attached
          documentation.
        </div>
      </div>
    </div>
  );
}
