import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

type ReportData = { overview: string; themes: { theme: string; status: string; findings: string; recommendation: string }[]; plan: { week: number; focusArea: string; skills: string; activities: string }[] };
const normaliseReport = (value: unknown, fallback: string): ReportData => {
  if (!value || typeof value !== "object") return { overview: fallback, themes: [], plan: [] };
  const report = value as Partial<ReportData>;
  return { overview: typeof report.overview === "string" ? report.overview : fallback, themes: Array.isArray(report.themes) ? report.themes.filter(item => item && typeof item.theme === "string").slice(0, 12).map(item => ({ theme: item.theme, status: item.status || "Developing", findings: item.findings || "", recommendation: item.recommendation || "" })) : [], plan: Array.isArray(report.plan) ? report.plan.filter(item => item && typeof item.week === "number").slice(0, 12).map(item => ({ week: item.week, focusArea: item.focusArea || "", skills: item.skills || "", activities: item.activities || "" })) : [] };
};

async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return false;
  const auth = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: { user } } = await auth.auth.getUser(token);
  return user?.email?.toLowerCase() === (process.env.ADMIN_EMAIL || "support@gradely.co").toLowerCase();
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdmin(request)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY is missing from .env.local." }, { status: 500 });
    const { id } = await context.params;
    const { data: assessment, error } = await createAdminClient().from("assessment_sessions").select("student_name,subject,curriculum,starting_grade,current_grade,tutor_observations,legacy_results,assessment_session_events(grade,topic,level,outcome)").eq("id", id).single();
    if (error || !assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    const events = assessment.assessment_session_events.length ? assessment.assessment_session_events.map(event => `${event.outcome}: ${event.grade} | ${event.topic} | ${event.level}`).join("\n") : assessment.legacy_results || "No assessment events were recorded.";
    const prompt = `You are an expert educational diagnostician. Based only on the assessment data below, produce valid JSON with exactly this shape: {"overview":"string","themes":[{"theme":"string","status":"Strength|Developing|Priority gap","findings":"string","recommendation":"string"}],"plan":[{"week":1,"focusArea":"string","skills":"string","activities":"string"}]}. Provide exactly 12 plan rows, one per week. Do not claim untested abilities and do not use Markdown.\n\nStudent: ${assessment.student_name}\nSubject: ${assessment.subject}\nCurriculum: ${assessment.curriculum}\nStarting grade: ${assessment.starting_grade}\nHighest grade tested: ${assessment.current_grade}\nTutor observations: ${assessment.tutor_observations || "None"}\nAssessment log:\n${events}`;
    const models = ["gemini-3.8-flash", "gemini-2.5-flash"];
    let report = "";
    for (const model of models) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
      if (!response.ok) continue;
      const json = await response.json(); report = json.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
      if (report) break;
    }
    if (!report) return NextResponse.json({ error: "Gemini could not generate a report. Please try again shortly." }, { status: 502 });
    let reportData: ReportData; try { reportData = normaliseReport(JSON.parse(report), report); } catch { reportData = normaliseReport(null, report); }
    const { error: updateError } = await createAdminClient().from("assessment_sessions").update({ generated_report: reportData.overview, generated_report_data: reportData, report_generated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ report: reportData.overview, reportData });
  } catch (error) { console.error("diagnostic report generation failed", error); return NextResponse.json({ error: "Unable to generate the diagnostic report." }, { status: 500 }); }
}
