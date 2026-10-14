# Diagnostic Studio

Next.js rebuild of the tutor-led multi-subject diagnostic.

## What is included

- Adaptive mathematics: mastery check → foundational questions → mastery retry.
- English-ready linear question-set support.
- Automatic grade advancement after full mastery and a protective stop on the first higher-level gap.
- The complete existing question bank in `src/data/content.json`.
- A new secured Supabase v2 assessment schema, with RLS ownership policies.

## Run locally

```powershell
cd C:\Users\marko\Documents\Code\diagnostic\diagnostic-app
npm install
npm run dev
```

Open `http://localhost:3000`.

The repository contains a ready-to-use `.env.local` for the connected project's public browser credentials. It contains no privileged key. Add `GOOGLE_GENERATIVE_AI_API_KEY` only when implementing server-side AI plan generation; it must never be prefixed with `NEXT_PUBLIC_`.

## Admin access

Visit `/admin` and sign in as `support@gradely.co`. Create that user first in Supabase Authentication with a password. The dashboard verifies the user with Supabase Auth and repeats the email allow-list check inside its server API before returning any assessment data. Set `SUPABASE_SECRET_KEY` in `.env.local` before using the dashboard; it is used only by server routes.

## Database

The `create_diagnostic_app_v2` migration is already applied to the connected project. Its source-controlled copy is in `supabase/migrations/202610140001_create_diagnostic_app_v2.sql`.

New tutor data belongs in `profiles`, `students`, `assessments`, `assessment_events`, and `learning_plans`. The legacy `assessment_results` table belongs only to the Streamlit app and is intentionally not queried by this project.

After a user signs up, promote an administrator deliberately in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<their auth user UUID>';
```

Do not put service-role keys in `.env.local` or any `NEXT_PUBLIC_` variable.
