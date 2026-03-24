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
};

const navItems = [
  { to: "/services", label: "Services" },
  { to: getPublicAccessRoute("login"), label: "Sign In" },
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
      </div>
    </div>
  );
}
