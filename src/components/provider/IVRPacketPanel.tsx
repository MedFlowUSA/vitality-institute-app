import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getSignedUrl } from "../../lib/patientFiles";

type Props = {
  patientId: string;
  locationId: string;
  visitId: string;
};

type DemoRow = {
  dob: string | null;
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
  payer_name: string | null;
  plan_name: string | null;
  member_id: string | null;
  group_id: string | null;
  is_primary: boolean;
};

type VisitRow = {
  visit_date: string;
  status: string | null;
  summary: string | null;
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
  infection_signs: string | null;
  odor: string | null;

  necrotic_pct: number | null;
  slough_pct: number | null;
  granulation_pct: number | null;
  epithelial_pct: number | null;

  pain_score: number | null;
  notes: string | null;
};

type FileRow = {
  id: string;
  bucket: string;
  path: string;
  filename: string;
  content_type: string | null;
  category: string | null;
  created_at: string;
  visit_id: string | null;
};

type SoapRow = {
  id: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  signed_at?: string | null;
  is_signed?: boolean | null;
  is_locked?: boolean | null;
};

type PlanItem = {
  name: string;
  qty?: string | null;
  notes?: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function areaCm2(w: { length_cm: number | null; width_cm: number | null }) {
  if (w.length_cm == null || w.width_cm == null) return null;
  const a = Number(w.length_cm) * Number(w.width_cm);
  return Number.isFinite(a) ? Number(a.toFixed(2)) : null;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function fmtDob(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
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
  if (!d) return "-";
  const parts = [
    d.address_line1,
    d.address_line2,
    [d.city, d.state, d.zip].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

async function trySelect<T>(
  tableOrView: string,
  select: string,
  build: (query: any) => any
): Promise<T[] | null> {
  try {
    const query = build(supabase.from(tableOrView).select(select));
    const { data, error } = await query;
    if (error) return null;
    return (data as T[]) ?? [];
  } catch {
    return null;
  }
}

export default function IVRPacketPanel({ patientId, locationId, visitId }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [ins, setIns] = useState<InsuranceRow | null>(null);
  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [soap, setSoap] = useState<SoapRow | null>(null);

  const [wounds, setWounds] = useState<WoundRow[]>([]);
  const [photos, setPhotos] = useState<FileRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  const [packetText, setPacketText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!patientId || !locationId || !visitId) return;
    setLoading(true);
    setErr(null);

    try {
      // Visit
      const { data: v, error: vErr } = await supabase
        .from("patient_visits")
        .select("visit_date,status,summary")
        .eq("id", visitId)
        .maybeSingle();
      if (vErr) throw vErr;
      setVisit((v as VisitRow) ?? null);

      // Demographics
      const { data: d, error: dErr } = await supabase
        .from("patient_demographics")
        .select("dob,sex,email,phone,address_line1,address_line2,city,state,zip")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (dErr) throw dErr;
      setDemo((d as DemoRow) ?? null);

      // Primary insurance (latest)
      const { data: insRows, error: iErr } = await supabase
        .from("patient_insurance")
        .select("payer_name,plan_name,member_id,group_id,is_primary,created_at")
        .eq("patient_id", patientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (iErr) throw iErr;
      setIns((insRows?.[0] as InsuranceRow) ?? null);

      // Latest SOAP (optional table)
      // Try common table names and shapes (won’t break if missing)
      const soap1 = await trySelect<SoapRow>(
        "patient_soap_notes",
        "id,subjective,objective,assessment,plan,signed_at,is_signed,is_locked",
        (q) => q.eq("visit_id", visitId).order("created_at", { ascending: false }).limit(1)
      );

      if (soap1 && soap1.length) setSoap(soap1[0]);
      else setSoap(null);

      // Wound assessments for this visit (preferred)
      const { data: w1, error: wErr } = await supabase
        .from("wound_assessments")
        .select(
          "id,created_at,wound_label,body_site,laterality,wound_type,stage,length_cm,width_cm,depth_cm,exudate,infection_signs,odor,necrotic_pct,slough_pct,granulation_pct,epithelial_pct,pain_score,notes"
        )
        .eq("patient_id", patientId)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });

      if (wErr) throw wErr;
      const woundRows = (w1 as WoundRow[]) ?? [];
      setWounds(woundRows);

      // Last wound photos (prefer this visit; fallback patient)
      const { data: f, error: fErr } = await supabase
        .from("patient_files")
        .select("id,bucket,path,filename,content_type,category,created_at,visit_id")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (fErr) throw fErr;
      const allFiles = (f as FileRow[]) ?? [];
      const isImage = (x: FileRow) => (x.content_type || "").startsWith("image/");
      const isWoundCat = (x: FileRow) => ["wound_photo", "clinical_image"].includes(String(x.category || ""));
      const visitImgs = allFiles.filter((x) => x.visit_id === visitId && isImage(x) && isWoundCat(x));
      const anyImgs = allFiles.filter((x) => isImage(x) && isWoundCat(x));

      const chosen = (visitImgs.length ? visitImgs : anyImgs).slice(0, 3);
      setPhotos(chosen);

      // Treatment plan items (optional)
      // Try two common patterns; ignore if missing
      let items: PlanItem[] = [];

      const p1 = await trySelect<{ name: string; qty: string | null; notes: string | null }>(
        "visit_treatment_items",
        "name,qty,notes",
        (q) => q.eq("visit_id", visitId).order("created_at", { ascending: false })
      );
      if (p1) items = p1.map((x) => ({ name: x.name, qty: x.qty ?? null, notes: x.notes ?? null }));

      if (!items.length) {
        const p2 = await trySelect<{ treatment_name: string; quantity: string | null; notes: string | null }>(
          "patient_treatment_plans",
          "treatment_name,quantity,notes",
          (q) => q.eq("visit_id", visitId).order("created_at", { ascending: false })
        );
        if (p2) items = p2.map((x) => ({ name: x.treatment_name, qty: x.quantity ?? null, notes: x.notes ?? null }));
      }

      setPlanItems(items);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load packet sources."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, locationId, visitId]);

  // Signed URLs for preview/open
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const map: Record<string, string> = {};
      for (const p of photos) {
        try {
          const url = await getSignedUrl(p.bucket, p.path, 120);
          if (!cancelled) map[p.id] = url;
        } catch {
          // ignore
        }
      }
      if (!cancelled) setPhotoUrls(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [photos]);

  const summaryStats = useMemo(() => {
    // If multiple wounds in one visit, list them all
    return wounds.map((w) => {
      const area = areaCm2(w);
      return {
        label: w.wound_label,
        site: [w.laterality, w.body_site].filter(Boolean).join(" "),
        type: w.wound_type,
        stage: w.stage,
        lwd: [w.length_cm, w.width_cm, w.depth_cm].map((x) => (x == null ? "-" : x)).join(" × "),
        area,
        exudate: w.exudate,
        infection: w.infection_signs,
      };
    });
  }, [wounds]);

  const buildPacket = () => {
    const age = calcAge(demo?.dob);
    const lines: string[] = [];

    lines.push("IVR / WOUND CARE JUSTIFICATION PACKET (DRAFT)");
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("");

    lines.push("PATIENT");
    lines.push(`Patient ID: ${patientId}`);
    lines.push(`DOB: ${fmtDob(demo?.dob)}${age != null ? ` (Age ${age})` : ""} � Sex: ${demo?.sex ?? "-"}`);
    lines.push(`Phone: ${demo?.phone ?? "-"} � Email: ${demo?.email ?? "-"}`);
    lines.push(`Address: ${addr(demo)}`);
    lines.push("");

    lines.push("INSURANCE");
    lines.push(
      `Payer: ${ins?.payer_name ?? "-"}${ins?.plan_name ? ` � ${ins.plan_name}` : ""}`
    );
    lines.push(`Member ID: ${ins?.member_id ?? "-"} � Group: ${ins?.group_id ?? "-"}`);
    lines.push("");

    lines.push("VISIT");
    lines.push(`Visit ID: ${visitId}`);
    lines.push(`Date: ${visit?.visit_date ? fmtDate(visit.visit_date) : "-"}`);
    lines.push(`Status: ${visit?.status ?? "-"}`);
    if (visit?.summary) lines.push(`Summary: ${visit.summary}`);
    lines.push("");

    lines.push("WOUND ASSESSMENT (LATEST FOR THIS VISIT)");
    if (!summaryStats.length) {
      lines.push("No structured wound measurements recorded for this visit yet.");
    } else {
      for (const w of summaryStats) {
        lines.push(`- ${w.label}`);
        lines.push(`  Site: ${w.site || "-"}`);
        if (w.type) lines.push(`  Type: ${w.type}`);
        if (w.stage) lines.push(`  Stage: ${w.stage}`);
        lines.push(`  L×W×D (cm): ${w.lwd}`);
        if (w.area != null) lines.push(`  Area (cm²): ${w.area}`);
        if (w.exudate) lines.push(`  Exudate: ${w.exudate}`);
        if (w.infection) lines.push(`  Infection signs: ${w.infection}`);
      }
    }
    lines.push("");

    lines.push("SOAP NOTE (IF AVAILABLE)");
    if (!soap) {
      lines.push("No SOAP note found for this visit.");
    } else {
      lines.push(`Subjective: ${soap.subjective || "-"}`);
      lines.push(`Objective: ${soap.objective || "-"}`);
      lines.push(`Assessment: ${soap.assessment || "-"}`);
      lines.push(`Plan: ${soap.plan || "-"}`);
      if (soap.is_signed || soap.is_locked) lines.push(`Signed/Locked: Yes${soap.signed_at ? ` � ${fmtDate(soap.signed_at)}` : ""}`);
      else lines.push("Signed/Locked: No (draft)");
    }
    lines.push("");

    lines.push("TREATMENT PLAN (IF AVAILABLE)");
    if (!planItems.length) {
      lines.push("No treatment items found (Plan module may still be in progress).");
    } else {
      for (const it of planItems) {
        lines.push(`- ${it.name}${it.qty ? ` � Qty: ${it.qty}` : ""}${it.notes ? ` � Notes: ${it.notes}` : ""}`);
      }
    }
    lines.push("");

    lines.push("IMAGES / DOCUMENTATION");
    if (!photos.length) {
      lines.push("No wound photos found in patient_files for this visit (or patient).");
    } else {
      lines.push(`Included wound photos (last ${photos.length}):`);
      for (const p of photos) lines.push(`- ${p.filename} � ${fmtDate(p.created_at)}`);
    }
    lines.push("");

    lines.push("JUSTIFICATION DRAFT (EDITABLE)");
    lines.push(
      "Patient presents with a chronic/non-healing wound requiring advanced wound care. " +
        "Clinical assessment, measurements, and photographic documentation support medical necessity. " +
        "Requested advanced biologic/treatment plan is intended to accelerate closure, reduce infection risk, " +
        "and prevent complications/amputation. Please review attached documentation and approve treatment."
    );

    setPacketText(lines.join("\n"));
  };

  const copyPacket = async () => {
    if (!packetText.trim()) return;
    await navigator.clipboard.writeText(packetText);
    alert("Copied packet draft to clipboard.");
  };

  const openPhoto = async (p: FileRow) => {
    const url = photoUrls[p.id];
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const PacketCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
      <div className="h2">{title}</div>
      <div className="space" />
      {children}
    </div>
  );

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Packet Builder</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            One click produces an IVR-ready draft using wound measurements + photos + SOAP + plan.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading || busy}>
            Refresh
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setBusy(true);
              try {
                buildPacket();
              } finally {
                setBusy(false);
              }
            }}
            disabled={loading || busy}
            title="Generate packet draft"
          >
            {busy ? "Building..." : "Build Packet Draft"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={copyPacket} disabled={!packetText.trim()}>
            Copy
          </button>
        </div>
      </div>

      <div className="space" />

      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      {loading ? (
        <div className="card card-pad" style={{ background: "rgba(255,255,255,0.04)" }}><div className="muted">Loading IVR packet...</div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PacketCard title="What will be included">
            <div className="muted" style={{ fontSize: 12 }}>
              Visit: <strong>{visitId}</strong> � Date: <strong>{visit?.visit_date ? fmtDate(visit.visit_date) : "-"}</strong>
            </div>
            <div className="space" />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <div className="v-chip">Wounds this visit: <strong>{wounds.length}</strong></div>
              <div className="v-chip">Photos: <strong>{photos.length}</strong></div>
              <div className="v-chip">SOAP: <strong>{soap ? (soap.is_signed || soap.is_locked ? "Signed" : "Draft") : "None"}</strong></div>
              <div className="v-chip">Plan items: <strong>{planItems.length}</strong></div>
            </div>

            <div className="space" />

            {wounds.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {summaryStats.slice(0, 6).map((w, idx) => (
                  <div key={`${w.label}-${idx}`} className="muted" style={{ fontSize: 12 }}>
                    <strong>{w.label}</strong> � {w.site || "-"} � L×W×D: {w.lwd}
                    {w.area != null ? ` � Area: ${w.area} cm²` : ""}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No wound measurements recorded for this visit yet.</div>
            )}

            <div className="space" />

            {photos.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {photos.map((p) => (
                  <button
                    key={p.id}
                    className="btn btn-ghost"
                    type="button"
                    style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}
                    onClick={() => openPhoto(p)}
                    disabled={!photoUrls[p.id]}
                    title="Open photo"
                  >
                    <span>
                      <div style={{ fontWeight: 700 }}>{p.filename}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{fmtDate(p.created_at)}</div>
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>Open</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="muted">No wound photos found (category wound_photo/clinical_image).</div>
            )}
          </PacketCard>

          <PacketCard title="Packet Draft (editable)">
            <textarea
              className="input"
              value={packetText}
              onChange={(e) => setPacketText(e.target.value)}
              placeholder="Click “Build Packet Draft” to generate…"
              style={{ width: "100%", minHeight: 520, whiteSpace: "pre-wrap" }}
            />
            <div className="space" />
            <div className="muted" style={{ fontSize: 12 }}>
              Next step (we’ll add): “Export PDF” and “Attach to IVR submission” buttons.
            </div>
          </PacketCard>
        </div>
      )}
    </div>
  );
}

