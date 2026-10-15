"""Cheap AI helpers using Google Gemini's free tier.
If GEMINI_API_KEY is missing, falls back to simple keyword logic (no AI cost at all)."""
import json
import os
import re
import time

import requests

MODEL = os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash-lite"
KEY = os.environ.get("GEMINI_API_KEY", "")
calls = 0


def _gemini(prompt: str, max_tokens: int = 1200):
    global calls
    if not KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_tokens,
                             "responseMimeType": "application/json"},
    }
    for attempt in range(4):
        r = requests.post(url, params={"key": KEY}, json=body, timeout=60)
        calls += 1
        if r.status_code in (429, 500, 503):
            time.sleep(15 * (attempt + 1))  # free tier rate limit: wait and retry
            continue
        r.raise_for_status()
        try:
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            text = re.sub(r"^```(json)?|```$", "", text.strip()).strip()
            return json.loads(text)
        except (KeyError, IndexError, json.JSONDecodeError):
            return None
    return None


def _profile_block(profile, settings):
    return f"""CANDIDATE
Name: {profile.get('full_name')}
Current: {profile.get('current_title')} at {profile.get('current_company')}
Total experience: {profile.get('years_experience')} years
Location: {profile.get('location')} | Willing to relocate: {profile.get('willing_to_relocate')}
Notice period: {profile.get('notice_period')} | Current CTC: {profile.get('current_ctc')} | Expected CTC: {profile.get('expected_ctc')}
Work authorization: {profile.get('work_authorization')}
Skills: {', '.join(settings.get('skills') or [])}
Summary: {profile.get('summary')}
RESUME:
{(profile.get('resume_text') or '')[:6000]}"""


def score_job(job, profile, settings):
    """Returns dict(score 0-100, reason, missing_skills[])."""
    desc = (job.get("description") or "")[:3500]
    prompt = f"""You screen jobs for one candidate. Be strict and honest.
{_profile_block(profile, settings)}

JOB
Title: {job.get('title')} | Company: {job.get('company')} | Location: {job.get('location')}
{desc}

Return JSON: {{"score": int 0-100 (how well the candidate fits, considering seniority, years and core skills),
"reason": "one short sentence", "missing_skills": ["must-have skills in the job the candidate clearly lacks, max 5"]}}"""
    out = _gemini(prompt, 400)
    if isinstance(out, dict) and "score" in out:
        return {"score": int(out.get("score") or 0), "reason": str(out.get("reason") or "")[:300],
                "missing_skills": [str(s) for s in (out.get("missing_skills") or [])][:5]}
    # Fallback: share of my skills that appear in the job text
    text = f"{job.get('title')} {desc}".lower()
    skills = settings.get("skills") or []
    hits = [s for s in skills if s.lower() in text]
    score = int(40 + 60 * len(hits) / max(len(skills), 1)) if skills else 60
    return {"score": score, "reason": f"Keyword match: {', '.join(hits) or 'none'} (AI not configured)", "missing_skills": []}


def answer_questions(questions, job, profile, settings, need_cover=False):
    """questions: list of dicts {label,type,options}. Returns list of {answer, confidence} aligned with input,
    plus a cover letter string if need_cover."""
    if not questions and not need_cover:
        return [], ""
    qtext = "\n".join(
        f"{i}. {q['label']} [type={q['type']}{'; options=' + ' | '.join(q['options']) if q.get('options') else ''}]"
        for i, q in enumerate(questions))
    prompt = f"""You fill a job application for the candidate below. RULES:
- Use ONLY facts from the candidate profile/resume. Never invent employers, degrees, numbers or skills.
- If the answer is not clearly supported, return null with confidence 0.
- For questions with options, answer with one option copied EXACTLY.
- "Years of experience with X": use the resume; if X is not in the resume, return null.
- Keep text answers short and professional (1-3 sentences) unless the question asks for more.
{_profile_block(profile, settings)}

JOB: {job.get('title')} at {job.get('company')} ({job.get('location')})
{(job.get('description') or '')[:2000]}

QUESTIONS:
{qtext or '(none)'}

Return JSON: {{"answers": [{{"i": index, "answer": string or null, "confidence": 0.0-1.0}}],
"cover_letter": {'"a short, specific cover letter (max 150 words, no placeholders, signed with the candidate name)"' if need_cover else '""'}}}"""
    out = _gemini(prompt, 1500)
    result = [{"answer": None, "confidence": 0.0} for _ in questions]
    cover = ""
    if isinstance(out, dict):
        for a in out.get("answers") or []:
            try:
                i = int(a.get("i"))
                if 0 <= i < len(result) and a.get("answer") not in (None, ""):
                    result[i] = {"answer": str(a["answer"]), "confidence": float(a.get("confidence") or 0)}
            except (TypeError, ValueError):
                continue
        cover = str(out.get("cover_letter") or "")
    if need_cover and not cover:
        cover = (f"Dear Hiring Team,\n\nI'm applying for the {job.get('title')} role at {job.get('company')}. "
                 f"{profile.get('summary') or ''}\n\nMy resume is attached. I'd welcome the chance to talk.\n\n"
                 f"Regards,\n{profile.get('full_name')}\n{profile.get('phone')}")
    return result, cover
