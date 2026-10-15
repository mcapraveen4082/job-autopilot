"""Find jobs on no-login career sites through their free public job APIs."""
import html
import re
from datetime import datetime, timezone

import requests

UA = {"User-Agent": "Mozilla/5.0 (personal job search assistant)"}


def html_to_text(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<(br|/p|/li|/h\d)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "• ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", s)).strip()


def _iso_ms(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat() if ms else None


def greenhouse(slug, company_name):
    r = requests.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", params={"content": "true"},
                     headers=UA, timeout=30)
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        out.append({
            "source": "greenhouse", "external_id": str(j["id"]), "company": company_name,
            "title": j.get("title", ""), "location": (j.get("location") or {}).get("name", ""),
            "url": j.get("absolute_url", ""),
            "apply_url": f"https://job-boards.greenhouse.io/{slug}/jobs/{j['id']}",
            "description": html_to_text(j.get("content", ""))[:8000],
            "posted_at": j.get("first_published") or j.get("updated_at"),
        })
    return out


def lever(slug, company_name):
    r = requests.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"}, headers=UA, timeout=30)
    r.raise_for_status()
    out = []
    for j in r.json():
        cats = j.get("categories") or {}
        lists = "\n".join(f"{l.get('text')}\n{html_to_text(l.get('content', ''))}" for l in (j.get("lists") or []))
        loc = cats.get("location") or ""
        if (j.get("workplaceType") or "").lower() == "remote" and "remote" not in loc.lower():
            loc = f"{loc} (Remote)".strip()
        out.append({
            "source": "lever", "external_id": j["id"], "company": company_name,
            "title": j.get("text", ""), "location": loc, "url": j.get("hostedUrl", ""),
            "apply_url": j.get("applyUrl") or f"{j.get('hostedUrl', '')}/apply",
            "description": f"{j.get('descriptionPlain', '')}\n{lists}\n{j.get('additionalPlain', '')}"[:8000],
            "posted_at": _iso_ms(j.get("createdAt")),
        })
    return out


def ashby(slug, company_name):
    r = requests.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}", headers=UA, timeout=30)
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        if j.get("isListed") is False:
            continue
        loc = j.get("location") or ""
        if j.get("isRemote") and "remote" not in loc.lower():
            loc = f"{loc} (Remote)".strip()
        out.append({
            "source": "ashby", "external_id": j["id"], "company": company_name,
            "title": j.get("title", ""), "location": loc, "url": j.get("jobUrl", ""),
            "apply_url": j.get("applyUrl") or f"{j.get('jobUrl', '')}/application",
            "description": (j.get("descriptionPlain") or html_to_text(j.get("descriptionHtml", "")))[:8000],
            "posted_at": j.get("publishedAt"),
        })
    return out


FETCHERS = {"greenhouse": greenhouse, "lever": lever, "ashby": ashby}


def fetch_company(ats, slug, name):
    return FETCHERS[ats](slug, name)


def hydrate(job):
    """Fill in details for a job you added by link (title, description, apply link)."""
    reason = job.get("status_reason") or ""
    m = re.search(r"Slug: (\S+)", reason)
    slug = m.group(1) if m else None
    if not slug:
        return None
    try:
        for j in fetch_company(job["source"], slug, job.get("company") or slug):
            if j["external_id"] == job["external_id"]:
                return j
    except requests.RequestException:
        return None
    return None
