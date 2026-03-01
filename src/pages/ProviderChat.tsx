import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";

type LocationRow = { id: string; name: string };

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
};

export default function ProviderChat() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const preselectThreadId = params.get("threadId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newBody, setNewBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isAdmin = useMemo(() => role === "super_admin" || role === "location_admin", [role]);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const loadLocations = async () => {
    const { data, error } = await supabase.from("locations").select("id,name").order("name");
    if (error) throw new Error(error.message);
    setLocations((data as LocationRow[]) ?? []);
  };

  const loadAllowed = async () => {
    if (!user) return;

    if (isAdmin) {
      setAllowedLocationIds([]);
      return;
    }

    const { data, error } = await supabase.from("user_locations").select("location_id").eq("user_id", user.id);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((r: any) => r.location_id).filter(Boolean);
    setAllowedLocationIds(ids);
    if (ids.length === 1) setLocationId(ids[0]);
  };

  const loadThreads = async () => {
    setErr(null);

    let q = supabase
      .from("chat_threads")
      .select(
        "id,created_at,location_id,patient_id,appointment_id,intake_submission_id,status,subject,last_message_at"
      )
      .order("last_message_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (isAdmin) {
      if (locationId) q = q.eq("location_id", locationId);
    } else {
      if (allowedLocationIds.length === 0) {
        setThreads([]);
        return;
      }
      q = q.in("location_id", allowedLocationIds);
      if (locationId) q = q.eq("location_id", locationId);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data as ThreadRow[]) ?? [];
    setThreads(rows);

    // URL preselect wins
    if (preselectThreadId) {
      setActiveThreadId(preselectThreadId);
      return;
    }

    if (!activeThreadId && rows.length > 0) setActiveThreadId(rows[0].id);
  };

  const loadMessages = async (threadId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,created_at,thread_id,sender_id,body,is_internal")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(400);

    if (error) throw new Error(error.message);
    setMessages((data as MessageRow[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        await loadLocations();
        await loadAllowed();
        await loadThreads();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, preselectThreadId]);

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, allowedLocationIds.join(","), isAdmin, preselectThreadId]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        await loadMessages(activeThreadId);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load messages.");
      }
    })();
  }, [activeThreadId]);

  // realtime updates
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const send = async () => {
    setErr(null);
    if (!user) return;
    if (!activeThreadId) return alert("Select a thread first.");
    if (!newBody.trim()) return;

    const activeThread = threads.find((t) => t.id === activeThreadId);
    if (activeThread?.status === "closed") return alert("This thread is closed.");

    setSending(true);
    const { error } = await supabase.from("chat_messages").insert([
      { thread_id: activeThreadId, sender_id: user.id, body: newBody.trim(), is_internal: isInternal },
    ]);
    setSending(false);

    if (error) return setErr(error.message);

    setNewBody("");
    setIsInternal(false);
    await loadMessages(activeThreadId);
    await loadThreads();
  };

  const closeThread = async () => {
    if (!activeThreadId) return;
    const { error } = await supabase.from("chat_threads").update({ status: "closed" }).eq("id", activeThreadId);
    if (error) return alert(error.message);
    await loadThreads();
  };

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  return (
    <AppShell
      title="Patient Messages"
      subtitle="Secure patient-provider messaging"
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={() => navigate("/provider")}>
            Back
          </button>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/provider/ai")}>
            AI Plan Builder
          </button>
          <button className="btn btn-ghost" onClick={signOut} type="button">
            Sign out
          </button>
        </>
      }
      chips={
        <>
          <div className="v-chip">
            Role: <strong>{role ?? "—"}</strong>
          </div>
          <div className="v-chip">
            Signed in: <strong>{user?.email ?? "—"}</strong>
          </div>
          <div className="v-chip">
            Status: <strong>Active</strong>
          </div>
        </>
      }
    >
      <div className="card card-pad">
        {loading && <div className="muted">Loading…</div>}
        {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

        {!loading && (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Threads */}
            <div className="card card-pad" style={{ flex: "1 1 320px", minWidth: 300 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div className="h2">Threads</div>

                <select
                  className="input"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={!isAdmin && allowedLocationIds.length <= 1}
                  title={!isAdmin && allowedLocationIds.length <= 1 ? "You’re assigned to one location." : ""}
                >
                  <option value="">{isAdmin ? "All Locations" : "My Locations"}</option>
                  {locations
                    .filter((l) => (isAdmin ? true : allowedLocationIds.includes(l.id)))
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space" />

              {!isAdmin && allowedLocationIds.length === 0 ? (
                <div className="muted">No locations assigned to your account yet. Ask an admin to add you to a location.</div>
              ) : threads.length === 0 ? (
                <div className="muted">No message threads found.</div>
              ) : (
                threads.map((t) => {
                  const active = t.id === activeThreadId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={active ? "btn btn-primary" : "btn btn-ghost"}
                      style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
                      onClick={() => setActiveThreadId(t.id)}
                    >
                      <span style={{ textAlign: "left" }}>
                        {t.subject?.trim() ? t.subject : "Message Thread"}
                        <span className="muted" style={{ display: "block", fontSize: 12 }}>
                          {locName(t.location_id)} • {t.status}
                        </span>
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t.last_message_at ? new Date(t.last_message_at).toLocaleDateString() : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Active */}
            <div className="card card-pad" style={{ flex: "2 1 560px", minWidth: 320 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div className="h2">{activeThread?.subject?.trim() ? activeThread.subject : "Conversation"}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {activeThread ? `${locName(activeThread.location_id)} • ${activeThread.status}` : "Select a thread"}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {activeThread && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => navigate(`/provider/patient/${activeThread.patient_id}`)}
                    >
                      Patient Center
                    </button>
                  )}

                  <button
                    className="btn btn-ghost"
                    onClick={closeThread}
                    disabled={!activeThreadId || activeThread?.status === "closed"}
                    type="button"
                  >
                    Close Thread
                  </button>
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad" style={{ maxHeight: 360, overflow: "auto" }}>
                {messages.length === 0 ? (
                  <div className="muted">No messages yet.</div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {m.is_internal ? "Internal Note" : mine ? "You" : "Patient"} • {fmt(m.created_at)}
                        </div>
                        <div>{m.body}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space" />

              <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  disabled={!activeThreadId || activeThread?.status === "closed"}
                />
                Internal note (patient will not see)
              </label>

              <div className="space" />

              <textarea
                className="input"
                style={{ width: "100%", minHeight: 90 }}
                placeholder={activeThread?.status === "closed" ? "This thread is closed." : "Type a message…"}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                disabled={!activeThreadId || activeThread?.status === "closed"}
              />

              <div className="space" />

              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button
                  className="btn btn-primary"
                  onClick={send}
                  disabled={sending || !activeThreadId || activeThread?.status === "closed"}
                  type="button"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
