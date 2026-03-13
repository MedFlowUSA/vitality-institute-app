import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import ProfileSummaryCard from "../components/vital-ai/ProfileSummaryCard";
import { supabase } from "../lib/supabase";
import type { VitalAiFileRow, VitalAiProfileRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function ProviderVitalAiProfileDetail() {
  const { profileId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<VitalAiProfileRow | null>(null);
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [files, setFiles] = useState<VitalAiFileRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: profileRow, error: profileError } = await supabase.from("vital_ai_profiles").select("*").eq("id", profileId).maybeSingle();
        if (profileError) throw profileError;
        const nextProfile = (profileRow as VitalAiProfileRow | null) ?? null;
        setProfile(nextProfile);
        if (!nextProfile) return;

        const [{ data: sessionRow, error: sessionError }, { data: fileRows, error: fileError }] = await Promise.all([
          supabase.from("vital_ai_sessions").select("*").eq("id", nextProfile.session_id).maybeSingle(),
          supabase.from("vital_ai_files").select("*").eq("session_id", nextProfile.session_id).order("created_at", { ascending: false }),
        ]);

        if (sessionError) throw sessionError;
        if (fileError) throw fileError;

        setSession((sessionRow as VitalAiSessionRow | null) ?? null);
        setFiles((fileRows as VitalAiFileRow[]) ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load provider profile.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profileId]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero title="Vital AI Profile Detail" subtitle="Phase 1 provider review of intake-generated clinical summaries." secondaryCta={{ label: "Back", to: "/provider/vital-ai" }} showKpis={false} />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading provider profile...</div></div>
        ) : err ? (
          <div className="card card-pad" style={{ color: "crimson" }}>{err}</div>
        ) : !profile ? (
          <div className="card card-pad"><div className="muted">Profile not found.</div></div>
        ) : (
          <>
            <ProfileSummaryCard profile={profile} />
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Structured Profile Data</div>
              <div className="space" />
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(profile.profile_json ?? {}, null, 2)}</pre>
            </div>
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Risk Flags</div>
              <div className="space" />
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(profile.risk_flags_json ?? [], null, 2)}</pre>
            </div>
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Attached Files</div>
              <div className="space" />
              {files.length === 0 ? <div className="muted">No files attached.</div> : files.map((file) => <div key={file.id} style={{ marginBottom: 8 }}>{file.category} • {file.filename}</div>)}
            </div>
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Session State</div>
              <div className="space" />
              <div className="muted">Current step: {session?.current_step_key ?? "-"}</div>
              <div className="muted" style={{ marginTop: 6 }}>Completed: {session?.completed_at ? new Date(session.completed_at).toLocaleString() : "-"}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
