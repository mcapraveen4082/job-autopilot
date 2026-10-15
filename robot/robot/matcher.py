"""Cheap rule checks done before spending any AI calls."""
import re
from datetime import datetime, timedelta, timezone

GENERIC = {"developer", "engineer", "engineering", "software", "sr", "senior", "jr", "junior", "the", "and", "of",
           "i", "ii", "iii", "lead", "staff", "principal", "specialist", "associate", "executive", "-", "/", "&"}


def _words(s):
    return [w for w in re.split(r"[^a-z0-9+#.]+", s.lower()) if w]


def title_matches(title, roles):
    if not roles:
        return True
    t = title.lower()
    tw = set(_words(title))
    for role in roles:
        r = role.lower().strip()
        if r and r in t:
            return True
        key = [w for w in _words(r) if w not in GENERIC]
        if key and all(w in tw or w in t for w in key):
            return True
        if not key and all(w in tw for w in _words(r)):
            return True
    return False


def location_ok(location, settings):
    locs = [l.lower() for l in (settings.get("locations") or [])]
    loc = (location or "").lower()
    if not locs or not loc:
        return True
    if settings.get("remote_ok") and ("remote" in loc or "anywhere" in loc):
        return True
    return any(l in loc for l in locs)


def excluded(title, settings):
    t = title.lower()
    return any(k.lower() in t for k in (settings.get("exclude_keywords") or []) if k.strip())


def fresh_enough(posted_at, settings):
    if not posted_at:
        return True
    try:
        dt = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    return dt >= datetime.now(timezone.utc) - timedelta(days=int(settings.get("max_job_age_days") or 7))


def passes_rules(job, settings):
    if not title_matches(job.get("title", ""), settings.get("target_roles") or []):
        return False, "Title doesn't match your roles"
    if excluded(job.get("title", ""), settings):
        return False, "Title has a word you excluded"
    if not location_ok(job.get("location", ""), settings):
        return False, "Location not in your list"
    if not fresh_enough(job.get("posted_at"), settings):
        return False, "Older than your age limit"
    return True, ""
