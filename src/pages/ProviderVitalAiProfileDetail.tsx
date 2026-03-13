import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import ProfileSummaryCard from "../components/vital-ai/ProfileSummaryCard";
import { supabase } from "../lib/supabase";
import VitalAI from "../lib/vital-ai/vitalAiService";
import type { VitalAiFileRow, VitalAiPathwayRow, VitalAiProfileRow, VitalAiResponseRow, VitalAiSessionRow } from "../lib/vitalAi/types";

type WoundMetricsSnapshot = Awaited<ReturnType<typeof VitalAI.generateWoundMetrics>>;

function formatProgressInterpretation(snapshot: WoundMetricsSnapshot | null) {
  if (!snapshot?.measurement) return null;
  if (snapshot.comparison.interpretation === "insufficient_data") return "No prior wound measurements available yet";
  if (snapshot.comparison.interpretation === "improving") return "Improving";
  if (snapshot.comparison.interpretation === "worsening") return "Worsening";
  return "Stable";
}

export default function ProviderVitalAiProfileDetail() {
  const { profileId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<VitalAiProfileRow | null>(null);
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [files, setFiles] = useState<VitalAiFileRow[]>([]);
  const [insights, setInsights] = useState<ReturnType<typeof VitalAI.generateInsights> | null>(null);
  const [woundMetrics, setWoundMetrics] = useState<WoundMetricsSnapshot | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      setWoundMetrics(null);
      try {
        const { data: profileRow, error: profileError } = await supabase.from("vital_ai_profiles").select("*").eq("id", profileId).maybeSingle();
        if (profileError) throw profileError;
        const nextProfile = (profileRow as VitalAiProfileRow | null) ?? null;
        setProfile(nextProfile);
        if (!nextProfile) return;

        const [
          { data: sessionRow, error: sessionError },
          { data: fileRows, error: fileError },
          { data: responseRows, error: responseError },
          { data: pathwayRow, error: pathwayError },
        ] = await Promise.all([
          supabase.from("vital_ai_sessions").select("*").eq("id", nextProfile.session_id).maybeSingle(),
          supabase.from("vital_ai_files").select("*").eq("session_id", nextProfile.session_id).order("created_at", { ascending: false }),
          supabase.from("vital_ai_responses").select("*").eq("session_id", nextProfile.session_id).order("updated_at", { ascending: true }),
          supabase.from("vital_ai_pathways").select("*").eq("id", nextProfile.pathway_id).maybeSingle(),
        ]);

        if (sessionError) throw sessionError;
        if (fileError) throw fileError;
        if (responseError) throw responseError;
        if (pathwayError) throw pathwayError;

        const nextSession = (sessionRow as VitalAiSessionRow | null) ?? null;
        const nextFiles = (fileRows as VitalAiFileRow[]) ?? [];
        const nextResponses = (responseRows as VitalAiResponseRow[]) ?? [];
        const nextPathway = (pathwayRow as VitalAiPathwayRow | null) ?? null;

        setSession(nextSession);
        setFiles(nextFiles);

        if (nextSession) {
          const sessionWithPathway = {
            ...nextSession,
            current_step_key: nextPathway?.slug ?? nextSession.current_step_key,
          };
          setInsights(VitalAI.generateInsights(sessionWithPathway, nextResponses, nextFiles));
          setWoundMetrics(await VitalAI.generateWoundMetrics(sessionWithPathway, nextResponses, nextFiles));
        } else {
          setInsights(null);
          setWoundMetrics(null);
        }
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
            {insights ? (
              <>
                <div className="card card-pad">
                  <div className="h2">Provider Visit Summary</div>
                  <div className="space" />

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Visit reason</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.providerVisitSummary.visitReason}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Concise narrative</div>
                      <div style={{ marginTop: 6, lineHeight: 1.6 }}>{insights.providerVisitSummary.conciseNarrative}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Key findings</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerVisitSummary.keyFindings.length === 0 ? (
                          <div className="muted">No key findings were derived from the intake.</div>
                        ) : (
                          insights.providerVisitSummary.keyFindings.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Risk flags</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerVisitSummary.riskFlags.length === 0 ? (
                          <div className="muted">No elevated risk flags were derived from this intake.</div>
                        ) : (
                          insights.providerVisitSummary.riskFlags.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Suggested focus</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerVisitSummary.suggestedFocus.map((item) => (
                          <div key={item} style={{ marginBottom: 4 }}>
                            - {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Suggested next steps</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerVisitSummary.suggestedNextSteps.map((item) => (
                          <div key={item} style={{ marginBottom: 4 }}>
                            - {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space" />

                <div className="card card-pad">
                  <div className="h2">Visit Preparation Summary</div>
                  <div className="space" />

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Patient concern</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.visitPreparation.patientConcern}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Key indicators</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.visitPreparation.keyIndicators.length === 0 ? (
                          <div className="muted">No elevated intake indicators detected.</div>
                        ) : (
                          insights.visitPreparation.keyIndicators.map((indicator) => (
                            <div key={indicator} style={{ marginBottom: 4 }}>
                              - {indicator}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Files available</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.visitPreparation.fileSummary}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Suggested focus</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.visitPreparation.suggestedFocus.length === 0 ? (
                          <div className="muted">No focused review areas were derived.</div>
                        ) : (
                          insights.visitPreparation.suggestedFocus.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Potential treatment pathways</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.visitPreparation.treatmentConsiderations.length === 0 ? (
                          <div className="muted">No treatment considerations detected from current rule-based analysis.</div>
                        ) : (
                          insights.visitPreparation.treatmentConsiderations.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Suggested visit duration</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.visitPreparation.suggestedVisitDuration}</div>
                    </div>
                  </div>
                </div>
                <div className="space" />

                <div className="card card-pad">
                  <div className="h2">Vital AI Follow-Up Plan</div>
                  <div className="space" />

                  <div style={{ display: "grid", gap: 12 }}>
                    {insights.followUpPlan.followUps.length === 0 ? (
                      <div className="muted">No follow-up plan was generated for this intake.</div>
                    ) : (
                      insights.followUpPlan.followUps.map((followUp) => (
                        <div key={`${followUp.type}-${followUp.dayOffset}`} className="card card-pad" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 800 }}>Day {followUp.dayOffset}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{followUp.type.replaceAll("_", " ")}</div>
                          </div>
                          <div style={{ marginTop: 8 }}>{followUp.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="space" />

                <div className="card card-pad">
                  <div className="h2">Provider Recommendation Summary</div>
                  <div className="space" />

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Patient concern</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.providerRecommendations.patientConcern}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Risk indicators</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerRecommendations.riskIndicators.length === 0 ? (
                          <div className="muted">No elevated risk indicators detected.</div>
                        ) : (
                          insights.providerRecommendations.riskIndicators.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Suggested priority</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>
                        {insights.providerRecommendations.suggestedPriority === "high"
                          ? "High - provider review within 24 hours"
                          : insights.providerRecommendations.suggestedPriority === "moderate"
                          ? "Moderate - schedule within 48 hours"
                          : "Low - standard review cadence"}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Treatment considerations</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerRecommendations.treatmentConsiderations.length === 0 ? (
                          <div className="muted">No treatment considerations detected from current rule-based analysis.</div>
                        ) : (
                          insights.providerRecommendations.treatmentConsiderations.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Likely service fit</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.providerRecommendations.likelyServiceFit.map((item) => (
                          <div key={item} style={{ marginBottom: 4 }}>
                            - {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space" />

                <div className="card card-pad">
                  <div className="h2">Treatment Opportunities</div>
                  <div className="space" />

                  <div style={{ display: "grid", gap: 12 }}>
                    {insights.treatmentOpportunitySignals.opportunities.length === 0 ? (
                      <div className="muted">No treatment opportunity signals were generated from the current intake.</div>
                    ) : (
                      insights.treatmentOpportunitySignals.opportunities.map((signal) => (
                        <div key={signal.type} className="card card-pad" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 800 }}>{signal.label}</div>
                            <div className="muted" style={{ fontSize: 12, textTransform: "capitalize" }}>{signal.confidence} confidence</div>
                          </div>
                          <div style={{ marginTop: 8 }}>{signal.reason}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="space" />

                {woundMetrics?.measurement ? (
                  <>
                    <div className="card card-pad">
                      <div className="h2">Wound Measurement Summary</div>
                      <div className="space" />

                      <div style={{ display: "grid", gap: 12 }}>
                        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 180 }}>
                            <div className="muted" style={{ fontSize: 12 }}>Wound location</div>
                            <div style={{ marginTop: 4, fontWeight: 800 }}>{woundMetrics.measurement.woundLocation ?? "Not captured"}</div>
                          </div>
                          <div style={{ minWidth: 180 }}>
                            <div className="muted" style={{ fontSize: 12 }}>Duration</div>
                            <div style={{ marginTop: 4, fontWeight: 800 }}>{woundMetrics.measurement.duration ?? "Not captured"}</div>
                          </div>
                          <div style={{ minWidth: 180 }}>
                            <div className="muted" style={{ fontSize: 12 }}>Uploaded images</div>
                            <div style={{ marginTop: 4, fontWeight: 800 }}>
                              {woundMetrics.measurement.woundImagesUploaded
                                ? `${woundMetrics.measurement.uploadedImageCount} ${woundMetrics.measurement.uploadedImageCount === 1 ? "image" : "images"} uploaded`
                                : "No wound images uploaded"}
                            </div>
                          </div>
                        </div>

                        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 140 }}>
                            <div className="muted" style={{ fontSize: 12 }}>Length</div>
                            <div style={{ marginTop: 4, fontWeight: 800 }}>
                              {woundMetrics.measurement.lengthCm != null ? `${woundMetrics.measurement.lengthCm} cm` : "Not captured"}
                            </div>
                          </div>
                          <div style={{ minWidth: 140 }}>
                            <div className="muted" style={{ fontSize: 12 }}>Width</div>
                            <div style={{ marginTop: 4, fontWeight: 800 }}>
                              {woundMetrics.measurement.widthCm != null ? `${woundMetrics.measurement.widthCm} cm` : "Not captured"}
                            </div>
                          </div>
                          {woundMetrics.measurement.depthCm != null ? (
                            <div style={{ minWidth: 140 }}>
                              <div className="muted" style={{ fontSize: 12 }}>Depth</div>
                              <div style={{ marginTop: 4, fontWeight: 800 }}>{woundMetrics.measurement.depthCm} cm</div>
                            </div>
                          ) : null}
                          <div style={{ minWidth: 160 }}>
                            <div className="muted" style={{ fontSize: 12 }}>Estimated area</div>
                            <div style={{ marginTop: 4, fontWeight: 800 }}>
                              {woundMetrics.measurement.areaCm2 != null ? `${woundMetrics.measurement.areaCm2} cm2` : "Not available"}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 12 }}>Healing progression</div>
                          <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                            <div>
                              Previous area: {woundMetrics.comparison.previousAreaCm2 != null ? `${woundMetrics.comparison.previousAreaCm2} cm2` : "No prior measurement"}
                            </div>
                            <div>
                              Current area: {woundMetrics.comparison.currentAreaCm2 != null ? `${woundMetrics.comparison.currentAreaCm2} cm2` : "No current measurement"}
                            </div>
                            {woundMetrics.comparison.percentChange != null ? (
                              <div>
                                Area change: {woundMetrics.comparison.percentChange > 0 ? `${woundMetrics.comparison.percentChange}% reduction` : `${Math.abs(woundMetrics.comparison.percentChange)}% increase`}
                              </div>
                            ) : null}
                            <div style={{ fontWeight: 800 }}>{formatProgressInterpretation(woundMetrics)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space" />
                  </>
                ) : null}

                <div className="card card-pad">
                  <div className="h2">Vital AI Clinical Insights</div>
                  <div className="space" />

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Patient concern summary</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.summary.concern}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Duration / context</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>{insights.summary.duration ?? "Not captured"}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Indicators</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.clinicalInsights.indicators.length === 0 ? (
                          <div className="muted">No elevated indicators detected from the submitted responses.</div>
                        ) : (
                          insights.clinicalInsights.indicators.map((indicator) => (
                            <div key={indicator} style={{ marginBottom: 4 }}>
                              - {indicator}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Uploaded files</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>
                        {insights.summary.fileCount === 0
                          ? "No uploaded files"
                          : `${insights.summary.fileCount} wound ${insights.summary.fileCount === 1 ? "image" : "images"} available`}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Suggested priority</div>
                      <div style={{ marginTop: 4, fontWeight: 800 }}>
                        {insights.clinicalInsights.suggestedPriority === "high"
                          ? "High - provider review within 24 hours"
                          : insights.clinicalInsights.suggestedPriority === "moderate"
                          ? "Moderate - schedule within 48 hours"
                          : "Low - standard review cadence"}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Treatment considerations</div>
                      <div style={{ marginTop: 6 }}>
                        {insights.treatmentOpportunities.length === 0 ? (
                          <div className="muted">No treatment opportunities detected from current rule-based analysis.</div>
                        ) : (
                          insights.treatmentOpportunities.map((item) => (
                            <div key={item} style={{ marginBottom: 4 }}>
                              - {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space" />
              </>
            ) : null}

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
              {files.length === 0 ? <div className="muted">No files attached.</div> : files.map((file) => <div key={file.id} style={{ marginBottom: 8 }}>{file.category} - {file.filename}</div>)}
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
