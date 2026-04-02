import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import ConversationList from "../components/messaging/ConversationList";
import ConversationTimeline from "../components/messaging/ConversationTimeline";
import MessageComposer from "../components/messaging/MessageComposer";
import { useAuth } from "../auth/AuthProvider";
import {
  closeConversation,
  joinConversationAsUser,
  loadConversationMessages,
  loadProviderConversationList,
  loadStaffDirectory,
  markConversationRead,
  sendConversationMessage,
} from "../lib/messaging/conversationService";
import { supabase } from "../lib/supabase";
import ProviderPrerequisiteCard from "../components/provider/ProviderPrerequisiteCard";

type LocationRow = { id: string; name: string };

type ConversationListItem = import("../lib/messaging/conversationService").ConversationListItem;
type ConversationMessage = import("../lib/messaging/conversationService").ConversationMessage;
type StaffDirectoryUser = import("../lib/messaging/conversationService").StaffDirectoryUser;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function ProviderConversationCenter() {
  const { user, role, signOut, resumeKey } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const preselectConversationId = params.get("conversationId") ?? params.get("threadId") ?? "";
  const isAdmin = role === "super_admin" || role === "location_admin";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [body, setBody] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null;

  const filteredConversations = useMemo(() => {
    if (!listSearch.trim()) return conversations;
    const needle = listSearch.trim().toLowerCase();
    return conversations.filter((item) =>
      [item.title, item.last_message_preview, item.patient_name, ...(item.participant_names ?? [])]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [conversations, listSearch]);

  const loadBase = useCallback(async () => {
    if (!user?.id) return;

    const { data: locationRows, error: locationErr } = await supabase.from("locations").select("id,name").order("name");
    if (locationErr) throw locationErr;
    setLocations((locationRows as LocationRow[]) ?? []);

    if (isAdmin) {
      const ids = ((locationRows as LocationRow[]) ?? []).map((item) => item.id);
      setAllowedLocationIds(ids);
      return;
    }

    const { data, error } = await supabase
      .from("user_locations")
      .select("location_id,is_primary")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false });

    if (error) throw error;

    const ids = ((data as Array<{ location_id: string; is_primary: boolean }>) ?? []).map((item) => item.location_id);
    setAllowedLocationIds(ids);
    if (!locationId) setLocationId(ids[0] ?? "");
  }, [isAdmin, locationId, user?.id]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    const items = await loadProviderConversationList({ userId: user.id, locationIds: allowedLocationIds, activeLocationId: locationId || undefined });
    setConversations(items);

    if (preselectConversationId) {
      setActiveConversationId(preselectConversationId);
      return;
    }

    if (!activeConversationId && items.length > 0) setActiveConversationId(items[0].id);
  }, [activeConversationId, allowedLocationIds, locationId, preselectConversationId, user?.id]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user?.id) return;
    await joinConversationAsUser({ conversationId, userId: user.id, role });
    const nextMessages = await loadConversationMessages({ conversationId, role });
    setMessages(nextMessages);
    await markConversationRead(conversationId, user.id);
  }, [role, user?.id]);

  const loadStaff = useCallback(async () => {
    const items = await loadStaffDirectory(locationId || undefined);
    setStaffDirectory(items);
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadBase();
      } catch (error: unknown) {
        if (!cancelled) setErr(getErrorMessage(error, "Failed to load messaging access."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadBase, resumeKey, role, user?.id]);

  useEffect(() => {
    if (!user?.id || allowedLocationIds.length === 0) return;
    loadConversations().catch((error: unknown) => setErr(getErrorMessage(error, "Failed to load conversations.")));
    loadStaff().catch((error: unknown) => setErr(getErrorMessage(error, "Failed to load staff directory.")));
  }, [allowedLocationIds.length, loadConversations, loadStaff, user?.id, resumeKey]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(activeConversationId).catch((error: unknown) => setErr(getErrorMessage(error, "Failed to load messages.")));
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
      .channel(`messages:${activeConversationId}:provider`)
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
  }, [activeConversationId, loadConversations, loadMessages, user?.id]);

  const send = async (mentionUserIds: string[], files: File[]) => {
    if (!user?.id || !activeConversationId) return;
    setSending(true);
    setErr(null);

    try {
      await sendConversationMessage({
        conversationId: activeConversationId,
        actorUserId: user.id,
        actorRole: role,
        body,
        visibility: internalNote ? "staff_internal" : "patient_visible",
        mentionUserIds,
        files,
      });
      setBody("");
      setInternalNote(false);
      await loadMessages(activeConversationId);
      await loadConversations();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send message."));
    } finally {
      setSending(false);
    }
  };

  const closeActiveConversation = async () => {
    if (!activeConversationId) return;
    setClosing(true);
    setErr(null);

    try {
      await closeConversation(activeConversationId);
      await loadConversations();
      await loadMessages(activeConversationId);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to close conversation."));
    } finally {
      setClosing(false);
    }
  };

  return (
    <AppShell
      title="Messages"
      subtitle="Conversation-based patient and care-team communication"
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={() => navigate("/provider")}>
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
            Active location: <strong>{locationId || "All"}</strong>
          </div>
        </>
      }
    >
      <div className="card card-pad">
        {loading ? <div className="muted">Loading conversations...</div> : null}
        {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

        {!loading ? (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", minWidth: 300, display: "grid", gap: 12 }}>
              {!isAdmin && allowedLocationIds.length === 0 ? (
                <ProviderPrerequisiteCard
                  title="No Messaging Location Access"
                  message="This provider account is not assigned to a location yet. Add a location assignment before opening patient conversations."
                />
              ) : null}
              <div className="card card-pad">
                <div className="h2">Filter</div>
                <div className="space" />
                <select
                  className="input"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  disabled={!isAdmin && allowedLocationIds.length <= 1}
                >
                  <option value="">{isAdmin ? "All locations" : "My locations"}</option>
                  {locations
                    .filter((item) => (isAdmin ? true : allowedLocationIds.includes(item.id)))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>

              <ConversationList
                title="Conversations"
                helper="Patient-visible messages and internal staff notes stay in one thread."
                items={filteredConversations}
                selectedId={activeConversationId}
                onSelect={setActiveConversationId}
                search={listSearch}
                onSearchChange={setListSearch}
                emptyLabel="No conversations found for this location."
                showPatientName
              />
            </div>

            <div className="card card-pad" style={{ flex: "2 1 640px", minWidth: 320 }}>
              {!activeConversation ? (
                <ProviderPrerequisiteCard
                  title={filteredConversations.length === 0 ? "No Conversations Ready" : "Select A Conversation"}
                  message={
                    filteredConversations.length === 0
                      ? "There are no conversations for the current location filter yet. Choose another location or wait for a patient or staff message to start the thread."
                      : "Choose a conversation from the list to review messages, add an internal note, or reply to the patient."
                  }
                />
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div className="h2">{activeConversation.title}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {activeConversation.patient_name}
                        {activeConversation.participant_names.length
                          ? ` - Team: ${activeConversation.participant_names.join(", ")}`
                          : ""}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {activeConversation.patient_id ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => navigate(`/provider/patients/${activeConversation.patient_id}`)}
                        >
                          Patient Center
                        </button>
                      ) : null}
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={closeActiveConversation}
                        disabled={closing || activeConversation.status === "closed"}
                      >
                        {closing ? "Closing..." : "Close Conversation"}
                      </button>
                    </div>
                  </div>

                  <div className="space" />

                  <ConversationTimeline
                    messages={messages}
                    currentUserId={user?.id}
                    emptyLabel="No messages in this conversation yet."
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
                    allowInternalNotes
                    internalNote={internalNote}
                    onInternalNoteChange={setInternalNote}
                    mentionCandidates={staffDirectory.filter((item) => item.id !== user?.id)}
                    helperText={
                      activeConversation.status === "closed"
                        ? "This conversation has been closed."
                        : "Send a patient-visible message or add a staff-only internal note. Use @mentions for follow-up."
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

