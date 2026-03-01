// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type AppRole =
  | "super_admin"
  | "location_admin"
  | "provider"
  | "clinical_staff"
  | "billing"
  | "front_desk"
  | "patient";

type AuthCtx = {
  loading: boolean;
  user: any | null;
  role: AppRole | null;
  roleError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

/* ---------------------------------- */
/* Fetch Role (CLEAN VERSION)         */
/* ---------------------------------- */

async function fetchRoleForUser(uid: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;

  return (data?.role ?? null) as AppRole | null;
}

/* ---------------------------------- */
/* Provider                           */
/* ---------------------------------- */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loadRole = async (uid: string) => {
    setRole(null);
    setRoleError(null);

    try {
      let r = await fetchRoleForUser(uid);

      // If profile row does not exist, create one safely
      if (!r) {
        const { error: insertError } = await supabase.from("profiles").insert([
          {
            id: uid,
            role: "patient", // default safe role
          },
        ]);

        if (insertError) {
          setRole(null);
          setRoleError(
            `Profile missing and could not auto-create: ${insertError.message}`
          );
          return;
        }

        r = "patient";
      }

      setRole(r);
    } catch (e: any) {
      setRole(null);
      setRoleError(e?.message ?? "Failed to load role from profiles.");
    }
  };

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
      setRoleError(null);

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
      setRoleError(null);

      if (sessionUser?.id) {
        await loadRole(sessionUser.id);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setRoleError(null);
    setLoading(false);
  };

  const refreshRole = async () => {
    if (!user?.id) return;
    await loadRole(user.id);
  };

  const value = useMemo(
    () => ({
      loading,
      user,
      role,
      roleError,
      signIn,
      signOut,
      refreshRole,
    }),
    [loading, user, role, roleError]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider />");
  return ctx;
}