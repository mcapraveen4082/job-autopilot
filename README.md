# Job Autopilot

Your private robot that finds new jobs on no-login career sites and applies for you, within a daily limit,
asking for your approval when it's unsure.

There are two parts:

| Folder | What it is | Where it lives | Cost |
|---|---|---|---|
| `web/` | Control panel website (only you can sign in) | Lovable (later Vercel/Netlify if you want) | ₹0 |
| `robot/` | Background robot that applies | GitHub Actions, 3 times a day | ₹0 |

The database and login use **Supabase** (free). The AI uses **Google Gemini's free tier**. Email uses your **Gmail**.
Expected cost: ₹0 at the start. Even with paid Gemini usage it stays far below ₹500/month.

---

## Step 1. Create your free Supabase project (10 min)

Use your own Supabase project rather than Lovable Cloud, because the robot needs Supabase's secret key.

1. Go to https://supabase.com, sign up, click **New project**. Pick region **Mumbai (ap-south-1)**.
2. Open **SQL Editor → New query**, paste the whole file `web/supabase/migrations/0001_job_autopilot.sql`, click **Run**.
   (If it errors on the "Single-owner lock" part, delete that last block and run again.)
3. Open **Project Settings → API** and note three values:
   - Project URL
   - `anon` public key (safe for the website)
   - `service_role` key (**secret**, only for the robot)

## Step 2. Put the website in Lovable (10 min)

1. In Lovable, create a new project with a short prompt like "blank project".
2. Click **GitHub → Connect** so Lovable creates a GitHub repo for it.
3. On github.com, open that repo and replace its files with everything inside the `web/` folder
   (Add file → Upload files, drag the contents in, commit). Lovable syncs the code automatically.
4. In Lovable, click **Supabase → Connect** and choose the project from Step 1.
   If Lovable rewrites `src/integrations/supabase/client.ts`, that's expected and fine.
   If the page shows an error about the Supabase URL, tell Lovable:
   *"Make src/integrations/supabase/client.ts use my connected Supabase project."*
5. Click **Publish**. You get a link like `https://your-app.lovable.app`.

## Step 3. Make it yours only (2 min)

1. Open your app link, click **Create the owner account**, sign up with your email.
   (If Supabase sends a confirmation email, click it, then sign in.)
2. In Supabase: **Authentication → Sign In / Providers → turn OFF "Allow new users to sign up"**.

Now nobody else can create an account, and every table is locked to your account.

## Step 4. Fill the app (15 min)

- **My profile**: upload your resume PDF, paste your resume text, fill name, phone, CTC, notice period.
- **Rules & limits**: job titles, skills, locations, daily limit (start with 10), keep **Review mode** on.
- **Companies**: add 20 to 50 companies. To find them, Google these searches:
  - `site:jobs.lever.co bangalore react`
  - `site:boards.greenhouse.io india frontend` (also `site:job-boards.greenhouse.io`)
  - `site:jobs.ashbyhq.com bengaluru`
  Paste any job link from a company; the app detects the company automatically.
- **Saved answers**: add answers to common questions (notice period, sponsorship, "how did you hear about us").

## Step 5. Get the free keys for the robot (10 min)

1. **Gemini AI key**: go to https://aistudio.google.com → **Get API key** → Create. Free tier is enough.
2. **Gmail app password** (for email applications and the daily summary):
   Google Account → Security → turn on 2-Step Verification → search "App passwords" → create one named "Job robot".
   Copy the 16-letter password.

## Step 6. Start the robot on GitHub (10 min)

1. On github.com, create a **new private repository**, e.g. `job-robot`.
2. Upload everything inside the `robot/` folder (including the `.github` folder).
   Tip: hidden folders don't show in some file pickers, so you can instead create the file
   `.github/workflows/robot.yml` with **Add file → Create new file** and paste its content.
3. In the repo: **Settings → Secrets and variables → Actions**.
   - **Secrets** tab, add: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`
   - **Variables** tab, add: `APP_URL` = your Lovable link (optional: `GEMINI_MODEL` to change the AI model)
4. Open the **Actions** tab → **Job robot** → **Run workflow** to test it now.
   After that it runs by itself at 9 AM, 1 PM and 6 PM India time, even when your laptop is off.

## Step 7. Daily use

- Check your **daily summary email** (sent after the 6 PM run).
- Open **Needs you** in the app to check answers and approve. Approved jobs are sent on the next run.
- After a few days, when the answers look right, switch **Rules & limits → Auto mode**.
- Use **Pause robot** on the Today page any time.
- LinkedIn or Naukri jobs: if "Apply" opens a company page, paste that link in **Add a job**.
  If it needs a LinkedIn/Naukri login, it goes to your "Apply yourself" list.

---

## How it decides

1. Fetches jobs from your companies through their free public job lists (no login, no scraping).
2. Drops jobs that don't match your titles, locations, excluded words or age limit (no AI used).
3. Newest first, asks Gemini for a match score. Below your minimum → skipped.
4. Opens the form, fills it from your profile, then saved answers, then AI (AI never invents experience).
5. Sends to **Needs you** when: review mode is on, a required question has no confident answer,
   the job needs skills you don't have (if you turned that on), or the form rejected an answer.
6. Otherwise submits, waits between applications like a person, stops at your per-run and daily limits.

## Good to know

- Some career forms show a captcha to robots. Those land in your list with your answers saved, so finishing takes a minute.
- Forms change over time. If a company keeps failing, check the reason in **All jobs** and pause that company.
- Workday, Taleo and LinkedIn/Naukri apply need accounts, so the robot doesn't apply there.
- Consent checkboxes ("I agree to the privacy policy") are ticked automatically, since you're applying.
- GitHub private repos get 2,000 free Action minutes a month. Each run takes about 5 to 10 minutes, so 3 runs a day fits.

## Moving the website off Lovable later

`web/` is a normal Vite + React app. On Vercel or Netlify: import the repo, set the build command `npm run build`,
output folder `dist`, and add these environment variables:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_OWNER_EMAIL` (your email, an extra lock).
`vercel.json` and `public/_redirects` are already included so page links work.

## Run the robot on your own computer (optional)

```bash
cd robot
pip install -r requirements.txt
python -m playwright install chromium
# create a .env from .env.example, then load it, e.g. on Mac/Linux:
export $(grep -v '^#' .env | xargs)
python -m robot.main
```
