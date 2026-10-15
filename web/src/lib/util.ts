export const normalizeQuestion = (q: string) =>
  q.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Start of "today" in India time, as an ISO string, so counts match the robot. */
export const startOfTodayIST = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600 * 1000).toISOString();
};

export const timeAgo = (iso?: string | null) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
};

/** Detect ATS + slug (and optional job id) from a careers or job URL. */
export const parseAtsUrl = (raw: string):
  { ats: "greenhouse" | "lever" | "ashby"; slug: string; jobId?: string } | null => {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  const parts = u.pathname.split("/").filter(Boolean);
  const host = u.hostname;
  if (host.includes("greenhouse.io")) {
    const slug = u.searchParams.get("for") || parts[0];
    const jobIdx = parts.indexOf("jobs");
    const jobId = u.searchParams.get("gh_jid") || u.searchParams.get("token") || (jobIdx >= 0 ? parts[jobIdx + 1] : undefined);
    if (!slug || slug === "embed") return null;
    return { ats: "greenhouse", slug, jobId };
  }
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    if (!parts[0]) return null;
    return { ats: "lever", slug: parts[0], jobId: parts[1] };
  }
  if (host === "jobs.ashbyhq.com") {
    if (!parts[0]) return null;
    return { ats: "ashby", slug: decodeURIComponent(parts[0]), jobId: parts[1] };
  }
  return null;
};

export const statusLabel: Record<string, string> = {
  new: "Found", skipped: "Skipped", queued: "Queued", needs_approval: "Needs you",
  approved: "Approved", applying: "Applying", applied: "Applied", failed: "Failed",
  manual: "Apply yourself",
};
