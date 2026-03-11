// src/auth/AuthProvider.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AppRole =
  | "super_admin"
  | "location_admin"
  | "provider"
  | "clinical_staff"
  | "billing"
  | "front_desk"
  | "patient";

export type AccountStatus = "approved" | "pending" | "inactive" | "restricted";

type ProfileRow = {
  role?: AppRole | null;
  active_location_id?: string | null;
  status?: string | null;
  approval_status?: string | null;
  access_state?: string | null;
  is_active?: boolean | null;
};

type AuthCtx = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  accountStatus: AccountStatus;
  roleError: string | null;
  activeLocationId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  setActiveLocationId: (locationId: string | null) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function getErrorMessage(e: unknown, fallback: string) {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/* ---------------------------------- */
/* Fetch Role (CLEAN VERSION)         */
/* ---------------------------------- */
async function fetchRoleForUser(uid: string): Promise<{
  role: AppRole | null;
  activeLocationId: string | null;
  rawStatus: string | null;
  rawApprovalStatus: string | null;
  rawAccessState: string | null;
  isActive: boolean | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;

  const profile = (data ?? {}) as ProfileRow;

  return {
    role: (profile.role ?? null) as AppRole | null,
    activeLocationId: (profile.active_location_id ?? null) as string | null,
    rawStatus: profile.status ?? null,
    rawApprovalStatus: profile.approval_status ?? null,
    rawAccessState: profile.access_state ?? null,
    isActive: profile.is_active ?? null,
  };
}

function normalizeAccountStatus(input: {
  role: AppRole | null;
  rawStatus?: string | null;
  rawApprovalStatus?: string | null;
  rawAccessState?: string | null;
  isActive?: boolean | null;
  roleError?: string | null;
}): AccountStatus {
  const raw = [input.rawAccessState, input.rawApprovalStatus, input.rawStatus]
    .find((value) => typeof value === "string" && value.trim())?.trim().toLowerCase() ?? null;

  if (input.isActive === false) return "inactive";

  if (raw && ["inactive", "disabled", "deactivated", "suspended", "revoked"].includes(raw)) {
    return "inactive";
  }

  if (raw && ["restricted", "blocked", "denied"].includes(raw)) {
    return "restricted";
  }

  if (raw && ["pending", "pending_review", "awaiting_approval", "invited", "unapproved"].includes(raw)) {
    return "pending";
  }

  if (raw && ["approved", "active", "enabled", "verified"].includes(raw)) {
    return input.role ? "approved" : "pending";
  }

  if (input.role) return "approved";
  if (input.roleError) return "restricted";
  return "pending";
}

/* ---------------------------------- */
/* Provider                           */
/* ---------------------------------- */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("pending");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(null);

  const loadRole = useCallback(async (uid: string) => {
    setRole(null);
    setAccountStatus("pending");
    setRoleError(null);
    setActiveLocationIdState(null);

    try {
      // 1) Try to get PRIMARY location (no order() to avoid PostgREST 400s)
      const { data: primaryLoc, error: primaryErr } = await supabase
        .from("user_locations")
        .select("location_id")
        .eq("user_id", uid)
        .eq("is_primary", true)
        .maybeSingle();

      if (primaryErr) throw primaryErr;

      let locationId: string | null = primaryLoc?.location_id ?? null;

      // 2) Fallback: grab any location if no primary exists
      if (!locationId) {
        const { data: anyLoc, error: anyErr } = await supabase
          .from("user_locations")
          .select("location_id")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();

        if (anyErr) throw anyErr;
        locationId = anyLoc?.location_id ?? null;
      }

      const profile = await fetchRoleForUser(uid);

      if (!profile.role) {
        setRole(null);
        setAccountStatus(
          normalizeAccountStatus({
            role: null,
            rawStatus: profile.rawStatus,
            rawApprovalStatus: profile.rawApprovalStatus,
            rawAccessState: profile.rawAccessState,
            isActive: profile.isActive,
          })
        );
        setRoleError("Profile exists but no MedFlow role is assigned yet.");
        setActiveLocationIdState(locationId);
        return;
      }

      setRole(profile.role);
      setAccountStatus(
        normalizeAccountStatus({
          role: profile.role,
          rawStatus: profile.rawStatus,
          rawApprovalStatus: profile.rawApprovalStatus,
          rawAccessState: profile.rawAccessState,
          isActive: profile.isActive,
        })
      );
      setActiveLocationIdState(profile.activeLocationId ?? locationId);
    } catch (e: unknown) {
      const nextRoleError = getErrorMessage(e, "Failed to load role from profiles.");
      setRole(null);
      setAccountStatus("restricted");
      setRoleError(nextRoleError);
      setActiveLocationIdState(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("getSession error:", error);

      const sessionUser = data.session?.user ?? null;

      if (!mounted) return;

      setUser(sessionUser);
      setRole(null);
      setAccountStatus(sessionUser ? "pending" : "restricted");
      setRoleError(null);
      setActiveLocationIdState(null);

      if (sessionUser?.id) {
        await loadRole(sessionUser.id);
      }

      if (mounted) setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;

      setLoading(true);
      setUser(sessionUser);
      setRole(null);
      setAccountStatus(sessionUser ? "pending" : "restricted");
      setRoleError(null);
      setActiveLocationIdState(null);

      if (sessionUser?.id) {
        await loadRole(sessionUser.id);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setAccountStatus("restricted");
    setRoleError(null);
    setActiveLocationIdState(null);
    setLoading(false);
  }, []);

  const refreshRole = useCallback(async () => {
    if (!user?.id) return;
    await loadRole(user.id);
  }, [loadRole, user?.id]);

  const setActiveLocationId = useCallback(
    async (locationId: string | null) => {
      if (!user?.id) return;

      const { error } = await supabase.from("profiles").update({ active_location_id: locationId }).eq("id", user.id);
      if (error) throw error;

      setActiveLocationIdState(locationId);
    },
    [user?.id]
  );

  const value = useMemo(
    () => ({
      loading,
      user,
      role,
      accountStatus,
      roleError,
      activeLocationId,
      signIn,
      signOut,
      refreshRole,
      setActiveLocationId,
    }),
    [loading, user, role, accountStatus, roleError, activeLocationId, signIn, signOut, refreshRole, setActiveLocationId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider />");
  return ctx;
}
