import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { loadProfile, loadSettings } from "@/lib/data";
import { startOfTodayIST, timeAgo } from "@/lib/util";
import type { Job, Profile, Run, Settings } from "@/lib/types";
import QuotaStamps from "@/components/QuotaStamps";
import StatusPill from "@/components/StatusPill";

const ROBOT_URL = import.meta.env.VITE_ROBOT_ACTIONS_URL as string | undefined;

export default function Dashboard() {
  const uid = useUserId();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState(0);
  const [pending, setPending] = useState(0);
  const [manual, setManual] = useState(0);
  const [companies, setCompanies] = useState(0);
  const [recent, setRecent] = useState<Job[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  const load = async () => {
    const [s, p] = await Promise.all([loadSettings(uid), loadProfile(uid)]);
    setSettings(s); setProfile(p);
    const since = startOfTodayIST();
    const c = (q: any) => q.then((r: any) => r.count ?? 0);
    const [t, pe, ma, co] = await Promise.all([
      c(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "applied").gte("applied_at", since)),
      c(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "needs_approval")),
      c(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "manual")),
      c(supabase.from("target_companies").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("active", true)),
    ]);
    setToday(t); setPending(pe); setManual(ma); setCompanies(co);
    const { data: r } = await supabase.from("jobs").select("*").eq("user_id", uid)
      .in("status", ["applied", "failed", "needs_approval"]).order("updated_at", { ascending: false }).limit(8);
    setRecent((r ?? []) as Job[]);
    const { data: rn } = await supabase.from("runs").select("*").eq("user_id", uid).order("started_at", { ascending: false }).limit(5);
    setRuns((rn ?? []) as Run[]);
  };
  useEffect(() => { if (uid) load(); }, [uid]);

  const togglePause = async () => {
    if (!settings) return;
    const paused = !settings.paused;
    setSettings({ ...settings, paused });
    await supabase.from("settings").update({ paused, updated_at: new Date().toISOString() }).eq("user_id", uid);
  };

  if (!settings || !profile) return <p className="muted">Loading…</p>;

  const setup = [
    { done: !!profile.resume_path, text: "Upload your resume", to: "/profile" },
    { done: !!(profile.first_name && profile.phone), text: "Fill in your name and phone", to: "/profile" },
    { done: settings.target_roles.length > 0 && settings.skills.length > 0, text: "Add the roles and skills you want", to: "/settings" },
    { done: companies > 0, text: "Add companies to watch", to: "/companies" },
  ];
  const setupLeft = setup.filter((s) => !s.done);
  const lastRun = runs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Today</h1>
          <p className="muted">
            {settings.paused ? "The robot is paused. It won't apply anywhere until you resume it."
              : settings.mode === "review" ? "Review mode: the robot fills every form, and you approve before anything is sent."
              : "Auto mode: the robot applies on its own and asks you only when it's unsure."}
          </p>
        </div>
        <button onClick={togglePause} className={settings.paused ? "btn-primary" : "btn-quiet"}>
          {settings.paused ? "Resume robot" : "Pause robot"}
        </button>
      </div>

      {setupLeft.length > 0 && (
        <section className="panel border-wait/40 bg-wait-soft p-5">
          <h2 className="h2">Finish setup so the robot can start</h2>
          <ul className="mt-2 space-y-1">
            {setup.map((s) => (
              <li key={s.text} className="text-sm">
                {s.done ? <span className="text-done">✓ {s.text}</span>
                  : <Link className="font-medium text-signal underline" to={s.to}>{s.text}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h2">Applications sent today</h2>
          <span className="text-sm text-slate-600"><b className="text-2xl text-ink">{today}</b> of {settings.daily_limit}</span>
        </div>
        <QuotaStamps used={Math.min(today, settings.daily_limit)} limit={settings.daily_limit} />
        <p className="muted mt-3">
          {lastRun ? `Last robot run ${timeAgo(lastRun.started_at)}: found ${lastRun.found}, applied ${lastRun.applied}.`
            : "The robot hasn't run yet. It runs on its schedule, or you can start it from GitHub."}
          {ROBOT_URL && <> <a className="text-signal underline" href={ROBOT_URL} target="_blank" rel="noreferrer">Open robot runs</a></>}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/approvals" className="panel block p-5 hover:border-wait">
          <div className="text-3xl font-semibold text-wait">{pending}</div>
          <div className="font-medium">Waiting for your answer</div>
          <div className="muted">Jobs with new questions, missing skills, or a captcha.</div>
        </Link>
        <Link to="/jobs?status=manual" className="panel block p-5 hover:border-signal">
          <div className="text-3xl font-semibold text-signal">{manual}</div>
          <div className="font-medium">To apply yourself</div>
          <div className="muted">Sites that need a login, like LinkedIn Easy Apply or Naukri.</div>
        </Link>
      </div>

      <section className="panel">
        <h2 className="h2 border-b border-slate-200 px-5 py-3">Latest activity</h2>
        {recent.length === 0 ? <p className="muted p-5">Nothing yet. Activity shows up here after the robot's first run.</p> : (
          <ul className="divide-y divide-slate-100">
            {recent.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{j.title}</div>
                  <div className="truncate text-sm text-slate-600">{j.company}{j.location ? `, ${j.location}` : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{timeAgo(j.applied_at ?? j.created_at)}</span>
                  <StatusPill status={j.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
