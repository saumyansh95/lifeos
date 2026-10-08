import { formatShortDate, inLast7Days } from "./dates";
import type { JournalEntry } from "./types";

export const WEEKLY_PROMPT = `Be my kind, honest reflection partner. Below are my diary entries from the last 7 days, each with its date. Read all of them before you answer, then tell me what they say about my week.

How to answer:
- Use only what is in my entries. Don't guess or fill gaps. Where it helps, quote a few of my own words (under 12 words) as evidence.
- Never rewrite, edit, correct, polish or summarise my entries back to me line by line. They stay exactly as I wrote them.
- Be warm, plain and specific, like a good friend who listens well. No therapy language, no labels, no diagnosis, and no medical or mental-health advice.
- If any entry says I feel unsafe or might hurt myself, gently suggest I talk to someone I trust or a local helpline today, and keep the rest short.
- Keep it under 300 words. Use exactly these six headings:

**Mood trend:** One or two sentences on how my mood moved across the week. Use the Mood tags if I added them.
**Three themes:** Three bullets. Each one is a theme that kept showing up, with a short quote from my entries.
**Wins:** Two to four bullets, including small wins I may have skipped past.
**Recurring blockers:** What got in my way more than once. If nothing repeated, say so honestly.
**One habit to try:** One small, specific habit for next week (10 minutes a day or less), linked to something I wrote.
**One question to sit with:** One open question for me to think about this week. Don't answer it.

My entries:
[PASTE YOUR LAST 7 JOURNAL ENTRIES HERE]`;

export function entriesForPrompt(entries: JournalEntry[], today: string): JournalEntry[] {
  return entries
    .filter((entry) => inLast7Days(entry.date, today))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function formatEntry(entry: JournalEntry): string {
  const date = entry.date ? formatShortDate(entry.date) : "Undated";
  const bits = [date, entry.mood, entry.title].filter(Boolean);
  const body = entry.entry.trim();
  return body ? `${bits.join(" · ")}\n${body}` : bits.join(" · ");
}

export function fillWeeklyPrompt(entries: JournalEntry[], today: string): string {
  const picked = entriesForPrompt(entries, today);
  const body = picked.length
    ? picked.map(formatEntry).join("\n\n")
    : "(No journal entries in the last 7 days.)";
  return WEEKLY_PROMPT.replace("[PASTE YOUR LAST 7 JOURNAL ENTRIES HERE]", body);
}
