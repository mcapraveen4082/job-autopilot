import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { statusLabel, timeAgo } from "@/lib/util";
import type { Job } from "@/lib/types";
import StatusPill from "@/components/StatusPill";

const tabs = ["all", "applied", "needs_approval", "approved", "queued", "manual", "failed", "skipped"];

export default function Jobs() {
  const uid = useUserId();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setJobs(null);
    let query = supabase.from("jobs").select("*").eq("user_id", uid)
      .order("posted_at", { ascending: false, nullsFirst: false }).limit(300);
    if (status !== "all") query = query.eq("status", status);
    const { data } = await query;
    setJobs((data ?? []) as Job[]);
  };
  useEffect(() => { if (uid) load(); }, [uid, status]);

  const setStatus = async (j: Job, s: string, reason: string) => {
    const patch: Record<string, unknown> = { status: s, status_reason: reason, updated_at: new Date().toISOString() };
    if (s === "applied") patch.applied_at = new Date().toISOString();
    await supabase.from("jobs").update(patch).eq("id", j.id);
    load();
  };

  const shown = (jobs ?? []).filter((j) =>
    !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">All jobs</h1>
        <p className="muted">Everything the robot found, newest first.</p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={status === t}
            onClick={() => setParams(t === "all" ? {} : { status: t })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${status === t ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-ink"}`}>
            {t === "all" ? "All" : statusLabel[t]}
          </button>
        ))}
      </div>
      <input className="field max-w-sm" placeholder="Search title, company or city" value={q} onChange={(e) => setQ(e.target.value)} />

      {!jobs ? <p className="muted">Loading…</p> : shown.length === 0 ? (
        <div className="panel p-6 muted">No jobs here yet.</div>
      ) : (
        <ul className="panel divide-y divide-slate-100">
          {shown.map((j) => (
            <li key={j.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => setOpen(open === j.id ? null : j.id)} aria-expanded={open === j.id}>
                  <div className="truncate font-medium">{j.title}</div>
                  <div className="truncate text-sm text-slate-600">
                    {j.company}{j.location ? `, ${j.location}` : ""} · {j.source}{j.posted_at ? ` · posted ${timeAgo(j.posted_at)}` : ""}
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  {j.match_score != null && <span className="text-sm text-slate-600">{j.match_score}/100</span>}
                  <StatusPill status={j.status} />
                </div>
              </div>
              {open === j.id && (
                <div className="mt-3 space-y-3 rounded-md bg-slate-50 p-3 text-sm">
                  {j.status_reason && <p><b>Note:</b> {j.status_reason}</p>}
                  {j.match_reason && <p><b>Why it matched:</b> {j.match_reason}</p>}
                  {j.applied_at && <p><b>Applied:</b> {new Date(j.applied_at).toLocaleString("en-IN")}</p>}
                  {j.questions?.length > 0 && (
                    <details><summary className="cursor-pointer font-medium">Answers used ({j.questions.length})</summary>
                      <ul className="mt-2 space-y-1">{j.questions.map((qq, i) => <li key={i}><span className="text-slate-600">{qq.label}:</span> {qq.answer || "—"}</li>)}</ul>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <a className="btn-quiet" href={j.apply_url || j.url} target="_blank" rel="noreferrer">Open job page</a>
                    {["manual", "failed", "skipped", "queued", "approved"].includes(j.status) &&
                      <button className="btn-quiet" onClick={() => setStatus(j, "applied", "You applied yourself")}>I applied myself</button>}
                    {["failed", "skipped"].includes(j.status) && j.source !== "manual" &&
                      <button className="btn-quiet" onClick={() => setStatus(j, "queued", "Re-queued by you")}>Try again</button>}
                    {!["skipped", "applied"].includes(j.status) &&
                      <button className="btn-quiet" onClick={() => setStatus(j, "skipped", "Skipped by you")}>Skip</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
