import { statusLabel } from "@/lib/util";

const tone: Record<string, string> = {
  applied: "bg-done-soft text-done",
  needs_approval: "bg-wait-soft text-wait",
  approved: "bg-signal-soft text-signal-dark",
  queued: "bg-signal-soft text-signal-dark",
  applying: "bg-signal-soft text-signal-dark",
  failed: "bg-stop-soft text-stop",
  manual: "bg-wait-soft text-wait",
  skipped: "bg-slate-100 text-slate-600",
  new: "bg-slate-100 text-slate-600",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${tone[status] ?? tone.new}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}
