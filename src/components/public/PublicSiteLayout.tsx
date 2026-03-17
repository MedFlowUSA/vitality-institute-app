import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightAction?: ReactNode;
};

const navItems = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/book", label: "Book" },
  { to: "/contact", label: "Contact" },
  { to: "/login", label: "Sign In" },
];

export default function PublicSiteLayout({ title, subtitle, children, rightAction }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const showBack = location.pathname !== "/";

  return (
    <div className="app-bg">
      <div className="shell">
        <div className="card card-pad" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <Link to="/" style={{ textDecoration: "none" }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "#C8B6FF" }}>
                  Vitality Institute
                </div>
                <div className="h1" style={{ marginTop: 8 }}>
                  {title}
                </div>
                {subtitle ? <div className="muted" style={{ marginTop: 6, maxWidth: 680 }}>{subtitle}</div> : null}
              </Link>
            </div>

            {rightAction}
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {showBack ? (
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                Back
              </button>
            ) : null}
            {navItems.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              return (
                <Link key={item.to} to={item.to} className={active ? "btn btn-primary" : "btn btn-ghost"} style={{ textDecoration: "none" }}>
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
