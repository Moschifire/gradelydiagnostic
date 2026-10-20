"use client";

import bankData from "@/data/content.json";
import { advance, Bank, initialRun, QuestionSet, record, RunState, topicName } from "@/lib/assessment-engine";
import { Fragment, useEffect, useMemo, useState } from "react";

const bank = bankData as Bank;
const draftKey = "gradely-diagnostic-draft-v1";
type Setup = { tutor: string; student: string; subject: string; curriculum: string; startingGrade: string };
type Draft = { setup: Setup; run: RunState; notes: string };
const empty: Setup = { tutor: "", student: "", subject: "Mathematics", curriculum: "US Common Core", startingGrade: "Kindergarten" };

function imageSource(url?: string) {
  if (!url) return null;
  if (!url.includes("drive.google.com")) return url;
  const fileMatch = url.match(/\/file\/d\/([^/?]+)/);
  const idMatch = url.match(/[?&]id=([^&]+)/);
  const id = fileMatch?.[1] ?? idMatch?.[1];
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : url;
}

function proxiedImageSource(url?: string) {
  const source = imageSource(url);
  return source?.startsWith("http") ? `/api/image?url=${encodeURIComponent(source)}` : source;
}

function setImages(set?: QuestionSet | null) {
  if (!set) return [];
  return [set.image, set.mastery_image, ...(set.questions ?? []).flatMap(question => [question.image, ...(question.options_images ?? []), ...(question.images ?? [])]), ...(set.subs ?? []).flatMap(question => [question.image, ...(question.options_images ?? []), ...(question.images ?? [])])]
    .map(proxiedImageSource).filter((value): value is string => Boolean(value));
}

function QuestionImage({ url, alt, compact = false }: { url?: string; alt: string; compact?: boolean }) {
  const src = proxiedImageSource(url);
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  return <figure className={compact ? "option-image" : "question-image"}>{failed ? <div className="image-unavailable" role="status">This visual could not be loaded.</div> : <img src={src} alt={alt} loading="eager" decoding="async" fetchPriority="high" onError={() => setFailed(true)} />}<figcaption>{alt}</figcaption></figure>;
}

function ReadingPassage({ content }: { content: string }) {
  const blocks: Array<{ type: "heading" | "paragraph" | "list"; value: string | string[] }> = [];
  for (const rawBlock of content.trim().split(/\n\s*\n/)) {
    const lines = rawBlock.split("\n").map(line => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every(line => line.startsWith("- "))) blocks.push({ type: "list", value: lines.map(line => line.slice(2)) });
    else if (lines[0].startsWith("### ")) {
      blocks.push({ type: "heading", value: lines[0].slice(4) });
      if (lines.length > 1) blocks.push({ type: "paragraph", value: lines.slice(1).join(" ") });
    } else blocks.push({ type: "paragraph", value: lines.join(" ") });
  }

  return <section className="reading-passage" aria-label="Reading passage">{blocks.map((block, index) => <Fragment key={`${block.type}-${index}`}>{block.type === "heading" ? <h3>{block.value as string}</h3> : block.type === "list" ? <ul>{(block.value as string[]).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul> : <p>{block.value as string}</p>}</Fragment>)}</section>;
}

function splitPrompt(prompt?: string) {
  if (!prompt) return { question: "", options: [] as string[] };
  const match = prompt.match(/\s+Options:\s*([\s\S]+)$/i);
  if (!match) return { question: prompt, options: [] as string[] };
  const rawOptions = match[1].trim();
  const bracketed = rawOptions.match(/\[[^\]]+\]/g);
  const labelled = [...rawOptions.matchAll(/(?:^|,\s*)([A-Z]\))\s*([\s\S]*?)(?=(?:,\s*[A-Z]\))|$)/g)].map(option => `${option[1]} ${option[2].trim()}`);
  return { question: prompt.slice(0, match.index).trim(), options: bracketed?.length ? bracketed.map(option => option.slice(1, -1)) : labelled.length ? labelled : [rawOptions] };
}

function QuestionPrompt({ prompt }: { prompt?: string }) {
  const { question, options } = splitPrompt(prompt);
  return <><h2>{question}</h2>{options.length > 0 && <section className="answer-options" aria-label="Answer options"><span className="options-label">OPTIONS</span><div>{options.map((option, index) => <span key={`${option}-${index}`}>{option}</span>)}</div></section>}</>;
}

export function DiagnosticWorkspace() {
  const [setup, setSetup] = useState<Setup>(empty); const [run, setRun] = useState<RunState | null>(null); const [notes, setNotes] = useState("");
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [savedAssessment, setSavedAssessment] = useState(false); const [saveMessage, setSaveMessage] = useState("");
  const curricula = Object.keys(bank[setup.subject] ?? {});
  const grades = Object.keys(bank[setup.subject]?.[setup.curriculum] ?? {});
  const setField = <K extends keyof Setup>(key: K, value: Setup[K]) => setSetup(current => ({ ...current, [key]: value }));
  const activeSet = useMemo(() => run ? bank[setup.subject]?.[setup.curriculum]?.[run.grade]?.[run.setIndex] ?? null : null, [run, setup]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as Draft;
      if (draft?.setup && draft?.run && bank[draft.setup.subject]?.[draft.setup.curriculum]?.[draft.run.grade]) {
        setSetup(draft.setup); setNotes(draft.notes ?? ""); setRun(draft.run); setSavedDraft(draft);
      }
    } catch { window.localStorage.removeItem(draftKey); } finally { setReady(true); }
  }, []);

  useEffect(() => {
    if (!ready || !run) return;
    const draft = { setup, run, notes };
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
    setSavedDraft(draft);
  }, [ready, setup, run, notes]);

  useEffect(() => {
    if (!activeSet) return;
    const gradeSets = bank[setup.subject]?.[setup.curriculum]?.[run?.grade ?? ""] ?? [];
    const nextSet = gradeSets[(run?.setIndex ?? 0) + 1];
    [...setImages(activeSet), ...setImages(nextSet)].slice(0, 16).forEach(src => { const image = new Image(); image.decoding = "async"; image.src = src; });
  }, [activeSet, run?.grade, run?.setIndex, setup.subject, setup.curriculum]);

  const begin = () => { window.localStorage.removeItem(draftKey); setSavedDraft(null); setNotes(""); setSavedAssessment(false); setSaveMessage(""); setRun(initialRun(setup.startingGrade, setup.subject)); };
  const resume = () => { if (!savedDraft) return; setSetup(savedDraft.setup); setNotes(savedDraft.notes); setRun(savedDraft.run); };
  const newAssessment = () => { window.localStorage.removeItem(draftKey); setSavedDraft(null); setRun(null); setNotes(""); setSavedAssessment(false); setSaveMessage(""); setSetup(empty); };
  const saveAssessment = async () => {
    if (!run || savedAssessment) return;
    setSaving(true); setSaveMessage("");
    try {
      const response = await fetch("/api/assessment-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tutorName: setup.tutor, studentName: setup.student, subject: setup.subject, curriculum: setup.curriculum, startingGrade: setup.startingGrade, currentGrade: run.grade, runState: run, observations: notes, status: "complete", events: run.results.map(result => ({ grade: result.grade, topic: result.topic, level: result.level, status: result.status })) }) });
      const raw = await response.text(); let data: { error?: string; sessionId?: string } = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error("The save service returned an invalid response. Please try again."); }
      if (!response.ok || !data.sessionId) throw new Error(data.error || "Unable to save this assessment.");
      setSavedAssessment(true); setSaveMessage("Assessment saved. It is now available to the administrator.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Unable to save this assessment."); } finally { setSaving(false); }
  };

  if (!ready) return <main className="shell"><p className="quiet">Restoring your assessment…</p></main>;
  if (!run) return <main className="shell"><header><img className="brand-logo" src="/gradely-logo.png" alt="Gradely" /><p className="eyebrow">DIAGNOSTIC STUDIO</p><h1>Start a learning assessment</h1><p className="lede">A calm, tutor-led diagnostic with adaptive progression.</p></header>{savedDraft && <section className="saved-draft"><div><b>Assessment in progress</b><span>{savedDraft.setup.student} · {savedDraft.setup.subject}</span></div><button className="primary" onClick={resume}>Resume assessment</button></section>}<section className="card form-grid">
    <label>Tutor name<input value={setup.tutor} onChange={e => setField("tutor", e.target.value)} placeholder="Your name" /></label><label>Learner name<input value={setup.student} onChange={e => setField("student", e.target.value)} placeholder="Learner name" /></label>
    <label>Subject<select value={setup.subject} onChange={e => { const subject = e.target.value; const curriculum = Object.keys(bank[subject])[0]; setSetup(s => ({ ...s, subject, curriculum, startingGrade: Object.keys(bank[subject][curriculum])[0] })); }}>{Object.keys(bank).map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Curriculum<select value={setup.curriculum} onChange={e => { const curriculum = e.target.value; setSetup(s => ({ ...s, curriculum, startingGrade: Object.keys(bank[s.subject][curriculum])[0] })); }}>{curricula.map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Starting grade<select value={setup.startingGrade} onChange={e => setField("startingGrade", e.target.value)}>{grades.map(x => <option key={x}>{x}</option>)}</select></label>
    <button className="primary" disabled={!setup.tutor || !setup.student} onClick={begin}>Begin assessment <span>→</span></button>
  </section><p className="quiet">Progress is saved automatically in this browser. <a className="admin-link" href="/admin">Admin sign in</a></p></main>;
  if (run.phase === "complete") return <main className="shell"><p className="eyebrow">SESSION COMPLETE</p><h1>Assessment summary</h1><section className="card"><div className="summary-head"><div><b>{setup.student}</b><span>{setup.subject} · Started at {setup.startingGrade}</span></div><button onClick={newAssessment}>New assessment</button></div><table><thead><tr><th>Grade</th><th>Skill</th><th>Check</th><th>Outcome</th></tr></thead><tbody>{run.results.map((result, i) => <tr key={i}><td>{result.grade}</td><td>{result.topic}</td><td>{result.level}</td><td className={result.status === "Correct" ? "success" : "gap"}>{result.status}</td></tr>)}</tbody></table><label className="notes">Tutor observations<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record misconceptions, confidence, supports that worked…" /></label><div className="completion-actions"><div><b>{savedAssessment ? "Assessment saved" : "Ready to save?"}</b><span>{savedAssessment ? "The administrator can now review it in the dashboard." : "Save the diagnostic results and tutor observations for administrator review."}</span></div><button className="primary" onClick={saveAssessment} disabled={saving || savedAssessment}>{saving ? "Saving…" : savedAssessment ? "Saved" : "Save assessment"}</button></div>{saveMessage && <p className={savedAssessment ? "save-message success" : "save-message gap"}>{saveMessage}</p>}</section></main>;
  const set = activeSet!; const topic = topicName(set); const isMath = setup.subject === "Mathematics";
  const usesEnglishScaffolding = !isMath && Boolean(set.mastery_q && set.subs?.length);
  const next = (updated: RunState) => setRun(advance(updated, bank, setup.subject, setup.curriculum));
  const answer = (status: "Correct" | "Incorrect") => {
    let updated = record(run, setup.subject, topic, run.phase === "subs" ? `Sub-skill ${run.subIndex + 1}` : run.phase === "retry" ? "Mastery retry" : "Mastery", status);
    if (run.bottleneck && status !== "Correct" && !(usesEnglishScaffolding && (run.phase === "mastery" || run.phase === "subs"))) return setRun({ ...updated, phase: "complete" });
    if (usesEnglishScaffolding) {
      if (run.phase === "mastery" && status === "Incorrect") return setRun({ ...updated, phase: "subs", subIndex: 0 });
      if (run.phase === "subs" && run.subIndex < (set.subs?.length ?? 1) - 1) return setRun({ ...updated, subIndex: run.subIndex + 1 });
      if (run.phase === "subs") return setRun({ ...updated, phase: "retry" });
      return next(updated);
    }
    if (isMath && run.phase === "mastery" && status === "Incorrect") return setRun({ ...updated, phase: "subs", subIndex: 0 });
    if (isMath && run.phase === "subs" && status === "Correct" && run.subIndex < (set.subs?.length ?? 1) - 1) return setRun({ ...updated, subIndex: run.subIndex + 1 });
    if (isMath && run.phase === "subs" && status === "Correct") return setRun({ ...updated, phase: "retry" });
    if (!isMath && run.phase === "english" && run.subIndex < (set.questions?.length ?? 1) - 1) return setRun({ ...updated, subIndex: run.subIndex + 1 });
    if (status === "Correct" && isMath && run.phase !== "subs") updated = { ...updated, mastery: updated.mastery + 1 };
    next(updated);
  };
  const familiarity = (known: boolean) => { const updated = known ? { ...run, phase: (isMath || usesEnglishScaffolding) ? "mastery" as const : "english" as const } : record(run, setup.subject, topic, "Familiarity", "Not familiar"); if (!known && run.bottleneck) setRun({ ...updated, phase: "complete" }); else if (!known) next(updated); else setRun(updated); };
  const prompt = run.phase === "subs" ? set.subs?.[run.subIndex]?.q : !isMath && run.phase === "english" ? set.questions?.[run.subIndex]?.q : set.mastery_q;
  const activeQuestion = run.phase === "subs" ? set.subs?.[run.subIndex] : run.phase === "english" ? set.questions?.[run.subIndex] : undefined;
  // The imported bank retains empty image fields for questions without an
  // illustration.  Treat those as absent so a set-level mastery visual can
  // still be used for the active mastery check.
  const image = activeQuestion?.image || set.image || set.mastery_image;
  const optionImages = activeQuestion?.options_images ?? activeQuestion?.images ?? [];
  const content = activeQuestion?.content_text ?? set.content_text;
  const hint = activeQuestion?.h ?? ((run.phase === "mastery" || run.phase === "retry") ? set.mastery_hint : undefined);
  return <main className="shell"><header className="session-header"><div><p className="eyebrow">{setup.student.toUpperCase()} · {setup.subject.toUpperCase()}</p><h1>{run.grade}</h1></div><div className="progress"><span>Saved · {run.results.length} observations</span><button onClick={() => setRun(null)}>Save and exit</button></div></header><section className="runner"><aside><span className="label">CURRENT SKILL</span><h2>{topic}</h2><p>{run.bottleneck ? "Stretch level — stop at the first gap to protect confidence." : "Use your judgement and encourage thinking aloud."}</p></aside><article className="question card">{run.phase === "familiarity" ? <><span className="label">CHECK-IN</span><h2>Is the learner familiar with this topic?</h2><p>Ask before showing the question. Their response guides the next step.</p><div className="actions"><button className="primary" onClick={() => familiarity(true)}>Yes, continue</button><button onClick={() => familiarity(false)}>Not yet</button></div></> : <><span className="label">{run.phase === "subs" ? `FOUNDATION ${run.subIndex + 1}` : run.phase === "retry" ? "MASTERY RETRY" : "MASTERY CHECK"}</span>{!isMath && set.instruction && <p>{set.instruction}</p>}{!isMath && content && <ReadingPassage content={content} />}<QuestionPrompt prompt={prompt} /><QuestionImage url={image} alt="Question visual" />{optionImages.length > 0 && <div className="option-images">{optionImages.map((option, index) => <QuestionImage key={option} url={option} alt={`Answer option ${index + 1}`} compact />)}</div>}{hint && <details><summary>Show tutor hint</summary><p>{hint}</p></details>}<div className="actions"><button className="primary" onClick={() => answer("Correct")}>✓ Correct</button><button className="danger" onClick={() => answer("Incorrect")}>× Needs support</button></div></>}</article></section></main>;
}
