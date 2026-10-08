import { weekdayName } from "./dates";
import { discoverDatabases, type Discovery, type ResolvedDb } from "./discover";
import { HttpError } from "./http";
import {
  checkboxValue,
  dateValue,
  richText,
  richValue,
  selectValue,
  statusValue,
  titleValue,
  type NotionClient,
  type NotionPage,
  type NotionProperty,
} from "./notion";
import { dayFlags, emptyDays, parseStreakText, streakFromDays } from "./streak";
import type { AiTool, Habit, JournalEntry, Summary, Task, TaskList, TaskStatus, Weekday } from "./types";
import { AI_TOOLS, LISTS, MOODS, STATUSES, WEEKDAYS } from "./types";
import type { Deps } from "./deps";

const LIST_PAGES = 2;

export async function loadHome(deps: Deps, today: string) {
  const discovery = await discoverDatabases(deps.config, deps.notion, deps.cache, false);
  assertToken(discovery);
  const [tasks, habits, journal, summaries] = await Promise.all([
    discovery.byKey.tasks?.missing.length === 0 && discovery.byKey.tasks
      ? listTasks(deps.notion!, discovery.byKey.tasks)
      : Promise.resolve([] as Task[]),
    discovery.byKey.habits?.missing.length === 0 && discovery.byKey.habits
      ? listHabits(deps.notion!, discovery.byKey.habits, today)
      : Promise.resolve([] as Habit[]),
    discovery.byKey.journal?.missing.length === 0 && discovery.byKey.journal
      ? listJournal(deps.notion!, discovery.byKey.journal)
      : Promise.resolve([] as JournalEntry[]),
    discovery.byKey.weekly?.missing.length === 0 && discovery.byKey.weekly
      ? listSummaries(deps.notion!, discovery.byKey.weekly)
      : Promise.resolve([] as Summary[]),
  ]);
  return { today, weekday: weekdayName(today), tasks, habits, journal, summaries };
}

export async function createTask(deps: Deps, input: { title: string; list: TaskList; due: string | null }): Promise<Task> {
  const db = await readyDb(deps, "tasks");
  const page = await deps.notion!.createPage(target(db), {
    Name: titleValue(input.title),
    List: selectValue(input.list),
    Status: statusValue("Not started", db.properties.Status?.type ?? "status"),
    ...(input.due ? { Due: dateValue(input.due) } : {}),
  });
  return pageToTask(page);
}

export async function updateTask(
  deps: Deps,
  id: string,
  patch: { title?: string; status?: TaskStatus; list?: TaskList; due?: string | null },
): Promise<Task> {
  const db = await readyDb(deps, "tasks");
  const properties: Record<string, unknown> = {};
  if (patch.title) properties.Name = titleValue(patch.title);
  if (patch.status) properties.Status = statusValue(patch.status, db.properties.Status?.type ?? "status");
  if (patch.list) properties.List = selectValue(patch.list);
  if (patch.due !== undefined) properties.Due = dateValue(patch.due);
  const page = await deps.notion!.updatePage(id, properties);
  return pageToTask(page);
}

export async function createHabit(deps: Deps, input: { title: string; why: string }, today: string): Promise<Habit> {
  const db = await readyDb(deps, "habits");
  const properties: Record<string, unknown> = { Habit: titleValue(input.title) };
  if (input.why && db.properties["Why it matters"]) properties["Why it matters"] = richValue(input.why);
  const page = await deps.notion!.createPage(target(db), properties);
  return pageToHabit(page, today);
}

export async function updateHabit(
  deps: Deps,
  id: string,
  day: Weekday,
  checked: boolean,
  today: string,
): Promise<Habit> {
  await readyDb(deps, "habits");
  const page = await deps.notion!.updatePage(id, { [day]: checkboxValue(checked) });
  return pageToHabit(page, today);
}

export async function createJournal(
  deps: Deps,
  input: { title: string; date: string; mood: string | null; entry: string },
): Promise<JournalEntry> {
  const db = await readyDb(deps, "journal");
  const page = await deps.notion!.createPage(target(db), {
    Title: titleValue(input.title),
    Date: dateValue(input.date),
    ...(input.mood ? { Mood: selectValue(input.mood) } : {}),
    Entry: richValue(input.entry),
  });
  return pageToJournal(page);
}

export async function updateJournal(
  deps: Deps,
  id: string,
  input: { title?: string; date?: string | null; mood?: string | null; entry?: string },
): Promise<JournalEntry> {
  await readyDb(deps, "journal");
  const properties: Record<string, unknown> = {};
  if (input.title) properties.Title = titleValue(input.title);
  if (input.date !== undefined) properties.Date = dateValue(input.date);
  if (input.mood) properties.Mood = selectValue(input.mood);
  if (input.entry !== undefined) properties.Entry = richValue(input.entry);
  const page = await deps.notion!.updatePage(id, properties);
  return pageToJournal(page);
}

export async function createSummary(
  deps: Deps,
  input: { week: string; weekEnding: string | null; takeaway: string; aiUsed: string | null },
): Promise<Summary> {
  const db = await readyDb(deps, "weekly");
  const properties: Record<string, unknown> = {
    Week: titleValue(input.week),
    Takeaway: richValue(input.takeaway),
  };
  if (input.weekEnding) properties["Week ending"] = dateValue(input.weekEnding);
  if (input.aiUsed && db.properties["AI used"]) properties["AI used"] = selectValue(input.aiUsed);
  const page = await deps.notion!.createPage(target(db), properties);
  if (input.takeaway) {
    try {
      await deps.notion!.appendParagraph(page.id, input.takeaway);
    } catch {
      // The Takeaway property already holds the text.
    }
  }
  return pageToSummary(page);
}

async function readyDb(deps: Deps, key: ResolvedKey): Promise<ResolvedDb> {
  if (!deps.notion) throw new HttpError(400, "Add NOTION_TOKEN in Netlify, then redeploy.");
  const discovery = await discoverDatabases(deps.config, deps.notion, deps.cache, false);
  assertToken(discovery);
  const db = discovery.byKey[key];
  if (!db) {
    throw new HttpError(409, `${labelFor(key)} isn't connected yet. Open the setup check and share your Life OS page with the integration.`);
  }
  if (db.missing.length) {
    throw new HttpError(409, `${labelFor(key)} is missing ${db.missing.join(", ")}.`);
  }
  return db;
}

function assertToken(discovery: Discovery) {
  if (!discovery.tokenFound) {
    throw new HttpError(400, discovery.tokenError || "Add NOTION_TOKEN in Netlify, then redeploy.");
  }
}

type ResolvedKey = "tasks" | "habits" | "journal" | "weekly";

function labelFor(key: ResolvedKey): string {
  if (key === "tasks") return "Tasks";
  if (key === "habits") return "Habits";
  if (key === "journal") return "Journal";
  return "Weekly Summary";
}

function target(db: ResolvedDb) {
  return { id: db.id, kind: db.kind };
}

async function queryAll(notion: NotionClient, db: ResolvedDb, body: Record<string, unknown> = {}): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < LIST_PAGES; page += 1) {
    const result = await notion.query(
      target(db),
      { page_size: 100, sorts: [{ timestamp: "last_edited_time", direction: "descending" }], ...body, ...(cursor ? { start_cursor: cursor } : {}) },
    );
    pages.push(...result.results);
    if (!result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return pages;
}

async function listTasks(notion: NotionClient, db: ResolvedDb): Promise<Task[]> {
  const pages = await queryAll(notion, db);
  return pages.map(pageToTask).sort(compareTasks);
}

async function listHabits(notion: NotionClient, db: ResolvedDb, today: string): Promise<Habit[]> {
  const pages = await queryAll(notion, db);
  return pages.map((page) => pageToHabit(page, today)).sort((a, b) => a.title.localeCompare(b.title));
}

async function listJournal(notion: NotionClient, db: ResolvedDb): Promise<JournalEntry[]> {
  const pages = await queryAll(notion, db);
  return pages.map(pageToJournal).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

async function listSummaries(notion: NotionClient, db: ResolvedDb): Promise<Summary[]> {
  const pages = await queryAll(notion, db);
  return pages.map(pageToSummary).sort((a, b) => (b.weekEnding || "").localeCompare(a.weekEnding || ""));
}

function compareTasks(a: Task, b: Task): number {
  const done = Number(a.status === "Done") - Number(b.status === "Done");
  if (done) return done;
  const list = LISTS.indexOf(a.list) - LISTS.indexOf(b.list);
  if (list) return list;
  return (a.due || "9999").localeCompare(b.due || "9999");
}

function textProp(page: NotionPage, name: string): string {
  const prop = page.properties[name];
  if (!prop) return "";
  if (prop.type === "title") return richText(prop.title);
  if (prop.type === "rich_text") return richText(prop.rich_text);
  return "";
}

function choiceProp(prop: NotionProperty | undefined): string | null {
  if (!prop) return null;
  if (prop.type === "select") return prop.select?.name ?? null;
  if (prop.type === "status") return prop.status?.name ?? null;
  return null;
}

function dateProp(prop: NotionProperty | undefined): string | null {
  const start = prop?.type === "date" ? prop.date?.start ?? null : null;
  return start ? start.slice(0, 10) : null;
}

export function pageToTask(page: NotionPage): Task {
  const status = choiceProp(page.properties.Status);
  const list = choiceProp(page.properties.List);
  return {
    id: page.id,
    title: textProp(page, "Name"),
    status: (STATUSES as readonly string[]).includes(status ?? "") ? (status as TaskStatus) : "Not started",
    list: (LISTS as readonly string[]).includes(list ?? "") ? (list as TaskList) : "Someday",
    due: dateProp(page.properties.Due),
  };
}

export function pageToHabit(page: NotionPage, today: string): Habit {
  const days = emptyDays();
  for (const day of WEEKDAYS) {
    const prop = page.properties[day];
    days[day] = Boolean(prop && prop.type === "checkbox" && prop.checkbox);
  }
  const formula = page.properties.Streak?.formula;
  const formulaText =
    formula?.type === "string" ? formula.string : formula?.type === "number" && formula.number != null ? String(formula.number) : null;
  const parsed = parseStreakText(formula?.type ? formulaText : null);
  const weekday = weekdayName(today);
  return {
    id: page.id,
    title: textProp(page, "Habit"),
    why: textProp(page, "Why it matters"),
    days,
    streak: parsed ?? streakFromDays(dayFlags(days), today),
    checkedToday: days[weekday],
  };
}

export function pageToJournal(page: NotionPage): JournalEntry {
  const mood = choiceProp(page.properties.Mood);
  return {
    id: page.id,
    title: textProp(page, "Title"),
    date: dateProp(page.properties.Date),
    mood: (MOODS as readonly string[]).includes(mood ?? "") ? mood : mood,
    entry: textProp(page, "Entry"),
  };
}

export function pageToSummary(page: NotionPage): Summary {
  const ai = choiceProp(page.properties["AI used"]);
  return {
    id: page.id,
    week: textProp(page, "Week"),
    weekEnding: dateProp(page.properties["Week ending"]),
    takeaway: textProp(page, "Takeaway"),
    aiUsed: (AI_TOOLS as readonly string[]).includes(ai ?? "") ? (ai as AiTool) : ai,
  };
}
