-- Job Autopilot: database schema
-- Run this once in Supabase (SQL editor) or let Lovable apply it as a migration.
-- Every table is locked to its owner with Row Level Security.
-- The background robot uses the service role key, which bypasses RLS.

-- ───────────── Profile (who you are, used to fill forms) ─────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  first_name text default '',
  last_name text default '',
  email text default '',
  phone text default '',
  location text default '',
  current_title text default '',
  current_company text default '',
  years_experience numeric default 0,
  notice_period text default '',
  current_ctc text default '',
  expected_ctc text default '',
  linkedin_url text default '',
  github_url text default '',
  portfolio_url text default '',
  work_authorization text default 'Authorized to work in India',
  willing_to_relocate boolean default true,
  resume_path text,
  resume_text text default '',
  summary text default '',
  updated_at timestamptz default now()
);

-- ───────────── Settings (what to apply for, and how much) ─────────────
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_roles text[] default '{}',
  skills text[] default '{}',
  locations text[] default '{}',
  remote_ok boolean default true,
  exclude_keywords text[] default '{senior director,vp,intern}',
  min_match_score int default 65,
  daily_limit int default 15,
  max_per_run int default 5,
  max_job_age_days int default 7,
  mode text default 'review' check (mode in ('auto','review')),
  approve_if_missing_skills boolean default true,
  paused boolean default false,
  notify_email text default '',
  updated_at timestamptz default now()
);

-- ───────────── Companies to watch (no-login career pages) ─────────────
create table if not exists public.target_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ats text not null check (ats in ('greenhouse','lever','ashby')),
  slug text not null,
  active boolean default true,
  last_checked_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, ats, slug)
);

-- ───────────── Jobs (found, queued, applied) ─────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('greenhouse','lever','ashby','email','manual')),
  external_id text not null,
  company text default '',
  title text default '',
  location text default '',
  url text default '',
  apply_url text default '',
  apply_email text default '',
  description text default '',
  posted_at timestamptz,
  match_score int,
  match_reason text default '',
  missing_skills text[] default '{}',
  status text not null default 'new' check (status in
    ('new','skipped','queued','needs_approval','approved','applying','applied','failed','manual')),
  status_reason text default '',
  questions jsonb default '[]'::jsonb,
  cover_letter text default '',
  applied_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, source, external_id)
);
create index if not exists jobs_user_status_idx on public.jobs (user_id, status);
create index if not exists jobs_user_posted_idx on public.jobs (user_id, posted_at desc);

-- ───────────── Saved answers (reused for similar questions) ─────────────
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  normalized text not null,
  answer text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, normalized)
);

-- ───────────── Robot run log ─────────────
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz default now(),
  finished_at timestamptz,
  found int default 0,
  matched int default 0,
  applied int default 0,
  needs_approval int default 0,
  failed int default 0,
  ai_calls int default 0,
  log text default ''
);

-- ───────────── Row Level Security: only the owner sees their rows ─────────────
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.target_companies enable row level security;
alter table public.jobs enable row level security;
alter table public.answers enable row level security;
alter table public.runs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','settings','target_companies','jobs','answers','runs'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ───────────── Private resume storage ─────────────
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resume owner read" on storage.objects;
drop policy if exists "resume owner write" on storage.objects;
drop policy if exists "resume owner update" on storage.objects;
drop policy if exists "resume owner delete" on storage.objects;
create policy "resume owner read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume owner update" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────── Single-owner lock ─────────────
-- After the first account is created, nobody else can sign up.
-- (Also turn off "Allow new users to sign up" in Supabase Auth settings.)
-- If your platform refuses triggers on auth.users, delete this block;
-- disabling sign-ups alone is enough.
create or replace function public.only_one_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from auth.users) >= 1 then
    raise exception 'This app has an owner already. Sign-ups are closed.';
  end if;
  return new;
end $$;

drop trigger if exists only_one_owner_trg on auth.users;
create trigger only_one_owner_trg before insert on auth.users
  for each row execute function public.only_one_owner();
