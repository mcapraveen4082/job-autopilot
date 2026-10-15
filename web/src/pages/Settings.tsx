import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { loadSettings } from "@/lib/data";
import type { Settings } from "@/lib/types";
import TagInput from "@/components/TagInput";

export default function SettingsPage() {
  const uid = useUserId();
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => { if (uid) loadSettings(uid).then(setS); }, [uid]);
  if (!s) return <p className="muted">Loading…</p>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setSaved(""); };

  const save = async () => {
    const { user_id, ...rest } = s;
    const { error } = await supabase.from("settings").update({
      ...rest,
      daily_limit: Math.min(Math.max(Number(s.daily_limit) || 1, 1), 60),
      max_per_run: Math.min(Math.max(Number(s.max_per_run) || 1, 1), 20),
      min_match_score: Math.min(Math.max(Number(s.min_match_score) || 0, 0), 100),
      max_job_age_days: Math.max(Number(s.max_job_age_days) || 1, 1),
      updated_at: new Date().toISOString(),
    }).eq("user_id", uid);
    setSaved(error ? error.message : "Rules saved. The robot uses them from its next run.");
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="h1">Rules & limits</h1>
        <p className="muted">Tell the robot what to look for and how much to apply.</p>
      </div>

      <section className="panel space-y-4 p-5">
        <h2 className="h2">What jobs to apply for</h2>
        <div><label className="label" htmlFor="roles">Job titles</label>
          <TagInput id="roles" value={s.target_roles} onChange={(v) => set("target_roles", v)} placeholder="Frontend Developer, React Developer…" />
          <p className="mt-1 text-xs text-slate-400">Press Enter after each one. A job title must contain one of these.</p></div>
        <div><label className="label" htmlFor="skills">My skills</label>
          <TagInput id="skills" value={s.skills} onChange={(v) => set("skills", v)} placeholder="React, TypeScript, Node.js…" /></div>
        <div><label className="label" htmlFor="locs">Locations</label>
          <TagInput id="locs" value={s.locations} onChange={(v) => set("locations", v)} placeholder="Bangalore, Bengaluru, India…" /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.remote_ok} onChange={(e) => set("remote_ok", e.target.checked)} /> Include remote jobs
        </label>
        <div><label className="label" htmlFor="ex">Skip jobs whose title contains</label>
          <TagInput id="ex" value={s.exclude_keywords} onChange={(v) => set("exclude_keywords", v)} placeholder="Senior, Lead, Intern…" /></div>
      </section>

      <section className="panel grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">How much to apply</h2>
        <div><label className="label" htmlFor="dl">Applications per day</label>
          <input id="dl" type="number" min={1} max={60} className="field" value={s.daily_limit} onChange={(e) => set("daily_limit", Number(e.target.value))} /></div>
        <div><label className="label" htmlFor="pr">Applications per robot run</label>
          <input id="pr" type="number" min={1} max={20} className="field" value={s.max_per_run} onChange={(e) => set("max_per_run", Number(e.target.value))} />
          <p className="mt-1 text-xs text-slate-400">Spreads applications across the day.</p></div>
        <div><label className="label" htmlFor="ms">Minimum match score (0 to 100)</label>
          <input id="ms" type="number" min={0} max={100} className="field" value={s.min_match_score} onChange={(e) => set("min_match_score", Number(e.target.value))} />
          <p className="mt-1 text-xs text-slate-400">65 is a good start. Higher means fewer, closer matches.</p></div>
        <div><label className="label" htmlFor="age">Ignore jobs older than (days)</label>
          <input id="age" type="number" min={1} className="field" value={s.max_job_age_days} onChange={(e) => set("max_job_age_days", Number(e.target.value))} /></div>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="h2">How the robot behaves</h2>
        <fieldset className="space-y-2">
          <legend className="sr-only">Mode</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" checked={s.mode === "review"} onChange={() => set("mode", "review")} className="mt-1" />
            <span><b>Review mode.</b> The robot fills every form and sends it to "Needs you". Nothing is submitted until you approve. Best for the first few days.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" checked={s.mode === "auto"} onChange={() => set("mode", "auto")} className="mt-1" />
            <span><b>Auto mode.</b> The robot submits on its own when it can answer every question confidently, and asks you about the rest.</span>
          </label>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.approve_if_missing_skills} onChange={(e) => set("approve_if_missing_skills", e.target.checked)} />
          Ask me first when a job needs skills that aren't in my list
        </label>
        <div><label className="label" htmlFor="ne">Daily summary email goes to</label>
          <input id="ne" type="email" className="field" value={s.notify_email} onChange={(e) => set("notify_email", e.target.value)} /></div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save}>Save rules</button>
        {saved && <span className="text-sm text-slate-600" role="status">{saved}</span>}
      </div>
    </div>
  );
}
