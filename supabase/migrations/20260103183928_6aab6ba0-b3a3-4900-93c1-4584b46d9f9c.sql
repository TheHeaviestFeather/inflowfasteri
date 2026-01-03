-- ============================================================
-- ID Flow (V1) — Supabase DDL + RLS Policies
-- ============================================================

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Utility: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2) PROFILES (public.profiles)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  timezone text default 'America/New_York',
  avatar_url text,
  tier text not null default 'free' check (tier in ('free', 'starter', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Profiles RLS
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- ============================================================
-- 3) SYSTEM PROMPTS (versioned; server-managed)
-- ============================================================
create table if not exists public.system_prompts (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  content text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.system_prompts enable row level security;

-- ============================================================
-- 4) PROJECTS (public.projects)
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  client_name text,
  mode text not null default 'standard' check (mode in ('standard', 'quick')),
  status text not null default 'active' check (status in ('active', 'archived', 'completed')),
  current_stage text,
  prompt_version text default 'id_flow_prompt_v3_2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_status_idx on public.projects(status);

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

-- Projects RLS
create policy "projects_select_own"
on public.projects
for select
using (auth.uid() = user_id);

create policy "projects_insert_own"
on public.projects
for insert
with check (auth.uid() = user_id);

create policy "projects_update_own"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "projects_delete_own"
on public.projects
for delete
using (auth.uid() = user_id);

-- ============================================================
-- 5) PROJECT STATE (public.project_state)
-- ============================================================
create table if not exists public.project_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  updated_by_message_id uuid,
  prompt_version text,
  updated_at timestamptz not null default now()
);

create index if not exists project_state_project_id_idx on public.project_state(project_id);

create trigger set_project_state_updated_at
before update on public.project_state
for each row execute function public.set_updated_at();

alter table public.project_state enable row level security;

-- Project State RLS
create policy "project_state_select_own"
on public.project_state
for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "project_state_insert_own"
on public.project_state
for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "project_state_update_own"
on public.project_state
for update
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "project_state_delete_own"
on public.project_state
for delete
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

-- ============================================================
-- 6) ARTIFACTS (public.artifacts)
-- ============================================================
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  artifact_type text not null check (artifact_type in (
    'phase_1_contract',
    'discovery_report',
    'learner_persona',
    'design_strategy',
    'design_blueprint',
    'scenario_bank',
    'assessment_kit',
    'final_audit',
    'performance_recommendation_report'
  )),
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved', 'stale')),
  version integer not null default 1,
  prompt_version text,
  updated_by_message_id uuid,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  stale_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artifacts_project_type_unique unique (project_id, artifact_type)
);

create index if not exists artifacts_project_id_idx on public.artifacts(project_id);
create index if not exists artifacts_type_idx on public.artifacts(artifact_type);

create trigger set_artifacts_updated_at
before update on public.artifacts
for each row execute function public.set_updated_at();

alter table public.artifacts enable row level security;

-- Artifacts RLS
create policy "artifacts_select_own"
on public.artifacts
for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "artifacts_insert_own"
on public.artifacts
for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "artifacts_update_own"
on public.artifacts
for update
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "artifacts_delete_own"
on public.artifacts
for delete
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

-- ============================================================
-- 7) ARTIFACT VERSIONS (public.artifact_versions)
-- ============================================================
create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  artifact_type text not null,
  content text not null,
  version integer not null,
  created_at timestamptz not null default now()
);

create index if not exists artifact_versions_artifact_id_idx on public.artifact_versions(artifact_id);
create index if not exists artifact_versions_project_id_idx on public.artifact_versions(project_id);

alter table public.artifact_versions enable row level security;

-- Artifact Versions RLS
create policy "artifact_versions_select_own"
on public.artifact_versions
for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "artifact_versions_insert_own"
on public.artifact_versions
for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

-- ============================================================
-- 8) MESSAGES (public.messages)
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  prompt_version text,
  sequence bigint generated always as identity,
  created_at timestamptz not null default now()
);

create index if not exists messages_project_id_idx on public.messages(project_id);
create index if not exists messages_project_created_at_idx on public.messages(project_id, created_at);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

alter table public.messages enable row level security;

-- Messages RLS
create policy "messages_select_own"
on public.messages
for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "messages_insert_own"
on public.messages
for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "messages_delete_own"
on public.messages
for delete
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

-- ============================================================
-- 9) TOKEN USAGE (public.token_usage)
-- ============================================================
create table if not exists public.token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists token_usage_user_id_idx on public.token_usage(user_id);
create index if not exists token_usage_project_id_idx on public.token_usage(project_id);

alter table public.token_usage enable row level security;

create policy "token_usage_select_own"
on public.token_usage
for select
using (auth.uid() = user_id);

create policy "token_usage_insert_own"
on public.token_usage
for insert
with check (auth.uid() = user_id);

-- ============================================================
-- 10) Auto-create profile on user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();