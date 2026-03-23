import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import RouteHeader from "../components/RouteHeader";
import { getPathwayLabel, type PublicVitalAiPathway } from "../lib/publicVitalAiLite";
import { buildFollowUpMessage, compareLeadPriority, getUrgencyIndicatorStyle, getValueIndicatorStyle, resolveBookingRequestLead } from "../lib/publicFollowUpEngine";
import {
  describeBookingSource,
  describePublicSubmissionOrigin,
  getBookingNextStep,
  getBookingRequestStatusLabel,
  isWoundRelated,
  type BookingRequestStatus,
} from "../lib/publicSubmissionOps";
import { supabase } from "../lib/supabase";
import { scoreConversionLead, type ConversionPathway, type ConversionUrgencyLevel, type ConversionValueLevel } from "../lib/vitalAi/conversionEngine";
import { getRevenueRecommendation } from "../lib/vitalAi/revenueEngine";

type BookingRequestRow = {
  id: string;
  location_id: string | null;
  service_id: string | null;
  service_label: string | null;
  requested_start: string;
  notes: string | null;
  source: string;
  status: BookingRequestStatus;
  patient_id: string | null;
  email: string | null;
  phone: string | null;
  internal_notes: string | null;
  assigned_to: string | null;
  contacted_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type LinkedVitalAiRow = {
  id: string;
  booking_request_id: string | null;
  pathway: PublicVitalAiPathway;
  status: string;
  summary: string | null;
  answers_json?: Record<string, unknown> | null;
  lead_type: ConversionPathway | null;
  urgency_level: ConversionUrgencyLevel | null;
  value_level: ConversionValueLevel | null;
  created_at: string;
};

type StaffOption = {
  id: string;
  email: string | null;
  role: string | null;
};

type LocationOption = {
  id: string;
  name: string | null;
};

type ServiceOption = {
  id: string;
  name: string | null;
};

type QueueFilter = "open" | "wound" | "linked" | "all";

const BOOKING_REQUEST_SELECT =
  "id,location_id,service_id,service_label,requested_start,notes,source,status,patient_id,email,phone,internal_notes,assigned_to,contacted_at,resolved_at,created_at,updated_at";

const LINKED_VITAL_AI_SELECT = "id,booking_request_id,pathway,status,summary,answers_json,lead_type,urgency_level,value_level,created_at";

export default function AdminBookingRequests() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [requests, setRequests] = useState<BookingRequestRow[]>([]);
  const [linkedVitalAi, setLinkedVitalAi] = useState<LinkedVitalAiRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [statusDraft, setStatusDraft] = useState<BookingRequestStatus>("new");
  const [notesDraft, setNotesDraft] = useState("");
  const [assignedToDraft, setAssignedToDraft] = useState("");

  const linkedVitalAiByBookingId = useMemo(() => {
    const map = new Map<string, LinkedVitalAiRow>();
    for (const item of linkedVitalAi) {
      if (!item.booking_request_id) continue;
      if (!map.has(item.booking_request_id)) {
        map.set(item.booking_request_id, item);
      }
    }
    return map;
  }, [linkedVitalAi]);

  const locationNameById = useMemo(() => new Map(locations.map((row) => [row.id, row.name ?? row.id])), [locations]);
  const serviceNameById = useMemo(() => new Map(services.map((row) => [row.id, row.name ?? row.id])), [services]);

  const enrichedRequests = useMemo(() => {
    return requests.map((request) => {
      const linkedSubmission = linkedVitalAiByBookingId.get(request.id) ?? null;
      const serviceName = request.service_label ?? (request.service_id ? serviceNameById.get(request.service_id) ?? request.service_id : null);
      const isWound = isWoundRelated({
        pathway: linkedSubmission?.pathway ?? null,
        serviceName,
        notes: request.notes,
      });
      const scoredLead = linkedSubmission
        ? linkedSubmission.lead_type && linkedSubmission.urgency_level && linkedSubmission.value_level
          ? scoreConversionLead({
              pathway: linkedSubmission.lead_type,
              answers: linkedSubmission.answers_json ?? {},
            })
          : scoreConversionLead({
              pathway: linkedSubmission.pathway,
              answers: linkedSubmission.answers_json ?? {},
            })
        : resolveBookingRequestLead({
            serviceName,
            notes: request.notes,
          });
      const revenueRecommendation = getRevenueRecommendation({
        lead: scoredLead,
        answers: linkedSubmission?.answers_json ?? {},
      });
      return {
        ...request,
        linkedSubmission,
        scoredLead,
        revenueRecommendation,
        serviceName,
        isWound,
        originLabel: describePublicSubmissionOrigin({
          bookingSource: request.source,
          hasBookingRequest: true,
          hasVitalAiSubmission: !!linkedSubmission,
        }),
      };
    });
  }, [linkedVitalAiByBookingId, requests, serviceNameById]);

  const visibleRequests = useMemo(() => {
    const filtered =
      filter === "all"
        ? enrichedRequests
        : filter === "wound"
        ? enrichedRequests.filter((request) => request.isWound)
        : filter === "linked"
        ? enrichedRequests.filter((request) => !!request.linkedSubmission)
        : enrichedRequests.filter((request) => request.status !== "closed");

    return [...filtered].sort((a, b) =>
      compareLeadPriority(
        {
          urgencyLevel: a.scoredLead.urgencyLevel,
          valueLevel: a.scoredLead.valueLevel,
          createdAt: a.created_at,
        },
        {
          urgencyLevel: b.scoredLead.urgencyLevel,
          valueLevel: b.scoredLead.valueLevel,
          createdAt: b.created_at,
        }
      )
    );
  }, [enrichedRequests, filter]);

  const selected = useMemo(() => visibleRequests.find((row) => row.id === selectedId) ?? enrichedRequests.find((row) => row.id === selectedId) ?? null, [enrichedRequests, selectedId, visibleRequests]);
  const selectedFollowUp = useMemo(
    () => (selected ? buildFollowUpMessage(selected.scoredLead.leadType, selected.scoredLead.urgencyLevel) : null),
    [selected]
  );

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.status);
    setNotesDraft(selected.internal_notes ?? "");
    setAssignedToDraft(selected.assigned_to ?? "");
  }, [selected]);

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const [requestRes, vitalAiRes, staffRes, locationRes, serviceRes] = await Promise.all([
        supabase.from("booking_requests").select(BOOKING_REQUEST_SELECT).order("created_at", { ascending: false }),
        supabase.from("public_vital_ai_submissions").select(LINKED_VITAL_AI_SELECT).order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id,email,role")
          .in("role", ["super_admin", "location_admin", "provider", "clinical_staff", "billing", "front_desk"])
          .order("email"),
        supabase.from("locations").select("id,name").order("name"),
        supabase.from("services").select("id,name").eq("is_active", true).order("name"),
      ]);

      if (requestRes.error) throw requestRes.error;
      if (vitalAiRes.error) throw vitalAiRes.error;
      if (staffRes.error) throw staffRes.error;
      if (locationRes.error) throw locationRes.error;
      if (serviceRes.error) throw serviceRes.error;

      const requestRows = (requestRes.data as BookingRequestRow[]) ?? [];
      setRequests(requestRows);
      setLinkedVitalAi((vitalAiRes.data as LinkedVitalAiRow[]) ?? []);
      setStaff((staffRes.data as StaffOption[]) ?? []);
      setLocations((locationRes.data as LocationOption[]) ?? []);
      setServices((serviceRes.data as ServiceOption[]) ?? []);
      setSelectedId((current) => {
        if (current && requestRows.some((row) => row.id === current)) return current;
        return requestRows[0]?.id ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load booking requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function saveRequest() {
    if (!selected || !user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const patch: Record<string, string | null> = {
      status: statusDraft,
      internal_notes: notesDraft.trim() || null,
      assigned_to: assignedToDraft || null,
      updated_at: new Date().toISOString(),
    };

    if ((statusDraft === "reviewed" || statusDraft === "scheduled") && !selected.contacted_at) {
      patch.contacted_at = new Date().toISOString();
    }

    if (statusDraft === "closed") {
      patch.resolved_at = selected.resolved_at ?? new Date().toISOString();
    } else if (selected.resolved_at) {
      patch.resolved_at = null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from("booking_requests")
        .update(patch)
        .eq("id", selected.id)
        .select(BOOKING_REQUEST_SELECT)
        .single();

      if (updateError) throw updateError;

      const updated = data as BookingRequestRow;
      setRequests((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setSuccess("Booking request updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update booking request.");
    } finally {
      setSaving(false);
    }
  }

  const filterSummary = useMemo(() => {
    return {
      open: enrichedRequests.filter((request) => request.status !== "closed").length,
      wound: enrichedRequests.filter((request) => request.isWound).length,
      linked: enrichedRequests.filter((request) => !!request.linkedSubmission).length,
      all: enrichedRequests.length,
    };
  }, [enrichedRequests]);

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Public Booking Requests"
          subtitle="Work public visit requests before they become scheduled appointments or authenticated patient intake."
          backTo="/admin"
          homeTo="/admin"
          rightAction={
            <button className="btn btn-secondary" type="button" onClick={loadRequests}>
              Refresh
            </button>
          }
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading booking requests...</div></div>
        ) : error ? (
          <div className="card card-pad card-light surface-light" style={{ color: "#991b1b" }}>{error}</div>
        ) : (
          <>
            <div className="card card-pad card-light surface-light" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div className="h2">Queue Filters</div>
                  <div className="surface-light-helper" style={{ marginTop: 4 }}>
                    Public submissions can begin as booking only, Vital AI only, or a linked combination.
                  </div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className={filter === "open" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("open")}>
                    Open ({filterSummary.open})
                  </button>
                    <button className={filter === "wound" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("wound")}>
                    Wound Priority ({filterSummary.wound})
                  </button>
                    <button className={filter === "linked" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("linked")}>
                    Linked Vital AI ({filterSummary.linked})
                  </button>
                    <button className={filter === "all" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("all")}>
                    All ({filterSummary.all})
                  </button>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div className="card card-pad card-light surface-light" style={{ flex: "1 1 360px", minWidth: 320 }}>
                <div className="h2">Request Queue</div>
                <div className="surface-light-helper" style={{ marginTop: 4 }}>
                  {visibleRequests.length} requests in this view
                </div>
                <div className="space" />
                {visibleRequests.length === 0 ? (
                  <div className="surface-light-helper">
                    No requests match this filter. Public booking requests will appear here once guests start the booking funnel.
                  </div>
                ) : (
                  visibleRequests.map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      className={selectedId === request.id ? "btn btn-primary" : "btn btn-secondary"}
                      style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left", minHeight: 88 }}
                      onClick={() => setSelectedId(request.id)}
                    >
                      <span style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800 }}>
                          {request.serviceName || "Public visit request"}
                          {request.isWound ? " • wound priority" : ""}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {getBookingRequestStatusLabel(request.status)} | {request.originLabel} | {new Date(request.requested_start).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>
                          Next step: {getBookingNextStep({
                            status: request.status,
                            hasVitalAiSubmission: !!request.linkedSubmission,
                            patientLinked: !!request.patient_id,
                            isWound: request.isWound,
                          })}
                        </div>
                      </span>
                      <span style={{ fontSize: 12 }}>{request.linkedSubmission ? "Linked intake" : "Booking only"}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="card card-pad card-light surface-light" style={{ flex: "2 1 720px", minWidth: 340 }}>
                {!selected ? (
                  <div className="surface-light-helper">Select a booking request.</div>
                ) : (
                  <>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div>
                        <div className="h2">{selected.serviceName || "Public visit request"}</div>
                        <div className="surface-light-helper" style={{ marginTop: 6 }}>
                          Requested for {new Date(selected.requested_start).toLocaleString()} via {describeBookingSource(selected.source)}
                        </div>
                      </div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <div className="v-chip">Status: <strong>{getBookingRequestStatusLabel(selected.status)}</strong></div>
                          <div className="v-chip">Flow: <strong>{selected.originLabel}</strong></div>
                          {selected.linkedSubmission ? <div className="v-chip">Vital AI: <strong>{getPathwayLabel(selected.linkedSubmission.pathway)}</strong></div> : null}
                          {selected.scoredLead ? <div className="v-chip" style={getUrgencyIndicatorStyle(selected.scoredLead.urgencyLevel)}>Urgency: <strong>{selected.scoredLead.urgencyLevel}</strong></div> : null}
                          {selected.scoredLead ? <div className="v-chip" style={getValueIndicatorStyle(selected.scoredLead.valueLevel)}>Value: <strong>{selected.scoredLead.valueLevel}</strong></div> : null}
                          {selected.isWound ? <div className="v-chip">Priority: <strong>Wound review</strong></div> : null}
                        </div>
                    </div>

                    <div className="space" />

                    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
                      <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                        <div className="h2">Request Context</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.8 }}>
                          <div><strong>Location:</strong> {selected.location_id ? locationNameById.get(selected.location_id) ?? selected.location_id : "Not provided"}</div>
                          <div><strong>Service:</strong> {selected.serviceName || "Not provided"}</div>
                          <div><strong>Email:</strong> {selected.email || "-"}</div>
                          <div><strong>Phone:</strong> {selected.phone || "-"}</div>
                          <div><strong>Patient linked:</strong> {selected.patient_id ? "Yes" : "No"}</div>
                          <div><strong>Visit note:</strong> {selected.notes || "-"}</div>
                        </div>
                      </div>

                      <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                        <div className="h2">Linked Intake</div>
                        <div className="space" />
                        {selected.linkedSubmission ? (
                          <div style={{ lineHeight: 1.8 }}>
                            <div><strong>Pathway:</strong> {getPathwayLabel(selected.linkedSubmission.pathway)}</div>
                            <div><strong>Submission status:</strong> {selected.linkedSubmission.status.replaceAll("_", " ")}</div>
                            <div><strong>Lead type:</strong> {selected.scoredLead?.leadType ?? "-"}</div>
                            <div><strong>Urgency:</strong> {selected.scoredLead?.urgencyLevel ?? "-"}</div>
                            <div><strong>Value:</strong> {selected.scoredLead?.valueLevel ?? "-"}</div>
                            <div><strong>Summary:</strong> {selected.linkedSubmission.summary || "-"}</div>
                          </div>
                        ) : (
                          <div className="muted">
                            No Vital AI Lite submission is linked yet. Staff can still follow up, request intake completion, or route into wound review if clinically appropriate.
                          </div>
                        )}
                      </div>

                      <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                        <div className="h2">Auto Follow-Up</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.8 }}>
                          <div><strong>Patient message:</strong> {selectedFollowUp?.patientMessage ?? "-"}</div>
                          <div><strong>Support line:</strong> {selectedFollowUp?.supportingLine ?? "-"}</div>
                          <div><strong>Staff note:</strong> {selectedFollowUp?.staffNote ?? "-"}</div>
                        </div>
                      </div>

                      <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                        <div className="h2">Recommended Revenue Path</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.8 }}>
                          <div><strong>Primary:</strong> {selected.revenueRecommendation.primaryOffer}</div>
                          <div><strong>Secondary:</strong> {selected.revenueRecommendation.secondaryOffer || "-"}</div>
                          <div><strong>Consult required:</strong> {selected.revenueRecommendation.consultRequired ? "Yes" : "No"}</div>
                          {selected.revenueRecommendation.note ? <div><strong>Note:</strong> {selected.revenueRecommendation.note}</div> : null}
                        </div>
                      </div>

                      <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                        <div className="h2">Next Recommended Step</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.75 }}>
                          {getBookingNextStep({
                            status: selected.status,
                            hasVitalAiSubmission: !!selected.linkedSubmission,
                            patientLinked: !!selected.patient_id,
                            isWound: selected.isWound,
                          })}
                        </div>
                        <div className="surface-light-helper" style={{ marginTop: 10 }}>
                          {selected.isWound
                            ? "Keep wound-care notes and urgency context visible early so provider review is not delayed."
                            : "Use this queue to decide whether the next step is intake completion, account setup, coordinator outreach, or scheduling."}
                        </div>
                      </div>
                    </div>

                    <div className="space" />

                    <div className="card card-pad">
                      <div className="h2">Workflow</div>
                      <div className="space" />

                      {success ? <div style={{ color: "#065f46", marginBottom: 12 }}>{success}</div> : null}
                      {error ? <div style={{ color: "#991b1b", marginBottom: 12 }}>{error}</div> : null}

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 220px" }}>
                          <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Lifecycle Status</div>
                          <select className="input" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as BookingRequestStatus)}>
                            <option value="new">Requested</option>
                            <option value="intake_started">Intake Started</option>
                            <option value="account_created">Account Created</option>
                            <option value="reviewed">Needs Follow-up</option>
                            <option value="scheduled">Converted to Scheduling</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>

                        <div style={{ flex: "1 1 260px" }}>
                          <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Assigned To</div>
                          <select className="input" value={assignedToDraft} onChange={(e) => setAssignedToDraft(e.target.value)}>
                            <option value="">Unassigned</option>
                            {staff.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.email ?? person.id} {person.role ? `(${person.role})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space" />

                      <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Internal Notes</div>
                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 120 }}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Internal notes for outreach, conversion, wound review, or patient account follow-up."
                      />

                      <div className="space" />

                      <button className="btn btn-primary" type="button" onClick={saveRequest} disabled={saving}>
                        {saving ? "Saving..." : "Save Workflow Update"}
                      </button>

                      <div className="space" />

                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {selected.contacted_at ? <div className="v-chip">Contacted: <strong>{new Date(selected.contacted_at).toLocaleString()}</strong></div> : null}
                        {selected.resolved_at ? <div className="v-chip">Resolved: <strong>{new Date(selected.resolved_at).toLocaleString()}</strong></div> : null}
                        {selected.linkedSubmission ? <div className="v-chip">Linked intake id: <strong>{selected.linkedSubmission.id}</strong></div> : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
