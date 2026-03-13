import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import ProfileSummaryCard from "../components/vital-ai/ProfileSummaryCard";
import { supabase } from "../lib/supabase";
import type { VitalAiPathwayRow, VitalAiProfileRow } from "../lib/vitalAi/types";

export default function ProviderVitalAiQueue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<VitalAiProfileRow[]>([]);
  const [pathways, setPathways] = useState<Record<string, VitalAiPathwayRow>>({});
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(() => profiles.find((profile) => profile.id === selectedId) ?? null, [profiles, selectedId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: profileRows, error: profileError } = await supabase.from("vital_ai_profiles").select("*").order("created_at", { ascending: false });
        if (profileError) throw profileError;

        const nextProfiles = (profileRows as VitalAiProfileRow[]) ?? [];
        setProfiles(nextProfiles);
        if (!selectedId && nextProfiles[0]) setSelectedId(nextProfiles[0].id);

        const pathwayIds = Array.from(new Set(nextProfiles.map((profile) => profile.pathway_id)));
        if (pathwayIds.length > 0) {
          const { data: pathwayRows, error: pathwayError } = await supabase.from("vital_ai_pathways").select("*").in("id", pathwayIds);
          if (pathwayError) throw pathwayError;
          const nextPathways: Record<string, VitalAiPathwayRow> = {};
          for (const row of (pathwayRows as VitalAiPathwayRow[]) ?? []) nextPathways[row.id] = row;
          setPathways(nextPathways);
        } else {
          setPathways({});
        }
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load provider review queue.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero title="Vital AI Provider Review" subtitle="Phase 1 review queue for intake-generated patient profiles." secondaryCta={{ label: "Back", to: "/provider" }} showKpis={false} />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading provider queue...</div></div>
        ) : err ? (
          <div className="card card-pad" style={{ color: "crimson" }}>{err}</div>
        ) : (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="card card-pad" style={{ flex: "1 1 360px", minWidth: 320 }}>
              <div className="h2">Profiles Awaiting Review</div>
              <div className="space" />
              {profiles.length === 0 ? (
                <div className="muted">No profiles yet.</div>
              ) : profiles.map((profile) => (
                <button key={profile.id} className={selectedId === profile.id ? "btn btn-primary" : "btn btn-ghost"} type="button" style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left" }} onClick={() => setSelectedId(profile.id)}>
                  <span>
                    <div style={{ fontWeight: 800 }}>{String((profile.profile_json as any)?.patient?.first_name ?? "Patient")} {String((profile.profile_json as any)?.patient?.last_name ?? "")}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {(pathways[profile.pathway_id]?.name ?? "Pathway")} • {profile.triage_level ?? "-"} • {new Date(profile.created_at).toLocaleString()}
                    </div>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>Open</span>
                </button>
              ))}
            </div>

            <div className="card card-pad" style={{ flex: "2 1 680px", minWidth: 340 }}>
              {!selected ? (
                <div className="muted">Select a profile.</div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div className="h2">Provider Snapshot</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {(pathways[selected.pathway_id]?.name ?? "Pathway")} • {selected.status}
                      </div>
                    </div>
                    <button className="btn btn-primary" type="button" onClick={() => navigate(`/provider/vital-ai/profile/${selected.id}`)}>
                      Open Full Profile
                    </button>
                  </div>

                  <div className="space" />

                  <ProfileSummaryCard profile={selected} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
