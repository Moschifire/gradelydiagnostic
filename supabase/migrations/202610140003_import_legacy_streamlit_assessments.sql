alter table public.assessment_sessions
  add column legacy_source_id uuid unique,
  add column legacy_results text,
  add column legacy_ai_plan text;

insert into public.assessment_sessions (
  legacy_source_id, tutor_name, tutor_email, student_name, subject, curriculum,
  starting_grade, current_grade, run_state, tutor_observations, status,
  resume_token_hash, resume_expires_at, created_at, updated_at, completed_at,
  legacy_results, legacy_ai_plan
)
select
  r.id,
  coalesce(nullif(trim(r.tutor), ''), 'Legacy tutor'),
  null,
  coalesce(nullif(trim(r.student), ''), 'Unnamed student'),
  case when r.subject in ('Mathematics', 'English Language') then r.subject else 'Mathematics' end,
  coalesce(nullif(trim(r.curriculum), ''), 'Legacy curriculum'),
  coalesce(nullif(trim(r.grade), ''), 'Legacy grade'),
  coalesce(nullif(trim(r.grade), ''), 'Legacy grade'),
  jsonb_build_object('source', 'streamlit_legacy', 'results', coalesce(r.results, ''), 'feedback', coalesce(r.feedback, ''), 'ai_plan', coalesce(r.ai_plan, '')),
  coalesce(r.feedback, ''),
  'complete',
  md5(r.id::text || r.created_at::text || 'legacy-not-resumable'),
  r.created_at,
  r.created_at,
  r.created_at,
  r.created_at,
  r.results,
  r.ai_plan
from public.assessment_results r
on conflict (legacy_source_id) do nothing;
