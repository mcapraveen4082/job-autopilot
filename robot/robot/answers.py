"""Decide what to type in each form field: profile first, then saved answers, then AI."""
import difflib
import re

from . import ai


def norm(q: str) -> str:
    q = re.sub(r"\(required\)|\*", "", q.lower())
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", q)).strip()


def yes_no(b):
    return "Yes" if b else "No"


def profile_value(label, profile):
    l = norm(label)
    p = profile
    if not l:
        return None
    rules = [
        (r"\bcompany\b.*\bname\b|current (company|employer)|^(org|organi[sz]ation)$|current organi[sz]ation", p.get("current_company")),
        (r"first name|given name|preferred (first )?name", p.get("first_name")),
        (r"last name|surname|family name", p.get("last_name")),
        (r"^(full )?name$|^your name$|full name|legal name", p.get("full_name")),
        (r"e ?mail", p.get("email")),
        (r"phone|mobile|contact number|whatsapp", p.get("phone")),
        (r"linkedin", p.get("linkedin_url")),
        (r"github", p.get("github_url")),
        (r"portfolio|website|personal site|other url", p.get("portfolio_url") or p.get("github_url")),
        (r"current (job )?(title|role|designation|position)|^job title$|^title$", p.get("current_title")),
        (r"notice period|earliest start|when can you (start|join)|availability to (start|join)", p.get("notice_period")),
        (r"current (ctc|salary|compensation|annual)", p.get("current_ctc")),
        (r"expected (ctc|salary|compensation)|desired (salary|compensation|ctc)|salary expectation", p.get("expected_ctc")),
        (r"^(total )?(years of )?(professional |work |relevant )?experience( in years)?$|total (years of )?experience|how many years of (professional |work )?experience do you have$",
         str(p.get("years_experience")) if p.get("years_experience") not in (None, "") else None),
        (r"relocat", yes_no(p.get("willing_to_relocate"))),
        (r"^(current )?(location|city)( city)?$|^location city$|current (location|city)|where are you (currently )?(based|located)|city of residence", p.get("location")),
    ]
    for pat, val in rules:
        if re.search(pat, l) and val not in (None, ""):
            return str(val)
    return None


def pick_option(answer, options):
    if not options or answer is None:
        return answer
    a = str(answer).strip().lower()
    for o in options:
        if o.strip().lower() == a:
            return o
    if a in ("yes", "y", "true"):
        for o in options:
            if o.lower().startswith("yes"):
                return o
    if a in ("no", "n", "false"):
        for o in options:
            if o.lower().startswith("no"):
                return o
    for o in options:
        if a and (a in o.lower() or o.lower() in a):
            return o
    close = difflib.get_close_matches(a, [o.lower() for o in options], n=1, cutoff=0.6)
    if close:
        return next(o for o in options if o.lower() == close[0])
    return None


def saved_value(label, saved):
    n = norm(label)
    if not n:
        return None
    if n in saved:
        return saved[n]
    close = difflib.get_close_matches(n, list(saved.keys()), n=1, cutoff=0.88)
    return saved[close[0]] if close else None


CONSENT = re.compile(r"agree|consent|acknowledge|privacy|terms|accurate|certify|true and correct", re.I)
COVER = re.compile(r"cover letter|why (do you want|are you interested)|tell us why|additional information", re.I)


def resolve(fields, job, profile, settings, saved, prior=None):
    """Returns (questions, cover_letter). Each question: label,type,required,options,answer,source,confidence,idx."""
    prior_map = {norm(q.get("label", "")): q.get("answer") for q in (prior or []) if q.get("answer")}
    out, pending = [], []
    need_cover = False
    for f in fields:
        q = {"idx": f["idx"], "label": f.get("label") or f.get("name") or "Field", "type": f["type"],
             "required": bool(f.get("required")), "options": f.get("options") or [], "answer": None,
             "source": None, "confidence": 0.0}
        label = q["label"]
        if f["type"] == "file":
            q["answer"] = "cover letter file" if re.search(r"cover", label, re.I) else "resume file"
            q["source"] = "profile"; q["confidence"] = 1.0
            if "cover" in q["answer"]:
                need_cover = True
            out.append(q); continue
        if f["type"] == "checkbox" and not q["options"] and CONSENT.search(label):
            q.update(answer="Yes", source="profile", confidence=1.0); out.append(q); continue

        val, src = None, None
        if norm(label) in prior_map:
            val, src = prior_map[norm(label)], "you"
        if val is None:
            val, src = profile_value(label, profile), "profile"
        if val is None:
            val, src = saved_value(label, saved), "saved"
        if val is not None and q["options"]:
            val = pick_option(val, q["options"])
        if val is not None:
            q.update(answer=val, source=src, confidence=1.0)
        elif COVER.search(label) and f["type"] in ("textarea", "text"):
            need_cover = True
            q["source"] = "cover"
        else:
            pending.append(q)
        out.append(q)

    ai_answers, cover = ai.answer_questions(pending, job, profile, settings, need_cover=need_cover)
    for q, a in zip(pending, ai_answers):
        val = pick_option(a["answer"], q["options"]) if q["options"] else a["answer"]
        if val:
            q.update(answer=val, source="ai", confidence=a["confidence"])
    for q in out:
        if q["source"] == "cover":
            q.update(answer=cover, source="ai", confidence=0.9)
    return out, cover


def blockers(questions, threshold=0.75):
    """Required questions we can't answer confidently."""
    return [q for q in questions if q["type"] != "file" and q["required"]
            and (not q["answer"] or (q["source"] == "ai" and q["confidence"] < threshold))]
