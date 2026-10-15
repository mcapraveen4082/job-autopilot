import { supabase } from "@/integrations/supabase/client";
import type { Profile, Settings } from "./types";

/** Makes sure the owner has a profile row and a settings row. */
export async function ensureRows(userId: string, email: string) {
  const { data: p } = await supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!p) await supabase.from("profiles").insert({ user_id: userId, email });
  const { data: s } = await supabase.from("settings").select("user_id").eq("user_id", userId).maybeSingle();
  if (!s) await supabase.from("settings").insert({ user_id: userId, notify_email: email });
}

export async function loadProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data as Profile;
}

export async function loadSettings(userId: string) {
  const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data as Settings;
}
