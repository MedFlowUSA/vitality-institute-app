import type { VitalAiFileRow, IntakeQuestion, IntakeStep } from "../../lib/vitalAi/types";
import FileUploadField from "./FileUploadField";
import ImageUploadField from "./ImageUploadField";
import QuestionRenderer from "./QuestionRenderer";

function filesForCategory(files: VitalAiFileRow[], category?: string) {
  if (!category) return [];
  return files.filter((file) => file.category === category);
}

export default function IntakeStepRenderer({
  step,
  answers,
  files,
  fileUrls,
  onAnswerChange,
  onFileUpload,
  uploadingCategory,
}: {
  step: IntakeStep;
  answers: Record<string, unknown>;
  files: VitalAiFileRow[];
  fileUrls: Record<string, string>;
  onAnswerChange: (question: IntakeQuestion, value: unknown) => void;
  onFileUpload: (question: IntakeQuestion, file: File) => void;
  uploadingCategory?: string | null;
}) {
  return (
    <div>
      <div className="h2">{step.title}</div>
      {step.description ? (
        <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
          {step.description}
        </div>
      ) : null}

      <div className="space" />

      {step.questions.map((question) => {
        if (question.type === "file") {
          const currentFiles = filesForCategory(files, question.category);
          return (
            <div key={question.key}>
              <FileUploadField
                label={question.label}
                required={question.required}
                uploading={uploadingCategory === question.category}
                onSelect={(file) => onFileUpload(question, file)}
              />
              {currentFiles.length > 0 ? (
                <div
                  className="card card-pad"
                  style={{
                    marginBottom: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
                    Uploaded to secure intake files
                  </div>
                  {currentFiles.map((file) => (
                    <div key={file.id} style={{ fontSize: 13, marginBottom: 4, color: "inherit" }}>
                      {file.filename} <span className="muted">({file.category})</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        if (question.type === "image") {
          const currentFiles = filesForCategory(files, question.category);
          return (
            <div key={question.key}>
              <ImageUploadField
                label={question.label}
                required={question.required}
                uploading={uploadingCategory === question.category}
                onSelect={(file) => onFileUpload(question, file)}
              />
              {currentFiles.length > 0 ? (
                <div
                  className="card card-pad"
                  style={{
                    marginBottom: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
                    Uploaded wound image
                  </div>
                  {currentFiles.map((file) => (
                    <div key={file.id} style={{ marginBottom: 10 }}>
                      {fileUrls[file.id] ? (
                        <img
                          src={fileUrls[file.id]}
                          alt={file.filename}
                          style={{
                            width: "100%",
                            maxWidth: 280,
                            height: 180,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            marginBottom: 8,
                          }}
                        />
                      ) : null}
                      <div style={{ fontSize: 13, color: "inherit" }}>
                        {file.filename} <span className="muted">({file.category})</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Stored in <strong>{file.bucket}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <QuestionRenderer
            key={question.key}
            question={question}
            value={answers[question.key]}
            onChange={(value) => onAnswerChange(question, value)}
          />
        );
      })}
    </div>
  );
}
