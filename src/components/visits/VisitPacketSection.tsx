import { useEffect, useMemo, useState } from "react";
import { resolvePatientFileOwnerIds } from "../../lib/patientFiles";
import { formatProviderStatusLabel } from "../../lib/provider/workspace";
import { supabase } from "../../lib/supabase";

type Props = {
  visitId: string;
  patientId: string;
};

type WoundRow = {
  id: string;
  wound_label: string;
  body_site: string | null;
  laterality: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  exudate: string | null;
  infection_signs: string | null;
};

type TreatmentPlanRow = {
  id: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
};

type FileRow = {
  id: string;
  filename: string;
  content_type: string | null;
};

function formatArea(length: number | null, width: number | null) {
  if (length == null || width == null) return "-";
  return (Number(length) * Number(width)).toFixed(2);
}

export default function VisitPacketSection({ visitId, patientId }: Props) {
  const [wounds, setWounds] = useState<WoundRow[]>([]);
  const [plan, setPlan] = useState<TreatmentPlanRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedPacketKey, setLoadedPacketKey] = useState<string | null>(null);
  const packetKey = useMemo(() => `${visitId}:${patientId}`, [patientId, visitId]);
  const loading = loadedPacketKey !== packetKey;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);

        const patientFileOwnerIds = await resolvePatientFileOwnerIds(patientId);

        const [{ data: woundRows, error: woundError }, { data: planRow, error: planError }, { data: fileRows, error: fileError }] =
          await Promise.all([
            supabase
              .from("wound_assessments")
              .select("id,wound_label,body_site,laterality,length_cm,width_cm,depth_cm,exudate,infection_signs")
              .eq("visit_id", visitId),
            supabase
              .from("patient_treatment_plans")
              .select("id,status,summary,patient_instructions")
              .eq("visit_id", visitId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("patient_files")
              .select("id,filename,content_type")
              .in("patient_id", patientFileOwnerIds)
              .eq("visit_id", visitId)
              .order("created_at", { ascending: false }),
          ]);

        if (woundError) throw woundError;
        if (planError) throw planError;
        if (fileError) throw fileError;
        if (cancelled) return;

        setWounds((woundRows as WoundRow[] | null) ?? []);
        setPlan((planRow as TreatmentPlanRow | null) ?? null);
        setFiles((fileRows as FileRow[] | null) ?? []);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load visit packet.");
        setWounds([]);
        setPlan(null);
        setFiles([]);
      } finally {
        if (!cancelled) setLoadedPacketKey(packetKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [packetKey, patientId, visitId]);

  const imageFiles = useMemo(
    () => files.filter((file) => (file.content_type ?? "").startsWith("image/")),
    [files]
  );

  if (loading) {
    return (
      <div className="card card-pad">
        <div className="h2">Visit Packet</div>
        <div className="space" />
        <div className="muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="h2">Visit Packet</div>

      <div className="space" />

      <div className="muted">Clinical documentation summary for this visit.</div>

      <div className="space" />

      {error ? (
        <>
          <div style={{ color: "crimson" }}>{error}</div>
          <div className="space" />
        </>
      ) : null}

      <div className="h2" style={{ fontSize: 18 }}>Wound Measurements</div>

      <div className="space" />

      {wounds.length === 0 ? (
        <div className="muted">No wound measurements.</div>
      ) : (
        wounds.map((wound) => (
          <div key={wound.id} className="card card-pad" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>{wound.wound_label}</div>

            <div className="muted">
              {[wound.body_site, wound.laterality].filter(Boolean).join(" | ") || "-"}
            </div>

            <div className="space" />

            <div>
              Size: {wound.length_cm ?? "-"} x {wound.width_cm ?? "-"} x {wound.depth_cm ?? "-"} cm
            </div>

            <div>Area: {formatArea(wound.length_cm, wound.width_cm)} cm2</div>

            <div>Exudate: {wound.exudate ?? "-"}</div>

            <div>Infection Signs: {wound.infection_signs ?? "-"}</div>
          </div>
        ))
      )}

      <div className="space" />

      <div className="h2" style={{ fontSize: 18 }}>Treatment Plan</div>

      <div className="space" />

      {!plan ? (
        <div className="muted">No treatment plan.</div>
      ) : (
        <div className="card card-pad">
          <div><strong>Status</strong></div>
          <div>{formatProviderStatusLabel(plan.status)}</div>

          <div className="space" />

          <div><strong>Summary</strong></div>
          <div>{plan.summary ?? "-"}</div>

          <div className="space" />

          <div><strong>Instructions</strong></div>
          <div style={{ whiteSpace: "pre-wrap" }}>{plan.patient_instructions ?? "-"}</div>
        </div>
      )}

      <div className="space" />

      <div className="h2" style={{ fontSize: 18 }}>Attached Photos</div>

      <div className="space" />

      {imageFiles.length === 0 ? (
        <div className="muted">No visit photos.</div>
      ) : (
        imageFiles.map((file) => (
          <div key={file.id} className="card card-pad" style={{ marginBottom: 8 }}>
            {file.filename}
          </div>
        ))
      )}
    </div>
  );
}
