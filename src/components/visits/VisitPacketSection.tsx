import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Props = {
  visitId: string;
  patientId: string;
};

export default function VisitPacketSection({ visitId, patientId }: Props) {
  const [loading, setLoading] = useState(true);
  const [wounds, setWounds] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);

    const { data: woundRows } = await supabase
      .from("wound_assessments")
      .select("*")
      .eq("visit_id", visitId);

    const { data: planRow } = await supabase
      .from("patient_treatment_plans")
      .select("*")
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: fileRows } = await supabase
      .from("patient_files")
      .select("*")
      .eq("patient_id", patientId);

    setWounds(woundRows ?? []);
    setPlan(planRow ?? null);
    setFiles(fileRows ?? []);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [visitId]);

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

      <div className="muted">
        Clinical documentation summary for this visit.
      </div>

      <div className="space" />

      <div className="h2" style={{ fontSize: 18 }}>Wound Measurements</div>

      <div className="space" />

      {wounds.length === 0 ? (
        <div className="muted">No wound measurements.</div>
      ) : (
        wounds.map((w) => {
          const area = w.length_cm && w.width_cm
            ? (w.length_cm * w.width_cm).toFixed(2)
            : "-";

          return (
            <div key={w.id} className="card card-pad" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>
                {w.wound_label}
              </div>

              <div className="muted">
                {w.body_site ?? "-"} {w.laterality ?? ""}
              </div>

              <div className="space" />

              <div>
                Size: {w.length_cm ?? "-"} x {w.width_cm ?? "-"} x {w.depth_cm ?? "-"} cm
              </div>

              <div>
                Area: {area} cm2
              </div>

              <div>
                Exudate: {w.exudate ?? "-"}
              </div>

              <div>
                Infection Signs: {w.infection_signs ?? "-"}
              </div>
            </div>
          );
        })
      )}

      <div className="space" />

      <div className="h2" style={{ fontSize: 18 }}>Treatment Plan</div>

      <div className="space" />

      {!plan ? (
        <div className="muted">No treatment plan.</div>
      ) : (
        <div className="card card-pad">
          <div><strong>Summary</strong></div>
          <div>{plan.summary ?? "-"}</div>

          <div className="space" />

          <div><strong>Instructions</strong></div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {plan.patient_instructions ?? "-"}
          </div>
        </div>
      )}

      <div className="space" />

      <div className="h2" style={{ fontSize: 18 }}>Attached Photos</div>

      <div className="space" />

      {files.length === 0 ? (
        <div className="muted">No files.</div>
      ) : (
        files
          .filter((f) => f.content_type?.startsWith("image/"))
          .map((f) => (
            <div key={f.id} className="card card-pad" style={{ marginBottom: 8 }}>
              {f.filename}
            </div>
          ))
      )}
    </div>
  );
}
