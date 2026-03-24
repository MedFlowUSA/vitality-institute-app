import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getErrorMessage, getPatientRecordIdForProfile } from "../lib/patientRecords";
import { supabase } from "../lib/supabase";
import { uploadPatientFile, getSignedUrl } from "../lib/patientFiles";
import VitalityHero from "../components/VitalityHero";

type ThreadRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  appointment_id: string | null;
  intake_submission_id: string | null;
  status: "open" | "closed";
  subject: string | null;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  created_at: string;
  thread_id: string;
  sender_id: string;
  body: string;
  is_internal: boolean;
  attachment_file_id: string | null;
  attachment_name: string | null;
  attachment_url: string | null;
};

type LocationRow = { id: string; name: string };
function threadStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
  } as const;

  if (s === "open") {
    return {
      ...base,
      background: "rgba(59,130,246,.18)",
      border: "1px solid rgba(59,130,246,.35)",
    };
  }

  if (s === "closed") {
    return {
      ...base,
      background: "rgba(148,163,184,.18)",
      border: "1px solid rgba(148,163,184,.35)",
    };
  }

  return base;
}

export default function PatientChat() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const preselectThreadId = params.get("threadId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newBody, setNewBody] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const threadTitle = (t: ThreadRow) => {
    if (t.subject?.trim()) return t.subject;
    if (t.appointment_id) return "Appointment Message";
    if (t.intake_submission_id) return "Intake Message";
    return "Message Thread";
  };

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase.from("locations").select("id,name").order("name");
    if (error) throw new Error(error.message);
    setLocations((data as LocationRow[]) ?? []);
  }, []);

  const loadThreads = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id,created_at,location_id,patient_id,appointment_id,intake_submission_id,status,subject,last_message_at")
      .eq("patient_id", user.id)
      .order("last_message_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const rows = (data as ThreadRow[]) ?? [];
    setThreads(rows);

    if (preselectThreadId) {
      setActiveThreadId(preselectThreadId);
      return;
    }

    if (!activeThreadId && rows.length > 0) setActiveThreadId(rows[0].id);
  }, [activeThreadId, preselectThreadId, user]);

  const loadMessages = useCallback(async (threadId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,created_at,thread_id,sender_id,body,is_internal,attachment_file_id,attachment_name,attachment_url")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) throw new Error(error.message);

    const safe = ((data as MessageRow[]) ?? []).filter((m) => m.is_internal !== true);
    setMessages(safe);
  }, []);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        await loadLocations();
        await loadThreads();
      } catch (error: unknown) {
        setErr(getErrorMessage(error, "Failed to load."));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLocations, loadThreads, preselectThreadId, user?.id]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    (async () => {
      try {
        await loadMessages(activeThreadId);
      } catch (error: unknown) {
        setErr(getErrorMessage(error, "Failed to load messages."));
      }
    })();
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    if (!activeThreadId) return;

    const channel = supabase
      .channel(`chat_messages:${activeThreadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${activeThreadId}` },
        async () => {
          await loadMessages(activeThreadId);
          await loadThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThreadId, loadMessages, loadThreads]);

  const createThread = async () => {
    if (!user) return;

    const defaultLoc = locations[0]?.id ?? "";
    if (!defaultLoc) {
      setErr("No locations found yet.");
      return;
    }

    setCreatingThread(true);
    setErr(null);

    try {
      const subject = `Patient Question - ${new Date().toLocaleDateString()}`;

      const { data, error } = await supabase
        .from("chat_threads")
        .insert([
          {
            location_id: defaultLoc,
            patient_id: user.id,
            subject,
            status: "open",
          },
        ])
        .select("id")
        .maybeSingle();

      if (error) throw new Error(error.message);

      await loadThreads();
      if (data?.id) setActiveThreadId(data.id);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to create thread."));
    } finally {
      setCreatingThread(false);
    }
  };

  const send = async () => {
    setErr(null);
    if (!user) return;
    if (!activeThreadId) return;

    const currentThread = threads.find((t) => t.id === activeThreadId);
    if (!currentThread) {
      setErr("Thread not found.");
      return;
    }

    if (currentThread?.status === "closed") {
      setErr("This thread is closed.");
      return;
    }

    if (!newBody.trim() && !attachmentFile) return;

    setSending(true);

    try {
      let attachmentPayload: {
        attachment_file_id?: string | null;
        attachment_name?: string | null;
        attachment_url?: string | null;
      } = {};

      if (attachmentFile) {
        setUploadingAttachment(true);

        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) throw new Error("Patient record not found for file upload.");

        const uploaded = await uploadPatientFile({
          patientId,
          locationId: currentThread.location_id,
          visitId: null,
          appointmentId: currentThread.appointment_id ?? null,
          category: "chat_attachment",
          file: attachmentFile,
        });

        let signedUrl: string | null = null;
        try {
          signedUrl = await getSignedUrl(uploaded.bucket, uploaded.path);
        } catch {
          signedUrl = null;
        }

        attachmentPayload = {
          attachment_file_id: null,
          attachment_name: attachmentFile.name,
          attachment_url: signedUrl,
        };
      }

      const { error } = await supabase.from("chat_messages").insert([
        {
          thread_id: activeThreadId,
          sender_id: user.id,
          body: newBody.trim() || (attachmentFile ? "Shared an attachment" : ""),
          is_internal: false,
          ...attachmentPayload,
        },
      ]);

      if (error) throw error;

      setNewBody("");
      setAttachmentFile(null);

      await loadMessages(activeThreadId);
      await loadThreads();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send message."));
    } finally {
      setSending(false);
      setUploadingAttachment(false);
    }
  };

  const onComposerKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await send();
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Secure patient messaging"
          secondaryCta={{ label: "Back", to: "/patient" }}
          primaryCta={{ label: "Labs", to: "/patient/labs" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="h1">Messages</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => navigate("/patient")} type="button">
                Back
              </button>
              <button className="btn btn-ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div className="card card-pad" style={{ flex: "1 1 300px", minWidth: 290 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div className="h2">Your Conversations</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                      Message the clinic securely
                    </div>
                  </div>

                  <button className="btn btn-ghost" onClick={createThread} type="button" disabled={creatingThread}>
                    {creatingThread ? "Creating..." : "New"}
                  </button>
                </div>

                <div className="space" />

                {threads.length === 0 ? (
                  <div className="muted">No messages yet. Start a new conversation.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {threads.map((t) => {
                      const active = t.id === activeThreadId;

                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="card card-pad"
                          onClick={() => setActiveThreadId(t.id)}
                          style={{
                            textAlign: "left",
                            border: active
                              ? "1px solid rgba(59,130,246,.40)"
                              : "1px solid rgba(255,255,255,.08)",
                            background: active
                              ? "rgba(59,130,246,.10)"
                              : "rgba(255,255,255,.03)",
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800 }}>{threadTitle(t)}</div>

                              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                                {locName(t.location_id)}
                              </div>

                              <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                <span style={threadStatusBadge(t.status)}>{t.status.toUpperCase()}</span>
                                {t.appointment_id ? <span className="v-chip">Appointment</span> : null}
                                {t.intake_submission_id ? <span className="v-chip">Intake</span> : null}
                              </div>
                            </div>

                            <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                              {t.last_message_at ? new Date(t.last_message_at).toLocaleDateString() : ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card card-pad" style={{ flex: "2 1 620px", minWidth: 320 }}>
                {!activeThread ? (
                  <div className="muted">Select a conversation to begin.</div>
                ) : (
                  <>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div className="h2">{threadTitle(activeThread)}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {locName(activeThread.location_id)}
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <span style={threadStatusBadge(activeThread.status)}>
                          {activeThread.status.toUpperCase()}
                        </span>
                        {activeThread.appointment_id ? <span className="v-chip">Appointment Linked</span> : null}
                        {activeThread.intake_submission_id ? <span className="v-chip">Intake Linked</span> : null}
                      </div>
                    </div>

                    <div className="space" />

                    <div
                      className="card card-pad"
                      style={{
                        maxHeight: 420,
                        overflow: "auto",
                        background: "rgba(255,255,255,.03)",
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      {messages.length === 0 ? (
                        <div className="muted">No messages yet. Send the first message below.</div>
                      ) : (
                        messages.map((m) => {
                          const mine = m.sender_id === user?.id;

                          return (
                            <div
                              key={m.id}
                              style={{
                                display: "flex",
                                justifyContent: mine ? "flex-end" : "flex-start",
                              }}
                            >
                              <div
                                style={{
                                  maxWidth: "78%",
                                  padding: "12px 14px",
                                  borderRadius: 16,
                                  background: mine
                                    ? "rgba(59,130,246,.18)"
                                    : "rgba(255,255,255,.08)",
                                  border: mine
                                    ? "1px solid rgba(59,130,246,.30)"
                                    : "1px solid rgba(255,255,255,.10)",
                                }}
                              >
                                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.body}</div>
                                {m.attachment_url ? (
                                  <div style={{ marginTop: 10 }}>
                                    {/\.(png|jpe?g|webp|gif)$/i.test(m.attachment_name ?? "") ? (
                                      <a href={m.attachment_url} target="_blank" rel="noreferrer">
                                        <img
                                          src={m.attachment_url}
                                          alt={m.attachment_name ?? "attachment"}
                                          style={{
                                            width: "100%",
                                            maxWidth: 260,
                                            borderRadius: 12,
                                            border: "1px solid rgba(255,255,255,.10)",
                                          }}
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={m.attachment_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost"
                                      >
                                        Open Attachment
                                      </a>
                                    )}

                                    {m.attachment_name ? (
                                      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                                        {m.attachment_name}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                <div
                                  className="muted"
                                  style={{
                                    fontSize: 11,
                                    marginTop: 8,
                                    textAlign: mine ? "right" : "left",
                                  }}
                                >
                                  {mine ? "You" : "Clinic"} - {fmt(m.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="space" />

                    <div className="card card-pad" style={{ background: "rgba(255,255,255,.03)" }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        {activeThread.status === "closed"
                          ? "This conversation is closed."
                          : "Send a secure message to the clinic. Press Enter to send, Shift+Enter for a new line."}
                      </div>

                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 100 }}
                        placeholder={
                          activeThread.status === "closed"
                            ? "This thread is closed."
                            : "Type your message..."
                        }
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        onKeyDown={onComposerKeyDown}
                        disabled={!activeThreadId || activeThread.status === "closed"}
                      />

                      <div className="space" />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setAttachmentFile(file);
                          }}
                          disabled={!activeThreadId || activeThread.status === "closed" || sending}
                        />

                        {attachmentFile ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            Attached: {attachmentFile.name}
                          </div>
                        ) : null}
                      </div>

                      <div className="space" />

                      <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary"
                          onClick={send}
                          disabled={sending || uploadingAttachment || !activeThreadId || activeThread.status === "closed" || (!newBody.trim() && !attachmentFile)}
                          type="button"
                        >
                          {sending || uploadingAttachment ? "Sending..." : "Send Message"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
