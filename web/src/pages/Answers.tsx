import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/useAuth";
import { normalizeQuestion } from "@/lib/util";
import type { Answer } from "@/lib/types";

const starters = [
  "What is your notice period?", "Are you willing to relocate?", "How many years of experience do you have with React?",
  "Do you require visa sponsorship?", "What is your expected CTC?", "How did you hear about us?",
];

export default function Answers() {
  const uid = useUserId();
  const [list, setList] = useState<Answer[] | null>(null);
  const [q, setQ] = useState(""); const [a, setA] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [draft, setDraft] = useState("");

  const load = async () => {
    const { data } = await supabase.from("answers").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
    setList((data ?? []) as Answer[]);
  };
  useEffect(() => { if (uid) load(); }, [uid]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    await supabase.from("answers").upsert({ user_id: uid, question: q, normalized: normalizeQuestion(q), answer: a, updated_at: new Date().toISOString() },
      { onConflict: "user_id,normalized" });
    setQ(""); setA(""); load();
  };
  const save = async (x: Answer) => { await supabase.from("answers").update({ answer: draft, updated_at: new Date().toISOString() }).eq("id", x.id); setEditing(null); load(); };
  const remove = async (x: Answer) => { await supabase.from("answers").delete().eq("id", x.id); load(); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Saved answers</h1>
        <p className="muted max-w-2xl">The robot reuses these when a form asks the same or a similar question. Answers you give on approvals are saved here too.</p>
      </div>
      <form onSubmit={add} className="panel space-y-3 p-5">
        <div><label className="label" htmlFor="aq">Question</label>
          <input id="aq" required className="field" list="starter-qs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What is your notice period?" />
          <datalist id="starter-qs">{starters.map((s) => <option key={s} value={s} />)}</datalist></div>
        <div><label className="label" htmlFor="aa">Your answer</label>
          <textarea id="aa" required rows={2} className="field" value={a} onChange={(e) => setA(e.target.value)} /></div>
        <button className="btn-primary">Save answer</button>
      </form>

      {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <div className="panel p-6 muted">No saved answers yet.</div> : (
        <ul className="panel divide-y divide-slate-100">
          {list.map((x) => (
            <li key={x.id} className="px-5 py-3">
              <div className="font-medium">{x.question}</div>
              {editing === x.id ? (
                <div className="mt-2 space-y-2">
                  <textarea rows={2} className="field" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit answer" />
                  <div className="flex gap-2"><button className="btn-primary" onClick={() => save(x)}>Save changes</button>
                    <button className="btn-quiet" onClick={() => setEditing(null)}>Cancel</button></div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-slate-600">{x.answer}</p>
                  <span className="whitespace-nowrap text-sm">
                    <button className="mr-3 text-signal hover:underline" onClick={() => { setEditing(x.id); setDraft(x.answer); }}>Edit</button>
                    <button className="text-stop hover:underline" onClick={() => remove(x)}>Delete</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
