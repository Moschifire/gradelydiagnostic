alter table public.assessment_sessions
  add column generated_report text,
  add column report_generated_at timestamptz;
