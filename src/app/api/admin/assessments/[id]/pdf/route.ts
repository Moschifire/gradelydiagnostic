import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createReportPdf } from "@/lib/report-pdf";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!token || !url || !key) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    const auth = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: { user } } = await auth.auth.getUser(token);
    if (user?.email?.toLowerCase() !== (process.env.ADMIN_EMAIL || "support@gradely.co").toLowerCase()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const { id } = await context.params;
    const { data, error } = await createAdminClient().from("assessment_sessions").select("student_name,tutor_name,subject,curriculum,starting_grade,current_grade,tutor_observations,legacy_results,legacy_ai_plan,generated_report,generated_report_data,assessment_session_events(grade,topic,level,outcome)").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    const pdf = createReportPdf({ ...data, legacy_ai_plan: data.legacy_ai_plan || data.generated_report });
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Diagnostic-${data.student_name.replace(/[^a-z0-9]+/gi, "-")}.pdf"` } });
  } catch (error) { console.error("report PDF failed", error); return NextResponse.json({ error: "Unable to create the PDF report." }, { status: 500 }); }
}
