import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RouteHeader from "../components/RouteHeader";
import {
  guidedHelperStyle,
  guidedMutedStyle,
  guidedPanelSoftStyle,
  guidedPanelStyle,
} from "../components/vital-ai/guidedIntakeStyles";
import MarketGroupedSelect from "../components/locations/MarketGroupedSelect";
import PathwaySelector from "../components/vital-ai/PathwaySelector";
import { useAuth } from "../auth/AuthProvider";
import { useClinicContext } from "../features/clinics/hooks/useClinicContext";
import { buildMarketOptionGroups, isPlaceholderMarket, type MarketStatus } from "../lib/locationMarkets";
import { clearPublicBookingDraft, readPublicBookingDraft } from "../lib/publicBookingDraft";
import { supabase } from "../lib/supabase";
import {
  getGenderPathwayGuidance,
  personalizePathwaysByGender,
  readStoredIntakeGender,
  saveStoredIntakeGender,
  type IntakeGender,
} from "../lib/vitalAi/genderPreferences";
import { loadVitalAiPathways } from "../lib/vitalAi/pathways";
import { createVitalAiSession, resolveCurrentPatient, saveVitalAiResponses } from "../lib/vitalAi/submission";
import type { PatientRecord, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

type IntakeLocationOption = {
  location_id: string;
  location_name: string;
  city: string | null;
  state: string | null;
  is_placeholder: boolean;
  market_status: MarketStatus;
  display_priority: number | null;
};

export default function VitalAiIntakeHome() {
  const { user, activeLocationId, setActiveLocationId, resumeKey } = useAuth();
  const { activeClinic, activeClinicId, activeClinicLocations, loading: clinicLoading, setActiveClinicId } = useClinicContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pathways, setPathways] = useState<VitalAiPathwayRow[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [drafts, setDrafts] = useState<VitalAiSessionRow[]>([]);
  const [allLocationMarkets, setAllLocationMarkets] = useState<IntakeLocationOption[]>([]);
  const [intakeGender, setIntakeGender] = useState<IntakeGender | "">(() => readStoredIntakeGender());
  const bookingDraft = useMemo(() => readPublicBookingDraft(), []);
  const requestedPathway = searchParams.get("pathway");
  const shouldAutostart = searchParams.get("autostart") === "1";
  const autoStartedPathwayRef = useRef<string | null>(null);
  const effectiveLocationId = bookingDraft?.locationId || activeLocationId || patient?.location_id || "";
  const intakeLocationOptions = useMemo<IntakeLocationOption[]>(() => {
    const clinicScoped = activeClinicLocations.map((location) => ({
      location_id: location.location_id,
      location_name: location.location_name,
      city: location.city,
      state: location.state,
      is_placeholder: location.is_placeholder,
      market_status: location.market_status,
      display_priority: location.display_priority,
    }));
    const next = new Map<string, IntakeLocationOption>(clinicScoped.map((location) => [location.location_id, location]));
    for (const location of allLocationMarkets.filter((market) => isPlaceholderMarket(market))) {
      next.set(location.location_id, location);
    }
    return Array.from(next.values());
  }, [activeClinicLocations, allLocationMarkets]);
  const effectiveLocationSummary =
    intakeLocationOptions.find((location) => location.location_id === effectiveLocationId) ?? null;
  const intakeLocationGroups = useMemo(
    () =>
      buildMarketOptionGroups(intakeLocationOptions, {
        valueOf: (location) => location.location_id,
        labelOf: (location) => {
          const place = [location.city, location.state].filter(Boolean).join(", ");
          return place ? `${location.location_name} - ${place}` : location.location_name;
        },
        includeComingSoon: true,
        disableComingSoon: true,
      }),
    [intakeLocationOptions]
  );
  const canStartIntake = Boolean(activeClinicId && effectiveLocationId && effectiveLocationSummary && !isPlaceholderMarket(effectiveLocationSummary));

  const matchedRequestedPathway = useMemo(() => {
    if (!requestedPathway) return null;
    const requestedKey = requestedPathway.toLowerCase();
    return pathways.find((pathway) => {
      const slug = pathway.slug.toLowerCase();
      return slug === requestedKey || slug.includes(requestedKey) || requestedKey.includes(slug);
    }) ?? null;
  }, [pathways, requestedPathway]);

  const prioritizedPathways = useMemo(() => {
    const baseline = [...pathways].sort((a, b) => {
      const rank = (slug: string) => {
        const key = slug.toLowerCase();
        if (key.includes("general") || key.includes("consult")) return 0;
        if (key.includes("wound")) return 1;
        return 2;
      };

      return rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name);
    });

    const personalized = personalizePathwaysByGender(baseline, intakeGender);
    if (!requestedPathway) return personalized;

    const requestedIndex = personalized.findIndex((pathway) => pathway.slug.toLowerCase().includes(requestedPathway.toLowerCase()));
    if (requestedIndex <= 0) return personalized;

    const next = [...personalized];
    const [requested] = next.splice(requestedIndex, 1);
    next.unshift(requested);
    return next;
  }, [intakeGender, pathways, requestedPathway]);

  useEffect(() => {
    saveStoredIntakeGender(intakeGender);
  }, [intakeGender]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setErr(null);

    try {
      const [pathwayRows, patientRow, draftRows, locationRows] = await Promise.all([
        loadVitalAiPathways(),
        resolveCurrentPatient(user.id),
        (() => {
          let query = supabase
            .from("vital_ai_sessions")
            .select("*")
            .eq("profile_id", user.id)
            .eq("status", "draft");

          if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
          if (effectiveLocationId) query = query.eq("location_id", effectiveLocationId);

          return query.order("updated_at", { ascending: false }).limit(10);
        })(),
        supabase
          .from("locations")
          .select("id,name,city,state,is_placeholder,market_status,display_priority")
          .order("display_priority")
          .order("name"),
      ]);

      if (draftRows.error) throw draftRows.error;
      if (locationRows.error) throw locationRows.error;

      setPathways(pathwayRows);
      setPatient(patientRow);
      setDrafts((draftRows.data as VitalAiSessionRow[]) ?? []);
      setAllLocationMarkets(
        (((locationRows.data as Array<{
          id: string;
          name: string;
          city: string | null;
          state: string | null;
          is_placeholder: boolean;
          market_status: MarketStatus;
          display_priority: number | null;
        }>) ?? [])).map((location) => ({
          location_id: location.id,
          location_name: location.name,
          city: location.city,
          state: location.state,
          is_placeholder: location.is_placeholder,
          market_status: location.market_status,
          display_priority: location.display_priority,
        }))
      );

      const preferredLocationId = bookingDraft?.locationId || patientRow?.location_id || null;
      const preferredLocation = (locationRows.data as Array<{ id: string; is_placeholder: boolean; market_status: MarketStatus }> | null)?.find(
        (location) => location.id === preferredLocationId
      );

      if (!activeLocationId && preferredLocationId && preferredLocation && !isPlaceholderMarket(preferredLocation)) {
        await setActiveLocationId(preferredLocationId);
      }
      if (!activeClinicId && patientRow?.clinic_id) {
        await setActiveClinicId(patientRow.clinic_id);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load Vital AI intake options.");
    } finally {
      setLoading(false);
    }
  }, [activeClinicId, activeLocationId, bookingDraft?.locationId, effectiveLocationId, setActiveClinicId, setActiveLocationId, user?.id]);

  useEffect(() => {
    void load();
  }, [load, resumeKey, user?.id]);

  useEffect(() => {
    if (!shouldAutostart || !requestedPathway) {
      autoStartedPathwayRef.current = null;
    }
  }, [requestedPathway, shouldAutostart]);

  const startPathway = useCallback(async (pathway: VitalAiPathwayRow) => {
    if (!user?.id) return;
    if (!activeClinicId) {
      setErr("Choose or confirm your clinic before starting intake.");
      return;
    }
    if (!effectiveLocationId) {
      setErr("Choose your location before starting intake.");
      return;
    }
    setBusySlug(pathway.slug);
    setErr(null);

    try {
      const session = await createVitalAiSession({
        pathway,
        patient,
        profileId: user.id,
        clinicId: activeClinicId,
        locationId: effectiveLocationId,
      });
      if (intakeGender) {
        await saveVitalAiResponses(session.id, { patient_gender: intakeGender });
      }
      clearPublicBookingDraft();
      navigate(`/intake/session/${session.id}`, { replace: true });
    } catch (e: unknown) {
      autoStartedPathwayRef.current = null;
      setErr(e instanceof Error ? e.message : "Failed to start intake.");
    } finally {
      setBusySlug(null);
    }
  }, [activeClinicId, effectiveLocationId, intakeGender, navigate, patient, user?.id]);

  useEffect(() => {
    if (!shouldAutostart || loading || busySlug || !matchedRequestedPathway) return;
    if (autoStartedPathwayRef.current === matchedRequestedPathway.slug) return;

    autoStartedPathwayRef.current = matchedRequestedPathway.slug;
    void startPathway(matchedRequestedPathway);
  }, [busySlug, loading, matchedRequestedPathway, shouldAutostart, startPathway]);

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Vital AI Intake"
          subtitle="Choose your location, pick the right pathway, and complete intake one section at a time."
          backTo="/patient/home"
          homeTo="/patient/home"
        />

        <div className="space" />

        {bookingDraft?.serviceId || bookingDraft?.locationId || bookingDraft?.startTimeLocal ? (
          <>
            <div className="card card-pad" style={guidedPanelStyle}>
              <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>Visit request saved</div>
              <div className="h2" style={{ marginTop: 6, color: "#F8FAFC" }}>Continue with intake</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, ...guidedMutedStyle }}>
                {bookingDraft.serviceName || "Your selected service"} at {bookingDraft.locationName || "your preferred location"}
                {bookingDraft.startTimeLocal ? ` with a preferred time of ${new Date(bookingDraft.startTimeLocal).toLocaleString()}` : ""} has been saved.
                Finish the intake so the care team receives the right clinical background before follow-up.
              </div>
            </div>
            <div className="space" />
          </>
        ) : null}

        {err ? (
          <>
            <div className="card card-pad" style={{ color: "crimson" }}>
              {err}
            </div>
            <div className="space" />
          </>
        ) : null}

        <div className="card card-pad" style={guidedPanelStyle}>
          <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>Start here</div>
          <div className="h2" style={{ marginTop: 6, color: "#F8FAFC" }}>Set up your intake</div>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, ...guidedMutedStyle }}>
            Choose your live clinic location, tell us the intake type that fits best, and then complete the guided form. Your progress saves automatically.
          </div>

          <div className="space" />

          <div className="card card-pad" style={guidedPanelSoftStyle}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>
                <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>1. Confirm location</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>Attach this intake to the right clinic and care team.</div>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>2. Pick a pathway</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>Choose the pathway that best matches your concern.</div>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>3. Submit for review</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>The team receives your answers, uploads, and intake summary.</div>
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 340px", minWidth: 280 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <div className="v-chip">Clinic: {activeClinic?.name ?? (clinicLoading ? "Loading..." : "Not set")}</div>
                <div className="v-chip">Location: {effectiveLocationSummary?.location_name ?? bookingDraft?.locationName ?? "Not set"}</div>
              </div>
              <MarketGroupedSelect
                label="Location"
                value={effectiveLocationId}
                onChange={(value) => void setActiveLocationId(value || null)}
                groups={intakeLocationGroups}
                placeholder="Select location..."
                disabled={intakeLocationOptions.length === 0}
                helperText="Live clinic locations can start intake. Coming-soon markets are visible for network awareness but stay disabled."
                style={{ marginTop: 8 }}
                selectStyle={{ width: "100%" }}
              />
              {!canStartIntake ? (
                <div className="muted" style={{ marginTop: 10, fontSize: 12, ...guidedHelperStyle }}>
                  Choose a live clinic location to unlock intake pathways.
                </div>
              ) : null}
            </div>

            <div style={{ flex: "1 1 240px", minWidth: 240 }}>
              <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>Gender</div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {(["Male", "Female"] as IntakeGender[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={intakeGender === option ? "btn btn-primary" : "btn btn-secondary"}
                    onClick={() => setIntakeGender(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="muted" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, ...guidedHelperStyle }}>
                {getGenderPathwayGuidance(intakeGender)}
              </div>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad" style={guidedPanelStyle}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Choose an intake pathway</div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, ...guidedMutedStyle }}>
            Start with the pathway that best matches your current concern. You can continue a draft later if you need to stop and come back.
          </div>

          <div className="space" />

          {!canStartIntake ? (
            <div className="muted" style={guidedMutedStyle}>Choose a clinic-linked location to unlock intake pathways.</div>
          ) : loading ? (
            <div className="muted">Loading pathways...</div>
          ) : (
            <PathwaySelector pathways={prioritizedPathways} busySlug={busySlug} onSelect={startPathway} />
          )}
        </div>

        <div className="space" />

        <div className="card card-pad" style={guidedPanelStyle}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Continue a saved draft</div>
          <div className="muted" style={{ marginTop: 6, ...guidedMutedStyle }}>
            Pick up a saved intake exactly where you left it.
          </div>
          <div className="space" />
          {loading ? (
            <div className="muted" style={guidedMutedStyle}>Loading drafts...</div>
          ) : drafts.length === 0 ? (
            <div className="muted" style={guidedMutedStyle}>No draft intakes yet.</div>
          ) : (
            drafts.map((draft) => (
              <button
                key={draft.id}
                className="btn btn-secondary"
                type="button"
                style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left", ...guidedPanelSoftStyle, color: "#F8FAFC", minHeight: 64 }}
                onClick={() => navigate(`/intake/session/${draft.id}`)}
              >
                <span>
                  <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{draft.current_step_key || "Continue intake"}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, ...guidedHelperStyle }}>
                    Last saved {new Date(draft.last_saved_at).toLocaleString()}
                  </div>
                </span>
                <span className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>
                  Continue
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

