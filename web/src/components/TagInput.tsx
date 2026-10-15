import { useState, type KeyboardEvent } from "react";

interface Props { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string; }

export default function TagInput({ value, onChange, placeholder, id }: Props) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (items.length) onChange([...value, ...items]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="field flex min-h-[42px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-signal-soft px-2 py-0.5 text-sm text-signal-dark">
          {t}
          <button type="button" aria-label={`Remove ${t}`} className="text-signal-dark/70 hover:text-stop"
            onClick={() => onChange(value.filter((v) => v !== t))}>×</button>
        </span>
      ))}
      <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
        onBlur={() => draft && add(draft)} placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none" />
    </div>
  );
}
