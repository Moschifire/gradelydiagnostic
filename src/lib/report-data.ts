export type ReportData = { overview: string; themes: { theme: string; status: string; findings: string; recommendation: string }[]; plan: { week: number; focusArea: string; skills: string; activities: string }[] };

const clean = (value: string) => value.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();

export function legacyPlanToReportData(markdown: string): ReportData {
  const lines = markdown.replace(/\r/g, "").split("\n"); const tableHeader = lines.findIndex(line => /^\|\s*week\s*\|/i.test(line));
  const tableLines = tableHeader >= 0 ? lines.slice(tableHeader + 1).filter(line => line.trim().startsWith("|") && !/^\|?\s*:?-{3,}/.test(line.trim())) : [];
  const plan = tableLines.map(line => line.split("|").slice(1, -1).map(cell => clean(cell))).map(cells => ({ week: Number.parseInt(cells[0], 10), focusArea: cells[1] || "", skills: cells[2] || "", activities: cells[3] || "" })).filter(row => Number.isFinite(row.week));
  const preamble = (tableHeader >= 0 ? lines.slice(0, tableHeader) : lines).map(clean); const themes: ReportData["themes"] = []; let current: { title: string; text: string[] } | null = null;
  for (const line of preamble) { if (!line) continue; if (/^(theme|strength|gap|area|number|algebra|geometry|reading|phonics|writing|comprehension)/i.test(line) && line.length < 90) { if (current) themes.push({ theme: current.title, status: "Developing", findings: current.text.join(" "), recommendation: "Continue targeted practice and monitor progress." }); current = { title: line, text: [] }; } else if (current) current.text.push(line); }
  if (current) themes.push({ theme: current.title, status: "Developing", findings: current.text.join(" "), recommendation: "Continue targeted practice and monitor progress." });
  const overview = preamble.filter(line => !line.startsWith("Theme") && !line.startsWith("12-Week") && !line.startsWith("Diagnostic Report")).slice(0, 8).join(" ") || "Imported diagnostic report and learning plan.";
  return { overview, themes: themes.filter(theme => theme.findings).slice(0, 8), plan };
}
