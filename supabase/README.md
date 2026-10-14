# Database migration

The `create_diagnostic_app_v2` migration has been applied to the connected Supabase project.

The app uses `profiles`, `students`, `assessments`, `assessment_events`, and `learning_plans`. Every v2 table has RLS enabled. Tutor rows are limited to their authenticated owner; administrators are assigned by changing a profile's `role` to `admin` in the Supabase SQL editor after that person has signed up.

The existing `assessment_results` table was deliberately left unchanged so the Streamlit application can continue to run. It has RLS disabled and must not be used by this app.
