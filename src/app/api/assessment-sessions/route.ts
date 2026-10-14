import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

type Event = { grade: string; topic: string; level: string; status: "Correct" | "Incorrect" | "Not familiar" };
type Payload = { tutorName: string; tutorEmail?: string; studentName: string; subject: "Mathematics" | "English Language"; curriculum: string; startingGrade: string; currentGrade: string; runState: unknown; observations?: string; status: "in_progress" | "complete"; events: Event[]; resumeToken?: string; sessionId?: string };

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

async function sendResumeEmail(email: string, resumeUrl: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || "Gradely Diagnostics <support@gradely.co>", to: [email], subject: "Resume your Gradely diagnostic assessment", html: `<p>Your assessment progress has been saved.</p><p><a href="${resumeUrl}">Resume assessment</a></p><p>This link expires in 30 days. Keep it private.</p>` }) });
  return response.ok;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Payload;
    const tutorName = clean(body.tutorName, 160); const studentName = clean(body.studentName, 160);
    const tutorEmail = clean(body.tutorEmail, 254).toLowerCase() || null;
    if (!tutorName || !studentName || !body.curriculum || !body.startingGrade || !body.currentGrade || !["Mathematics", "English Language"].includes(body.subject)) return NextResponse.json({ error: "Please provide the required assessment details." }, { status: 400 });
    if (body.status === "in_progress" && !tutorEmail) return NextResponse.json({ error: "An email address is required to resume an incomplete assessment." }, { status: 400 });
    const supabase = createAdminClient();
    const token = body.resumeToken || randomBytes(32).toString("base64url");
    const values = { tutor_name: tutorName, tutor_email: tutorEmail, student_name: studentName, subject: body.subject, curriculum: clean(body.curriculum, 160), starting_grade: clean(body.startingGrade, 80), current_grade: clean(body.currentGrade, 80), run_state: body.runState, tutor_observations: clean(body.observations, 5000), status: body.status, resume_token_hash: digest(token), updated_at: new Date().toISOString(), completed_at: body.status === "complete" ? new Date().toISOString() : null };
    let sessionId = body.sessionId;
    if (sessionId && body.resumeToken) {
      const { data, error } = await supabase.from("assessment_sessions").update(values).eq("id", sessionId).eq("resume_token_hash", digest(body.resumeToken)).select("id").maybeSingle();
      if (error) throw error; if (!data) return NextResponse.json({ error: "This resume link is invalid or has expired." }, { status: 403 });
    } else {
      const { data, error } = await supabase.from("assessment_sessions").insert(values).select("id").single();
      if (error) throw error; sessionId = data.id;
    }
    if (body.events.length) await supabase.from("assessment_session_events").insert(body.events.slice(0, 500).map(event => ({ assessment_session_id: sessionId, grade: clean(event.grade, 80), topic: clean(event.topic, 500), level: clean(event.level, 160), outcome: event.status })));
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const resumeUrl = `${appUrl}/resume/${sessionId}?token=${encodeURIComponent(token)}`;
    const emailed = body.status === "in_progress" && tutorEmail ? await sendResumeEmail(tutorEmail, resumeUrl) : false;
    return NextResponse.json({ sessionId, resumeUrl: body.status === "in_progress" ? resumeUrl : undefined, emailed });
  } catch (error) { console.error("assessment session save failed", error); return NextResponse.json({ error: "Unable to save this assessment right now." }, { status: 500 }); }
}
