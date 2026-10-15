"""Job Autopilot robot. Runs on a schedule (GitHub Actions), finds new jobs on no-login career sites,
checks the match, fills the forms and applies, within your daily limit."""
import os
import random
import tempfile
import time
import traceback
from datetime import datetime, timedelta, timezone

import requests
from playwright.sync_api import sync_playwright

from . import ai, answers, apply, emailer, matcher, sources
from .db import DB

IST = timezone(timedelta(hours=5, minutes=30))
log_lines = []


def log(msg):
    line = f"{datetime.now(IST):%H:%M:%S} {msg}"
    print(line, flush=True)
    log_lines.append(line)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def start_of_today_ist():
    d = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    return d.astimezone(timezone.utc).isoformat()


def set_job(db, job_id, **patch):
    patch["updated_at"] = now_iso()
    db.update("jobs", {"id": f"eq.{job_id}"}, patch)


def public_questions(qs):
    return [{k: q.get(k) for k in ("label", "type", "required", "options", "answer", "source")} for q in qs]


class Robot:
    def __init__(self):
        self.db = DB()
        owner = os.environ.get("OWNER_USER_ID")
        params = {"select": "*"}
        if owner:
            params["user_id"] = f"eq.{owner}"
        self.profile = self.db.one("profiles", params)
        if not self.profile:
            raise SystemExit("No profile found. Sign in to the web app once to create it.")
        self.uid = self.profile["user_id"]
        self.settings = self.db.one("settings", {"user_id": f"eq.{self.uid}", "select": "*"})
        saved = self.db.select("answers", {"user_id": f"eq.{self.uid}", "select": "normalized,answer"})
        self.saved = {a["normalized"]: a["answer"] for a in saved}
        self.stats = dict(found=0, matched=0, applied=0, needs_approval=0, failed=0)
        self.run_id = self.db.insert("runs", [{"user_id": self.uid}])[0]["id"]
        self.resume_path, self.resume_name, self.resume_bytes = None, None, None
        self.tmp = tempfile.mkdtemp()

    # ───────── setup ─────────
    def load_resume(self):
        path = self.profile.get("resume_path")
        if not path:
            return
        self.resume_bytes = self.db.download("resumes", path)
        first = (self.profile.get("first_name") or "My").strip()
        last = (self.profile.get("last_name") or "").strip()
        ext = path.rsplit(".", 1)[-1]
        self.resume_name = f"{first}_{last}_Resume.{ext}".replace(" ", "_").replace("__", "_")
        self.resume_path = os.path.join(self.tmp, self.resume_name)
        with open(self.resume_path, "wb") as f:
            f.write(self.resume_bytes)

    def cover_file(self, text):
        p = os.path.join(self.tmp, "Cover_Letter.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(text or "")
        return p

    # ───────── 1. discover ─────────
    def discover(self):
        companies = self.db.select("target_companies", {"user_id": f"eq.{self.uid}", "active": "eq.true", "select": "*"})
        log(f"Checking {len(companies)} companies")
        for c in companies:
            try:
                jobs = sources.fetch_company(c["ats"], c["slug"], c["name"])
            except requests.RequestException as e:
                log(f"  {c['name']}: couldn't load jobs ({str(e)[:80]})")
                continue
            keep = []
            for j in jobs:
                ok, _ = matcher.passes_rules(j, self.settings)
                if ok:
                    keep.append({**j, "user_id": self.uid, "status": "new"})
            if keep:
                inserted = self.db.insert("jobs", keep, on_conflict="user_id,source,external_id", ignore_duplicates=True)
                self.stats["found"] += len(inserted)
                if inserted:
                    log(f"  {c['name']}: {len(inserted)} new matching jobs")
            self.db.update("target_companies", {"id": f"eq.{c['id']}"}, {"last_checked_at": now_iso()})
            time.sleep(1)

    # ───────── 2. apply ─────────
    def applied_today(self):
        return self.db.count("jobs", {"user_id": f"eq.{self.uid}", "status": "eq.applied", "applied_at": f"gte.{start_of_today_ist()}"})

    def process(self, page, job, approved=False, user_added=False):
        s, p = self.settings, self.profile
        review = s.get("mode") == "review" and not approved

        # Match check (skipped for jobs you approved or added yourself)
        if not approved and not user_added:
            m = ai.score_job(job, p, s)
            set_job(self.db, job["id"], match_score=m["score"], match_reason=m["reason"], missing_skills=m["missing_skills"])
            job.update(match_score=m["score"], missing_skills=m["missing_skills"])
            if m["score"] < int(s.get("min_match_score") or 0):
                set_job(self.db, job["id"], status="skipped", status_reason=f"Match {m['score']} is below your minimum")
                return "skipped"
            self.stats["matched"] += 1

        ask_reasons = []
        if review:
            ask_reasons.append("Review mode is on")
        if not approved and s.get("approve_if_missing_skills") and job.get("missing_skills"):
            ask_reasons.append(f"Needs skills not in your list: {', '.join(job['missing_skills'])}")

        if job["source"] == "email":
            return self.process_email(job, approved, ask_reasons)

        set_job(self.db, job["id"], status="applying")
        apply.open_form(page, job["apply_url"] or job["url"])
        fields = apply.extract_fields(page)
        if not fields:
            set_job(self.db, job["id"], status="manual", status_reason="Couldn't find an application form on the page")
            return "manual"

        qs, cover = answers.resolve(fields, job, p, s, self.saved, prior=job.get("questions") if approved else None)
        block = answers.blockers(qs)
        if block:
            ask_reasons.append("Needs your answer: " + "; ".join(q["label"][:60] for q in block[:4]))
        if not self.resume_path and any(q["type"] == "file" for q in qs):
            ask_reasons.append("Upload your resume on the profile page")

        if ask_reasons:
            set_job(self.db, job["id"], status="needs_approval", questions=public_questions(qs),
                    cover_letter=cover, status_reason=". ".join(ask_reasons))
            self.stats["needs_approval"] += 1
            return "needs_approval"

        apply.fill(page, qs, self.resume_path, self.cover_file(cover) if cover else None)
        status, reason = apply.submit(page)
        patch = dict(status=status, status_reason=reason, questions=public_questions(qs), cover_letter=cover)
        if status == "applied":
            patch["applied_at"] = now_iso()
            self.stats["applied"] += 1
        elif status == "needs_approval":
            self.stats["needs_approval"] += 1
        else:
            self.stats["failed"] += status == "failed"
        set_job(self.db, job["id"], **patch)
        return status

    def process_email(self, job, approved, ask_reasons):
        if not emailer.enabled():
            set_job(self.db, job["id"], status="manual", status_reason="Gmail isn't set up for the robot, so send this one yourself")
            return "manual"
        body = job.get("cover_letter") if approved and job.get("cover_letter") else None
        if not body:
            _, body = ai.answer_questions([], job, self.profile, self.settings, need_cover=True)
        if ask_reasons and not approved:
            set_job(self.db, job["id"], status="needs_approval", cover_letter=body, status_reason=". ".join(ask_reasons))
            self.stats["needs_approval"] += 1
            return "needs_approval"
        subject = f"Application for {job['title']} - {self.profile.get('full_name')}"
        emailer.send(job["apply_email"], subject, body, self.resume_bytes, self.resume_name)
        set_job(self.db, job["id"], status="applied", applied_at=now_iso(), cover_letter=body,
                status_reason=f"Emailed your resume to {job['apply_email']}")
        self.stats["applied"] += 1
        return "applied"

    def apply_loop(self):
        s = self.settings
        remaining = int(s.get("daily_limit") or 10) - self.applied_today()
        budget = min(int(s.get("max_per_run") or 5), remaining)
        if budget <= 0:
            log("Daily limit reached. Nothing more to send today.")
            return
        log(f"Can send up to {budget} applications this run")

        base = {"user_id": f"eq.{self.uid}", "select": "*", "order": "posted_at.desc.nullslast"}
        approved = self.db.select("jobs", {**base, "status": "eq.approved", "limit": 50})
        queued = self.db.select("jobs", {**base, "status": "eq.queued", "limit": 20})
        fresh = self.db.select("jobs", {**base, "status": "eq.new", "limit": 60})

        for j in queued:  # jobs you added by link need their details loaded
            if j["source"] in sources.FETCHERS and not j.get("description"):
                d = sources.hydrate(j)
                if d:
                    j.update({k: d[k] for k in ("title", "location", "url", "apply_url", "description", "posted_at") if d.get(k)})
                    set_job(self.db, j["id"], **{k: j[k] for k in ("title", "location", "url", "apply_url", "description")})

        work = [(j, True, False) for j in approved] + [(j, False, True) for j in queued] + [(j, False, False) for j in fresh]
        attempts = 0
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
            ctx = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                locale="en-IN", timezone_id="Asia/Kolkata", viewport={"width": 1366, "height": 900})
            for job, is_approved, user_added in work:
                if self.stats["applied"] >= budget or attempts >= budget * 3:
                    break
                if not is_approved and not user_added and not matcher.fresh_enough(job.get("posted_at"), s):
                    set_job(self.db, job["id"], status="skipped", status_reason="Older than your age limit")
                    continue
                attempts += 1
                page = ctx.new_page()
                try:
                    log(f"→ {job['title']} at {job['company']}")
                    result = self.process(page, job, approved=is_approved, user_added=user_added)
                    log(f"   {result}")
                    if result == "applied":
                        time.sleep(random.uniform(25, 70))  # behave like a person between applications
                except Exception as e:
                    self.stats["failed"] += 1
                    set_job(self.db, job["id"], status="failed", status_reason=f"Robot error: {str(e)[:200]}")
                    log(f"   error: {e}")
                    traceback.print_exc()
                finally:
                    page.close()
            browser.close()

    # ───────── 3. daily summary ─────────
    def maybe_summary(self):
        to = self.settings.get("notify_email")
        if not (emailer.enabled() and to) or datetime.now(IST).hour < 17:
            return
        already = self.db.count("runs", {"user_id": f"eq.{self.uid}", "started_at": f"gte.{start_of_today_ist()}",
                                         "log": "like.*summary-sent*"})
        if already:
            return
        today = self.db.select("jobs", {"user_id": f"eq.{self.uid}", "status": "eq.applied",
                                        "applied_at": f"gte.{start_of_today_ist()}", "select": "title,company"})
        pending = self.db.count("jobs", {"user_id": f"eq.{self.uid}", "status": "eq.needs_approval"})
        manual = self.db.count("jobs", {"user_id": f"eq.{self.uid}", "status": "eq.manual"})
        lines = "\n".join(f"  • {j['title']} at {j['company']}" for j in today) or "  (none today)"
        app_url = os.environ.get("APP_URL", "")
        body = (f"Applied today: {len(today)}\n{lines}\n\nWaiting for your answer: {pending}\n"
                f"To apply yourself: {manual}\n\n{('Open your dashboard: ' + app_url) if app_url else ''}\n")
        emailer.send(to, f"Job Autopilot: {len(today)} applied today, {pending} need you", body)
        log("Daily summary sent [summary-sent]")

    def run(self):
        try:
            if self.settings.get("paused"):
                log("Robot is paused in the web app. Exiting.")
                return
            self.load_resume()
            self.discover()
            self.apply_loop()
        except Exception as e:
            log(f"Run failed: {e}")
            traceback.print_exc()
        finally:
            try:
                self.maybe_summary()
            except Exception as e:
                log(f"Summary email failed: {e}")
            self.db.update("runs", {"id": f"eq.{self.run_id}"},
                           {**self.stats, "ai_calls": ai.calls, "finished_at": now_iso(), "log": "\n".join(log_lines)[-20000:]})
            log(f"Done: {self.stats}, AI calls {ai.calls}")


if __name__ == "__main__":
    Robot().run()
