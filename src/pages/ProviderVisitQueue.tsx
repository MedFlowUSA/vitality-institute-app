import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";
import ProviderWorkspaceNav from "../components/provider/ProviderWorkspaceNav";

type VisitRow = {
  id: string;
  visit_date: string;
  patient_id: string;
  location_id: string;
  status: string | null;
  patients: {
    first_name: string | null;
    last_name: string | null;
  }[] | null;
};

export default function ProviderVisitQueue() {
  const nav = useNavigate();

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("patient_visits")
        .select(`
          id,
          visit_date,
          location_id,
          patient_id,
          status,
          patients(first_name,last_name)
        `)
        .order("visit_date", { ascending: false })
        .limit(50);

      if (cancelled) return;
      setVisits(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Visit Queue"
          subtitle="Active patient visits"
          showKpis={false}
        />

        <div className="space" />

        <ProviderWorkspaceNav compact />

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading visits...</div>}

          {!loading && visits.length === 0 && (
            <div className="muted">No visits found.</div>
          )}

          {!loading && visits.map((v) => {
            const p = Array.isArray(v.patients) ? v.patients[0] : null;
            const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`;

            return (
              <div
                key={v.id}
                className="row"
                style={{
                  justifyContent: "space-between",
                  padding: 12,
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{name}</div>

                  <div className="muted">
                    {new Date(v.visit_date).toLocaleString()}
                  </div>

                  <div className="muted">
                    Status: {v.status ?? "new"}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => nav(`/provider/visits/${v.id}`)}
                >
                  Open Visit
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
