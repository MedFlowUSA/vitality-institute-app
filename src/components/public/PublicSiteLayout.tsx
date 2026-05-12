import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandLockup from "../BrandLockup";
import { getPublicAccessRoute } from "../../lib/publicMarketingCatalog";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightAction?: ReactNode;
  backFallbackTo?: string;
  compactHeader?: boolean;
  preferFallbackBack?: boolean;
};

const navItems = [
  { to: "/services", label: "Services" },
  { to: "/how-to-use-the-app", label: "App Guide" },
  { to: getPublicAccessRoute("login"), label: "Sign In" },
];

function getBackFallback(pathname: string) {
  if (pathname.startsWith("/services/")) return "/services";
  if (pathname === "/contact") return "/";
  if (pathname === "/book") return "/services";
  if (pathname === "/how-to-use-the-app") return "/";
  if (pathname === "/access" || pathname === "/patient/auth" || pathname === "/login") return "/";
  if (pathname === "/vital-ai" || pathname === "/start") return "/";
  if (pathname === "/privacy-policy" || pathname === "/terms-of-service") return "/";
  return "/";
}

export default function PublicSiteLayout({
  title,
  subtitle,
  children,
  rightAction,
  backFallbackTo,
  compactHeader = false,
  preferFallbackBack = false,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const showBack = location.pathname !== "/";
  const resolvedBackFallback = backFallbackTo ?? getBackFallback(location.pathname);

  function handleBack() {
    if (!preferFallbackBack && typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(resolvedBackFallback);
  }

  return (
    <div className="app-bg public-shell">
      <div className="shell">
        <div
          className="card card-pad card-light surface-light"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,241,255,0.95))",
            border: "1px solid rgba(184,164,255,0.18)",
            paddingTop: 18,
            paddingBottom: showBack ? 18 : 16,
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <BrandLockup
              to="/"
              title={compactHeader ? "Vitality Institute" : title}
              subtitle={compactHeader ? undefined : subtitle}
              compact={compactHeader}
            />

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {navItems.map((item) => {
                const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={active ? "btn btn-primary" : "btn btn-secondary"}
                    style={{ textDecoration: "none" }}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {rightAction}
            </div>
          </div>

          {showBack ? (
            <>
              <div className="space" />
              <button type="button" className="btn btn-secondary" onClick={handleBack}>
                Back
              </button>
            </>
          ) : null}
        </div>

        <div className="space" />
        {children}

        <div className="space" />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            paddingBottom: 24,
            paddingTop: 8,
            borderTop: "1px solid rgba(184,164,255,0.14)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1f1633" }}>Vitality Institute</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Physician-led care across Southern California
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <a href="tel:+12139126838" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
              (213) 912-6838
            </a>
            <Link to="/contact" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
              Contact
            </Link>
            <Link to="/privacy-policy" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
              Privacy
            </Link>
            <Link to="/terms-of-service" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
