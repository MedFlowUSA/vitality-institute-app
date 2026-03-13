import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import LeadStatusCard from "../components/vital-ai/LeadStatusCard";
import { supabase } from "../lib/supabase";
import type { VitalAiFileRow, VitalAiLeadRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function AdminVitalAiLeadDetail() {
  const { leadId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lead, setLead] = useState<VitalAiLeadRow | null>(null);
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [files, setFiles] = useState<VitalAiFileRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: leadRow, error: leadError } = await supabase.from("vital_ai_leads").select("*").eq("id", leadId).maybeSingle();
        if (leadError) throw leadError;
        const nextLead = (leadRow as VitalAiLeadRow | null) ?? null;
        setLead(nextLead);
        if (!nextLead) return;

        const [{ data: sessionRow, error: sessionError }, { data: fileRows, error: fileError }] = await Promise.all([
          supabase.from("vital_ai_sessions").select("*").eq("id", nextLead.session_id).maybeSingle(),
          supabase.from("vital_ai_files").select("*").eq("session_id", nextLead.session_id).order("created_at", { ascending: false }),
        ]);

        if (sessionError) throw sessionError;
        if (fileError) throw fileError;

        setSession((sessionRow as VitalAiSessionRow | null) ?? null);
        setFiles((fileRows as VitalAiFileRow[]) ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load lead detail.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [leadId]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero title="Vital AI Lead Detail" subtitle="Operational lead details for Phase 1 staff follow-up." secondaryCta={{ label: "Back", to: "/admin/vital-ai" }} showKpis={false} />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading lead detail...</div></div>
        ) : err ? (
          <div className="card card-pad" style={{ color: "crimson" }}>{err}</div>
        ) : !lead ? (
          <div className="card card-pad"><div className="muted">Lead not found.</div></div>
        ) : (
          <>
            <LeadStatusCard lead={lead} />
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Lead Payload</div>
              <div className="space" />
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(lead.lead_json ?? {}, null, 2)}</pre>
            </div>
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Session</div>
              <div className="space" />
              <div className="muted">Status: {session?.status ?? "-"}</div>
              <div className="muted" style={{ marginTop: 6 }}>Completed: {session?.completed_at ? new Date(session.completed_at).toLocaleString() : "-"}</div>
            </div>
            <div className="space" />
            <div className="card card-pad">
              <div className="h2">Files</div>
              <div className="space" />
              {files.length === 0 ? <div className="muted">No files attached.</div> : files.map((file) => <div key={file.id} style={{ marginBottom: 8 }}>{file.category} • {file.filename}</div>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
