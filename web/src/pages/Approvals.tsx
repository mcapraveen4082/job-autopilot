import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { normalizeQuestion, timeAgo } from "@/lib/util";
import type { Job, Question } from "@/lib/types";

export default function Approvals() {
  const uid = useUserId();
  const [jobs, setJobs] = useState<Job[] | null>(null);

  const load = async () => {
    const { data } = await supabase.from("jobs").select("*").eq("user_id", uid).eq("status", "needs_approval")
      .order("posted_at", { ascending: false, nullsFirst: false });
    setJobs((data ?? []) as Job[]);
  };
  useEffect(() => { if (uid) load(); }, [uid]);

  if (!jobs) return <p className="muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Needs you</h1>
        <p className="muted">Check the robot's answers, fix anything wrong, then approve. Approved jobs are sent on the next robot run.</p>
      </div>
      {jobs.length === 0
        ? <div className="panel p-6 muted">Nothing waiting. The robot will add jobs here when it meets a question it can't answer safely.</div>
        : jobs.map((j) => <ApprovalCard key={j.id} job={j} uid={uid} onDone={() => setJobs(jobs.filter((x) => x.id !== j.id))} />)}
    </div>
  );
}

function ApprovalCard({ job, uid, onDone }: { job: Job; uid: string; onDone: () => void }) {
  const [qs, setQs] = useState<Question[]>(job.questions ?? []);
  const [cover, setCover] = useState(job.cover_letter ?? "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setAnswer = (i: number, answer: string) =>
    setQs(qs.map((q, k) => (k === i ? { ...q, answer, source: "you" } : q)));

  const missingRequired = qs.filter((q) => q.required && q.type !== "file" && !String(q.answer ?? "").trim());

  const update = async (patch: Partial<Job>) => {
    setBusy(true); setErr("");
    const { error } = await supabase.from("jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id);
    setBusy(false);
    if (error) { setErr(error.message); return false; }
    onDone(); return true;
  };

  const approve = async () => {
    if (missingRequired.length) { setErr(`Answer the required questions first: ${missingRequired.map((q) => q.label).join(", ")}`); return; }
    if (remember) {
      const rows = qs.filter((q) => q.type !== "file" && String(q.answer ?? "").trim() && q.source === "you")
        .map((q) => ({ user_id: uid, question: q.label, normalized: normalizeQuestion(q.label), answer: String(q.answer), updated_at: new Date().toISOString() }));
      if (rows.length) await supabase.from("answers").upsert(rows, { onConflict: "user_id,normalized" });
    }
    await update({ status: "approved", questions: qs, cover_letter: cover, status_reason: "Approved by you" });
  };

  return (
    <article className="panel overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{job.title}</h2>
          <p className="muted">{job.company}{job.location ? `, ${job.location}` : ""} {job.posted_at && <>· posted {timeAgo(job.posted_at)}</>}</p>
          {job.status_reason && <p className="mt-2 rounded bg-wait-soft px-2 py-1 text-sm">{job.status_reason}</p>}
        </div>
        {job.match_score != null && (
          <div className="text-right">
            <div className="text-2xl font-semibold">{job.match_score}<span className="text-sm text-slate-400">/100</span></div>
            <div className="text-xs text-slate-600">match</div>
          </div>
        )}
      </header>

      <div className="space-y-4 p-5">
        {job.match_reason && <p className="text-sm text-slate-600">{job.match_reason}</p>}
        {job.missing_skills?.length > 0 && (
          <p className="text-sm">Skills the job asks for that aren't in your list: <b>{job.missing_skills.join(", ")}</b></p>
        )}

        {qs.filter((q) => q.type !== "file").length > 0 && (
          <div className="space-y-3">
            <h3 className="h2">Form answers</h3>
            {qs.map((q, i) => q.type === "file" ? null : (
              <div key={i}>
                <label className="label" htmlFor={`${job.id}-${i}`}>
                  {q.label}{q.required && <span className="text-stop"> *</span>}
                  {q.source && q.source !== "you" && <span className="ml-2 text-xs font-normal text-slate-400">filled from {q.source}</span>}
                </label>
                {q.options && q.options.length > 0 ? (
                  <select id={`${job.id}-${i}`} className="field" value={q.answer ?? ""} onChange={(e) => setAnswer(i, e.target.value)}>
                    <option value="">Choose…</option>
                    {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : q.type === "textarea" ? (
                  <textarea id={`${job.id}-${i}`} rows={3} className="field" value={q.answer ?? ""} onChange={(e) => setAnswer(i, e.target.value)} />
                ) : (
                  <input id={`${job.id}-${i}`} className="field" value={q.answer ?? ""} onChange={(e) => setAnswer(i, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        )}

        {(job.cover_letter || job.source === "email") && (
          <div>
            <label className="label" htmlFor={`${job.id}-cover`}>{job.source === "email" ? "Email message" : "Cover letter"}</label>
            <textarea id={`${job.id}-cover`} rows={6} className="field" value={cover} onChange={(e) => setCover(e.target.value)} />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember my answers and reuse them for similar questions
        </label>

        {err && <p className="rounded bg-stop-soft p-2 text-sm text-stop">{err}</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={approve}>Approve and send</button>
          <a className="btn-quiet" href={job.apply_url || job.url} target="_blank" rel="noreferrer">Open job page</a>
          <button className="btn-quiet" disabled={busy}
            onClick={() => update({ status: "applied", applied_at: new Date().toISOString(), status_reason: "You applied yourself" })}>
            I applied myself
          </button>
          <button className="btn-quiet" disabled={busy} onClick={() => update({ status: "skipped", status_reason: "Skipped by you" })}>Skip this job</button>
        </div>
      </div>
    </article>
  );
}
