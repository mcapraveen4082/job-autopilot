import { createClient } from "@supabase/supabase-js";

// When you connect Supabase / Lovable Cloud inside Lovable, Lovable may
// regenerate this file with your project's URL and key. That's fine:
// the rest of the app only imports `supabase` from here.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
