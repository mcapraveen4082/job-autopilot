import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export default function Login() {
  const { blocked } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(blocked ? "This account isn't allowed to use this app." : "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg(error.message.includes("owner") || error.message.includes("Database error")
      ? "Sign-ups are closed. This app already has an owner." : error.message);
    else if (mode === "up") setMsg("Account created. If Supabase asks you to confirm your email, open the link, then sign in.");
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-sm p-6">
        <h1 className="h1">Job Autopilot</h1>
        <p className="muted mb-6 mt-1">Your private job-application robot. Only you can sign in.</p>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" required className="field mb-3" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label className="label" htmlFor="pw">Password</label>
        <input id="pw" type="password" required minLength={8} className="field mb-4" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        {msg && <p className="mb-4 rounded-md bg-wait-soft p-2 text-sm text-ink">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create owner account"}</button>
        <button type="button" className="mt-3 w-full text-center text-sm text-slate-600 hover:text-ink"
          onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "First time here? Create the owner account" : "Already set up? Sign in"}
        </button>
      </form>
    </div>
  );
}
