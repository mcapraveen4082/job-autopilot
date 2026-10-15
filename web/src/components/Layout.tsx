import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";

const links = [
  { to: "/", label: "Today", end: true },
  { to: "/approvals", label: "Needs you" },
  { to: "/jobs", label: "All jobs" },
  { to: "/add", label: "Add a job" },
  { to: "/companies", label: "Companies" },
  { to: "/answers", label: "Saved answers" },
  { to: "/profile", label: "My profile" },
  { to: "/settings", label: "Rules & limits" },
];

export default function Layout() {
  const uid = useUserId();
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const load = () => supabase.from("jobs").select("id", { count: "exact", head: true })
      .eq("user_id", uid).eq("status", "needs_approval").then(({ count }) => setPending(count ?? 0));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [uid]);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
              isActive ? "bg-white text-ink shadow-[0_0_0_1px_#D3D9E2]" : "text-slate-600 hover:bg-white/60 hover:text-ink"}`}>
          {l.label}
          {l.to === "/approvals" && pending > 0 && (
            <span className="rounded-full bg-wait px-1.5 text-xs font-bold text-white">{pending}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-full md:flex" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-slate-100 p-4 md:block">
        <div className="mb-6 px-3">
          <div className="text-lg font-bold tracking-tight">Job Autopilot</div>
          <div className="text-xs text-slate-600">Applies while you get on with your day</div>
        </div>
        {nav}
        <button className="mt-6 px-3 text-sm text-slate-600 hover:text-ink" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </aside>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3 md:hidden">
        <span className="font-bold">Job Autopilot</span>
        <button className="btn-quiet py-1.5" aria-expanded={open} onClick={() => setOpen(!open)}>
          Menu{pending > 0 ? ` (${pending})` : ""}
        </button>
      </header>
      {open && (
        <div className="border-b border-slate-200 bg-slate-100 p-3 md:hidden">
          {nav}
          <button className="mt-3 px-3 text-sm text-slate-600" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
        <Outlet />
      </main>
    </div>
  );
}
