import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { loadProfile } from "@/lib/data";
import type { Profile } from "@/lib/types";

type Key = keyof Profile;
const fields: { k: Key; label: string; type?: string; hint?: string }[] = [
  { k: "first_name", label: "First name" }, { k: "last_name", label: "Last name" },
  { k: "email", label: "Email for applications", type: "email" }, { k: "phone", label: "Phone", hint: "With country code, e.g. +91 98xxxxxx" },
  { k: "location", label: "Current city" }, { k: "current_title", label: "Current job title" },
  { k: "current_company", label: "Current company" }, { k: "years_experience", label: "Total years of experience", type: "number" },
  { k: "notice_period", label: "Notice period", hint: "e.g. 30 days, Immediate" }, { k: "current_ctc", label: "Current CTC", hint: "e.g. 6 LPA" },
  { k: "expected_ctc", label: "Expected CTC", hint: "e.g. 9 LPA" }, { k: "work_authorization", label: "Work authorization" },
  { k: "linkedin_url", label: "LinkedIn URL", type: "url" }, { k: "github_url", label: "GitHub URL", type: "url" },
  { k: "portfolio_url", label: "Portfolio / website", type: "url" },
];

export default function ProfilePage() {
  const uid = useUserId();
  const [p, setP] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => { if (uid) loadProfile(uid).then(setP); }, [uid]);
  if (!p) return <p className="muted">Loading…</p>;

  const set = (k: Key, v: unknown) => { setP({ ...p, [k]: v }); setSaved(""); };

  const save = async () => {
    setBusy(true);
    const full_name = `${p.first_name} ${p.last_name}`.trim();
    const { user_id, ...rest } = p;
    const { error } = await supabase.from("profiles")
      .update({ ...rest, full_name, years_experience: Number(p.years_experience) || 0, updated_at: new Date().toISOString() }).eq("user_id", uid);
    setBusy(false); setSaved(error ? error.message : "Profile saved.");
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setSaved("That file is over 5 MB. Upload a smaller PDF."); return; }
    setBusy(true);
    const ext = f.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${uid}/resume.${ext}`;
    const { error } = await supabase.storage.from("resumes").upload(path, f, { upsert: true, contentType: f.type });
    if (!error) await supabase.from("profiles").update({ resume_path: path }).eq("user_id", uid);
    setBusy(false);
    if (error) setSaved(error.message); else { setP({ ...p, resume_path: path }); setSaved(`Uploaded ${f.name}.`); }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="h1">My profile</h1>
        <p className="muted">The robot fills application forms with these details.</p>
      </div>

      <section className="panel space-y-3 p-5">
        <h2 className="h2">Resume</h2>
        <p className="text-sm text-slate-600">{p.resume_path ? `Current file: ${p.resume_path.split("/").pop()}` : "No resume uploaded yet."} PDF works best on every site.</p>
        <input type="file" accept=".pdf,.doc,.docx" onChange={upload} className="text-sm" aria-label="Upload resume" />
        <div>
          <label className="label" htmlFor="rt">Resume text</label>
          <p className="mb-1 text-xs text-slate-600">Paste your resume as plain text. The AI reads this to judge job matches and answer questions. It never invents experience you don't list here.</p>
          <textarea id="rt" rows={10} className="field font-normal" value={p.resume_text} onChange={(e) => set("resume_text", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="sm">Short summary about you</label>
          <textarea id="sm" rows={3} className="field" placeholder="2 or 3 lines used in cover letters and emails" value={p.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>
      </section>

      <section className="panel grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Details</h2>
        {fields.map((f) => (
          <div key={f.k}>
            <label className="label" htmlFor={f.k}>{f.label}</label>
            <input id={f.k} type={f.type ?? "text"} className="field" value={String(p[f.k] ?? "")} onChange={(e) => set(f.k, e.target.value)} />
            {f.hint && <p className="mt-0.5 text-xs text-slate-400">{f.hint}</p>}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={p.willing_to_relocate} onChange={(e) => set("willing_to_relocate", e.target.checked)} />
          I'm willing to relocate
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}>Save profile</button>
        {saved && <span className="text-sm text-slate-600" role="status">{saved}</span>}
      </div>
    </div>
  );
}
