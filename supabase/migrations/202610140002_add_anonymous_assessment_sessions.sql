create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  tutor_name text not null check (char_length(tutor_name) between 1 and 160),
  tutor_email text check (tutor_email is null or tutor_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  student_name text not null check (char_length(student_name) between 1 and 160),
  subject text not null check (subject in ('Mathematics', 'English Language')),
  curriculum text not null,
  starting_grade text not null,
  current_grade text not null,
  run_state jsonb not null,
  tutor_observations text not null default '',
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  resume_token_hash text not null unique,
  resume_expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.assessment_session_events (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  grade text not null,
  topic text not null,
  level text not null,
  outcome text not null check (outcome in ('Correct', 'Incorrect', 'Not familiar')),
  created_at timestamptz not null default now()
);

create index assessment_sessions_status_updated_idx on public.assessment_sessions(status, updated_at desc);
create index assessment_session_events_session_id_idx on public.assessment_session_events(assessment_session_id);
alter table public.assessment_sessions enable row level security;
alter table public.assessment_session_events enable row level security;
revoke all on public.assessment_sessions from anon, authenticated;
revoke all on public.assessment_session_events from anon, authenticated;
