import { useMemo, useRef, useState } from "react";
import type { StaffDirectoryUser } from "../../lib/messaging/conversationService";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  formatPatientFileSize,
  validatePatientFileSelection,
} from "../../lib/patientFiles";

type MessageComposerProps = {
  body: string;
  onBodyChange: (value: string) => void;
  onSend: (mentionUserIds: string[], files: File[]) => Promise<void>;
  sending: boolean;
  disabled: boolean;
  allowInternalNotes?: boolean;
  internalNote: boolean;
  onInternalNoteChange: (value: boolean) => void;
  mentionCandidates?: StaffDirectoryUser[];
  helperText: string;
};

function nameForCandidate(candidate: StaffDirectoryUser) {
  return `${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`.trim() || "Care Team";
}

function replaceMentionToken(source: string, mentionQuery: string, replacement: string) {
  const needle = `@${mentionQuery}`;
  const index = source.lastIndexOf(needle);
  if (index === -1) return `${source}${replacement} `;
  return `${source.slice(0, index)}${replacement} ${source.slice(index + needle.length)}`;
}

export default function MessageComposer({
  body,
  onBodyChange,
  onSend,
  sending,
  disabled,
  allowInternalNotes = false,
  internalNote,
  onInternalNoteChange,
  mentionCandidates = [],
  helperText,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);

  const mentionQuery = useMemo(() => {
    const match = body.match(/@([\w-]{1,40})$/i);
    return match?.[1] ?? "";
  }, [body]);

  const filteredCandidates = useMemo(() => {
    if (!mentionQuery.trim()) return [];
    return mentionCandidates
      .filter((candidate) => nameForCandidate(candidate).toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 6);
  }, [mentionCandidates, mentionQuery]);

  const chooseMention = (candidate: StaffDirectoryUser) => {
    const label = `@${nameForCandidate(candidate)}`;
    onBodyChange(replaceMentionToken(body, mentionQuery, label));
    setSelectedMentionIds((current) => (current.includes(candidate.id) ? current : [...current, candidate.id]));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const send = async () => {
    await onSend(selectedMentionIds, files);
    setSelectedMentionIds([]);
    setFiles([]);
    setFileError(null);
  };

  return (
    <div className="card card-pad" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {helperText}
      </div>

      {allowInternalNotes ? (
        <>
          <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={internalNote}
              onChange={(event) => onInternalNoteChange(event.target.checked)}
              disabled={disabled || sending}
            />
            Internal note only
          </label>
        </>
      ) : null}

      <textarea
        ref={textareaRef}
        className="input"
        style={{ width: "100%", minHeight: 110 }}
        placeholder={disabled ? "Conversation is closed." : "Type your message..."}
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        disabled={disabled || sending}
        spellCheck
        autoCorrect="on"
        autoCapitalize="sentences"
      />

      {filteredCandidates.length ? (
        <div className="card card-pad card-light surface-light" style={{ marginTop: 10, display: "grid", gap: 6 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Mention a teammate
          </div>
          {filteredCandidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="btn btn-ghost"
              style={{ justifyContent: "flex-start" }}
              onClick={() => chooseMention(candidate)}
            >
              @{nameForCandidate(candidate)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space" />

      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(event) => {
            const nextFiles = Array.from(event.target.files ?? []);
            const validationError = validatePatientFileSelection(nextFiles, {
              allowPdf: true,
              allowDocuments: true,
              maxFiles: 6,
              maxBytes: MAX_DOCUMENT_UPLOAD_BYTES,
              label: "Message attachments",
            });

            if (validationError) {
              setFiles([]);
              setFileError(validationError);
              event.currentTarget.value = "";
              return;
            }

            setFileError(null);
            setFiles(nextFiles);
            event.currentTarget.value = "";
          }}
          disabled={disabled || sending}
        />
        {files.length ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {files.length} attachment{files.length === 1 ? "" : "s"} ready
          </div>
        ) : null}
      </div>

      {fileError ? (
        <div className="muted" style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>
          {fileError}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Supports images, PDF, DOC, DOCX, and TXT up to {formatPatientFileSize(MAX_DOCUMENT_UPLOAD_BYTES)} each.
        </div>
      )}

      <div className="space" />

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={send}
          disabled={disabled || sending || (!body.trim() && files.length === 0)}
        >
          {sending ? "Sending..." : "Send message"}
        </button>
      </div>
    </div>
  );
}
