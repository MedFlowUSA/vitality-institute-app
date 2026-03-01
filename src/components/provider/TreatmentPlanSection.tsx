import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

type Props = {
  visitId: string;
  patientId: string;
  locationId: string;
};

export default function TreatmentPlanSection({ visitId, patientId, locationId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [instructions, setInstructions] = useState("");
  const [planJson, setPlanJson] = useState("{}");
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  async function loadPlan() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("patient_treatment_plans")
      .select("*")
      .eq("visit_id", visitId)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setPlanId(data.id);
      setSummary(data.summary || "");
      setInstructions(data.patient_instructions || "");
      setPlanJson(JSON.stringify(data.plan || {}, null, 2));
      setIsLocked(!!data.is_locked);
    } else {
      // No plan yet
      setPlanId(null);
      setSummary("");
      setInstructions("");
      setPlanJson("{}");
      setIsLocked(false);
    }

    setLoading(false);
  }

  async function createPlanIfMissing() {
    if (planId) return planId;

    const { data, error } = await supabase
      .from("patient_treatment_plans")
      .insert({
        visit_id: visitId,
        patient_id: patientId,
        location_id: locationId,
        created_by: user?.id ?? null,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      return null;
    }

    setPlanId(data.id);
    return data.id as string;
  }

  async function savePlan() {
    setError(null);

    const id = await createPlanIfMissing();
    if (!id) return;

    let parsedPlan: any = {};
    try {
      parsedPlan = JSON.parse(planJson);
    } catch {
      setError("Invalid JSON in plan field.");
      return;
    }

    const { error } = await supabase
      .from("patient_treatment_plans")
      .update({
        summary,
        patient_instructions: instructions,
        plan: parsedPlan,
      })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadPlan();
    alert("Treatment plan saved.");
  }

  async function signAndLock() {
    setError(null);

    const id = await createPlanIfMissing();
    if (!id) return;

    const { error } = await supabase
      .from("patient_treatment_plans")
      .update({
        signed_by: user?.id ?? null,
        signed_at: new Date().toISOString(),
        is_locked: true,
        status: "active",
      })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadPlan();
    alert("Treatment plan signed and locked.");
  }

  if (loading) return <div className="mt-4">Loading treatment plan...</div>;

  return (
    <div className="card bg-base-100 shadow p-4 mt-4">
      <h2 className="text-lg font-bold mb-3">Treatment Plan</h2>

      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div className="mb-3">
        <label className="font-semibold">Summary</label>
        <textarea
          className="textarea textarea-bordered w-full"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={isLocked}
        />
      </div>

      <div className="mb-3">
        <label className="font-semibold">Patient Instructions</label>
        <textarea
          className="textarea textarea-bordered w-full"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={isLocked}
        />
      </div>

      <div className="mb-3">
        <label className="font-semibold">Structured Plan (JSON)</label>
        <textarea
          className="textarea textarea-bordered w-full font-mono text-sm"
          rows={10}
          value={planJson}
          onChange={(e) => setPlanJson(e.target.value)}
          disabled={isLocked}
        />
      </div>

      {!isLocked ? (
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={savePlan}>
            Save
          </button>
          <button className="btn btn-success" onClick={signAndLock}>
            Sign &amp; Lock
          </button>
        </div>
      ) : (
        <div className="text-green-600 font-semibold">This plan is locked.</div>
      )}
    </div>
  );
}