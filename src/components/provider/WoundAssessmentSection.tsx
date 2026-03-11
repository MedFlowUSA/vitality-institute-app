import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { auditWrite } from "../../lib/audit";

type Props = {
  patientId: string;
  locationId: string;
  visitId: string;
};

type FileRow = {
  id: string;
  filename: string;
  content_type: string | null;
  created_at: string;
  visit_id: string | null;
  category: string | null;
};

type WoundRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  visit_id: string;

  wound_label: string;
  wound_series_id?: string | null;
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
  stage: string | null;

  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;

  undermining_cm: number | null;
  tunneling_cm: number | null;

  exudate: string | null;
  odor: string | null;
  infection_signs: string | null;

  necrotic_pct: number | null;
  slough_pct: number | null;
  granulation_pct: number | null;
  epithelial_pct: number | null;

  pain_score: number | null;
  notes: string | null;

  photo_file_id: string | null;
};

type HealingPoint = {
  id: string;
  created_at: string;
  visit_id: string;
  wound_label: string;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  area_cm2: number | null;
  body_site: string | null;
  laterality: string | null;
  wound_type: string | null;
};

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

function sortRowsDesc(rows: WoundRow[]) {
  return [...rows].sort((a, b) => {
    if (a.created_at === b.created_at) return a.id < b.id ? 1 : -1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

async function findExistingWoundSeries(patientId: string, label: string) {
  const { data, error } = await supabase
    .from("wound_assessments")
    .select("wound_series_id")
    .eq("patient_id", patientId)
    .eq("wound_label", label)
    .not("wound_series_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (data as { wound_series_id?: string | null } | null)?.wound_series_id ?? null;
}

function generateSeriesId() {
  return crypto.randomUUID();
}

export default function WoundAssessmentPanel({ patientId, locationId, visitId }: Props) {
  const { user } = useAuth();

  const [rows, setRows] = useState<WoundRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [woundLabel, setWoundLabel] = useState("Wound #1");
  const [bodySite, setBodySite] = useState("");
  const [laterality, setLaterality] = useState<"left" | "right" | "bilateral" | "">("");
  const [woundType, setWoundType] = useState("");
  const [stage, setStage] = useState("");

  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  const [underminingCm, setUnderminingCm] = useState("");
  const [tunnelingCm, setTunnelingCm] = useState("");

  const [exudate, setExudate] = useState<"none" | "low" | "moderate" | "high" | "">("");
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
  const [allPatientRows, setAllPatientRows] = useState<WoundRow[]>([]);
  const [selectedCurveLabel, setSelectedCurveLabel] = useState<string>("");

  const area = useMemo(() => {
    const l = toNum(lengthCm);
    const w = toNum(widthCm);
    if (l == null || w == null) return null;
    return Number((l * w).toFixed(2));
  }, [lengthCm, widthCm]);

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
    setLaterality((r.laterality as any) ?? "");
    setWoundType(r.wound_type ?? "");
    setStage(r.stage ?? "");

    setLengthCm(r.length_cm == null ? "" : String(r.length_cm));
    setWidthCm(r.width_cm == null ? "" : String(r.width_cm));
    setDepthCm(r.depth_cm == null ? "" : String(r.depth_cm));
    setUnderminingCm(r.undermining_cm == null ? "" : String(r.undermining_cm));
    setTunnelingCm(r.tunneling_cm == null ? "" : String(r.tunneling_cm));

    setExudate((r.exudate as any) ?? "");
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

  const load = async () => {
    if (!patientId || !locationId || !visitId) {
      setRows([]);
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const { data: woundRows, error: wErr } = await supabase
        .from("wound_assessments")
        .select(`
          id,created_at,location_id,patient_id,visit_id,
          wound_label,wound_series_id,body_site,laterality,wound_type,stage,
          length_cm,width_cm,depth_cm,undermining_cm,tunneling_cm,
          exudate,odor,infection_signs,
          necrotic_pct,slough_pct,granulation_pct,epithelial_pct,
          pain_score,notes,photo_file_id
        `)
        .eq("patient_id", patientId)
        .eq("location_id", locationId)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });

      if (wErr) throw wErr;
      setRows(sortRowsDesc((woundRows as WoundRow[]) ?? []));

      const { data: allRows, error: allErr } = await supabase
        .from("wound_assessments")
        .select(`
          id,created_at,location_id,patient_id,visit_id,
          wound_label,wound_series_id,body_site,laterality,wound_type,stage,
          length_cm,width_cm,depth_cm,undermining_cm,tunneling_cm,
          exudate,odor,infection_signs,
          necrotic_pct,slough_pct,granulation_pct,epithelial_pct,
          pain_score,notes,photo_file_id
        `)
        .eq("patient_id", patientId)
        .eq("location_id", locationId)
        .order("created_at", { ascending: true });

      if (allErr) throw allErr;

      const normalizedAllRows = (allRows as WoundRow[]) ?? [];
      setAllPatientRows(normalizedAllRows);

      const labels = Array.from(
        new Set(
          normalizedAllRows
            .map((r) => (r.wound_label || "").trim())
            .filter(Boolean)
        )
      );

      setSelectedCurveLabel((prev) => {
        if (prev && labels.includes(prev)) return prev;
        if (labels.includes(woundLabel.trim())) return woundLabel.trim();
        return labels[0] ?? "";
      });

      const { data: fileRows, error: fErr } = await supabase
        .from("patient_files")
        .select("id,filename,content_type,created_at,visit_id,category")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (fErr) throw fErr;
      setFiles((fileRows as FileRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load wound assessments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, locationId, visitId]);

  const filesForPicker = useMemo(() => {
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

    const seen = new Set<string>();
    return merged.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    }).slice(0, 50);
  }, [files, visitId]);

  const prevForLabel = useMemo(() => {
    const map = new Map<string, WoundRow[]>();
    for (const r of rows) {
      const key = (r.wound_label || "Wound").trim();
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [rows]);

  const currentImprovement = useMemo(() => {
    const labelKey = (woundLabel || "Wound").trim();
    const list = prevForLabel.get(labelKey) ?? [];
    const previous = list.find((x) => x.id !== editingId) ?? null;

    const prevArea =
      previous?.length_cm != null && previous?.width_cm != null
        ? Number(previous.length_cm) * Number(previous.width_cm)
        : null;

    const curLength = toNum(lengthCm);
    const curWidth = toNum(widthCm);
    const curArea = curLength != null && curWidth != null ? curLength * curWidth : null;

    if (!prevArea || !curArea) return null;

    const pct = ((prevArea - curArea) / prevArea) * 100;
    return Number(pct.toFixed(1));
  }, [prevForLabel, woundLabel, lengthCm, widthCm, editingId]);

  const availableCurveLabels = useMemo(() => {
    return Array.from(
      new Set(
        allPatientRows
          .map((r) => (r.wound_label || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [allPatientRows]);

  const healingCurve = useMemo<HealingPoint[]>(() => {
    const key = selectedCurveLabel.trim();
    if (!key) return [];

    return allPatientRows
      .filter((r) => (r.wound_label || "").trim() === key)
      .map((r) => ({
        id: r.id,
        created_at: r.created_at,
        visit_id: r.visit_id,
        wound_label: r.wound_label,
        length_cm: r.length_cm,
        width_cm: r.width_cm,
        depth_cm: r.depth_cm,
        area_cm2:
          r.length_cm != null && r.width_cm != null
            ? Number((Number(r.length_cm) * Number(r.width_cm)).toFixed(2))
            : null,
        body_site: r.body_site,
        laterality: r.laterality,
        wound_type: r.wound_type,
      }))
      .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  }, [allPatientRows, selectedCurveLabel]);

  const healingStats = useMemo(() => {
    if (healingCurve.length === 0) {
      return {
        firstArea: null as number | null,
        latestArea: null as number | null,
        improvementPct: null as number | null,
        entries: 0,
      };
    }

    const withArea = healingCurve.filter((x) => x.area_cm2 != null);
    const firstArea = withArea[0]?.area_cm2 ?? null;
    const latestArea = withArea[withArea.length - 1]?.area_cm2 ?? null;

    let improvementPct: number | null = null;
    if (firstArea != null && latestArea != null && firstArea > 0) {
      improvementPct = Number((((firstArea - latestArea) / firstArea) * 100).toFixed(1));
    }

    return {
      firstArea,
      latestArea,
      improvementPct,
      entries: healingCurve.length,
    };
  }, [healingCurve]);

  const save = async () => {
    if (!user?.id) {
      setErr("You must be signed in.");
      return;
    }

    if (!patientId || !locationId || !visitId) {
      setErr("Missing patient/location/visit.");
      return;
    }

    const label = woundLabel.trim();
    if (!label) {
      setErr("Wound label is required.");
      return;
    }

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
        const { data, error } = await supabase
          .from("wound_assessments")
          .update(payload)
          .eq("id", editingId)
          .select(`
            id,created_at,location_id,patient_id,visit_id,
            wound_label,wound_series_id,body_site,laterality,wound_type,stage,
            length_cm,width_cm,depth_cm,undermining_cm,tunneling_cm,
            exudate,odor,infection_signs,
            necrotic_pct,slough_pct,granulation_pct,epithelial_pct,
            pain_score,notes,photo_file_id
          `)
          .maybeSingle();

        if (error) throw error;

        const savedRow = (data as WoundRow | null) ?? null;

        if (savedRow) {
          setRows((prev) =>
            sortRowsDesc([savedRow, ...prev.filter((r) => r.id !== savedRow.id)])
          );
          setAllPatientRows((prev) => {
            const next = [savedRow, ...prev.filter((r) => r.id !== savedRow.id)];
            return next.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
          });
        }

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
        let seriesId = await findExistingWoundSeries(patientId, label);
        if (!seriesId) {
          seriesId = generateSeriesId();
        }

        const { data, error } = await supabase
          .from("wound_assessments")
          .insert([{ ...payload, wound_series_id: seriesId }])
          .select(`
            id,created_at,location_id,patient_id,visit_id,
            wound_label,wound_series_id,body_site,laterality,wound_type,stage,
            length_cm,width_cm,depth_cm,undermining_cm,tunneling_cm,
            exudate,odor,infection_signs,
            necrotic_pct,slough_pct,granulation_pct,epithelial_pct,
            pain_score,notes,photo_file_id
          `)
          .maybeSingle();

        if (error) throw error;

        const savedRow = (data as WoundRow | null) ?? null;

        if (savedRow) {
          setRows((prev) => sortRowsDesc([savedRow, ...prev]));
          setAllPatientRows((prev) => {
            const next = [...prev, savedRow];
            return next.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
          });
        }

        await auditWrite({
          location_id: locationId,
          patient_id: patientId,
          visit_id: visitId,
          event_type: "create",
          entity_type: "wound_assessment",
          entity_id: savedRow?.id ?? null,
          metadata: { wound_label: payload.wound_label },
        });
      }

      resetForm();
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save wound assessment.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!user?.id) {
      setErr("You must be signed in.");
      return;
    }

    const ok = window.confirm("Delete this wound assessment? This cannot be undone.");
    if (!ok) return;

    setErr(null);

    try {
      const { error } = await supabase.from("wound_assessments").delete().eq("id", id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      setAllPatientRows((prev) => prev.filter((r) => r.id !== id));

      await auditWrite({
        location_id: locationId,
        patient_id: patientId,
        visit_id: visitId,
        event_type: "delete",
        entity_type: "wound_assessment",
        entity_id: id,
        metadata: {},
      });

      if (editingId === id) resetForm();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete wound assessment.");
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const rowArea = (r: WoundRow) => {
    if (r.length_cm == null || r.width_cm == null) return null;
    return Number((Number(r.length_cm) * Number(r.width_cm)).toFixed(2));
  };

  return (
    <div>
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        <div>
          <div className="h2">Wound Assessment</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Structured measurements and progression for this visit.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button className="btn btn-ghost" type="button" onClick={resetForm} disabled={saving}>
            New Entry
          </button>
        </div>
      </div>

      <div className="space" />
      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
          <div className="h2">{editingId ? "Edit measurement" : "New measurement"}</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Visit: <strong>{visitId}</strong>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              value={woundLabel}
              onChange={(e) => setWoundLabel(e.target.value)}
              placeholder="Wound label (e.g., Left heel ulcer)"
              style={{ flex: "1 1 320px" }}
            />

            <select
              className="input"
              value={laterality}
              onChange={(e) => setLaterality(e.target.value as any)}
              style={{ flex: "0 0 160px" }}
            >
              <option value="">Laterality</option>
              <option value="left">left</option>
              <option value="right">right</option>
              <option value="bilateral">bilateral</option>
            </select>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              value={bodySite}
              onChange={(e) => setBodySite(e.target.value)}
              placeholder="Body site (e.g., Heel, Shin)"
              style={{ flex: "1 1 220px" }}
            />
            <input
              className="input"
              value={woundType}
              onChange={(e) => setWoundType(e.target.value)}
              placeholder="Type (diabetic/venous/pressure/etc.)"
              style={{ flex: "1 1 220px" }}
            />
            <input
              className="input"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              placeholder="Stage (optional)"
              style={{ flex: "0 0 160px" }}
            />
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Measurements (cm)</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
              placeholder="Length"
              style={{ flex: "0 0 120px" }}
            />
            <input
              className="input"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
              placeholder="Width"
              style={{ flex: "0 0 120px" }}
            />
            <input
              className="input"
              value={depthCm}
              onChange={(e) => setDepthCm(e.target.value)}
              placeholder="Depth"
              style={{ flex: "0 0 120px" }}
            />
            <input
              className="input"
              value={underminingCm}
              onChange={(e) => setUnderminingCm(e.target.value)}
              placeholder="Undermining"
              style={{ flex: "0 0 140px" }}
            />
            <input
              className="input"
              value={tunnelingCm}
              onChange={(e) => setTunnelingCm(e.target.value)}
              placeholder="Tunneling"
              style={{ flex: "0 0 120px" }}
            />

            <div className="v-chip">
              Area: <strong>{area == null ? "-" : `${area} cm²`}</strong>
            </div>

            {currentImprovement != null ? (
              <div className="v-chip" title="Compared to the previous measurement for this wound label in this visit">
                Change: <strong>{currentImprovement >= 0 ? `+${currentImprovement}% improved` : `${currentImprovement}%`}</strong>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                Add at least 2 measurements with the same label for % change.
              </div>
            )}
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Clinical</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <select
              className="input"
              value={exudate}
              onChange={(e) => setExudate(e.target.value as any)}
              style={{ flex: "0 0 160px" }}
            >
              <option value="">Exudate</option>
              <option value="none">none</option>
              <option value="low">low</option>
              <option value="moderate">moderate</option>
              <option value="high">high</option>
            </select>

            <input
              className="input"
              value={odor}
              onChange={(e) => setOdor(e.target.value)}
              placeholder="Odor (optional)"
              style={{ flex: "1 1 220px" }}
            />
            <input
              className="input"
              value={infectionSigns}
              onChange={(e) => setInfectionSigns(e.target.value)}
              placeholder="Infection signs (optional)"
              style={{ flex: "1 1 260px" }}
            />
            <input
              className="input"
              value={painScore}
              onChange={(e) => setPainScore(e.target.value)}
              placeholder="Pain (0-10)"
              style={{ flex: "0 0 120px" }}
            />
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Tissue composition (%)</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              value={necroticPct}
              onChange={(e) => setNecroticPct(e.target.value)}
              placeholder="Necrotic %"
              style={{ flex: "0 0 140px" }}
            />
            <input
              className="input"
              value={sloughPct}
              onChange={(e) => setSloughPct(e.target.value)}
              placeholder="Slough %"
              style={{ flex: "0 0 140px" }}
            />
            <input
              className="input"
              value={granulationPct}
              onChange={(e) => setGranulationPct(e.target.value)}
              placeholder="Granulation %"
              style={{ flex: "0 0 160px" }}
            />
            <input
              className="input"
              value={epithelialPct}
              onChange={(e) => setEpithelialPct(e.target.value)}
              placeholder="Epithelial %"
              style={{ flex: "0 0 160px" }}
            />
          </div>

          <div className="space" />

          <div className="h2" style={{ fontSize: 16 }}>Photo link (optional)</div>
          <select
            className="input"
            value={photoFileId}
            onChange={(e) => setPhotoFileId(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">No photo linked</option>
            {filesForPicker.map((f) => (
              <option key={f.id} value={f.id}>
                {f.filename}
                {f.visit_id === visitId ? " - this visit" : ""}
                {f.category ? ` - ${f.category}` : ""}
                {" - "}
                {new Date(f.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>

          <div className="space" />

          <textarea
            className="input"
            style={{ width: "100%", minHeight: 90 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Narrative notes (optional)..."
          />

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {editingId ? (
              <button className="btn btn-ghost" type="button" onClick={resetForm} disabled={saving}>
                Cancel Edit
              </button>
            ) : null}

            <button
              className="btn btn-primary"
              type="button"
              onClick={save}
              disabled={saving || !woundLabel.trim()}
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Measurement"}
            </button>
          </div>
        </div>

        <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
          <div className="h2">History (this visit)</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Click a row to edit. New saves should appear immediately here.
          </div>

          <div className="space" />

          {loading ? (
            <div className="muted">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="muted">No wound measurements yet for this visit.</div>
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
                          {r.wound_label}
                          {r.laterality ? ` - ${r.laterality}` : ""}
                          {r.body_site ? ` - ${r.body_site}` : ""}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                          {fmt(r.created_at)} - Area: <strong>{a == null ? "-" : `${a} cm²`}</strong>
                          {r.stage ? ` - Stage: ${r.stage}` : ""}
                          {r.exudate ? ` - Exudate: ${r.exudate}` : ""}
                        </div>
                      </span>

                      <span className="muted" style={{ fontSize: 12 }}>
                        Open
                      </span>
                    </button>

                    <div
                      className="row"
                      style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 8 }}
                    >
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

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2">Healing Curve</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
              Longitudinal wound progression for this patient by wound label.
            </div>
          </div>

          <select
            className="input"
            value={selectedCurveLabel}
            onChange={(e) => setSelectedCurveLabel(e.target.value)}
            style={{ minWidth: 240 }}
          >
            <option value="">Select wound label</option>
            {availableCurveLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space" />

        {!selectedCurveLabel ? (
          <div className="muted">No wound label selected yet.</div>
        ) : healingCurve.length === 0 ? (
          <div className="muted">No historical measurements found for this wound label.</div>
        ) : (
          <>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="card card-pad" style={{ flex: "1 1 200px" }}>
                <div className="muted">Entries</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>{healingStats.entries}</div>
              </div>

              <div className="card card-pad" style={{ flex: "1 1 200px" }}>
                <div className="muted">Initial Area</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>
                  {healingStats.firstArea == null ? "-" : `${healingStats.firstArea} cm²`}
                </div>
              </div>

              <div className="card card-pad" style={{ flex: "1 1 200px" }}>
                <div className="muted">Latest Area</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>
                  {healingStats.latestArea == null ? "-" : `${healingStats.latestArea} cm²`}
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

            <div className="card card-pad" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>Visit</th>
                    <th style={{ padding: "10px 8px" }}>Body Site</th>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px" }}>L × W × D</th>
                    <th style={{ padding: "10px 8px" }}>Area</th>
                  </tr>
                </thead>
                <tbody>
                  {healingCurve.map((point) => (
                    <tr key={point.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "10px 8px" }}>{fmt(point.created_at)}</td>
                      <td style={{ padding: "10px 8px" }}>
                        {point.visit_id === visitId ? "Current Visit" : point.visit_id.slice(0, 8)}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {point.body_site ?? "-"}
                        {point.laterality ? ` - ${point.laterality}` : ""}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{point.wound_type ?? "-"}</td>
                      <td style={{ padding: "10px 8px" }}>
                        {point.length_cm ?? "-"} × {point.width_cm ?? "-"} × {point.depth_cm ?? "-"}
                      </td>
                      <td style={{ padding: "10px 8px", fontWeight: 700 }}>
                        {point.area_cm2 == null ? "-" : `${point.area_cm2} cm²`}
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
      <div className="muted" style={{ fontSize: 12 }}>
        Next step: healing curve chart plus a one-click packet builder for photos, measurements, narrative, and plan.
      </div>
    </div>
  );
}
