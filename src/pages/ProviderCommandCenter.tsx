// src/pages/ProviderCommandCenter.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import InlineNotice from "../components/InlineNotice";
import VitalityHero from "../components/VitalityHero";
import SystemStatusBar from "../components/SystemStatusBar";
import { auditWrite } from "../lib/audit";
import { ensureAppointmentConversation } from "../lib/messaging/conversationService";
import {
  formatProviderStatusLabel,
  getProviderPatientLabel,
  isInactiveAppointmentStatus,
  loadProviderPatientNames,
} from "../lib/provider/workspace";
import {
  PROVIDER_ROUTES,
  providerMessagesPath,
  providerPatientCenterPath,
  providerVisitBuilderAppointmentPath,
  providerVisitChartPath,
} from "../lib/providerRoutes";
import { resolvePatientRecordId, startVisitFromAppointment } from "../lib/provider/visitLaunch";
import { analyzeWoundProgression } from "../lib/woundProgression";
import { analyzeWoundRisk } from "../lib/woundRiskAlerts";

type ApptRow = {
  id: string;
  location_id: string;
  service_id: string | null;
  patient_id: string;
  start_time: string;
  status: string;
  notes: string | null;
};

type IntakeRow = {
  id: string;
  patient_id: string;
  location_id: string | null;
  status: string | null;
  service_type: string | null;
  wound_data: unknown;
  medications: string | null;
  consent_accepted: boolean | null;
  consent_signed_name: string | null;
  consent_signed_at: string | null;
  created_at: string;
  patients:
    | {
        id: string;
        profile_id: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        email: string | null;
      }[]
    | null;
};

type LocationRow = { id: string; name: string };
type ServiceRow = { id: string; name: string };

type WoundAssessmentLite = {
  id: string;
  patient_id: string;
  visit_id: string;
  wound_label: string | null;
  created_at: string;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  exudate: string | null;
  infection_signs: string | null;
  pain_score: number | null;
};

type PatientLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type WoundAttentionItem = {
  patient_id: string;
  patient_name: string;
  visit_id: string;
  wound_label: string;
  trajectory: string;
  confidence: string;
  risk_level: "low" | "moderate" | "high";
  alert_title: string;
  alert_message: string;
  suggested_action: string;
};

export default function ProviderCommandCenter() {
  const { user, role, activeLocationId } = useAuth();
  const nav = useNavigate();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [localLocationId, setLocalLocationId] = useState<string>("");

  const [apptsToday, setApptsToday] = useState<ApptRow[]>([]);
  const [intakesPending, setIntakesPending] = useState<IntakeRow[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [attentionItems, setAttentionItems] = useState<WoundAttentionItem[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Action loading for buttons so we don't double-click
  const [busyApptId, setBusyApptId] = useState<string | null>(null);

  const isAdmin = useMemo(() => role === "super_admin" || role === "location_admin", [role]);
  const effectiveLocationId = activeLocationId || localLocationId;

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const svcName = useMemo(() => {
    const m = new Map(services.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "-" : "-");
  }, [services]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const scope = (q: any) => (effectiveLocationId ? q.eq("location_id", effectiveLocationId) : q);

  const loadBase = async () => {
    // locations (admin can see all; non-admin normally uses activeLocationId already)
    if (isAdmin) {
      const { data, error } = await supabase.from("locations").select("id,name").order("name");
      if (error) throw error;
      setLocations((data as LocationRow[]) ?? []);
    }

    // services (for labels)
    const { data: svcs, error: svcErr } = await supabase
      .from("services")
      .select("id,name")
      .eq("is_active", true)
      .order("name");
    if (svcErr) throw svcErr;
    setServices(((svcs ?? []) as any[]).map((s) => ({ id: s.id, name: s.name })) as ServiceRow[]);
  };

  const loadMain = async () => {
    setErr(null);
    setLoading(true);

    try {
      // If you're not admin, you MUST have effectiveLocationId
      if (!isAdmin && !effectiveLocationId) {
        setApptsToday([]);
        setIntakesPending([]);
        setPatientNames({});
        throw new Error("No active location found. Set Active Location in the status bar.");
      }

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // Today appointments
      let qA = supabase
        .from("appointments")
        .select("id,location_id,service_id,patient_id,start_time,status,notes")
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString())
        .order("start_time", { ascending: true });

      qA = scope(qA);

      const { data: appts, error: aErr } = await qA;
      if (aErr) throw aErr;

      const activeAppointments = ((appts as ApptRow[]) ?? []).filter((item) => !isInactiveAppointmentStatus(item.status));
      setApptsToday(activeAppointments);

      // Pending wound intakes
      let qI = supabase
        .from("patient_intakes")
        .select(
          `
          id,
          patient_id,
          location_id,
          service_type,
          status,
          wound_data,
          medications,
          consent_accepted,
          consent_signed_name,
          consent_signed_at,
          created_at,
          patients:patients (
            id,
            profile_id,
            first_name,
            last_name,
            phone,
            email
          )
        `
        )
        .in("status", ["submitted", "needs_info"])
        .order("created_at", { ascending: false });

      qI = scope(qI);

      const { data: intakes, error: iErr } = await qI;
      if (iErr) throw iErr;

      const pendingIntakes = (intakes as IntakeRow[]) ?? [];
      setIntakesPending(pendingIntakes);
      setPatientNames(
        await loadProviderPatientNames([
          ...activeAppointments.map((item) => item.patient_id),
          ...pendingIntakes.map((item) => item.patient_id).filter(Boolean),
        ])
      );

      let qW = supabase
        .from("wound_assessments")
        .select(`
          id,
          patient_id,
          visit_id,
          wound_label,
          created_at,
          length_cm,
          width_cm,
          depth_cm,
          exudate,
          infection_signs,
          pain_score
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (effectiveLocationId) {
        qW = qW.eq("location_id", effectiveLocationId);
      }

      const { data: woundRows, error: wErr } = await qW;
      if (wErr) throw wErr;

      const woundList = (woundRows as WoundAssessmentLite[]) ?? [];

      const patientIds = Array.from(new Set(woundList.map((w) => w.patient_id).filter(Boolean)));

      let patientMap = new Map<string, string>();
      if (patientIds.length > 0) {
        const { data: patientRows, error: pLiteErr } = await supabase
          .from("patients")
          .select("id,first_name,last_name")
          .in("id", patientIds);

        if (pLiteErr) throw pLiteErr;

        patientMap = new Map(
          ((patientRows as PatientLite[]) ?? []).map((p) => [
            p.id,
            `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Patient",
          ])
        );
      }

      const grouped = new Map<string, WoundAssessmentLite[]>();
      for (const row of woundList) {
        const label = (row.wound_label || "Unlabeled wound").trim();
        const key = `${row.patient_id}::${label}`;
        const arr = grouped.get(key) ?? [];
        arr.push(row);
        grouped.set(key, arr);
      }

      const items: WoundAttentionItem[] = [];

      for (const [, rows] of grouped.entries()) {
        const sorted = [...rows].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
        const latest = sorted[sorted.length - 1];
        const patientName = patientMap.get(latest.patient_id) ?? latest.patient_id;

        const progression = analyzeWoundProgression(
          sorted.map((r) => ({
            created_at: r.created_at,
            length_cm: r.length_cm,
            width_cm: r.width_cm,
            depth_cm: r.depth_cm,
            exudate: r.exudate,
            infection_signs: !!(r.infection_signs && r.infection_signs.trim()),
            pain_score: r.pain_score,
          }))
        );

        const risks = analyzeWoundRisk(
          sorted.map((r) => ({
            created_at: r.created_at,
            length_cm: r.length_cm,
            width_cm: r.width_cm,
            exudate: r.exudate,
            infection_signs: !!(r.infection_signs && r.infection_signs.trim()),
            pain_score: r.pain_score,
          }))
        );

        const topRisk =
          risks.find((r) => r.level === "high") ??
          risks.find((r) => r.level === "moderate") ??
          risks[0];

        if (!topRisk) continue;

        if (
          topRisk.level !== "low" ||
          progression.trajectory === "Worsening" ||
          progression.trajectory === "Stalled" ||
          progression.trajectory === "Slow Improvement"
        ) {
          items.push({
            patient_id: latest.patient_id,
            patient_name: patientName,
            visit_id: latest.visit_id,
            wound_label: latest.wound_label ?? "Unlabeled wound",
            trajectory: progression.trajectory,
            confidence: progression.confidence,
            risk_level: topRisk.level,
            alert_title: topRisk.title,
            alert_message: topRisk.message,
            suggested_action: progression.suggested_action,
          });
        }
      }

      items.sort((a, b) => {
        const rank = (v: string) => (v === "high" ? 0 : v === "moderate" ? 1 : 2);
        return rank(a.risk_level) - rank(b.risk_level);
      });

      setAttentionItems(items.slice(0, 12));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load command center.");
      setPatientNames({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        await loadBase();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load base data.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    loadMain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLocationId, isAdmin, user?.id]);

  const refresh = async () => {
    await loadMain();
  };

  const setStatus = async (id: string, status: string) => {
    setErr(null);
    setActionMessage(null);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    setActionMessage(`Appointment updated to ${status}.`);
    await refresh();
  };

  const messagePatient = async (appt: ApptRow) => {
    setErr(null);
    try {
      if (!user?.id) throw new Error("User not found.");
      const conversationId = await ensureAppointmentConversation({
        appointmentId: appt.id,
        patientCandidateId: appt.patient_id,
        locationId: appt.location_id,
        actorUserId: user.id,
        actorRole: role,
        title: "Appointment conversation",
      });
      nav(providerMessagesPath(conversationId));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to open conversation.");
    }
  };

  const openPatient = async (patientCandidateId: string) => {
    try {
      const patientId = await resolvePatientRecordId(patientCandidateId);
      nav(providerPatientCenterPath(patientId));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to open patient.");
    }
  };

  const goToVisit = (visitId: string) => {
    nav(providerVisitChartPath(visitId));
  };

  const approveAndOpenVisit = async (appt: ApptRow) => {
    setErr(null);
    setActionMessage(null);
    setBusyApptId(appt.id);

    try {
      const launched = await startVisitFromAppointment({
        appointmentId: appt.id,
        patientCandidateId: appt.patient_id,
        locationId: appt.location_id,
      });
      const visitId = launched.visitId;

      await auditWrite({
        event_type: launched.reusedExistingVisit ? "appointment_opened_existing_visit" : "appointment_visit_started",
        location_id: appt.location_id,
        patient_id: launched.patientId,
        visit_id: visitId,
        appointment_id: appt.id,
        entity_type: "patient_visits",
        entity_id: visitId,
        metadata: { reused_existing_visit: launched.reusedExistingVisit, source: "ProviderCommandCenter" },
      });

      setActionMessage(launched.reusedExistingVisit ? "Opened the existing visit for this appointment." : "Visit started.");
      await refresh();
      goToVisit(visitId);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start visit.");
    } finally {
      setBusyApptId(null);
    }
  };

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card card-pad">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        <div className="h2">{title}</div>
        <button className="btn btn-ghost" type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="space" />
      {children}
    </div>
  );

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Command Center"
          subtitle="Schedule and intake triage for your active location"
          primaryCta={{ label: "Open Queue", to: PROVIDER_ROUTES.queue }}
          secondaryCta={{ label: "Back to Dashboard", onClick: () => nav(PROVIDER_ROUTES.home) }}
          showKpis={false}
          rightActions={
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" onClick={() => nav(PROVIDER_ROUTES.referrals)}>
                Referrals
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav(PROVIDER_ROUTES.patients)}>
                Patient Center
              </button>
            </div>
          }
        />

        <SystemStatusBar />

        <div className="space" />

        {isAdmin ? (
          <div className="card card-pad">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="h2">Location Scope</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {effectiveLocationId ? `Viewing: ${locName(effectiveLocationId)}` : "Viewing: All Locations"}
                </div>
              </div>

              <div style={{ minWidth: 320 }}>
                <select
                  className="input"
                  value={localLocationId}
                  onChange={(e) => setLocalLocationId(e.target.value)}
                  disabled={!!activeLocationId}
                  title={activeLocationId ? "Active Location is set in the status bar." : "Filter by location (admin only)"}
                >
                  <option value="">All Locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {activeLocationId ? (
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    Note: Active Location currently overrides this filter.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : effectiveLocationId ? (
          <div className="card card-pad">
            <div className="muted">
              Viewing: <strong>{locName(effectiveLocationId)}</strong>
            </div>
          </div>
        ) : null}

        <div className="space" />

        {loading ? <div className="muted">Loading...</div> : null}
        {actionMessage ? <InlineNotice message={actionMessage} tone="success" style={{ marginBottom: 12 }} /> : null}
        {err ? <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} /> : null}

        {attentionItems.length > 0 ? (
          <>
            <Card title="Wounds Needing Attention">
              <div style={{ display: "grid", gap: 10 }}>
                {attentionItems.map((item, idx) => (
                  <div key={`${item.patient_id}-${item.wound_label}-${idx}`} className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 260 }}>
                        <div className="h2" style={{ margin: 0 }}>
                          {item.patient_name} - {item.wound_label}
                        </div>

                        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                          Risk: <strong>{item.risk_level}</strong> - Trajectory: <strong>{item.trajectory}</strong> - Confidence:{" "}
                          <strong>{item.confidence}</strong>
                        </div>

                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          <strong>{item.alert_title}</strong>: {item.alert_message}
                        </div>

                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Suggested action: {item.suggested_action}
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => nav(providerVisitChartPath(item.visit_id))}
                        >
                          Open Visit
                        </button>

                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => void openPatient(item.patient_id)}
                        >
                          Open Patient
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space" />
          </>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
          {/* Left: Today */}
          <Card title="Today's Schedule">
            {apptsToday.length === 0 ? (
              <div className="muted">No appointments today.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Use Visit Builder for scheduling and setup changes. Use Start Visit Now when you are ready to open the chart immediately.
                </div>
                {apptsToday.map((a) => {
                  const canApprove = a.status === "requested";
                  const isBusy = busyApptId === a.id;
                  const canUseActions = !!a.location_id;

                  return (
                    <div key={a.id} className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
                      <div
                        className="row"
                        style={{
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 240 }}>
                          <div className="h2" style={{ margin: 0 }}>
                            {fmtTime(a.start_time)} | {svcName(a.service_id)}
                          </div>
                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            Status: <strong>{formatProviderStatusLabel(a.status)}</strong> | Patient:{" "}
                            {getProviderPatientLabel(a.patient_id, patientNames)}
                          </div>
                          {a.notes ? (
                            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                              Notes: {a.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => nav(providerVisitBuilderAppointmentPath(a.id))}
                            title="Open Visit Builder for appointment setup and visit preparation"
                          >
                            Open Visit Builder
                          </button>

                          <button className="btn btn-ghost" type="button" onClick={() => void openPatient(a.patient_id)}>
                            Open Patient
                          </button>

                          <button className="btn btn-ghost" type="button" onClick={() => messagePatient(a)}>
                            Message
                          </button>

                          {canApprove ? (
                            <button
                              className="btn btn-primary"
                              type="button"
                              disabled={isBusy || !canUseActions}
                              onClick={() => approveAndOpenVisit(a)}
                              title="Approve the appointment when needed, then create or reuse the visit and open the chart"
                            >
                              {isBusy ? "Working..." : "Start Visit Now"}
                            </button>
                          ) : null}

                          <button className="btn btn-ghost" type="button" onClick={() => setStatus(a.id, "confirmed")} disabled={isBusy}>
                            Confirm
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => setStatus(a.id, "completed")} disabled={isBusy}>
                            Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Right: Intake queue */}
          <Card title="Pending Wound Intakes">
            {intakesPending.length === 0 ? (
              <div className="muted">No pending wound intakes.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {intakesPending.map((i) => (
                  <div key={i.id} className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Patient:{" "}
                      <strong>
                        {i.patients?.[0]
                          ? `${i.patients[0].first_name ?? ""} ${i.patients[0].last_name ?? ""}`.trim() ||
                            getProviderPatientLabel(i.patient_id, patientNames)
                          : getProviderPatientLabel(i.patient_id, patientNames)}
                      </strong>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Status: <strong>{formatProviderStatusLabel(i.status)}</strong>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Created: {new Date(i.created_at).toLocaleString()}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Intake ID: {i.id}
                    </div>
                    <div className="space" />
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-primary" type="button" onClick={() => nav(`${PROVIDER_ROUTES.intakes}?activeId=${i.id}`)}>
                        Open Intake
                      </button>
                      {i.patient_id ? (
                        <button className="btn btn-ghost" type="button" onClick={() => void openPatient(i.patient_id)}>
                          Open Patient
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space" />
      </div>
    </div>
  );
}


