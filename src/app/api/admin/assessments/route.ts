import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

function accessToken(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function GET(request: Request) {
  try {
    const token = accessToken(request);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!token || !url || !key) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

    const auth = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await auth.auth.getUser(token);
    const allowedEmail = (process.env.ADMIN_EMAIL || "support@gradely.co").toLowerCase();
    if (error || user?.email?.toLowerCase() !== allowedEmail) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

    const { data, error: queryError } = await createAdminClient()
      .from("assessment_sessions")
      .select("id,legacy_source_id,legacy_results,legacy_ai_plan,generated_report,generated_report_data,report_generated_at,tutor_name,tutor_email,student_name,subject,curriculum,starting_grade,current_grade,status,tutor_observations,created_at,updated_at,completed_at,assessment_session_events(grade,topic,level,outcome,created_at)")
      .order("updated_at", { ascending: false });
    if (queryError) return NextResponse.json({ error: "Unable to load assessments." }, { status: 500 });
    return NextResponse.json({ assessments: data });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Missing server-side Supabase")
      ? "Server configuration is incomplete: add SUPABASE_SECRET_KEY to .env.local and restart the server."
      : "Unable to load assessments right now.";
    console.error("admin assessment list failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
