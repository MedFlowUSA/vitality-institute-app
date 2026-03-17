import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import ConversationList from "../components/messaging/ConversationList";
import ConversationTimeline from "../components/messaging/ConversationTimeline";
import MessageComposer from "../components/messaging/MessageComposer";
import { useAuth } from "../auth/AuthProvider";
import {
  createPatientConversation,
  loadConversationMessages,
  loadPatientConversationList,
  markConversationRead,
  sendConversationMessage,
} from "../lib/messaging/conversationService";
import { supabase } from "../lib/supabase";

type LocationRow = { id: string; name: string };

export default function PatientConversationCenter() {
  const { user, role, signOut, resumeKey } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const preselectConversationId = params.get("conversationId") ?? params.get("threadId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null;

  const filteredConversations = useMemo(() => {
    if (!listSearch.trim()) return conversations;
    const needle = listSearch.trim().toLowerCase();
    return conversations.filter((item) =>
      [item.title, item.last_message_preview, ...(item.participant_names ?? [])]
        .filter(Boolean)
        .some((value: string) => value.toLowerCase().includes(needle))
    );
  }, [conversations, listSearch]);

  const loadLocations = async () => {
    const { data, error } = await supabase.from("locations").select("id,name").order("name");
    if (error) throw error;
    setLocations((data as LocationRow[]) ?? []);
  };

  const loadConversations = async () => {
    if (!user?.id) return;
    const items = await loadPatientConversationList(user.id);
    setConversations(items);

    if (preselectConversationId) {
      setActiveConversationId(preselectConversationId);
      return;
    }

    if (!activeConversationId && items.length > 0) setActiveConversationId(items[0].id);
  };

  const loadMessages = async (conversationId: string) => {
    if (!user?.id) return;
    const nextMessages = await loadConversationMessages({ conversationId, role });
    setMessages(nextMessages);
    await markConversationRead(conversationId, user.id);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadLocations();
        await loadConversations();
      } catch (error: any) {
        if (!cancelled) setErr(error?.message ?? "Failed to load conversations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, preselectConversationId, resumeKey]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(activeConversationId).catch((error: any) => setErr(error?.message ?? "Failed to load messages."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
      .channel(`messages:${activeConversationId}:patient`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConversationId}` },
        async () => {
          await loadMessages(activeConversationId);
          await loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, user?.id]);

  const createConversation = async () => {
    if (!user?.id) return;
    const locationId = locations[0]?.id;
    if (!locationId) {
      setErr("No clinic location is available for a new message.");
      return;
    }

    setCreating(true);
    setErr(null);

    try {
      const conversationId = await createPatientConversation({ userId: user.id, locationId });
      await loadConversations();
      setActiveConversationId(conversationId);
    } catch (error: any) {
      setErr(error?.message ?? "Failed to start a conversation.");
    } finally {
      setCreating(false);
    }
  };

  const send = async (_mentionUserIds: string[], files: File[]) => {
    if (!user?.id || !activeConversationId) return;
    setSending(true);
    setErr(null);

    try {
      await sendConversationMessage({
        conversationId: activeConversationId,
        actorUserId: user.id,
        actorRole: role,
        body,
        visibility: "patient_visible",
        files,
      });
      setBody("");
      await loadMessages(activeConversationId);
      await loadConversations();
    } catch (error: any) {
      setErr(error?.message ?? "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="Clinical Messages"
      subtitle="Secure conversation with the Vitality Institute care team"
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={() => navigate("/patient")}>
            Back
          </button>
          <button className="btn btn-ghost" type="button" onClick={signOut}>
            Sign out
          </button>
        </>
      }
      chips={
        <>
          <div className="v-chip">
            Role: <strong>{role ?? "-"}</strong>
          </div>
          <div className="v-chip">
            Signed in: <strong>{user?.email ?? "-"}</strong>
          </div>
        </>
      }
    >
      <div className="card card-pad">
        {loading ? <div className="muted">Loading conversations...</div> : null}
        {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

        {!loading ? (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <ConversationList
              title="Your Conversations"
              helper="Keep one continuous message history with the clinic."
              items={filteredConversations}
              selectedId={activeConversationId}
              onSelect={setActiveConversationId}
              search={listSearch}
              onSearchChange={setListSearch}
              emptyLabel="No conversations yet. Start a new conversation."
              action={
                <button className="btn btn-ghost" type="button" onClick={createConversation} disabled={creating}>
                  {creating ? "Creating..." : "New Conversation"}
                </button>
              }
            />

            <div className="card card-pad" style={{ flex: "2 1 620px", minWidth: 320 }}>
              {!activeConversation ? (
                <div className="muted">Select a conversation to begin.</div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div className="h2">{activeConversation.title}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {activeConversation.participant_names.length
                          ? `Care team: ${activeConversation.participant_names.join(", ")}`
                          : "Clinic care team"}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <span className="v-chip">{activeConversation.status}</span>
                      {activeConversation.context_type ? <span className="v-chip">{activeConversation.context_type}</span> : null}
                    </div>
                  </div>

                  <div className="space" />

                  <ConversationTimeline
                    messages={messages}
                    currentUserId={user?.id}
                    emptyLabel="No messages yet. Send the first update below."
                    search={messageSearch}
                    onSearchChange={setMessageSearch}
                  />

                  <div className="space" />

                  <MessageComposer
                    body={body}
                    onBodyChange={setBody}
                    onSend={send}
                    sending={sending}
                    disabled={activeConversation.status === "closed"}
                    internalNote={false}
                    onInternalNoteChange={() => undefined}
                    helperText={
                      activeConversation.status === "closed"
                        ? "This conversation has been closed."
                        : "Send a secure update to the clinic. Attachments stay linked to your chart."
                    }
                  />
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
