import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import LeadStatusCard from "../components/vital-ai/LeadStatusCard";
import { supabase } from "../lib/supabase";
import type { PatientRecord, VitalAiLeadRow, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function AdminVitalAiQueue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [leads, setLeads] = useState<VitalAiLeadRow[]>([]);
  const [sessions, setSessions] = useState<Record<string, VitalAiSessionRow>>({});
  const [patients, setPatients] = useState<Record<string, PatientRecord>>({});
  const [pathways, setPathways] = useState<Record<string, VitalAiPathwayRow>>({});
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(() => leads.find((lead) => lead.id === selectedId) ?? null, [leads, selectedId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: leadRows, error: leadError } = await supabase
          .from("vital_ai_leads")
          .select("*")
          .order("created_at", { ascending: false });
        if (leadError) throw leadError;

        const nextLeads = (leadRows as VitalAiLeadRow[]) ?? [];
        setLeads(nextLeads);
        if (!selectedId && nextLeads[0]) setSelectedId(nextLeads[0].id);

        const sessionIds = nextLeads.map((lead) => lead.session_id);
        const pathwayIds = Array.from(new Set(nextLeads.map((lead) => lead.pathway_id)));
        const patientIds = Array.from(new Set(nextLeads.map((lead) => lead.patient_id).filter(Boolean))) as string[];

        const [sessionRows, pathwayRows, patientRows] = await Promise.all([
          sessionIds.length ? supabase.from("vital_ai_sessions").select("*").in("id", sessionIds) : Promise.resolve({ data: [], error: null }),
          pathwayIds.length ? supabase.from("vital_ai_pathways").select("*").in("id", pathwayIds) : Promise.resolve({ data: [], error: null }),
          patientIds.length ? supabase.from("patients").select("id,profile_id,first_name,last_name,phone,email,dob").in("id", patientIds) : Promise.resolve({ data: [], error: null }),
        ]);

        if (sessionRows.error) throw sessionRows.error;
        if (pathwayRows.error) throw pathwayRows.error;
        if (patientRows.error) throw patientRows.error;

        const nextSessions: Record<string, VitalAiSessionRow> = {};
        for (const row of (sessionRows.data as VitalAiSessionRow[]) ?? []) nextSessions[row.id] = row;
        setSessions(nextSessions);

        const nextPathways: Record<string, VitalAiPathwayRow> = {};
        for (const row of (pathwayRows.data as VitalAiPathwayRow[]) ?? []) nextPathways[row.id] = row;
        setPathways(nextPathways);

        const nextPatients: Record<string, PatientRecord> = {};
        for (const row of (patientRows.data as PatientRecord[]) ?? []) nextPatients[row.id] = row;
        setPatients(nextPatients);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load Vital AI lead queue.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const patientLabel = (lead: VitalAiLeadRow) => {
    const patient = lead.patient_id ? patients[lead.patient_id] : null;
    if (!patient) return String((lead.lead_json as any)?.name ?? "Unknown patient");
    return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || patient.email || patient.phone || "Unknown patient";
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero title="Vital AI Staff Queue" subtitle="Phase 1 operational queue for new general consultation and wound care leads." secondaryCta={{ label: "Back", to: "/admin" }} showKpis={false} />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading lead queue...</div></div>
        ) : err ? (
          <div className="card card-pad" style={{ color: "crimson" }}>{err}</div>
        ) : (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="card card-pad" style={{ flex: "1 1 360px", minWidth: 320 }}>
              <div className="h2">Open Leads</div>
              <div className="space" />
              {leads.length === 0 ? (
                <div className="muted">No Vital AI leads yet.</div>
              ) : leads.map((lead) => (
                <button key={lead.id} className={selectedId === lead.id ? "btn btn-primary" : "btn btn-ghost"} type="button" style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left" }} onClick={() => setSelectedId(lead.id)}>
                  <span>
                    <div style={{ fontWeight: 800 }}>{patientLabel(lead)}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {(pathways[lead.pathway_id]?.name ?? "Pathway")} • {lead.lead_status} • {new Date(lead.created_at).toLocaleString()}
                    </div>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>Open</span>
                </button>
              ))}
            </div>

            <div className="card card-pad" style={{ flex: "2 1 680px", minWidth: 340 }}>
              {!selected ? (
                <div className="muted">Select a lead.</div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div className="h2">Lead Detail</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {patientLabel(selected)} • {(pathways[selected.pathway_id]?.name ?? "Pathway")}
                      </div>
                    </div>

                    <button className="btn btn-primary" type="button" onClick={() => navigate(`/admin/vital-ai/leads/${selected.id}`)}>
                      Open Full Detail
                    </button>
                  </div>

                  <div className="space" />

                  <LeadStatusCard lead={selected} />

                  <div className="space" />

                  <div className="card card-pad">
                    <div className="h2">Phase 1 Staff Snapshot</div>
                    <div className="space" />
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <div className="v-chip">Pathway: <strong>{pathways[selected.pathway_id]?.name ?? "-"}</strong></div>
                      <div className="v-chip">Priority: <strong>{selected.priority ?? "-"}</strong></div>
                      <div className="v-chip">Submitted: <strong>{sessions[selected.session_id]?.completed_at ? "Yes" : "No"}</strong></div>
                    </div>
                    <div className="space" />
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(selected.lead_json ?? {}, null, 2)}</pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
