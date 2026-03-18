import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import IntakeFlowShell from "../components/vital-ai/IntakeFlowShell";
import IntakeStepRenderer from "../components/vital-ai/IntakeStepRenderer";
import { useAuth } from "../auth/AuthProvider";
import { getSignedUrl } from "../lib/patientFiles";
import { getStepIndex, getVisibleQuestions, getVisibleSteps, normalizeAnswerValue } from "../lib/vitalAi/branching";
import { loadVitalAiPathwayById } from "../lib/vitalAi/pathways";
import {
  loadVitalAiFiles,
  loadVitalAiResponses,
  loadVitalAiSession,
  resolveCurrentPatient,
  responsesToMap,
  saveVitalAiResponses,
  updateVitalAiSessionStep,
  uploadVitalAiFile,
  validateVisibleQuestions,
} from "../lib/vitalAi/submission";
import type { IntakeQuestion, PatientRecord, ResponseMap, VitalAiFileRow, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

export default function VitalAiSession() {
  const { sessionId = "" } = useParams();
  const { user, resumeKey } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [pathway, setPathway] = useState<VitalAiPathwayRow | null>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [answers, setAnswers] = useState<ResponseMap>({});
  const [files, setFiles] = useState<VitalAiFileRow[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<Record<string, unknown>>({});
  const hydratedRef = useRef(false);

  const definition = pathway?.definition_json ?? null;
  const visibleSteps = useMemo(() => (definition ? getVisibleSteps(definition, answers) : []), [definition, answers]);
  const activeIndex = useMemo(() => getStepIndex(visibleSteps, session?.current_step_key), [visibleSteps, session?.current_step_key]);
  const activeStep = visibleSteps[activeIndex] ?? visibleSteps[0] ?? null;
  const stepForRender = useMemo(
    () => (activeStep ? { ...activeStep, questions: getVisibleQuestions(activeStep, answers) } : null),
    [activeStep, answers]
  );

  useEffect(() => {
    const load = async () => {
      if (!sessionId || !user?.id) return;
      setLoading(true);
      setErr(null);

      try {
        const nextSession = await loadVitalAiSession(sessionId);
        if (!nextSession) throw new Error("Intake session not found.");
        if (nextSession.profile_id && nextSession.profile_id !== user.id) throw new Error("This intake belongs to another account.");

        const [nextPathway, nextPatient, responseRows, fileRows] = await Promise.all([
          loadVitalAiPathwayById(nextSession.pathway_id),
          resolveCurrentPatient(user.id),
          loadVitalAiResponses(sessionId),
          loadVitalAiFiles(sessionId),
        ]);

        if (!nextPathway) throw new Error("Pathway definition not found.");

        hydratedRef.current = true;
        setSession(nextSession);
        setPathway(nextPathway);
        setPatient(nextPatient);
        setAnswers(responsesToMap(responseRows));
        setFiles(fileRows);

        const nextUrls: Record<string, string> = {};
        for (const file of fileRows) {
          if (!(file.content_type ?? "").startsWith("image/")) continue;
          try {
            nextUrls[file.id] = await getSignedUrl(file.bucket, file.path);
          } catch {
            // ignore preview failures
          }
        }
        setFileUrls(nextUrls);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load intake session.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [resumeKey, sessionId, user?.id]);

  useEffect(() => {
    if (!hydratedRef.current || !session?.id) return;
    const entries = Object.entries(pendingRef.current);
    if (entries.length === 0) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const payload = { ...pendingRef.current };
      pendingRef.current = {};
      setSaving(true);
      try {
        await saveVitalAiResponses(session.id, payload);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to save your progress.");
      } finally {
        setSaving(false);
      }
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [answers, session?.id]);

  const setAnswer = (question: IntakeQuestion, value: unknown) => {
    const normalized = normalizeAnswerValue(question, value);
    pendingRef.current[question.key] = normalized;
    setAnswers((prev) => ({ ...prev, [question.key]: normalized }));
  };

  const handleUpload = async (question: IntakeQuestion, file: File) => {
    if (!session?.id || !user?.id || !question.category) return;
    setUploadingCategory(question.category);
    setErr(null);
    try {
      const uploaded = await uploadVitalAiFile({
        sessionId: session.id,
        patient,
        profileId: user.id,
        category: question.category,
        file,
        image: question.type === "image",
      });
      setFiles((prev) => [uploaded, ...prev]);
      setAnswer(question, {
        file_id: uploaded.id,
        filename: uploaded.filename,
        bucket: uploaded.bucket,
        path: uploaded.path,
        category: uploaded.category,
      });
      if ((uploaded.content_type ?? "").startsWith("image/")) {
        try {
          const url = await getSignedUrl(uploaded.bucket, uploaded.path);
          setFileUrls((prev) => ({ ...prev, [uploaded.id]: url }));
        } catch {
          // ignore preview failures
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to upload file.");
    } finally {
      setUploadingCategory(null);
    }
  };

  const goToStep = async (index: number) => {
    if (!session || !visibleSteps[index]) return;
    const stepKey = visibleSteps[index].key;
    await updateVitalAiSessionStep(session.id, stepKey);
    setSession((prev) => (prev ? { ...prev, current_step_key: stepKey, last_saved_at: new Date().toISOString() } : prev));
  };

  const handleNext = async () => {
    if (!definition || !activeStep || !session) return;
    const validationError = validateVisibleQuestions({
      definition: { ...definition, steps: [{ ...activeStep, questions: getVisibleQuestions(activeStep, answers) }] },
      answers,
      files,
    });
    if (validationError) return setErr(validationError);
    setErr(null);
    await goToStep(Math.min(activeIndex + 1, visibleSteps.length - 1));
  };

  const handleBack = async () => {
    if (activeIndex === 0) {
      navigate("/intake");
      return;
    }
    await goToStep(Math.max(activeIndex - 1, 0));
  };

  const handleReview = async () => {
    if (!definition || !session) return;
    const validationError = validateVisibleQuestions({ definition, answers, files });
    if (validationError) return setErr(validationError);
    navigate(`/intake/session/${session.id}/review`);
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title={pathway?.name ?? "Vital AI Session"}
          subtitle="Complete each step and your draft saves automatically."
          backTo="/intake"
          homeTo="/patient"
        />

        <div className="space" />

        <VitalityHero
          title={pathway?.name ?? "Vital AI Intake"}
          subtitle="Work through the intake step by step."
          secondaryCta={{ label: "Back to Intake Home", to: "/intake" }}
          showKpis={false}
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad">
            <div className="muted">Loading intake session...</div>
          </div>
        ) : err && !pathway ? (
          <div className="card card-pad" style={{ color: "crimson" }}>
            {err}
          </div>
        ) : !pathway || !definition || !activeStep || !stepForRender || !session ? (
          <div className="card card-pad">
            <div className="muted">This intake could not be loaded.</div>
          </div>
        ) : (
          <>
            {err ? (
              <>
                <div className="card card-pad" style={{ color: "crimson" }}>
                  {err}
                </div>
                <div className="space" />
              </>
            ) : null}

            <IntakeFlowShell
              title={pathway.name}
              subtitle={definition.description}
              steps={visibleSteps}
              activeIndex={activeIndex}
              onBack={handleBack}
              onNext={handleNext}
              onReview={handleReview}
              disableNext={saving}
              isLastStep={activeIndex === visibleSteps.length - 1}
              saveStateLabel={saving ? "Saving draft..." : session.last_saved_at ? `Last saved ${new Date(session.last_saved_at).toLocaleString()}` : undefined}
              headerAside={
                <div style={{ display: "grid", gap: 10 }}>
                  <VitalAiAvatarAssistant stepKey={activeStep.key} pathwaySlug={pathway.slug} answers={answers} />
                  <div
                    className="card card-pad"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.82)" }}>
                      Session Status
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 800, color: "#F8FAFC" }}>
                      {session.status.toUpperCase()}
                    </div>
                    <div className="muted" style={{ marginTop: 8, fontSize: 12, color: "rgba(226,232,240,0.78)" }}>
                      Uploaded files: {files.length}
                    </div>
                  </div>
                </div>
              }
            >
              <IntakeStepRenderer
                step={stepForRender}
                answers={answers}
                files={files}
                fileUrls={fileUrls}
                onAnswerChange={setAnswer}
                onFileUpload={handleUpload}
                uploadingCategory={uploadingCategory}
              />
            </IntakeFlowShell>
          </>
        )}
      </div>
    </div>
  );
}
