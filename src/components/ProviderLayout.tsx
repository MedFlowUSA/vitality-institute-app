import type { ReactNode } from "react";

/**
 * Legacy compatibility shell.
 * Active provider routes use AppShell, RouteHeader, VitalityHero, and ProviderWorkspaceNav.
 */
export default function ProviderLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

