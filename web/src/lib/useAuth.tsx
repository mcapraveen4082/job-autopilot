import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const OWNER = (import.meta.env.VITE_OWNER_EMAIL as string | undefined)?.toLowerCase().trim();

interface AuthCtx { session: Session | null; loading: boolean; blocked: boolean; }
const Ctx = createContext<AuthCtx>({ session: null, loading: true, blocked: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user.email?.toLowerCase();
  const blocked = !!(session && OWNER && email !== OWNER);
  useEffect(() => { if (blocked) supabase.auth.signOut(); }, [blocked]);

  return <Ctx.Provider value={{ session: blocked ? null : session, loading, blocked }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const useUserId = () => useContext(Ctx).session?.user.id ?? "";
