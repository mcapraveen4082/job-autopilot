import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { parseAtsUrl } from "@/lib/util";

export default function AddJob() {
  const uid = useUserId();
  const [tab, setTab] = useState<"link" | "email">("link");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // link form
  const [url, setUrl] = useState(""); const [lTitle, setLTitle] = useState(""); const [lCompany, setLCompany] = useState("");
  // email form
  const [email, setEmail] = useState(""); const [eTitle, setETitle] = useState(""); const [eCompany, setECompany] = useState(""); const [desc, setDesc] = useState("");

  const addLink = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null);
    const ats = parseAtsUrl(url);
    const row = ats && ats.jobId
      ? { user_id: uid, source: ats.ats, external_id: ats.jobId, company: lCompany || ats.slug, title: lTitle, url, apply_url: url,
          status: "queued", status_reason: `Added by you. Slug: ${ats.slug}` }
      : { user_id: uid, source: "manual", external_id: url, company: lCompany, title: lTitle || url, url, apply_url: url,
          status: "manual", status_reason: "This site needs a login or isn't supported yet, so it's in your apply-yourself list." };
    const { error } = await supabase.from("jobs").upsert({ ...row, posted_at: new Date().toISOString() }, { onConflict: "user_id,source,external_id" });
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: row.status === "queued"
        ? "Added. The robot will read the job and apply on its next run (if it matches your rules)."
        : "Saved to your apply-yourself list." });
      setUrl(""); setLTitle(""); setLCompany("");
    }
  };

  const addEmail = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null);
    const { error } = await supabase.from("jobs").insert({
      user_id: uid, source: "email", external_id: `${email}:${eTitle}:${Date.now()}`, company: eCompany, title: eTitle,
      apply_email: email, description: desc, status: "queued", posted_at: new Date().toISOString(),
      status_reason: "Added by you. The robot will email your resume.",
    });
    if (error) setMsg({ ok: false, text: error.message });
    else { setMsg({ ok: true, text: "Added. The robot will write a short email and send your resume on its next run." }); setEmail(""); setETitle(""); setECompany(""); setDesc(""); }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="h1">Add a job</h1>
        <p className="muted">Found a job on LinkedIn, Naukri or a WhatsApp group? Paste it here.</p>
      </div>
      <div className="flex gap-1.5">
        {(["link", "email"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {t === "link" ? "Job link" : "Apply by email"}
          </button>
        ))}
      </div>

      {tab === "link" ? (
        <form onSubmit={addLink} className="panel space-y-3 p-5">
          <p className="text-sm text-slate-600">
            Links from <b>Greenhouse</b>, <b>Lever</b> or <b>Ashby</b> are applied automatically. Any other link is saved to your apply-yourself list.
            On LinkedIn, click "Apply" first and copy the company page it opens.
          </p>
          <div><label className="label" htmlFor="u">Job link</label>
            <input id="u" type="url" required className="field" placeholder="https://jobs.lever.co/company/1234-abcd" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="lt">Job title (optional)</label><input id="lt" className="field" value={lTitle} onChange={(e) => setLTitle(e.target.value)} /></div>
            <div><label className="label" htmlFor="lc">Company (optional)</label><input id="lc" className="field" value={lCompany} onChange={(e) => setLCompany(e.target.value)} /></div>
          </div>
          <button className="btn-primary">Add job</button>
        </form>
      ) : (
        <form onSubmit={addEmail} className="panel space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="et">Job title</label><input id="et" required className="field" value={eTitle} onChange={(e) => setETitle(e.target.value)} /></div>
            <div><label className="label" htmlFor="ec">Company</label><input id="ec" required className="field" value={eCompany} onChange={(e) => setECompany(e.target.value)} /></div>
          </div>
          <div><label className="label" htmlFor="em">Send resume to</label>
            <input id="em" type="email" required className="field" placeholder="hr@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label" htmlFor="d">Job description</label>
            <textarea id="d" rows={6} className="field" placeholder="Paste the job post so the robot can tailor the email" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <button className="btn-primary">Add job</button>
        </form>
      )}

      {msg && <p className={`rounded p-3 text-sm ${msg.ok ? "bg-done-soft text-done" : "bg-stop-soft text-stop"}`}>{msg.text}</p>}
    </div>
  );
}
