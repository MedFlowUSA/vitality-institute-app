import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: "rgba(124,58,237,0.10)",
          border: "1px solid rgba(124,58,237,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
          }}
        />
      </div>
      <div>
        <div style={{ fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
          Vitality Institute
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
          Provider Portal
        </div>
      </div>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/provider"}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 800,
        color: isActive ? "#4C1D95" : "#374151",
        background: isActive ? "rgba(124,58,237,0.12)" : "transparent",
        border: isActive ? "1px solid rgba(124,58,237,0.18)" : "1px solid transparent",
      })}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
          opacity: 0.9,
        }}
      />
      {label}
    </NavLink>
  );
}

export default function ProviderLayout({
  title,
  subtitle,
  rightSlot,
  children,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const nav = useNavigate();
  const { user, signOut } = useAuth();

  async function onSignOut() {
    await signOut();
    nav("/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", display: "flex" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 280,
          padding: 18,
          position: "sticky",
          top: 0,
          height: "100vh",
          borderRight: "1px solid #E5E7EB",
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ padding: "6px 6px 14px 6px" }}>
          <BrandMark />
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <NavItem to="/provider" label="Home" />
          <NavItem to="/provider/patients" label="Patients" />
          <NavItem to="/provider/intakes" label="Intakes" />
          <NavItem to="/provider/labs" label="Labs" />
          <NavItem to="/provider/chat" label="Messages" />
          <NavItem to="/provider/ai" label="AI Assist" />
        </div>

        <div style={{ marginTop: 16, padding: 12, borderRadius: 16, border: "1px solid #E5E7EB", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Signed in as</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "#111827", wordBreak: "break-word" }}>
            {user?.email ?? "—"}
          </div>
          <button
            onClick={onSignOut}
            style={{
              marginTop: 10,
              width: "100%",
              borderRadius: 14,
              padding: "10px 12px",
              border: "1px solid #E5E7EB",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              color: "#374151",
            }}
          >
            Sign out
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: "#9CA3AF", paddingLeft: 6 }}>
          © {new Date().getFullYear()} Vitality Institute
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 22 }}>
        {/* Topbar */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 950, color: "#111827", letterSpacing: "-0.02em" }}>
              {title}
            </div>
            {subtitle && <div style={{ marginTop: 4, color: "#6B7280", fontSize: 13 }}>{subtitle}</div>}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{rightSlot}</div>
        </div>

        {/* Content card */}
        <div
          style={{
            borderRadius: 22,
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            boxShadow: "0 18px 55px rgba(17,24,39,0.06)",
            padding: 18,
            minHeight: 240,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
