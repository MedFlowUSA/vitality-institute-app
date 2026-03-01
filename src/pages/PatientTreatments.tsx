// src/pages/PatientTreatments.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type VisitRow = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  appointment_id: string | null;
  visit_date: string | null;
  status: string | null;
  summary: string | null;
};

type LocationRow = { id: string; name: string };

type VisitNoteRow = {
  id: string;
  visit_id: string;
  created_at: string;
  author_id: string | null;
  note: string;
};

type SoapRow = {
  id: string;
  visit_id: string;
  created_at: string;
  status: string | null;
  locked: boolean | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  signed_at: string | null;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ✅ Accept Supabase "thenables" safely
async function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export default function PatientTreatments() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [activeVisitId, setActiveVisitId] = useState<string>("");

  const [notesByVisit, setNotesByVisit] = useState<Record<string, VisitNoteRow[]>>({});
  const [soapByVisit, setSoapByVisit] = useState<Record<string, SoapRow | null>>({});

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const activeVisit = useMemo(
    () => visits.find((v) => v.id === activeVisitId) ?? null,
    [visits, activeVisitId]
  );

  const loadAll = async () => {
    setErr(null);
    setLoading(true);

    try {
      if (!user?.id) throw new Error("Not signed in.");

      // 1) Locations (for display names)
      const locRes = await withTimeout(
        supabase.from("locations").select("id,name").order("name"),
        12000
      );
      if ((locRes as any).error) throw new Error((locRes as any).error.message);
      setLocations((((locRes as any).data) as LocationRow[]) ?? []);

      // 2) Visits for THIS patient
      const vRes = await withTimeout(
        supabase
          .from("patient_visits")
          .select("id,created_at,location_id,patient_id,appointment_id,visit_date,status,summary")
          .eq("patient_id", user.id)
          .order("visit_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        12000
      );
      if ((vRes as any).error) throw new Error((vRes as any).error.message);

      const vList = (((vRes as any).data) as VisitRow[]) ?? [];
      setVisits(vList);

      const firstId = vList[0]?.id ?? "";
      setActiveVisitId((prev) => prev || firstId);

      if (vList.length === 0) {
        setNotesByVisit({});
        setSoapByVisit({});
        return;
      }

      const visitIds = vList.map((v) => v.id);

      // 3) Visit notes
      const nRes = await withTimeout(
        supabase
          .from("patient_visit_notes")
          .select("id,visit_id,created_at,author_id,note")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false }),
        12000
      );
      if ((nRes as any).error) throw new Error((nRes as any).error.message);

      const notes = (((nRes as any).data) as VisitNoteRow[]) ?? [];
      const byVisit: Record<string, VisitNoteRow[]> = {};
      for (const n of notes) {
        byVisit[n.visit_id] = byVisit[n.visit_id] ? [...byVisit[n.visit_id], n] : [n];
      }
      for (const id of visitIds) if (!byVisit[id]) byVisit[id] = [];
      setNotesByVisit(byVisit);

      // 4) SOAP notes — keep latest per visit
      const sRes = await withTimeout(
        supabase
          .from("patient_soap_notes")
          .select("id,visit_id,created_at,status,locked,subjective,objective,assessment,plan,signed_at")
          .in("visit_id", visitIds)
          .order("created_at", { ascending: false }),
        12000
      );
      if ((sRes as any).error) throw new Error((sRes as any).error.message);

      const soaps = (((sRes as any).data) as SoapRow[]) ?? [];
      const soapMap: Record<string, SoapRow | null> = {};
      for (const s of soaps) {
        if (!soapMap[s.visit_id]) soapMap[s.visit_id] = s;
      }
      for (const id of visitIds) if (!(id in soapMap)) soapMap[id] = null;
      setSoapByVisit(soapMap);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load treatments.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Patient Portal • Treatments"
          primaryCta={{ label: "Back to Home", to: "/patient" }}
          secondaryCta={{ label: "Labs", to: "/patient/labs" }}
          rightActions={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient")}>
                Home
              </button>
              <button className="btn btn-ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </>
          }
          activityItems={[
            { t: "Now", m: "View current & past visits", s: "Visits" },
            { t: "Now", m: "See provider notes & SOAP", s: "Clinical" },
            { t: "Soon", m: "Treatment plan + tasks", s: "Next" },
            { t: "Soon", m: "Invoices + receipts", s: "Billing" },
          ]}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h1">Treatments</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Your visits, notes, and care plan history.
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" onClick={loadAll}>
                Refresh
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/patient")}>
                Home
              </button>
            </div>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && !err && (
            <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div className="card card-pad" style={{ flex: "1 1 340px", minWidth: 320 }}>
                <div className="h2">My Visits</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Click a visit to view details.
                </div>

                <div className="space" />

                {visits.length === 0 ? (
                  <div className="muted">No visits yet.</div>
                ) : (
                  visits.map((v) => {
                    const active = v.id === activeVisitId;
                    const d = v.visit_date ? new Date(v.visit_date) : new Date(v.created_at);

                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={active ? "btn btn-primary" : "btn btn-ghost"}
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          textAlign: "left",
                        }}
                        onClick={() => setActiveVisitId(v.id)}
                      >
                        <span>
                          {d.toLocaleDateString()}
                          <span className="muted" style={{ display: "block", fontSize: 12 }}>
                            {locName(v.location_id)} • {v.status ?? "—"}
                          </span>
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {v.visit_date ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="card card-pad" style={{ flex: "2 1 640px", minWidth: 320 }}>
                {!activeVisit ? (
                  <div className="muted">Select a visit.</div>
                ) : (
                  <>
                    <div className="h2" style={{ marginBottom: 6 }}>
                      Visit Details
                    </div>

                    <div className="muted" style={{ fontSize: 13 }}>
                      Date: <strong>{fmt(activeVisit.visit_date ?? activeVisit.created_at)}</strong>
                      {" • "}Location: <strong>{locName(activeVisit.location_id)}</strong>
                      {" • "}Status: <strong>{activeVisit.status ?? "—"}</strong>
                    </div>

                    <div className="space" />

                    <div className="card card-pad">
                      <div className="h2">Visit Summary</div>
                      <div className="space" />
                      <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                        {activeVisit.summary ?? "No summary yet."}
                      </div>
                    </div>

                    <div className="space" />

                    <div className="card card-pad">
                      <div className="h2">SOAP (Latest)</div>
                      <div className="space" />
                      {soapByVisit[activeVisit.id] ? (
                        <>
                          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                            Created: {fmt(soapByVisit[activeVisit.id]!.created_at)}
                            {" • "}Signed:{" "}
                            {soapByVisit[activeVisit.id]!.signed_at
                              ? fmt(soapByVisit[activeVisit.id]!.signed_at)
                              : "—"}
                            {" • "}Locked: {soapByVisit[activeVisit.id]!.locked ? "Yes" : "No"}
                          </div>

                          <div className="card card-pad" style={{ marginBottom: 10 }}>
                            <div className="h2">S</div>
                            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                              {soapByVisit[activeVisit.id]!.subjective ?? "—"}
                            </div>
                          </div>

                          <div className="card card-pad" style={{ marginBottom: 10 }}>
                            <div className="h2">O</div>
                            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                              {soapByVisit[activeVisit.id]!.objective ?? "—"}
                            </div>
                          </div>

                          <div className="card card-pad" style={{ marginBottom: 10 }}>
                            <div className="h2">A</div>
                            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                              {soapByVisit[activeVisit.id]!.assessment ?? "—"}
                            </div>
                          </div>

                          <div className="card card-pad">
                            <div className="h2">P</div>
                            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                              {soapByVisit[activeVisit.id]!.plan ?? "—"}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="muted">No SOAP note on file yet for this visit.</div>
                      )}
                    </div>

                    <div className="space" />

                    <div className="card card-pad">
                      <div className="h2">Provider / Staff Notes</div>
                      <div className="space" />

                      {(notesByVisit[activeVisit.id] ?? []).length === 0 ? (
                        <div className="muted">No notes yet.</div>
                      ) : (
                        (notesByVisit[activeVisit.id] ?? []).map((n) => (
                          <div key={n.id} className="card card-pad" style={{ marginBottom: 10 }}>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {fmt(n.created_at)}
                            </div>
                            <div className="space" />
                            <div style={{ whiteSpace: "pre-wrap" }}>{n.note}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space" />

                    <div className="muted" style={{ fontSize: 12 }}>
                      Visit ID: {activeVisit.id}
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