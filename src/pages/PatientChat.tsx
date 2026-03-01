import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
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
};

type LocationRow = { id: string; name: string };

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

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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

  const loadThreads = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id,created_at,location_id,patient_id,appointment_id,intake_submission_id,status,subject,last_message_at")
      .order("last_message_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const rows = (data as ThreadRow[]) ?? [];
    setThreads(rows);

    // URL preselect wins
    if (preselectThreadId) {
      setActiveThreadId(preselectThreadId);
      return;
    }

    // Auto-select first if none selected
    if (!activeThreadId && rows.length > 0) setActiveThreadId(rows[0].id);
  };

  const loadMessages = async (threadId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,created_at,thread_id,sender_id,body,is_internal")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) throw new Error(error.message);

    // Patient should never see internal notes
    const safe = ((data as MessageRow[]) ?? []).filter((m) => m.is_internal !== true);
    setMessages(safe);
  };

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        await loadLocations();
        await loadThreads();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, preselectThreadId]);

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

  // realtime (instant updates)
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

  const createThread = async () => {
    if (!user) return;

    const defaultLoc = locations[0]?.id ?? "";
    if (!defaultLoc) return alert("No locations found yet.");

    const subject = prompt("Subject (optional):", "Question for the clinic");
    const { data, error } = await supabase
      .from("chat_threads")
      .insert([
        {
          location_id: defaultLoc,
          patient_id: user.id,
          subject: subject?.trim() || null,
          status: "open",
        },
      ])
      .select("id")
      .maybeSingle();

    if (error) return alert(error.message);

    await loadThreads();
    if (data?.id) setActiveThreadId(data.id);
  };

  const send = async () => {
    setErr(null);
    if (!user) return;
    if (!activeThreadId) return alert("Select a thread first.");
    if (!newBody.trim()) return;

    const activeThread = threads.find((t) => t.id === activeThreadId);
    if (activeThread?.status === "closed") return alert("This thread is closed.");

    setSending(true);
    const { error } = await supabase.from("chat_messages").insert([
      {
        thread_id: activeThreadId,
        sender_id: user.id,
        body: newBody.trim(),
        is_internal: false,
      },
    ]);
    setSending(false);

    if (error) return setErr(error.message);

    setNewBody("");
    await loadMessages(activeThreadId);
    await loadThreads();
  };

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const threadTitle = (t: ThreadRow) => {
    if (t.subject?.trim()) return t.subject;
    if (t.appointment_id) return "Appointment message";
    if (t.intake_submission_id) return "Intake message";
    return "Message Thread";
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Patient & Provider Platform • Secure Intake • Scheduling • Messaging • Labs"
          secondaryCta={{ label: "Back", to: "/patient" }}
          primaryCta={{ label: "Labs", to: "/patient/labs" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut}>
              Sign out
            </button>
          }
          showKpis={true}
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
              <button className="btn btn-ghost" onClick={() => navigate("/patient")}>
                Back
              </button>
              <button className="btn btn-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Thread list */}
              <div className="card card-pad" style={{ flex: "1 1 280px", minWidth: 280 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="h2">Your Threads</div>
                  <button className="btn btn-ghost" onClick={createThread} type="button">
                    New
                  </button>
                </div>

                <div className="space" />

                {threads.length === 0 ? (
                  <div className="muted">No messages yet. Tap “New” to start.</div>
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
                          {threadTitle(t)}
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

              {/* Active thread */}
              <div className="card card-pad" style={{ flex: "2 1 520px", minWidth: 320 }}>
                <div className="h2">{activeThread ? threadTitle(activeThread) : "Conversation"}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {activeThread ? `${locName(activeThread.location_id)} • ${activeThread.status}` : "Select a thread"}
                </div>

                <div className="space" />

                <div className="card card-pad" style={{ maxHeight: 360, overflow: "auto" }}>
                  {messages.length === 0 ? (
                    <div className="muted">No messages yet.</div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {m.sender_id === user?.id ? "You" : "Clinic"} • {fmt(m.created_at)}
                        </div>
                        <div>{m.body}</div>
                      </div>
                    ))
                  )}
                </div>

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
      </div>
    </div>
  );
}
