import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import RouteHeader from "../components/RouteHeader";
import { preparePublicVitalAiOutboundPayload } from "../lib/outboundMessagePrep";
import { formatAnswerValue, getPathwayLabel, getPathwayQuestions, type PublicVitalAiAnswers, type PublicVitalAiPathway, type PublicVitalAiStatus } from "../lib/publicVitalAiLite";
import { buildFollowUpMessage, compareLeadPriority, getUrgencyIndicatorStyle, getValueIndicatorStyle } from "../lib/publicFollowUpEngine";
import {
  describePublicSubmissionOrigin,
  getBookingRequestStatusLabel,
  getPublicVitalAiCaptureTypeLabel,
  getVitalAiNextStep,
  getVitalAiStatusLabel,
  isExpansionBookingRequest,
  isExpansionPublicVitalAiSubmission,
  isWoundRelated,
  type BookingRequestCaptureType,
  type BookingRequestStatus,
  type PublicVitalAiCaptureType,
} from "../lib/publicSubmissionOps";
import { supabase } from "../lib/supabase";
import { scoreConversionLead, type ConversionPathway, type ConversionUrgencyLevel, type ConversionValueLevel } from "../lib/vitalAi/conversionEngine";
import { getRevenueRecommendation } from "../lib/vitalAi/revenueEngine";

type SubmissionRow = {
  id: string;
  pathway: PublicVitalAiPathway;
  status: PublicVitalAiStatus;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  preferred_contact_method: "phone" | "email" | "either";
  preferred_location_id: string | null;
  booking_request_id: string | null;
  service_id: string | null;
  answers_json: PublicVitalAiAnswers;
  summary: string | null;
  source: string;
  capture_type: PublicVitalAiCaptureType | null;
  notes: string | null;
  internal_notes: string | null;
  assigned_to: string | null;
  contacted_at: string | null;
  resolved_at: string | null;
  lead_type: ConversionPathway | null;
  urgency_level: ConversionUrgencyLevel | null;
  value_level: ConversionValueLevel | null;
  created_at: string;
  updated_at: string;
};

type StaffOption = {
  id: string;
  email: string | null;
  role: string | null;
};

type LocationOption = {
  id: string;
  name: string | null;
  is_placeholder: boolean | null;
  market_status: "live" | "coming_soon" | null;
};

type ServiceOption = {
  id: string;
  name: string | null;
};

type BookingRequestRow = {
  id: string;
  status: BookingRequestStatus;
  source: string;
  capture_type: BookingRequestCaptureType | null;
  patient_id: string | null;
  requested_start: string;
  service_label: string | null;
};

type QueueFilter = "open" | "wound" | "booking-linked" | "expansion" | "all";

const SUBMISSION_SELECT =
  "id,pathway,status,first_name,last_name,phone,email,preferred_contact_method,preferred_location_id,booking_request_id,service_id,answers_json,summary,source,capture_type,notes,internal_notes,assigned_to,contacted_at,resolved_at,lead_type,urgency_level,value_level,created_at,updated_at";

export default function AdminPublicVitalAiSubmissions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequestRow[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [selectedId, setSelectedId] = useState("");
  const [statusDraft, setStatusDraft] = useState<PublicVitalAiStatus>("new");
  const [notesDraft, setNotesDraft] = useState("");
  const [assignedToDraft, setAssignedToDraft] = useState("");

  const locationNameById = useMemo(() => {
    return new Map(locations.map((location) => [location.id, location.name ?? location.id]));
  }, [locations]);
  const locationById = useMemo(() => {
    return new Map(locations.map((location) => [location.id, location]));
  }, [locations]);

  const serviceNameById = useMemo(() => {
    return new Map(services.map((service) => [service.id, service.name ?? service.id]));
  }, [services]);

  const bookingRequestById = useMemo(() => {
    return new Map(bookingRequests.map((request) => [request.id, request]));
  }, [bookingRequests]);

  const enrichedSubmissions = useMemo(() => {
    return submissions.map((submission) => {
      const linkedBookingRequest = submission.booking_request_id ? bookingRequestById.get(submission.booking_request_id) ?? null : null;
      const serviceName = submission.service_id ? serviceNameById.get(submission.service_id) ?? submission.service_id : null;
      const preferredLocation = submission.preferred_location_id ? locationById.get(submission.preferred_location_id) ?? null : null;
      const scoredLead =
        submission.lead_type && submission.urgency_level && submission.value_level
          ? scoreConversionLead({
              pathway: submission.lead_type,
              answers: submission.answers_json ?? {},
            })
          : scoreConversionLead({
              pathway: submission.pathway,
              answers: submission.answers_json ?? {},
            });
      const revenueRecommendation = getRevenueRecommendation({
        lead: scoredLead,
        answers: submission.answers_json ?? {},
      });

      return {
        ...submission,
        linkedBookingRequest,
        serviceName,
        scoredLead,
        revenueRecommendation,
        captureType: isExpansionPublicVitalAiSubmission({
          captureType: submission.capture_type,
          preferredLocationIsPlaceholder: preferredLocation?.is_placeholder === true || preferredLocation?.market_status === "coming_soon",
        })
          ? ("expansion_interest" as const)
          : ("standard_intake" as const),
        originLabel: describePublicSubmissionOrigin({
          bookingSource: linkedBookingRequest?.source,
          vitalAiSource: submission.source,
          hasBookingRequest: !!linkedBookingRequest,
          hasVitalAiSubmission: true,
        }),
        isExpansionInterest:
          isExpansionPublicVitalAiSubmission({
            captureType: submission.capture_type,
            preferredLocationIsPlaceholder: preferredLocation?.is_placeholder === true || preferredLocation?.market_status === "coming_soon",
          }) ||
          isExpansionBookingRequest({
            captureType: linkedBookingRequest?.capture_type,
            source: linkedBookingRequest?.source,
          }),
        isWound: isWoundRelated({
          pathway: submission.pathway,
          serviceName,
          notes: submission.notes,
        }),
      };
    });
  }, [bookingRequestById, locationById, serviceNameById, submissions]);

  const visibleSubmissions = useMemo(() => {
    const filtered =
      filter === "all"
        ? enrichedSubmissions
        : filter === "wound"
        ? enrichedSubmissions.filter((submission) => submission.isWound)
        : filter === "expansion"
        ? enrichedSubmissions.filter((submission) => submission.isExpansionInterest)
        : filter === "booking-linked"
        ? enrichedSubmissions.filter((submission) => !!submission.linkedBookingRequest)
        : enrichedSubmissions.filter((submission) => submission.status !== "closed");

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
  }, [enrichedSubmissions, filter]);

  const selected = useMemo(
    () => visibleSubmissions.find((row) => row.id === selectedId) ?? enrichedSubmissions.find((row) => row.id === selectedId) ?? null,
    [enrichedSubmissions, selectedId, visibleSubmissions]
  );
  const selectedFollowUp = useMemo(
    () => (selected ? buildFollowUpMessage(selected.scoredLead.leadType, selected.scoredLead.urgencyLevel) : null),
    [selected]
  );
  const selectedOutbound = useMemo(
    () =>
      selected
        ? preparePublicVitalAiOutboundPayload({
            submissionId: selected.id,
            pathway: selected.pathway,
            answers: selected.answers_json ?? {},
            summary: selected.summary,
            firstName: selected.first_name,
            lastName: selected.last_name,
            email: selected.email,
            phone: selected.phone,
            preferredContactMethod: selected.preferred_contact_method,
            preferredLocationId: selected.preferred_location_id,
            bookingRequestId: selected.booking_request_id,
            serviceId: selected.service_id,
            patientId: selected.linkedBookingRequest?.patient_id ?? null,
            notes: selected.notes,
            source: selected.source,
            status: selected.status,
          })
        : null,
    [selected]
  );

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.status);
    setNotesDraft(selected.internal_notes ?? "");
    setAssignedToDraft(selected.assigned_to ?? "");
  }, [selected]);

  const filterSummary = useMemo(() => {
    return {
      open: enrichedSubmissions.filter((submission) => submission.status !== "closed").length,
      wound: enrichedSubmissions.filter((submission) => submission.isWound).length,
      bookingLinked: enrichedSubmissions.filter((submission) => !!submission.linkedBookingRequest).length,
      expansion: enrichedSubmissions.filter((submission) => submission.isExpansionInterest).length,
      all: enrichedSubmissions.length,
    };
  }, [enrichedSubmissions]);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const [submissionRes, staffRes, locationRes, serviceRes, bookingRequestRes] = await Promise.all([
        supabase.from("public_vital_ai_submissions").select(SUBMISSION_SELECT).order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id,email,role")
          .in("role", ["super_admin", "location_admin", "provider", "clinical_staff", "billing", "front_desk"])
          .order("email"),
        supabase.from("locations").select("id,name,is_placeholder,market_status").order("name"),
        supabase.from("services").select("id,name").eq("is_active", true).order("name"),
        supabase.from("booking_requests").select("id,status,source,capture_type,patient_id,requested_start,service_label"),
      ]);

      if (submissionRes.error) throw submissionRes.error;
      if (staffRes.error) throw staffRes.error;
      if (locationRes.error) throw locationRes.error;
      if (serviceRes.error) throw serviceRes.error;
      if (bookingRequestRes.error) throw bookingRequestRes.error;

      const rows = (submissionRes.data as SubmissionRow[]) ?? [];
      setSubmissions(rows);
      setStaff((staffRes.data as StaffOption[]) ?? []);
      setLocations((locationRes.data as LocationOption[]) ?? []);
      setServices((serviceRes.data as ServiceOption[]) ?? []);
      setBookingRequests((bookingRequestRes.data as BookingRequestRow[]) ?? []);
      setSelectedId((current) => {
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Vital AI Lite submissions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function saveSubmission() {
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

    if ((statusDraft === "contacted" || statusDraft === "scheduled") && !selected.contacted_at) {
      patch.contacted_at = new Date().toISOString();
    }

    if (statusDraft === "closed") {
      patch.resolved_at = selected.resolved_at ?? new Date().toISOString();
    } else if (selected.resolved_at) {
      patch.resolved_at = null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from("public_vital_ai_submissions")
        .update(patch)
        .eq("id", selected.id)
        .select(SUBMISSION_SELECT)
        .single();

      if (updateError) throw updateError;

      const updated = data as SubmissionRow;
      setSubmissions((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setSuccess("Submission updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update submission.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Vital AI Lite Submissions"
          subtitle="Review public pre-intake guidance submissions and work the next step."
          backTo="/admin"
          homeTo="/admin"
          rightAction={
            <button className="btn btn-secondary" type="button" onClick={loadSubmissions}>
              Refresh
            </button>
          }
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading submissions...</div></div>
        ) : error ? (
          <div className="card card-pad card-light surface-light" style={{ color: "#991b1b" }}>{error}</div>
        ) : (
          <>
            <div className="card card-pad card-light surface-light" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div className="h2">Queue Filters</div>
                  <div className="surface-light-helper" style={{ marginTop: 4 }}>
                    Separate Vital AI-only traffic from booking-linked follow-up and wound-priority requests.
                  </div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className={filter === "open" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("open")}>
                    Open ({filterSummary.open})
                  </button>
                  <button className={filter === "wound" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("wound")}>
                    Wound Priority ({filterSummary.wound})
                  </button>
                  <button className={filter === "booking-linked" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("booking-linked")}>
                    Booking Linked ({filterSummary.bookingLinked})
                  </button>
                  <button className={filter === "expansion" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("expansion")}>
                    Expansion Interest ({filterSummary.expansion})
                  </button>
                  <button className={filter === "all" ? "btn btn-primary" : "btn btn-secondary"} type="button" onClick={() => setFilter("all")}>
                    All ({filterSummary.all})
                  </button>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div className="card card-pad card-light surface-light" style={{ flex: "1 1 360px", minWidth: 320 }}>
                <div className="h2">Submission Queue</div>
                <div className="surface-light-helper" style={{ marginTop: 4 }}>
                  {visibleSubmissions.length} submissions in this view
                </div>
                <div className="space" />
                {visibleSubmissions.length === 0 ? (
                  <div className="surface-light-helper">
                    {filter === "expansion"
                      ? "No expansion-interest Vital AI submissions match this filter yet."
                      : "No Vital AI Lite submissions match this filter yet."}
                  </div>
                ) : (
                  visibleSubmissions.map((submission) => (
                    <button
                      key={submission.id}
                      type="button"
                      className={selectedId === submission.id ? "btn btn-primary" : "btn btn-secondary"}
                      style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left", minHeight: 88 }}
                      onClick={() => setSelectedId(submission.id)}
                    >
                      <span style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800 }}>{submission.first_name} {submission.last_name}</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {getPathwayLabel(submission.pathway)} | {getVitalAiStatusLabel(submission.status)} | {submission.originLabel}
                        </div>
                        {submission.isExpansionInterest ? (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#8a4b14" }}>
                            Expansion market follow-up - do not treat as live scheduling
                          </div>
                        ) : null}
                        <div style={{ fontSize: 12, opacity: 0.85 }}>
                          Next step: {getVitalAiNextStep({
                            status: submission.status,
                            pathway: submission.pathway,
                            hasBookingRequest: !!submission.linkedBookingRequest,
                            patientLinked: !!submission.linkedBookingRequest?.patient_id,
                            isExpansionInterest: submission.isExpansionInterest,
                          })}
                        </div>
                      </span>
                      <span style={{ fontSize: 12 }}>{submission.isWound ? "Wound priority" : submission.preferred_contact_method}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="card card-pad card-light surface-light" style={{ flex: "2 1 700px", minWidth: 340 }}>
                {!selected ? (
                  <div className="surface-light-helper">Select a submission.</div>
                ) : (
                  <>
                    {selected.isExpansionInterest ? (
                      <>
                        <div
                          className="card card-pad card-light surface-light"
                          style={{
                            marginBottom: 12,
                            border: "1px solid rgba(191,90,36,0.22)",
                            background: "linear-gradient(180deg, rgba(255,249,243,0.98), rgba(255,245,238,0.96))",
                          }}
                        >
                          <div className="public-eyebrow" style={{ color: "#a64e20" }}>Expansion Interest</div>
                          <div className="h2" style={{ marginTop: 10 }}>This submission should stay out of live-market scheduling</div>
                          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
                            Treat this as market-demand follow-up unless the patient is intentionally redirected to a live clinic. It should not inflate live operational intake or booking counts for a coming-soon market.
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div>
                        <div className="h2">{selected.first_name} {selected.last_name}</div>
                        <div className="surface-light-helper" style={{ marginTop: 6 }}>
                          {getPathwayLabel(selected.pathway)} submitted {new Date(selected.created_at).toLocaleString()} via {selected.originLabel}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <div className="v-chip">Status: <strong>{getVitalAiStatusLabel(selected.status)}</strong></div>
                        <div className="v-chip">Preferred contact: <strong>{selected.preferred_contact_method}</strong></div>
                        <div className="v-chip">Lead type: <strong>{selected.scoredLead.leadType}</strong></div>
                        <div className="v-chip" style={getUrgencyIndicatorStyle(selected.scoredLead.urgencyLevel)}>Urgency: <strong>{selected.scoredLead.urgencyLevel}</strong></div>
                        <div className="v-chip" style={getValueIndicatorStyle(selected.scoredLead.valueLevel)}>Value: <strong>{selected.scoredLead.valueLevel}</strong></div>
                        {selected.linkedBookingRequest ? <div className="v-chip">Booking status: <strong>{getBookingRequestStatusLabel(selected.linkedBookingRequest.status)}</strong></div> : null}
                        {selected.isWound ? <div className="v-chip">Priority: <strong>Wound review</strong></div> : null}
                        {selected.isExpansionInterest ? <div className="v-chip">Market: <strong>Coming Soon</strong></div> : null}
                      </div>
                    </div>

                    <div className="space" />

                    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
                      <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                        <div className="h2">Contact</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.8 }}>
                          <div><strong>Email:</strong> {selected.email || "-"}</div>
                          <div><strong>Phone:</strong> {selected.phone || "-"}</div>
                          <div><strong>Location:</strong> {selected.preferred_location_id ? locationNameById.get(selected.preferred_location_id) ?? selected.preferred_location_id : "Not provided"}</div>
                          <div><strong>Service:</strong> {selected.serviceName || "Not provided"}</div>
                          <div><strong>Capture type:</strong> {getPublicVitalAiCaptureTypeLabel(selected.captureType)}</div>
                          <div><strong>Lead type:</strong> {selected.scoredLead.leadType}</div>
                          <div><strong>Urgency:</strong> {selected.scoredLead.urgencyLevel}</div>
                          <div><strong>Value:</strong> {selected.scoredLead.valueLevel}</div>
                          <div><strong>Summary:</strong> {selected.summary || "-"}</div>
                          <div><strong>Visit note:</strong> {selected.notes || "-"}</div>
                        </div>
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

                      <div className="card card-pad" style={{ flex: "1 1 320px" }}>
                        <div className="h2">Outbound Preview</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.8 }}>
                          <div><strong>Title:</strong> {selectedOutbound?.title ?? "-"}</div>
                          <div><strong>Subject:</strong> {selectedOutbound?.message.subject ?? "-"}</div>
                          <div><strong>Channel:</strong> {selectedOutbound?.recipient.recommendedChannel ?? "-"}</div>
                          <div><strong>Timing:</strong> {selectedOutbound?.timing.label ?? "-"}</div>
                          <div><strong>Primary offer:</strong> {selectedOutbound?.recommendation.primaryOffer ?? "-"}</div>
                          <div><strong>Next step:</strong> {selectedOutbound?.recommendation.nextStep ?? "-"}</div>
                          <div><strong>Body:</strong> {selectedOutbound?.message.body ?? "-"}</div>
                          <div><strong>Internal note:</strong> {selectedOutbound?.message.staffNote ?? "-"}</div>
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

                      <div className="card card-pad" style={{ flex: "2 1 420px" }}>
                        <div className="h2">Submission Details</div>
                        <div className="space" />
                        <div style={{ display: "grid", gap: 10 }}>
                          {getPathwayQuestions(selected.pathway).map((question) => (
                            <div key={question.key}>
                              <div className="surface-light-helper" style={{ fontSize: 12 }}>{question.label}</div>
                              <div style={{ marginTop: 4, lineHeight: 1.7 }}>
                                {formatAnswerValue(question, selected.answers_json?.[question.key])}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="surface-light-helper" style={{ marginTop: 12 }}>
                          This public pre-intake is guidance and provider prep only. Final recommendations are determined by clinical review.
                        </div>
                      </div>
                    </div>

                    <div className="space" />

                    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
                      <div className="card card-pad" style={{ flex: "1 1 300px" }}>
                        <div className="h2">Linked Booking Context</div>
                        <div className="space" />
                        {selected.linkedBookingRequest ? (
                          <div style={{ lineHeight: 1.8 }}>
                            <div><strong>Booking request:</strong> {selected.linkedBookingRequest.id}</div>
                            <div><strong>Booked service:</strong> {selected.linkedBookingRequest.service_label || selected.serviceName || "Not provided"}</div>
                            <div><strong>Requested time:</strong> {new Date(selected.linkedBookingRequest.requested_start).toLocaleString()}</div>
                            <div><strong>Booking status:</strong> {getBookingRequestStatusLabel(selected.linkedBookingRequest.status)}</div>
                            <div><strong>Patient linked:</strong> {selected.linkedBookingRequest.patient_id ? "Yes" : "No"}</div>
                          </div>
                        ) : (
                          <div className="muted">
                            This submission came in without a linked booking request. Staff can still guide booking, account setup, or provider review from here.
                          </div>
                        )}
                      </div>

                      <div className="card card-pad" style={{ flex: "1 1 300px" }}>
                        <div className="h2">Next Recommended Step</div>
                        <div className="space" />
                        <div style={{ lineHeight: 1.75 }}>
                          {getVitalAiNextStep({
                            status: selected.status,
                            pathway: selected.pathway,
                            hasBookingRequest: !!selected.linkedBookingRequest,
                            patientLinked: !!selected.linkedBookingRequest?.patient_id,
                            isExpansionInterest: selected.isExpansionInterest,
                          })}
                        </div>
                        <div className="surface-light-helper" style={{ marginTop: 10 }}>
                          {selected.isExpansionInterest
                            ? "Keep expansion-market follow-up separate from live intake conversion unless the patient is intentionally moved to an active clinic."
                            : selected.isWound
                            ? "Keep urgency, infection concerns, and the need for photos or faster follow-up visible."
                            : "Use this to decide whether booking confirmation, coordinator outreach, account setup, or provider review should happen next."}
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
                          <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                          <select className="input" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as PublicVitalAiStatus)}>
                            <option value="new">Requested</option>
                            <option value="reviewed">Needs Follow-up</option>
                            <option value="contacted">Contacted</option>
                            {!selected.isExpansionInterest ? <option value="scheduled">Converted to Scheduling</option> : null}
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
                        placeholder="Internal notes for outreach, scheduling, booking follow-up, or provider review."
                      />

                      <div className="space" />

                      <button className="btn btn-primary" type="button" onClick={saveSubmission} disabled={saving}>
                        {saving ? "Saving..." : "Save Workflow Update"}
                      </button>

                      <div className="space" />

                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {selected.contacted_at ? <div className="v-chip">Contacted: <strong>{new Date(selected.contacted_at).toLocaleString()}</strong></div> : null}
                        {selected.resolved_at ? <div className="v-chip">Resolved: <strong>{new Date(selected.resolved_at).toLocaleString()}</strong></div> : null}
                        {selected.linkedBookingRequest ? <div className="v-chip">Linked booking: <strong>{selected.linkedBookingRequest.id}</strong></div> : null}
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
