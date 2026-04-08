import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import InlineNotice from "../InlineNotice";

type Props = {
  patientId: string;
  locationId: string;
  visitId: string;
};

type WoundRow = {
  wound_label: string;
  wound_type: string | null;
  stage: string | null;
  body_site: string | null;
  laterality: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  infection_signs: string | null;
};

type CaptureRow = {
  id: string;
  suggested: any;
  selected: any;
  notes: string | null;
};

function areaCm2(l?: number | null, w?: number | null) {
  if (l == null || w == null) return null;
  const a = Number(l) * Number(w);
  return Number.isFinite(a) ? Number(a.toFixed(2)) : null;
}

// A conservative, editable suggestion set.
// We keep ICD coarse (category-level) to avoid wrong specificity.
// Billing can refine later.
function suggestCodesFromWounds(wounds: WoundRow[]) {
  const cpt = new Set<string>();
  const icd = new Set<string>();

  // Basic E/M suggestion as placeholder (billing chooses final)
  cpt.add("99213/99214 (E/M - choose based on complexity)");

  for (const w of wounds) {
    const area = areaCm2(w.length_cm, w.width_cm);
    const hasInfection = !!(w.infection_signs && w.infection_signs.trim());

    // Very common wound ICD families (intentionally broad):
    const t = (w.wound_type || "").toLowerCase();
    if (t.includes("pressure")) icd.add("L89.- (Pressure ulcer family)");
    else if (t.includes("diabet")) icd.add("E11.621 (DM w foot ulcer) / L97.- (Lower limb ulcer family)");
    else if (t.includes("venous")) icd.add("I87.2 / I83.- (Venous insufficiency family) + L97.-");
    else if (t.includes("arterial") || t.includes("ischem")) icd.add("I70.- (Atherosclerosis family) + L97.-");
    else icd.add("L97.- / L98.49 (Non-pressure chronic ulcer / other skin ulcer)");

    // If depth recorded, suggest debridement family (billing confirms)
    if ((w.depth_cm ?? 0) > 0) {
      cpt.add("97597/97598 (Selective debridement - consider)");
      cpt.add("11042/11045 (Debridement subcutaneous - consider)");
      cpt.add("11043/11046 (Debridement muscle - consider)");
      cpt.add("11044/11047 (Debridement bone - consider)");
    }

    // Infection risk may imply additional services (billing confirms)
    if (hasInfection) {
      cpt.add("99214+ (Higher complexity E/M - consider if infection)");
    }

    // If area is large, flag graft/skin substitute possibility (billing confirms)
    if (area != null && area >= 10) {
      cpt.add("15271/15272 (Skin substitute/graft application - consider)");
    }
  }

  // Common adjuncts in wound care (optional)
  cpt.add("29581 (Compression wrap - if indicated)");
  cpt.add("97602 (Non-selective debridement - if performed)");

  return {
    cpt: Array.from(cpt),
    icd: Array.from(icd),
  };
}

export default function ChargeCapturePanel({ patientId, locationId, visitId }: Props) {
  const { user } = useAuth();

  const [wounds, setWounds] = useState<WoundRow[]>([]);
  const [row, setRow] = useState<CaptureRow | null>(null);
  const [selectedCpt, setSelectedCpt] = useState<string[]>([]);
  const [selectedIcd, setSelectedIcd] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const suggested = useMemo(() => suggestCodesFromWounds(wounds), [wounds]);

  const load = async () => {
    if (!patientId || !locationId || !visitId) return;
    setLoading(true);
    setErr(null);

    try {
      // Wounds for this visit
      const { data: w, error: wErr } = await supabase
        .from("wound_assessments")
        .select("wound_label,wound_type,stage,body_site,laterality,length_cm,width_cm,depth_cm,infection_signs,created_at")
        .eq("patient_id", patientId)
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });

      if (wErr) throw wErr;
      setWounds((w as unknown as WoundRow[]) ?? []);

      // Existing capture row for visit
      const { data: existing, error: eErr } = await supabase
        .from("visit_charge_capture")
        .select("id,suggested,selected,notes")
        .eq("visit_id", visitId)
        .maybeSingle();

      if (eErr && eErr.code !== "PGRST116") throw eErr;

      if (existing?.id) {
        setRow(existing as unknown as CaptureRow);
        const sel = (existing as any).selected || {};
        setSelectedCpt(Array.isArray(sel.cpt) ? sel.cpt : []);
        setSelectedIcd(Array.isArray(sel.icd) ? sel.icd : []);
        setNotes((existing as any).notes || "");
      } else {
        setRow(null);
        setSelectedCpt([]);
        setSelectedIcd([]);
        setNotes("");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load charge capture.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, locationId, visitId]);

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const seedFromSuggested = () => {
    setSelectedCpt(suggested.cpt.slice(0, 4)); // seed a few (billing can expand)
    setSelectedIcd(suggested.icd.slice(0, 3));
  };

  const save = async () => {
    if (!user?.id) return setErr("You must be signed in.");
    setBusy(true);
    setErr(null);
    setSaveMessage(null);

    try {
      const payload = {
        patient_id: patientId,
        location_id: locationId,
        visit_id: visitId,
        suggested,
        selected: { cpt: selectedCpt, icd: selectedIcd },
        notes: notes.trim() || null,
        created_by: user.id,
      };

      if (!row?.id) {
        const { data, error } = await supabase
          .from("visit_charge_capture")
          .insert([payload])
          .select("id,suggested,selected,notes")
          .maybeSingle();
        if (error) throw error;
        setRow(data as unknown as CaptureRow);
      } else {
        const { error } = await supabase
          .from("visit_charge_capture")
          .update({
            suggested,
            selected: { cpt: selectedCpt, icd: selectedIcd },
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (error) throw error;
      }

      setSaveMessage("Charge capture saved.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="h2">Charge Capture</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Suggestions based on visit data. Billing reviews/edits before submission.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading || busy}>Refresh</button>
          <button className="btn btn-ghost" type="button" onClick={seedFromSuggested} disabled={loading || busy}>Seed</button>
          <button className="btn btn-primary" type="button" onClick={save} disabled={loading || busy}>Save</button>
        </div>
      </div>

      <div className="space" />
      {saveMessage ? <InlineNotice message={saveMessage} tone="success" style={{ marginBottom: 10 }} /> : null}
      {err ? <InlineNotice message={err} tone="error" style={{ marginBottom: 10 }} /> : null}
      {loading ? <div className="muted">Loading...</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
          <div className="h2">Suggested CPT</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Click to include.</div>
          <div className="space" />
          <div style={{ display: "grid", gap: 8 }}>
            {suggested.cpt.map((c) => (
              <button
                key={c}
                type="button"
                className={selectedCpt.includes(c) ? "btn btn-primary" : "btn btn-ghost"}
                onClick={() => setSelectedCpt((prev) => toggle(prev, c))}
                style={{ justifyContent: "space-between" }}
              >
                <span style={{ textAlign: "left" }}>{c}</span>
                <span>{selectedCpt.includes(c) ? "OK" : ""}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
          <div className="h2">Suggested ICD (broad families)</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Billing refines specificity.</div>
          <div className="space" />
          <div style={{ display: "grid", gap: 8 }}>
            {suggested.icd.map((c) => (
              <button
                key={c}
                type="button"
                className={selectedIcd.includes(c) ? "btn btn-primary" : "btn btn-ghost"}
                onClick={() => setSelectedIcd((prev) => toggle(prev, c))}
                style={{ justifyContent: "space-between" }}
              >
                <span style={{ textAlign: "left" }}>{c}</span>
                <span>{selectedIcd.includes(c) ? "OK" : ""}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
        <div className="h2">Billing Notes</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Optional: include procedures performed, materials used, time/complexity, etc.
        </div>
        <div className="space" />
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: "100%", minHeight: 110 }}
          placeholder="Example: Debridement performed, depth to subcutaneous, wound cleansed, compression applied, graft applied..."
        />
      </div>
    </div>
  );
}



