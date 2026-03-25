import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { auditWrite } from "../../lib/audit";
import { getErrorMessage } from "../../lib/patientRecords";
import type { WoundAssessmentRecord, WoundExudateLevel, WoundLaterality } from "../../lib/provider/types";
import ProviderPrerequisiteCard from "./ProviderPrerequisiteCard";

type Props = {
  patientId: string;
  locationId: string;
  visitId: string;
  onContinueToPlan?: () => void;
};

type FileRow = {
  id: string;
  filename: string;
  content_type: string | null;
  created_at: string;
  visit_id: string | null;
  category: string | null;
};

type WoundRow = WoundAssessmentRecord;
type InsertedWoundAssessmentRow = Pick<WoundAssessmentRecord, "id">;

function toNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clampPct(n: number | null): number | null {
  if (n == null) return null;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export default function WoundAssessmentPanel({ patientId, locationId, visitId, onContinueToPlan }: Props) {
  const { user } = useAuth();

  const [rows, setRows] = useState<WoundRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [woundLabel, setWoundLabel] = useState("Wound #1");
  const [bodySite, setBodySite] = useState("");
  const [laterality, setLaterality] = useState<WoundLaterality>("");
  const [woundType, setWoundType] = useState("");
  const [stage, setStage] = useState("");

  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  const [underminingCm, setUnderminingCm] = useState("");
  const [tunnelingCm, setTunnelingCm] = useState("");

  const [exudate, setExudate] = useState<WoundExudateLevel>("");
  const [odor, setOdor] = useState("");
  const [infectionSigns, setInfectionSigns] = useState("");

  const [necroticPct, setNecroticPct] = useState("");
  const [sloughPct, setSloughPct] = useState("");
  const [granulationPct, setGranulationPct] = useState("");
  const [epithelialPct, setEpithelialPct] = useState("");

  const [painScore, setPainScore] = useState("");
  const [notes, setNotes] = useState("");

  const [photoFileId, setPhotoFileId] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const area = useMemo(() => {
    const l = toNum(lengthCm);
    const w = toNum(widthCm);
    if (l == null || w == null) return null;
    return Number((l * w).toFixed(2));
  }, [lengthCm, widthCm]);

  const load = async () => {
    if (!patientId || !locationId || !visitId) return;
    setLoading(true);
    setErr(null);

    try {
      const { data: woundRows, error: wErr } = await supabase
        .from("wound_assessments")
        .select(
          `
            id,created_at,location_id,patient_id,visit_id,
            wound_label,body_site,laterality,wound_type,stage,
            length_cm,width_cm,depth_cm,undermining_cm,tunneling_cm,
            exudate,odor,infection_signs,
            necrotic_pct,slough_pct,granulation_pct,epithelial_pct,
            pain_score,notes,photo_file_id
          `
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (wErr) throw wErr;
      setRows((woundRows as WoundRow[]) ?? []);

      const { data: fileRows, error: fErr } = await supabase
        .from("patient_files")
        .select("id,filename,content_type,created_at,visit_id,category")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (fErr) throw fErr;
      setFiles((fileRows as FileRow[]) ?? []);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load wound assessments."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, locationId, visitId]);

  const filesForPicker = useMemo(() => {
    // Prefer visit files, then general; keep images first
    const isImage = (f: FileRow) => (f.content_type || "").startsWith("image/");
    const visit = files.filter((f) => f.visit_id === visitId);
    const general = files.filter((f) => !f.visit_id);
    const merged = [...visit, ...general];
    merged.sort((a, b) => {
      const ai = isImage(a) ? 0 : 1;
      const bi = isImage(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.created_at < b.created_at ? 1 : -1;
    });
    return merged.slice(0, 50);
  }, [files, visitId]);

  const resetForm = () => {
    setEditingId(null);
    setWoundLabel("Wound #1");
    setBodySite("");
    setLaterality("");
    setWoundType("");
    setStage("");
    setLengthCm("");
    setWidthCm("");
    setDepthCm("");
    setUnderminingCm("");
    setTunnelingCm("");
    setExudate("");
    setOdor("");
    setInfectionSigns("");
    setNecroticPct("");
    setSloughPct("");
    setGranulationPct("");
    setEpithelialPct("");
    setPainScore("");
    setNotes("");
    setPhotoFileId("");
  };

  const fillFromRow = (r: WoundRow) => {
    setEditingId(r.id);
    setWoundLabel(r.wound_label ?? "Wound");
    setBodySite(r.body_site ?? "");
    setLaterality(r.laterality ?? "");
    setWoundType(r.wound_type ?? "");
    setStage(r.stage ?? "");

    setLengthCm(r.length_cm == null ? "" : String(r.length_cm));
    setWidthCm(r.width_cm == null ? "" : String(r.width_cm));
    setDepthCm(r.depth_cm == null ? "" : String(r.depth_cm));
    setUnderminingCm(r.undermining_cm == null ? "" : String(r.undermining_cm));
    setTunnelingCm(r.tunneling_cm == null ? "" : String(r.tunneling_cm));

    setExudate(r.exudate ?? "");
    setOdor(r.odor ?? "");
    setInfectionSigns(r.infection_signs ?? "");

    setNecroticPct(r.necrotic_pct == null ? "" : String(r.necrotic_pct));
    setSloughPct(r.slough_pct == null ? "" : String(r.slough_pct));
    setGranulationPct(r.granulation_pct == null ? "" : String(r.granulation_pct));
    setEpithelialPct(r.epithelial_pct == null ? "" : String(r.epithelial_pct));

    setPainScore(r.pain_score == null ? "" : String(r.pain_score));
    setNotes(r.notes ?? "");

    setPhotoFileId(r.photo_file_id ?? "");
  };

  const prevForLabel = useMemo(() => {
    const map = new Map<string, WoundRow[]>();
    for (const r of rows) {
      const key = (r.wound_label || "Wound").trim();
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    // rows already ordered desc by created_at
    return map;
  }, [rows]);

  const currentImprovement = useMemo(() => {
    const labelKey = (woundLabel || "Wound").trim();
    const list = prevForLabel.get(labelKey) ?? [];
    // when editing, list[0] may be the row itself; find "previous" different id
    const previous = list.find((x) => x.id !== editingId) ?? null;

    const prevArea =
      previous?.length_cm != null && previous?.width_cm != null
        ? Number(previous.length_cm) * Number(previous.width_cm)
        : null;

    const curArea =
      toNum(lengthCm) != null && toNum(widthCm) != null ? Number(toNum(lengthCm)!) * Number(toNum(widthCm)!) : null;

    if (!prevArea || !curArea) return null;

    const pct = ((prevArea - curArea) / prevArea) * 100;
    return Number(pct.toFixed(1));
  }, [prevForLabel, woundLabel, lengthCm, widthCm, editingId]);

  const save = async () => {
    if (!user?.id) return setErr("You must be signed in.");
    if (!patientId || !locationId || !visitId) return setErr("Missing patient/location/visit.");

    const label = woundLabel.trim();
    if (!label) return setErr("Wound label is required.");

    setSaving(true);
    setErr(null);

    const payload = {
      location_id: locationId,
      patient_id: patientId,
      visit_id: visitId,

      wound_label: label,
      body_site: bodySite.trim() || null,
      laterality: laterality || null,
      wound_type: woundType.trim() || null,
      stage: stage.trim() || null,

      length_cm: toNum(lengthCm),
      width_cm: toNum(widthCm),
      depth_cm: toNum(depthCm),
      undermining_cm: toNum(underminingCm),
      tunneling_cm: toNum(tunnelingCm),

      exudate: exudate || null,
      odor: odor.trim() || null,
      infection_signs: infectionSigns.trim() || null,

      necrotic_pct: clampPct(toNum(necroticPct)),
      slough_pct: clampPct(toNum(sloughPct)),
      granulation_pct: clampPct(toNum(granulationPct)),
      epithelial_pct: clampPct(toNum(epithelialPct)),

      pain_score: toNum(painScore) != null ? Math.round(Number(toNum(painScore)!)) : null,
      notes: notes.trim() || null,

      photo_file_id: photoFileId || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("wound_assessments").update(payload).eq("id", editingId);
        if (error) throw error;

        await auditWrite({
          location_id: locationId,
          patient_id: patientId,
          visit_id: visitId,
          event_type: "update",
          entity_type: "wound_assessment",
          entity_id: editingId,
          metadata: { wound_label: payload.wound_label },
        });
      } else {
        const { data, error } = await supabase.from("wound_assessments").insert([payload]).select("id").maybeSingle<InsertedWoundAssessmentRow>();
        if (error) throw error;

        const newId = data?.id;

        await auditWrite({
          location_id: locationId,
          patient_id: patientId,
          visit_id: visitId,
          event_type: "create",
          entity_type: "wound_assessment",
          entity_id: newId ?? null,
          metadata: { wound_label: payload.wound_label },
        });
      }

      await load();
      resetForm();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to save wound assessment."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!user?.id) return setErr("You must be signed in.");
    const ok = window.confirm("Delete this wound assessment? This cannot be undone.");
    if (!ok) return;

    setErr(null);
    try {
      const { error } = await supabase.from("wound_assessments").delete().eq("id", id);
      if (error) throw error;

      await auditWrite({
        location_id: locationId,
        patient_id: patientId,
        visit_id: visitId,
        event_type: "delete",
        entity_type: "wound_assessment",
        entity_id: id,
        metadata: {},
      });

      await load();
      if (editingId === id) resetForm();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to delete wound assessment."));
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const rowArea = (r: WoundRow) => {
    if (r.length_cm == null || r.width_cm == null) return null;
    return Number((Number(r.length_cm) * Number(r.width_cm)).toFixed(2));
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Wound Assessment</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Structured wound measurements, tissue findings, and progression for this visit.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button className="btn btn-ghost" type="button" onClick={resetForm} disabled={saving}>
            New Assessment
          </button>
          {onContinueToPlan ? (
            <button className="btn btn-ghost" type="button" onClick={onContinueToPlan} disabled={saving}>
              Next: Treatment Plan
            </button>
          ) : null}
        </div>
      </div>

      <div className="space" />
      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT: Form */}
        <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
          <div className="h2">{editingId ? "Edit Assessment" : "New Assessment"}</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Visit: <strong>{visitId}</strong>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input className="input" value={woundLabel} onChange={(e) => setWoundLabel(e.target.value)} placeholder="Wound label (e.g., Left heel ulcer)" style={{ flex: "1 1 320px" }} />

            <select className="input" value={laterality} onChange={(e) => setLaterality(e.target.value as WoundLaterality)} style={{ flex: "0 0 160px" }}>
              <option value="">Laterality</option>
              <option value="left">left</option>
              <option value="right">right</option>
              <option value="bilateral">bilateral</option>
            </select>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input className="input" value={bodySite} onChange={(e) => setBodySite(e.target.value)} placeholder="Body site (e.g., Heel, Shin)" style={{ flex: "1 1 220px" }} />
            <input className="input" value={woundType} onChange={(e) => setWoundType(e.target.value)} placeholder="Type (diabetic/venous/pressure/etc.)" style={{ flex: "1 1 220px" }} />
            <input className="input" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Stage (optional)" style={{ flex: "0 0 160px" }} />
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Measurements (cm)</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="Length" style={{ flex: "0 0 120px" }} />
            <input className="input" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} placeholder="Width" style={{ flex: "0 0 120px" }} />
            <input className="input" value={depthCm} onChange={(e) => setDepthCm(e.target.value)} placeholder="Depth" style={{ flex: "0 0 120px" }} />
            <input className="input" value={underminingCm} onChange={(e) => setUnderminingCm(e.target.value)} placeholder="Undermining" style={{ flex: "0 0 140px" }} />
            <input className="input" value={tunnelingCm} onChange={(e) => setTunnelingCm(e.target.value)} placeholder="Tunneling" style={{ flex: "0 0 120px" }} />

            <div className="v-chip">
              Area: <strong>{area == null ? "-" : `${area} cm2`}</strong>
            </div>

            {currentImprovement != null ? (
              <div className="v-chip" title="Compared to the previous measurement for this wound label">
                Change: <strong>{currentImprovement >= 0 ? `+${currentImprovement}% improved` : `${currentImprovement}%`}</strong>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>Add at least 2 measurements (same label) for % change.</div>
            )}
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Clinical</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <select className="input" value={exudate} onChange={(e) => setExudate(e.target.value as WoundExudateLevel)} style={{ flex: "0 0 160px" }}>
              <option value="">Exudate</option>
              <option value="none">none</option>
              <option value="low">low</option>
              <option value="moderate">moderate</option>
              <option value="high">high</option>
            </select>

            <input className="input" value={odor} onChange={(e) => setOdor(e.target.value)} placeholder="Odor (optional)" style={{ flex: "1 1 220px" }} />
            <input className="input" value={infectionSigns} onChange={(e) => setInfectionSigns(e.target.value)} placeholder="Infection signs (optional)" style={{ flex: "1 1 260px" }} />
            <input className="input" value={painScore} onChange={(e) => setPainScore(e.target.value)} placeholder="Pain (0-10)" style={{ flex: "0 0 120px" }} />
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Tissue composition (%)</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input className="input" value={necroticPct} onChange={(e) => setNecroticPct(e.target.value)} placeholder="Necrotic %" style={{ flex: "0 0 140px" }} />
            <input className="input" value={sloughPct} onChange={(e) => setSloughPct(e.target.value)} placeholder="Slough %" style={{ flex: "0 0 140px" }} />
            <input className="input" value={granulationPct} onChange={(e) => setGranulationPct(e.target.value)} placeholder="Granulation %" style={{ flex: "0 0 160px" }} />
            <input className="input" value={epithelialPct} onChange={(e) => setEpithelialPct(e.target.value)} placeholder="Epithelial %" style={{ flex: "0 0 160px" }} />
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Photo link (optional)</div>
          <select className="input" value={photoFileId} onChange={(e) => setPhotoFileId(e.target.value)} style={{ width: "100%" }}>
            <option value="">No photo linked</option>
            {filesForPicker.map((f) => (
              <option key={f.id} value={f.id}>
                {f.filename} {f.visit_id === visitId ? "- (this visit)" : ""} {f.category ? `- ${f.category}` : ""} - {new Date(f.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>

          <div className="space" />

          <textarea className="input" style={{ width: "100%", minHeight: 90 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Narrative notes (optional)..." />

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {editingId ? (
              <button className="btn btn-ghost" type="button" onClick={() => setEditingId(null)} disabled={saving}>
                Cancel edit
              </button>
            ) : null}

            <button className="btn btn-primary" type="button" onClick={save} disabled={saving || !woundLabel.trim()}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Measurement"}
            </button>
          </div>
        </div>

        {/* RIGHT: History */}
        <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
          <div className="h2">History</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Select an entry to review or update the recorded wound measurements.
          </div>

          <div className="space" />

          {loading ? (
            <div className="card card-pad" style={{ background: "rgba(255,255,255,0.04)" }}><div className="muted">Loading wound measurements...</div></div>
          ) : rows.length === 0 ? (
            <ProviderPrerequisiteCard
              title="No Wound Assessment Yet"
              message="Add the first wound assessment for this visit to capture measurements, tissue findings, and progression."
              actionLabel="Add First Assessment"
              onAction={resetForm}
              secondaryLabel={onContinueToPlan ? "Open Treatment Plan" : undefined}
              onSecondaryAction={onContinueToPlan}
            />
          ) : (
            <div className="card card-pad" style={{ maxHeight: 520, overflow: "auto" }}>
              {rows.map((r) => {
                const a = rowArea(r);
                const isActive = editingId === r.id;

                return (
                  <div key={r.id} style={{ marginBottom: 12 }}>
                    <button
                      className={isActive ? "btn btn-primary" : "btn btn-ghost"}
                      type="button"
                      style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}
                      onClick={() => fillFromRow(r)}
                      title="Edit this measurement"
                    >
                      <span>
                        <div style={{ fontWeight: 800 }}>
                          {r.wound_label} {r.laterality ? `- ${r.laterality}` : ""} {r.body_site ? `- ${r.body_site}` : ""}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                          {fmt(r.created_at)} - Area: <strong>{a == null ? "-" : `${a} cm2`}</strong>
                          {r.stage ? ` - Stage: ${r.stage}` : ""}
                          {r.exudate ? ` - Exudate: ${r.exudate}` : ""}
                        </div>
                      </span>

                      <span className="muted" style={{ fontSize: 12 }}>
                        Open
                      </span>
                    </button>

                    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 8 }}>
                      <button className="btn btn-ghost" type="button" onClick={() => remove(r.id)}>
                        Delete
                      </button>
                    </div>

                    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", marginTop: 12 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space" />
      <div className="muted" style={{ fontSize: 12 }}>
        Next: we'll add the healing curve chart + one-click "Packet Builder" (latest measurement + narrative + photos + plan) so it's IVR-ready.
      </div>
    </div>
  );
}




