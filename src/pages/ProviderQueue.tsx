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
import {
  formatProviderShortId,
  formatProviderStatusLabel,
  getProviderPatientLabel,
  isInactiveAppointmentStatus,
  isVisitClosedStatus,
  loadProviderPatientNames,
} from "../lib/provider/workspace";
import { PROVIDER_ROUTES, providerPatientCenterPath } from "../lib/providerRoutes";
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
  appointment_id: string | null;
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
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
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
      setPatientNames({});
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

      const pendingAppointments = ((appointmentsData as AppointmentRow[]) ?? []).filter(
        (item) => !appointmentIdsWithVisits.has(item.id) && !isInactiveAppointmentStatus(item.status)
      );
      setAppointments(pendingAppointments);
      setPatientNames(
        await loadProviderPatientNames([
          ...visitRows.map((item) => item.patient_id),
          ...pendingAppointments.map((item) => item.patient_id),
        ])
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

      // Labs from the review queue source of truth
      const appointmentIds = visitRows
        .map((item) => item.appointment_id)
        .filter((value): value is string => Boolean(value));

      if (appointmentIds.length) {
        const { data: l, error: lErr } = await supabase
          .from("lab_results")
          .select("id,appointment_id,status")
          .eq("location_id", activeLocationId)
          .in("appointment_id", appointmentIds);

        if (lErr) throw lErr;

        const visitByAppointmentId = new Map(
          visitRows
            .filter((item) => item.appointment_id)
            .map((item) => [item.appointment_id as string, item.id])
        );
        const map: Record<string, LabMini[]> = {};
        for (const row of (l as LabMini[]) ?? []) {
          const vid = row.appointment_id ? visitByAppointmentId.get(row.appointment_id) : null;
          if (!vid) continue;
          const arr = map[vid] ?? [];
          arr.push({ id: row.id, appointment_id: row.appointment_id, status: row.status });
          map[vid] = arr;
        }
        setLabsByVisit(map);
      } else {
        setLabsByVisit({});
      }
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load provider queue."));
      setPatientNames({});
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

    const openVisits = visits.filter((v) => !isVisitClosedStatus(v.status)).length;

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
    if (!isVisitClosedStatus(visit.status)) return "Review the chart and close the visit when ready.";
    return "Visit is complete. Reopen only if follow-up work is needed.";
  };

  const openPatientCenter = (patientId: string, visitId?: string) => {
    const nextPath = visitId
      ? `${providerPatientCenterPath(patientId)}?visitId=${encodeURIComponent(visitId)}`
      : providerPatientCenterPath(patientId);
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
          subtitle="Active encounter worklist filtered by your active location"
          secondaryCta={{ label: "Back", to: PROVIDER_ROUTES.home }}
          primaryCta={{ label: "AI Plan Builder", to: PROVIDER_ROUTES.ai }}
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

                <button className="btn btn-secondary" type="button" onClick={() => nav(PROVIDER_ROUTES.patients)}>
                  Patients List
                </button>

                <button className="btn btn-secondary" type="button" onClick={() => nav(PROVIDER_ROUTES.command)}>
                  Intake Triage
                </button>
              </div>
            </div>

            <div className="space" />

            {/* Queue list */}
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div className="h2">Encounter Queue</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    Use this screen for active visits, chart follow-through, and appointment-to-visit launch at this location.
                  </div>
                </div>
              </div>

              <div className="space" />

              {loading ? (
                <div className="card card-pad">
                  <div className="muted">Loading visit queue...</div>
                </div>
              ) : queueItems.length === 0 ? (
                <ProviderPrerequisiteCard
                  title="No Active Visits Yet"
                  message="There are no visits for this location yet. Start a visit from today’s appointments or open the patient list to launch the next encounter."
                  actionLabel="Open Patients List"
                  onAction={() => nav(PROVIDER_ROUTES.patients)}
                  secondaryLabel="Open Intake Triage"
                  onSecondaryAction={() => nav(PROVIDER_ROUTES.command)}
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
                        className="card card-pad card-light surface-light"
                        style={{ marginBottom: 10, background: "rgba(250,247,255,0.82)", border: "1px solid rgba(184,164,255,0.2)" }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 320px" }}>
                            <div style={{ fontWeight: 800 }}>{fmtDate(item.appointment.start_time)}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Appointment: {formatProviderShortId(item.appointment.id)} • Patient:{" "}
                              {getProviderPatientLabel(item.appointment.patient_id, patientNames)}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Status: <strong>{formatProviderStatusLabel(item.appointment.status)}</strong>
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
                    isVisitClosed: isVisitClosedStatus(visit.status),
                  });

                  return (
                    <div
                      key={`visit-${visit.id}`}
                      className="card card-pad card-light surface-light"
                      style={{ marginBottom: 10, background: "rgba(250,247,255,0.82)", border: "1px solid rgba(184,164,255,0.2)" }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 320px" }}>
                          <div style={{ fontWeight: 800 }}>{fmtDate(visit.visit_date)}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Visit: {formatProviderShortId(visit.id)} • Patient: {getProviderPatientLabel(visit.patient_id, patientNames)}
                           </div>
                           <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Status: <strong>{formatProviderStatusLabel(visit.status)}</strong>
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
