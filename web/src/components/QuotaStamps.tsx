/** Today's application quota, drawn as a sheet of postage stamps: one per application slot. */
export default function QuotaStamps({ used, limit }: { used: number; limit: number }) {
  const slots = Math.max(limit, 1);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${used} of ${limit} applications sent today`}>
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < used;
          return (
            <span key={i}
              className={`relative h-9 w-7 rounded-[3px] border-2 border-dashed ${
                filled ? "border-signal bg-signal" : "border-slate-200 bg-white"}`}>
              {filled && (
                <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto h-4 w-4 text-white" aria-hidden>
                  <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
