// src/pages/ProviderQueue.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import SystemStatusBar from "../components/SystemStatusBar";
import ProviderPrerequisiteCard from "../components/provider/ProviderPrerequisiteCard";
import { getErrorMessage } from "../lib/patientRecords";
import { getProviderQueueRecommendation } from "../lib/provider/providerWorkflow";
import { resolvePatientRecordId, startVisitFromAppointment } from "../lib/provider/visitLaunch";
import type { ProviderVisitSummary } from "../lib/provider/types";

type VisitRow = ProviderVisitSummary & {
  appointment_id: string | null;
  created_at: string;
};

type SoapMini = {
  id: string;
  visit_id: string;
  is_locked: boolean | null;
  is_signed: boolean | null;
  signed_at: string | null;
};

type LabMini = {
  id: string;
  visit_id: string | null;
  status: string;
};

type AppointmentRow = {
  id: string;
  patient_id: string;
  location_id: string;
  start_time: string;
  status: string | null;
  notes: string | null;
};

type QueueItem =
  | { kind: "visit"; visit: VisitRow }
  | { kind: "appointment"; appointment: AppointmentRow };

export default function ProviderQueue() {
  const nav = useNavigate();
  const { user, role, signOut, activeLocationId } = useAuth();

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [soapByVisit, setSoapByVisit] = useState<Record<string, SoapMini>>({});
  const [labsByVisit, setLabsByVisit] = useState<Record<string, LabMini[]>>({});

  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isStaff = role && role !== "patient";

  // Load queue for active location
  const loadQueue = async () => {
    if (!user?.id) return;
    if (!activeLocationId) {
      setVisits([]);
      setAppointments([]);
      setSoapByVisit({});
      setLabsByVisit({});
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      // Visits
      const { data: v, error: vErr } = await supabase
        .from("patient_visits")
        .select("id,patient_id,location_id,appointment_id,visit_date,status,summary,created_at")
        .eq("location_id", activeLocationId)
        .order("visit_date", { ascending: false })
        .limit(60);

      if (vErr) throw vErr;
      const visitRows = (v as VisitRow[]) ?? [];
      setVisits(visitRows);
      const appointmentIdsWithVisits = new Set(visitRows.map((item) => item.appointment_id).filter(Boolean));

      const visitIds = visitRows.map((x) => x.id);

      const { data: appointmentsData, error: appointmentsErr } = await supabase
        .from("appointments")
        .select("id,patient_id,location_id,start_time,status,notes")
        .eq("location_id", activeLocationId)
        .order("start_time", { ascending: false })
        .limit(60);

      if (appointmentsErr) throw appointmentsErr;

      setAppointments(
        ((appointmentsData as AppointmentRow[]) ?? []).filter((item) => !appointmentIdsWithVisits.has(item.id))
      );

      // SOAP minis
      if (visitIds.length) {
        const { data: s, error: sErr } = await supabase
          .from("patient_soap_notes")
          .select("id,visit_id,is_locked,is_signed,signed_at")
          .in("visit_id", visitIds);

        if (sErr) throw sErr;

        const map: Record<string, SoapMini> = {};
        for (const row of (s as SoapMini[]) ?? []) {
          // last write wins is fine for now; if multiples exist it is a data issue anyway
          map[row.visit_id] = {
            id: row.id,
            visit_id: row.visit_id,
            is_locked: row.is_locked ?? null,
            is_signed: row.is_signed ?? null,
            signed_at: row.signed_at ?? null,
          };
        }
        setSoapByVisit(map);
      } else {
        setSoapByVisit({});
      }

      // Labs minis
      if (visitIds.length) {
        const { data: l, error: lErr } = await supabase
          .from("patient_labs")
          .select("id,visit_id,status")
          .eq("location_id", activeLocationId)
          .in("visit_id", visitIds);

        if (lErr) throw lErr;

        const map: Record<string, LabMini[]> = {};
        for (const row of (l as LabMini[]) ?? []) {
          const vid = row.visit_id ?? "general";
          const arr = map[vid] ?? [];
          arr.push({ id: row.id, visit_id: row.visit_id, status: row.status });
          map[vid] = arr;
        }
        setLabsByVisit(map);
      } else {
        setLabsByVisit({});
      }
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load provider queue."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationId, user?.id]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleString();

  const queueItems = useMemo<QueueItem[]>(() => {
    const visitItems = visits.map((visit) => ({ kind: "visit" as const, visit, sortAt: visit.visit_date }));
    const appointmentItems = appointments.map((appointment) => ({
      kind: "appointment" as const,
      appointment,
      sortAt: appointment.start_time,
    }));

    return [...visitItems, ...appointmentItems]
      .sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1))
      .map((item) => (item.kind === "visit" ? { kind: "visit", visit: item.visit } : { kind: "appointment", appointment: item.appointment }));
  }, [appointments, visits]);

  const kpis = useMemo(() => {
    const now = new Date();
    const todayKey = now.toLocaleDateString();

    const openVisits = visits.filter((v) => (v.status ?? "").toLowerCase() !== "closed").length;

    const needsSoap = visits.filter((v) => {
      const s = soapByVisit[v.id];
      return !s?.id || !(s.is_locked || s.is_signed || s.signed_at);
    }).length;

    const needsLabs = visits.filter((v) => {
      const labs = labsByVisit[v.id] ?? [];
      return labs.length === 0;
    }).length;

    const newToday = visits.filter((v) => new Date(v.created_at).toLocaleDateString() === todayKey).length;

    return { openVisits, needsSoap, needsLabs, newToday };
  }, [visits, soapByVisit, labsByVisit]);

  const getNextStep = (visit: VisitRow) => {
    const soap = soapByVisit[visit.id];
    const labs = labsByVisit[visit.id] ?? [];

    if (!soap?.id) return "Open the visit and start the SOAP note.";
    if (!(soap.is_locked || soap.is_signed || soap.signed_at)) return "Finish and sign the SOAP note.";
    if (labs.length === 0) return "Review whether labs need to be added or ordered.";
    if ((visit.status ?? "").toLowerCase() !== "closed") return "Review the chart and close the visit when ready.";
    return "Visit is complete. Reopen only if follow-up work is needed.";
  };

  const openPatientCenter = (patientId: string, visitId?: string) => {
    const nextPath = visitId
      ? `/provider/patients/${patientId}?visitId=${encodeURIComponent(visitId)}`
      : `/provider/patients/${patientId}`;
    nav(nextPath);
  };

  const openPatientCenterFromCandidate = async (patientCandidateId: string) => {
    setErr(null);
    try {
      const resolvedPatientId = await resolvePatientRecordId(patientCandidateId);
      openPatientCenter(resolvedPatientId);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to open patient center."));
    }
  };

  const launchVisitFromAppointment = async (appointment: AppointmentRow) => {
    setErr(null);
    setLaunchingId(appointment.id);

    try {
      const launched = await startVisitFromAppointment({
        appointmentId: appointment.id,
        patientCandidateId: appointment.patient_id,
        locationId: appointment.location_id,
      });

      openPatientCenter(launched.patientId, launched.visitId);
      await loadQueue();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to start visit."));
    } finally {
      setLaunchingId(null);
    }
  };

  if (!isStaff) {
    return (
      <div className="app-bg">
        <div className="shell">
          <div className="card card-pad">
            <div className="h2">Not authorized</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Provider Queue is staff-only.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Queue"
          subtitle="Live operational dashboard filtered by your active location"
          secondaryCta={{ label: "Back", to: "/provider" }}
          primaryCta={{ label: "AI Plan Builder", to: "/provider/ai" }}
          rightActions={
            <button className="btn btn-secondary" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={true}
        />

        {/* Visible status + context */}
        <div className="space" />
        <SystemStatusBar />

        <div className="space" />

        {!activeLocationId ? (
          <div className="card card-pad">
            <ProviderPrerequisiteCard
              title="Set An Active Location"
              message="Choose your working location before opening the provider queue. Once an active location is set, visits and prerequisites will populate automatically."
            />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="card card-pad">
              <div className="h2">Today at a glance</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Location ID: <strong>{activeLocationId}</strong>
              </div>

              <div className="space" />

              <div className="v-statgrid">
                <div className="v-stat">
                  <div className="k">Open Visits</div>
                  <div className="v">{kpis.openVisits}</div>
                </div>
                <div className="v-stat">
                  <div className="k">Needs SOAP</div>
                  <div className="v">{kpis.needsSoap}</div>
                </div>
                <div className="v-stat">
                  <div className="k">Needs Labs</div>
                  <div className="v">{kpis.needsLabs}</div>
                </div>
                <div className="v-stat">
                  <div className="k">New Today</div>
                  <div className="v">{kpis.newToday}</div>
                </div>
              </div>

              {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-primary" type="button" onClick={loadQueue} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh Queue"}
                </button>

                <button className="btn btn-secondary" type="button" onClick={() => nav("/provider/patients")}>
                  Patients List
                </button>

                <button className="btn btn-secondary" type="button" onClick={() => nav("/provider/command")}>
                  Command Center
                </button>
              </div>
            </div>

            <div className="space" />

            {/* Queue list */}
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div className="h2">Queue</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    Visits and appointments that need provider action at this location.
                  </div>
                </div>
              </div>

              <div className="space" />

              {loading ? (
                <div className="card card-pad" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="muted">Loading visit queue...</div>
                </div>
              ) : queueItems.length === 0 ? (
                <ProviderPrerequisiteCard
                  title="No Active Visits Yet"
                  message="There are no visits for this location yet. Start a visit from today’s appointments or open the patient list to launch the next encounter."
                  actionLabel="Open Patients List"
                  onAction={() => nav("/provider/patients")}
                  secondaryLabel="Open Command Center"
                  onSecondaryAction={() => nav("/provider/command")}
                />
              ) : (
                queueItems.map((item) => {
                  if (item.kind === "appointment") {
                    const recommendation = getProviderQueueRecommendation({
                      hasVisit: false,
                      hasAppointment: true,
                      hasSoap: false,
                      isSoapSigned: false,
                      isVisitClosed: false,
                    });

                    return (
                      <div
                        key={`appointment-${item.appointment.id}`}
                        className="card card-pad"
                        style={{ marginBottom: 10, background: "rgba(255,255,255,0.03)" }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 320px" }}>
                            <div style={{ fontWeight: 800 }}>{fmtDate(item.appointment.start_time)}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Appointment: {item.appointment.id.slice(0, 8)} • Patient: {item.appointment.patient_id.slice(0, 8)}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Status: <strong>{item.appointment.status ?? "-"}</strong>
                              {item.appointment.notes ? ` - ${item.appointment.notes}` : ""}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>
                              Next step: {recommendation.description}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="v-chip">{recommendation.label}</span>
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() => {
                                void launchVisitFromAppointment(item.appointment);
                              }}
                              disabled={launchingId === item.appointment.id}
                            >
                              {launchingId === item.appointment.id ? "Starting..." : "Start Visit"}
                            </button>
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() => {
                                void openPatientCenterFromCandidate(item.appointment.patient_id);
                              }}
                            >
                              Review Intake
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const visit = item.visit;
                  const soap = soapByVisit[visit.id];
                  const labs = labsByVisit[visit.id] ?? [];
                  const soapLabel = !soap?.id ? "None" : soap.is_locked || soap.is_signed || soap.signed_at ? "Signed" : "Draft";
                  const recommendation = getProviderQueueRecommendation({
                    hasVisit: true,
                    hasAppointment: !!visit.appointment_id,
                    hasSoap: !!soap?.id,
                    isSoapSigned: !!(soap?.is_locked || soap?.is_signed || soap?.signed_at),
                    isVisitClosed: (visit.status ?? "").toLowerCase() === "closed" || (visit.status ?? "").toLowerCase() === "completed",
                  });

                  return (
                    <div
                      key={`visit-${visit.id}`}
                      className="card card-pad"
                      style={{ marginBottom: 10, background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 320px" }}>
                          <div style={{ fontWeight: 800 }}>{fmtDate(visit.visit_date)}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Visit: {visit.id.slice(0, 8)} • Patient: {visit.patient_id.slice(0, 8)}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Status: <strong>{visit.status ?? "-"}</strong>
                            {" - "}
                            SOAP: <strong>{soapLabel}</strong>
                            {" - "}
                            Labs: <strong>{labs.length}</strong>
                            {visit.summary ? ` - ${visit.summary}` : ""}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>
                            Next step: {getNextStep(visit)}
                          </div>
                        </div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="v-chip">{recommendation.label}</span>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => openPatientCenter(visit.patient_id, visit.id)}
                          >
                            {recommendation.id === "resume_visit" ? "Resume Visit" : "Open Chart"}
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => openPatientCenter(visit.patient_id)}
                          >
                            Review Intake
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
