export type Status = "Correct" | "Incorrect" | "Not familiar";
export type Result = { subject: string; grade: string; topic: string; level: string; status: Status };
export type Question = { q: string; h?: string; image?: string; content_text?: string; options_images?: string[]; images?: string[] };
export type QuestionSet = { topic?: string; section_title?: string; mastery_q?: string; mastery_hint?: string; mastery_image?: string; image?: string; instruction?: string; content_text?: string; questions?: Question[]; subs?: Question[] };
export type Bank = Record<string, Record<string, Record<string, QuestionSet[]>>>;

export type RunState = { grade: string; setIndex: number; subIndex: number; phase: "familiarity" | "mastery" | "subs" | "retry" | "english" | "complete"; mastery: number; perfect: boolean; bottleneck: boolean; results: Result[] };
export const topicName = (set: QuestionSet) => set.topic ?? set.section_title ?? "Untitled skill";

export function initialRun(grade: string, subject: string): RunState {
  return { grade, setIndex: 0, subIndex: 0, phase: subject === "Mathematics" ? "familiarity" : "familiarity", mastery: 0, perfect: true, bottleneck: false, results: [] };
}

export function gradeKeys(bank: Bank, subject: string, curriculum: string) { return Object.keys(bank[subject][curriculum]); }

export function advance(state: RunState, bank: Bank, subject: string, curriculum: string): RunState {
  const sets = bank[subject][curriculum][state.grade];
  if (state.setIndex < sets.length - 1) return { ...state, setIndex: state.setIndex + 1, subIndex: 0, phase: "familiarity" };
  const grades = gradeKeys(bank, subject, curriculum);
  const next = grades[grades.indexOf(state.grade) + 1];
  const qualifies = subject === "Mathematics" ? state.mastery >= sets.length : state.perfect;
  if (qualifies && next) return { ...state, grade: next, setIndex: 0, subIndex: 0, phase: "familiarity", mastery: 0, perfect: true, bottleneck: true };
  return { ...state, phase: "complete" };
}

export function record(state: RunState, subject: string, topic: string, level: string, status: Status) {
  return { ...state, results: [...state.results, { subject, grade: state.grade, topic, level, status }], perfect: state.perfect && status === "Correct" };
}
