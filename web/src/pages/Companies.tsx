import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { parseAtsUrl, timeAgo } from "@/lib/util";
import type { Company } from "@/lib/types";

export default function Companies() {
  const uid = useUserId();
  const [list, setList] = useState<Company[] | null>(null);
  const [url, setUrl] = useState(""); const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await supabase.from("target_companies").select("*").eq("user_id", uid).order("name");
    setList((data ?? []) as Company[]);
  };
  useEffect(() => { if (uid) load(); }, [uid]);

  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const p = parseAtsUrl(url);
    if (!p) { setErr("That link isn't a Greenhouse, Lever or Ashby careers page. Open the company's careers page, click any job, and copy the link from there."); return; }
    const { error } = await supabase.from("target_companies").upsert(
      { user_id: uid, name: name || p.slug, ats: p.ats, slug: p.slug, active: true }, { onConflict: "user_id,ats,slug" });
    if (error) setErr(error.message); else { setUrl(""); setName(""); load(); }
  };

  const toggle = async (c: Company) => { await supabase.from("target_companies").update({ active: !c.active }).eq("id", c.id); load(); };
  const remove = async (c: Company) => { await supabase.from("target_companies").delete().eq("id", c.id); load(); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Companies</h1>
        <p className="muted max-w-2xl">
          The robot checks these career pages every run and applies to new matching jobs, newest first. No login is needed for them.
          Tip: on a company's careers page, open any job. If the link has <b>greenhouse.io</b>, <b>jobs.lever.co</b> or <b>jobs.ashbyhq.com</b>, it works here.
        </p>
      </div>
      <form onSubmit={add} className="panel grid gap-3 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div><label className="label" htmlFor="cu">Careers or job link</label>
          <input id="cu" required className="field" placeholder="https://boards.greenhouse.io/companyname" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
        <div><label className="label" htmlFor="cn">Name (optional)</label>
          <input id="cn" className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button className="btn-primary">Add company</button>
        {err && <p className="text-sm text-stop sm:col-span-3">{err}</p>}
      </form>

      {!list ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <div className="panel p-6 muted">No companies yet. Add 20 to 50 companies you'd like to work at to give the robot plenty of jobs to check.</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600"><tr className="border-b border-slate-200">
              <th className="px-5 py-2 font-medium">Company</th><th className="px-3 py-2 font-medium">Site</th>
              <th className="px-3 py-2 font-medium">Last checked</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                  <td className="px-5 py-2.5 font-medium">{c.name}<div className="text-xs font-normal text-slate-400">{c.slug}</div></td>
                  <td className="px-3 py-2.5 capitalize">{c.ats}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.last_checked_at ? timeAgo(c.last_checked_at) : "Not yet"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button className="mr-3 text-signal hover:underline" onClick={() => toggle(c)}>{c.active ? "Pause" : "Resume"}</button>
                    <button className="text-stop hover:underline" onClick={() => remove(c)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
