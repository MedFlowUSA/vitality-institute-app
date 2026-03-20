import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightAction?: ReactNode;
  backFallbackTo?: string;
  compactHeader?: boolean;
};

const navItems = [
  { to: "/services", label: "Services" },
  { to: "/login", label: "Sign In" },
];

function getBackFallback(pathname: string) {
  if (pathname.startsWith("/services/")) return "/services";
  if (pathname === "/contact") return "/";
  if (pathname === "/book") return "/services";
  if (pathname === "/vital-ai" || pathname === "/start") return "/";
  return "/";
}

export default function PublicSiteLayout({ title, subtitle, children, rightAction, backFallbackTo, compactHeader = false }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const showBack = location.pathname !== "/";
  const resolvedBackFallback = backFallbackTo ?? getBackFallback(location.pathname);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(resolvedBackFallback);
  }

  return (
    <div className="app-bg public-shell">
      <div className="shell">
        <div className="card card-pad" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <Link to="/" style={{ textDecoration: "none" }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "#C8B6FF" }}>
                  Vitality Institute
                </div>
                {!compactHeader ? (
                  <>
                    <div className="h1" style={{ marginTop: 8 }}>
                      {title}
                    </div>
                    {subtitle ? <div className="muted" style={{ marginTop: 6, maxWidth: 680 }}>{subtitle}</div> : null}
                  </>
                ) : null}
              </Link>
            </div>

            {rightAction}
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {showBack ? (
              <button type="button" className="btn btn-ghost" onClick={handleBack}>
                Back
              </button>
            ) : null}
            {navItems.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 700,
                    color: active ? "#ffffff" : "rgba(255,255,255,0.84)",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space" />
        {children}
      </div>
    </div>
  );
}
