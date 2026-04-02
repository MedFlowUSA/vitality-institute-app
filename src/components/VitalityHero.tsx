import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import logo from "../assets/vitality-logo.png";

type Kpis = {
  apptsToday: number;
  openThreads: number;
  pendingIntakes: number;
  labsPending: number;
};

function startOfTodayLocalISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayLocalISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function getDefaultHome(role: ReturnType<typeof useAuth>["role"]) {
  if (role === "patient") return "/patient/home";
  if (role === "super_admin" || role === "location_admin") return "/admin";
  return "/provider";
}

export default function VitalityHero({
  title = "Vitality Institute",
  subtitle = "Patient & Provider Platform • Secure Intake • Scheduling • Messaging • Labs",
  primaryCta,
  secondaryCta,
  rightActions,
  showKpis = true,
  activityItems,
}: {
  title?: string;
  subtitle?: string;
  primaryCta?: { label: string; to?: string; onClick?: () => void };
  secondaryCta?: { label: string; to?: string; onClick?: () => void };
  rightActions?: ReactNode;
  showKpis?: boolean;
  activityItems?: { t: string; m: string; s: string }[];
}) {
  const nav = useNavigate();
  const { user, role, signOut } = useAuth();
  const useLightPanels = role === "patient";
  const resolvedHome = useMemo(() => getDefaultHome(role), [role]);

  const [kpis, setKpis] = useState<Kpis>({
    apptsToday: 0,
    openThreads: 0,
    pendingIntakes: 0,
    labsPending: 0,
  });
  const [kpiErr, setKpiErr] = useState<string | null>(null);

  const canSeeKpis = useMemo(() => !!user && !!role && showKpis, [user, role, showKpis]);

  const loadKpis = useCallback(async () => {
    if (!user) return;
    setKpiErr(null);

    try {
      // --- APPOINTMENTS TODAY (count)
      const { count: apptsToday, error: apptErr } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startOfTodayLocalISO())
        .lte("start_time", endOfTodayLocalISO());

      if (apptErr) throw apptErr;

      // --- OPEN THREADS (count)
      const { count: openThreads, error: threadErr } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

      if (threadErr) throw threadErr;

      // --- PENDING INTAKES (count)
      const { count: pendingIntakes, error: intakeErr } = await supabase
        .from("intake_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");

      if (intakeErr && intakeErr.message?.toLowerCase().includes("does not exist")) {
        // ignore
      } else if (intakeErr) {
        throw intakeErr;
      }

      // --- LABS PENDING (count)
      const { count: labsPending, error: labErr } = await supabase
        .from("lab_uploads")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review");

      if (labErr && labErr.message?.toLowerCase().includes("does not exist")) {
        // ignore
      } else if (labErr) {
        throw labErr;
      }

      setKpis({
        apptsToday: apptsToday ?? 0,
        openThreads: openThreads ?? 0,
        pendingIntakes: pendingIntakes ?? 0,
        labsPending: labsPending ?? 0,
      });
    } catch (error: unknown) {
      setKpiErr(error instanceof Error ? error.message : "Failed to load KPIs.");
    }
  }, [user]);

  useEffect(() => {
    if (!canSeeKpis) return;

    void loadKpis();
    const t = setInterval(() => void loadKpis(), 25000);
    return () => clearInterval(t);
  }, [canSeeKpis, loadKpis]);

  const go = (to?: string, onClick?: () => void) => {
    if (onClick) return onClick();
    if (to) return nav(to);
  };

  return (
    <div className="v-hero">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 520px" }}>
          <div className="v-brand">
            <div className="v-logo">
              <img src={logo} alt="Vitality Institute" />
            </div>

            <div className="v-brand-title">
              <div className="title">{title}</div>
              <div className="sub">{subtitle}</div>
            </div>
          </div>

          <div className="v-chips">
            <div className="v-chip">
              Role: <strong>{role ?? "—"}</strong>
            </div>
            <div className="v-chip">
              Signed in: <strong>{user?.email ?? "—"}</strong>
            </div>
            <div className="v-chip">
              Status: <strong>Active</strong>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {secondaryCta && (
            <button className="btn btn-secondary" type="button" onClick={() => go(secondaryCta.to, secondaryCta.onClick)}>
              {secondaryCta.label}
            </button>
          )}
          {primaryCta && (
            <button className="btn btn-primary" type="button" onClick={() => go(primaryCta.to, primaryCta.onClick)}>
              {primaryCta.label}
            </button>
          )}
          {rightActions ?? (user && role ? (
            <>
              <button className="btn btn-secondary" type="button" onClick={() => nav(resolvedHome)}>
                Home
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => void signOut()}>
                Logout
              </button>
            </>
          ) : null)}
        </div>
      </div>

      {canSeeKpis && (
        <>
          <div className="v-statgrid">
            <div className={useLightPanels ? "v-stat v-stat-light surface-light" : "v-stat"}>
              <div className="k">Appointments Today</div>
              <div className="v">{kpis.apptsToday}</div>
            </div>
            <div className={useLightPanels ? "v-stat v-stat-light surface-light" : "v-stat"}>
              <div className="k">Open Threads</div>
              <div className="v">{kpis.openThreads}</div>
            </div>
            <div className={useLightPanels ? "v-stat v-stat-light surface-light" : "v-stat"}>
              <div className="k">Pending Intakes</div>
              <div className="v">{kpis.pendingIntakes}</div>
            </div>
            <div className={useLightPanels ? "v-stat v-stat-light surface-light" : "v-stat"}>
              <div className="k">Labs Pending</div>
              <div className="v">{kpis.labsPending}</div>
            </div>
          </div>

          {kpiErr && (
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              {kpiErr}
            </div>
          )}
        </>
      )}

      {activityItems && activityItems.length > 0 && (
        <div
          className={useLightPanels ? "card card-pad card-light surface-light" : "card card-pad"}
          style={{ marginTop: 14 }}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div className="h2">Recent Activity</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                Live feed of platform actions (appointments, intake, labs, messaging)
              </div>

              <div className="space" />

              <button className="btn btn-secondary" type="button" onClick={() => nav("/patient/treatments")}>
                Treatments
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Auto-refresh enabled
            </div>
          </div>

          <hr className="hr-soft" />

          {activityItems.map((x, i) => (
            <div key={i} className="row" style={{ justifyContent: "space-between", gap: 10, padding: "10px 0" }}>
              <div>
                <div style={{ fontWeight: 700, color: useLightPanels ? "#1f1633" : undefined }}>{x.m}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {x.s}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {x.t}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
