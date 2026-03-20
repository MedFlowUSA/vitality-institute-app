import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import {
  guidedChipStyle,
  guidedHelperStyle,
  guidedMutedStyle,
  guidedPanelSoftStyle,
  guidedPanelStyle,
} from "../components/vital-ai/guidedIntakeStyles";
import PathwaySelector from "../components/vital-ai/PathwaySelector";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import { useAuth } from "../auth/AuthProvider";
import { clearPublicBookingDraft, readPublicBookingDraft } from "../lib/publicBookingDraft";
import { supabase } from "../lib/supabase";
import { loadVitalAiPathways } from "../lib/vitalAi/pathways";
import { createVitalAiSession, resolveCurrentPatient } from "../lib/vitalAi/submission";
import type { PatientRecord, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function VitalAiIntakeHome() {
  const { user, resumeKey } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pathways, setPathways] = useState<VitalAiPathwayRow[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [drafts, setDrafts] = useState<VitalAiSessionRow[]>([]);
  const bookingDraft = useMemo(() => readPublicBookingDraft(), []);

  const prioritizedPathways = [...pathways].sort((a, b) => {
    const rank = (slug: string) => {
      const key = slug.toLowerCase();
      if (key.includes("general") || key.includes("consult")) return 0;
      if (key.includes("wound")) return 1;
      return 2;
    };

    return rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name);
  });

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErr(null);

    try {
      const [pathwayRows, patientRow, draftRows] = await Promise.all([
        loadVitalAiPathways(),
        resolveCurrentPatient(user.id),
        supabase
          .from("vital_ai_sessions")
          .select("*")
          .eq("profile_id", user.id)
          .eq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(10),
      ]);

      if (draftRows.error) throw draftRows.error;

      setPathways(pathwayRows);
      setPatient(patientRow);
      setDrafts((draftRows.data as VitalAiSessionRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load Vital AI intake options.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeKey, user?.id]);

  const startPathway = async (pathway: VitalAiPathwayRow) => {
    if (!user?.id) return;
    setBusySlug(pathway.slug);
    setErr(null);

    try {
      const session = await createVitalAiSession({ pathway, patient, profileId: user.id });
      clearPublicBookingDraft();
      navigate(`/intake/session/${session.id}`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start intake.");
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Vital AI Intake"
          subtitle="Start a new intake or resume where you left off."
          backTo="/patient"
          homeTo="/patient"
        />

        <div className="space" />

        <VitalityHero
          title="Vital AI"
          subtitle="Start or resume intake so your care team has the right details before your visit."
          secondaryCta={{ label: "Back", to: "/patient" }}
          showKpis={false}
        />

        <div className="space" />

        {bookingDraft?.serviceId || bookingDraft?.locationId || bookingDraft?.startTimeLocal ? (
          <>
            <div className="card card-pad" style={guidedPanelStyle}>
              <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>
                Visit request saved
              </div>
              <div className="h2" style={{ marginTop: 6, color: "#F8FAFC" }}>
                Continue intake with your visit details in place
              </div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, ...guidedMutedStyle }}>
                {bookingDraft.serviceName || "Your selected service"} at {bookingDraft.locationName || "your preferred location"}
                {bookingDraft.startTimeLocal ? ` with a preferred time of ${new Date(bookingDraft.startTimeLocal).toLocaleString()}` : ""} has been saved.
                Choose the pathway that best matches your concern so the team receives the right intake and wound care urgency details early.
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

        <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            className="card card-pad"
            style={{
              flex: "1 1 420px",
              minWidth: 320,
              ...guidedPanelStyle,
            }}
          >
            <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>
              Welcome to Vital AI
            </div>
            <div className="h2" style={{ marginTop: 6, color: "#F8FAFC" }}>A guided intake experience</div>
            <div style={{ marginTop: 8, lineHeight: 1.7, ...guidedMutedStyle }}>
              Vital AI helps you choose the right pathway, move through one section at a time, save progress automatically, and route your intake to the right care team for review.
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <div className="v-chip" style={guidedChipStyle}>Choose a pathway</div>
              <div className="v-chip" style={guidedChipStyle}>Answer one section at a time</div>
              <div className="v-chip" style={guidedChipStyle}>Review before submit</div>
              <div className="v-chip" style={guidedChipStyle}>Secure uploads</div>
            </div>

            <div className="space" />

            <div className="card card-pad" style={guidedPanelSoftStyle}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>1. Choose Pathway</div>
                  <div style={{ marginTop: 6, fontWeight: 800 }}>Start with the concern that best matches your visit.</div>
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>2. Complete Intake</div>
                  <div style={{ marginTop: 6, fontWeight: 800 }}>Move through guided sections with saved progress.</div>
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <div className="muted" style={{ fontSize: 12, ...guidedHelperStyle }}>3. Submit for Review</div>
                  <div style={{ marginTop: 6, fontWeight: 800 }}>The Vitality team receives a structured summary and uploads.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: "1 1 340px", minWidth: 300 }}>
            <VitalAiAvatarAssistant stepKey="contact" title="Vital AI Guide" />
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad" style={guidedPanelStyle}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Choose Your Intake Pathway</div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, ...guidedMutedStyle }}>
            Start with the pathway that best matches the patient concern. Wound care stays front and center for urgent wound history, infection screening, and photo upload.
          </div>

          <div className="space" />

          {loading ? <div className="muted">Loading pathways...</div> : <PathwaySelector pathways={prioritizedPathways} busySlug={busySlug} onSelect={startPathway} />}
        </div>

        <div className="space" />

        <div className="card card-pad" style={guidedPanelStyle}>
          <div className="h2" style={{ color: "#F8FAFC" }}>Continue Intake Form</div>
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
                className="btn btn-ghost"
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
