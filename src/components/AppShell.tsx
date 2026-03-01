import type { ReactNode } from "react";
import VitalityHeader from "./VitalityHeader";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  chips?: ReactNode;
  children: ReactNode;
};

export default function AppShell({
  title,
  subtitle,
  actions,
  chips,
  children,
}: AppShellProps) {
  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          chips={chips}
        />
        <div className="space" />
        {children}
      </div>
    </div>
  );
}
