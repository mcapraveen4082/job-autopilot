"""Fill and submit no-login application forms (Greenhouse, Lever, Ashby) with a real browser."""
import random
import re
import time

from playwright.sync_api import TimeoutError as PWTimeout

EXTRACT_JS = r"""
() => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const vis = el => { const st = getComputedStyle(el); const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && (r.width > 0 || r.height > 0); };
  const forms = [...document.querySelectorAll('form')];
  const root = forms.sort((a, b) => b.querySelectorAll('input,select,textarea').length - a.querySelectorAll('input,select,textarea').length)[0] || document.body;
  const labelNear = (el, skip) => {
    let p = el.parentElement;
    for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
      const cands = p.querySelectorAll('label, legend, [class*="label"], [class*="question"], [class*="title"]');
      for (const l of cands) { if (skip && skip.some(s => l.contains(s))) continue; if (l.contains(el)) continue;
        const t = clean(l.innerText); if (t) return t; }
    }
    return '';
  };
  const labelOf = el => {
    let t = '';
    if (el.labels && el.labels.length) t = clean(el.labels[0].innerText);
    if (!t && el.getAttribute('aria-labelledby')) t = clean(el.getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id)?.innerText || '').join(' '));
    if (!t) t = clean(el.getAttribute('aria-label'));
    if (!t) t = labelNear(el);
    if (!t) t = clean(el.placeholder || el.name || el.id);
    return t;
  };
  const fields = []; const seen = new Set(); let idx = 0;
  for (const el of root.querySelectorAll('input, select, textarea')) {
    const type = (el.type || el.tagName).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'search'].includes(type)) continue;
    if (el.disabled || el.readOnly && type !== 'file') continue;
    if (el.closest('[aria-hidden="true"]') && type !== 'file') continue;
    const groupSize = el.name ? root.querySelectorAll(`input[type="${type}"][name="${CSS.escape(el.name)}"]`).length : 1;
    if (type === 'radio' || (type === 'checkbox' && groupSize > 1)) {
      const key = type + ':' + el.name; if (seen.has(key)) continue; seen.add(key);
      const group = [...root.querySelectorAll(`input[type="${type}"][name="${CSS.escape(el.name)}"]`)];
      let label = clean(el.closest('fieldset')?.querySelector('legend')?.innerText);
      if (!label) label = labelNear(group[0], group.map(g => g.closest('label') || g));
      const opts = group.map(g => { g.setAttribute('data-ja', String(idx)); return clean(g.labels?.[0]?.innerText || g.closest('label')?.innerText || g.value); });
      fields.push({ idx, label, type, required: group.some(g => g.required) || /\*/.test(label), options: opts });
      idx++; continue;
    }
    if (type !== 'file' && type !== 'checkbox' && !vis(el)) continue;
    el.setAttribute('data-ja', String(idx));
    const role = el.getAttribute('role');
    const ftype = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : role === 'combobox' ? 'combobox' : type;
    const label = labelOf(el);
    const opts = el.tagName === 'SELECT' ? [...el.options].filter(o => o.value !== '').map(o => clean(o.text)).filter(t => t && !/^(select|choose|please select|--)/i.test(t)) : [];
    fields.push({ idx, label, type: ftype, required: el.required || el.getAttribute('aria-required') === 'true' || /\*/.test(label), options: opts, name: el.name || el.id || '' });
    idx++;
  }
  const yn = [...root.querySelectorAll('button')].filter(b => /^(yes|no)$/i.test(clean(b.innerText)) && vis(b));
  for (const p of new Set(yn.map(b => b.parentElement))) {
    const kids = [...p.querySelectorAll('button')].filter(b => /^(yes|no)$/i.test(clean(b.innerText)));
    if (kids.length < 2) continue;
    const label = labelNear(p, kids);
    kids.forEach(k => k.setAttribute('data-ja', String(idx)));
    fields.push({ idx, label, type: 'yesno', required: /\*/.test(label), options: kids.map(k => clean(k.innerText)) });
    idx++;
  }
  return fields;
}
"""

SUCCESS = re.compile(r"thank you for (applying|your application|your interest)|application (has been )?(submitted|received)|"
                     r"we('ve| have) received your application|successfully (submitted|applied)|your application was sent", re.I)


def pause(a=0.15, b=0.5):
    time.sleep(random.uniform(a, b))


def open_form(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PWTimeout:
        pass
    # Some pages show an "Apply" button before the form
    if page.locator("input[type=file]").count() == 0:
        btn = page.get_by_role("button", name=re.compile(r"^apply", re.I))
        if btn.count() == 0:
            btn = page.get_by_role("link", name=re.compile(r"^apply( for this job| now)?$", re.I))
        if btn.count():
            try:
                btn.first.click(timeout=5000)
                page.wait_for_timeout(2500)
            except PWTimeout:
                pass


def extract_fields(page):
    fields = page.evaluate(EXTRACT_JS)
    for f in fields:  # read options of custom dropdowns
        if f["type"] == "combobox" and not f["options"]:
            try:
                el = page.locator(f'[data-ja="{f["idx"]}"]').first
                el.click(timeout=3000)
                page.wait_for_timeout(500)
                opts = page.locator("[role=option]").all_inner_texts()[:60]
                f["options"] = [o.strip() for o in opts if o.strip()]
                page.keyboard.press("Escape")
            except Exception:
                pass
    return fields


def fill(page, questions, resume_path, cover_path):
    for q in questions:
        ans = q.get("answer")
        sel = f'[data-ja="{q["idx"]}"]'
        loc = page.locator(sel)
        if loc.count() == 0 or ans in (None, ""):
            continue
        try:
            t = q["type"]
            if t == "file":
                path = cover_path if "cover" in str(ans) else resume_path
                if path:
                    loc.first.set_input_files(path)
            elif t == "select":
                try:
                    loc.first.select_option(label=ans, timeout=5000)
                except Exception:
                    loc.first.select_option(value=ans, timeout=5000)
            elif t in ("radio", "checkbox") and q.get("options"):
                wanted = [a.strip().lower() for a in str(ans).split(",")] if t == "checkbox" else [str(ans).strip().lower()]
                for i in range(loc.count()):
                    el = loc.nth(i)
                    text = (el.evaluate("e => (e.labels && e.labels[0] ? e.labels[0].innerText : (e.closest('label')?.innerText || e.value))") or "").strip().lower()
                    if text in wanted:
                        el.check(force=True)
            elif t == "checkbox":
                if str(ans).lower().startswith("y"):
                    loc.first.check(force=True)
            elif t == "yesno":
                for i in range(loc.count()):
                    if loc.nth(i).inner_text().strip().lower() == str(ans).strip().lower():
                        loc.nth(i).click()
            elif t == "combobox":
                loc.first.click()
                loc.first.fill(str(ans))
                page.wait_for_timeout(900)
                opt = page.locator("[role=option]", has_text=str(ans))
                if opt.count():
                    opt.first.click()
                else:
                    page.keyboard.press("Enter")
            else:
                loc.first.fill(str(ans))
            pause()
        except Exception as e:  # keep going; the form check after submit catches real problems
            print(f"    could not fill '{q['label'][:40]}': {str(e)[:80]}")


def captcha_visible(page):
    for f in page.locator("iframe").all():
        src = (f.get_attribute("src") or "") + (f.get_attribute("title") or "")
        if re.search(r"recaptcha/api2/bframe|hcaptcha.*challenge|challenge", src, re.I):
            try:
                box = f.bounding_box()
                if box and box["width"] > 100 and box["height"] > 100:
                    return True
            except Exception:
                pass
    return False


def submit(page):
    btn = page.locator("button[type=submit], input[type=submit]")
    if btn.count() == 0:
        btn = page.get_by_role("button", name=re.compile(r"submit|send application|apply", re.I))
    if btn.count() == 0:
        return "failed", "Couldn't find the submit button"
    url_before = page.url
    btn.last.click()
    for _ in range(12):
        page.wait_for_timeout(1000)
        body = page.inner_text("body")[:20000]
        if SUCCESS.search(body) or re.search(r"confirmation|thank", page.url, re.I) and page.url != url_before:
            return "applied", "Submitted and confirmed by the site"
        if captcha_visible(page):
            return "manual", "The site showed a captcha. Open the job and submit it yourself (your answers are saved below)."
    invalid = page.locator("[aria-invalid=true]").count()
    errors = page.locator("[class*=error]:visible").all_inner_texts()[:3]
    if invalid or errors:
        return "needs_approval", f"The form didn't accept some answers: {'; '.join(e.strip() for e in errors if e.strip())[:200] or 'check required fields'}"
    return "applied", "Submitted (no confirmation message seen, so worth checking your email)"
