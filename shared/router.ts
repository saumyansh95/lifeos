import { isIsoDate } from "./dates";
import type { Deps } from "./deps";
import { discoverDatabases, toSetupReport } from "./discover";
import { asString, HttpError, json, readJson } from "./http";
import { createHabit, createJournal, createSummary, createTask, loadHome, updateHabit, updateJournal, updateTask } from "./life";
import {
  clearSessionCookie,
  createSessionToken,
  passwordMatches,
  requestIsSecure,
  sessionCookie,
  verifySessionToken,
  readCookie,
  SESSION_COOKIE,
} from "./session";
import { AI_TOOLS, LISTS, MOODS, STATUSES, WEEKDAYS, type TaskList, type TaskStatus, type Weekday } from "./types";
import { checkForUpdate } from "./updates";

const KEEP_SECONDS = 60 * 60 * 24 * 30;
const SHORT_SECONDS = 60 * 60 * 12;
const ID = /^[0-9a-f]{32}$|^[0-9a-f-]{36}$/i;

export async function route(req: Request, deps: Deps): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const taskId = path.match(/^\/api\/tasks\/([^/]+)$/);
    const habitId = path.match(/^\/api\/habits\/([^/]+)$/);
    const journalId = path.match(/^\/api\/journal\/([^/]+)$/);

    if (path === "/api/session") return sessionRoute(req, deps);
    if (path === "/api/setup") return guarded(req, deps, () => setupRoute(req, deps, url));
    if (path === "/api/home") return guarded(req, deps, () => homeRoute(url, deps));
    if (path === "/api/tasks" && req.method === "POST") return guarded(req, deps, () => createTaskRoute(req, deps));
    if (path === "/api/tasks") return guarded(req, deps, () => homeRoute(url, deps));
    if (taskId) return guarded(req, deps, () => patchTask(req, deps, taskId[1]));
    if (path === "/api/habits" && req.method === "POST") return guarded(req, deps, () => createHabitRoute(req, deps, url));
    if (habitId) return guarded(req, deps, () => patchHabit(req, deps, habitId[1], url));
    if (path === "/api/journal" && req.method === "POST") return guarded(req, deps, () => createJournalRoute(req, deps));
    if (journalId) return guarded(req, deps, () => patchJournal(req, deps, journalId[1]));
    if (path === "/api/summaries" && req.method === "POST") return guarded(req, deps, () => createSummaryRoute(req, deps));
    if (path === "/api/update") return guarded(req, deps, () => updateRoute(deps));
    return json({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("life-os", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Something went wrong. Try the setup check." }, 500);
  }
}

async function sessionRoute(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "GET") {
    return json({ ok: signedIn(req, deps) });
  }
  if (req.method === "DELETE") {
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(requestIsSecure(req)) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!deps.config.appPassword || !deps.config.sessionSecret) {
    return json({ error: "APP_PASSWORD is not set in Netlify." }, 500);
  }
  const body = await readJson(req);
  const password = asString(body.password, 500);
  if (!passwordMatches(password, deps.config.appPassword)) {
    return json({ error: "That password doesn't match." }, 401);
  }
  const keep = body.keep === true;
  const maxAge = keep ? KEEP_SECONDS : SHORT_SECONDS;
  const token = createSessionToken(deps.config.sessionSecret, maxAge, deps.now());
  return json({ ok: true }, 200, {
    "set-cookie": sessionCookie(token, maxAge, requestIsSecure(req)),
  });
}

function signedIn(req: Request, deps: Deps): boolean {
  if (!deps.config.sessionSecret) return false;
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return verifySessionToken(deps.config.sessionSecret, token, deps.now());
}

async function guarded(req: Request, deps: Deps, run: () => Promise<Response>): Promise<Response> {
  if (!signedIn(req, deps)) return json({ error: "Sign in required." }, 401);
  return run();
}

async function setupRoute(req: Request, deps: Deps, url: URL): Promise<Response> {
  if (req.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const discovery = await discoverDatabases(deps.config, deps.notion, deps.cache, url.searchParams.get("refresh") === "1");
  return json(await toSetupReport(discovery, deps.notion));
}

async function homeRoute(url: URL, deps: Deps): Promise<Response> {
  return json(await loadHome(deps, todayFrom(url)));
}

async function createTaskRoute(req: Request, deps: Deps): Promise<Response> {
  const body = await readJson(req);
  const title = asString(body.title, 500);
  if (!title) return json({ error: "Add a name first." }, 400);
  const list = asString(body.list, 40);
  if (!(LISTS as readonly string[]).includes(list)) return json({ error: "Pick Today, This Week or Someday." }, 400);
  const due = optionalDate(body.due);
  const task = await createTask(deps, { title, list: list as TaskList, due });
  return json({ task }, 201);
}

async function patchTask(req: Request, deps: Deps, id: string): Promise<Response> {
  if (req.method !== "PATCH") return json({ error: "Method not allowed." }, 405);
  if (!ID.test(id)) return json({ error: "Unknown task." }, 400);
  const body = await readJson(req);
  const patch: { title?: string; status?: TaskStatus; list?: TaskList; due?: string | null } = {};
  if (body.title !== undefined) {
    const title = asString(body.title, 500);
    if (!title) return json({ error: "Add a name first." }, 400);
    patch.title = title;
  }
  if (body.status !== undefined) {
    const status = asString(body.status, 40);
    if (!(STATUSES as readonly string[]).includes(status)) return json({ error: "Unknown status." }, 400);
    patch.status = status as TaskStatus;
  }
  if (body.list !== undefined) {
    const list = asString(body.list, 40);
    if (!(LISTS as readonly string[]).includes(list)) return json({ error: "Unknown list." }, 400);
    patch.list = list as TaskList;
  }
  if (body.due !== undefined) patch.due = optionalDate(body.due);
  return json({ task: await updateTask(deps, id, patch) });
}

async function createHabitRoute(req: Request, deps: Deps, url: URL): Promise<Response> {
  const body = await readJson(req);
  const title = asString(body.title, 300);
  if (!title) return json({ error: "Add a habit name first." }, 400);
  const habit = await createHabit(deps, { title, why: asString(body.why, 1000) }, todayFrom(url));
  return json({ habit }, 201);
}

async function patchHabit(req: Request, deps: Deps, id: string, url: URL): Promise<Response> {
  if (req.method !== "PATCH") return json({ error: "Method not allowed." }, 405);
  if (!ID.test(id)) return json({ error: "Unknown habit." }, 400);
  const body = await readJson(req);
  const day = asString(body.day, 3);
  if (!(WEEKDAYS as readonly string[]).includes(day)) return json({ error: "Unknown day." }, 400);
  const habit = await updateHabit(deps, id, day as Weekday, body.checked === true, todayFrom(url));
  return json({ habit });
}

async function createJournalRoute(req: Request, deps: Deps): Promise<Response> {
  const body = await readJson(req);
  const date = asString(body.date, 10);
  if (!isIsoDate(date)) return json({ error: "Pick a date." }, 400);
  const mood = asString(body.mood, 40);
  if (mood && !(MOODS as readonly string[]).includes(mood)) return json({ error: "Pick a mood from the list." }, 400);
  const title = asString(body.title, 300) || "Journal";
  const entry = await createJournal(deps, {
    title,
    date,
    mood: mood || null,
    entry: asString(body.entry, 8000),
  });
  return json({ entry }, 201);
}

async function patchJournal(req: Request, deps: Deps, id: string): Promise<Response> {
  if (req.method !== "PATCH") return json({ error: "Method not allowed." }, 405);
  if (!ID.test(id)) return json({ error: "Unknown entry." }, 400);
  const body = await readJson(req);
  const patch: { title?: string; date?: string | null; mood?: string | null; entry?: string } = {};
  if (body.title !== undefined) patch.title = asString(body.title, 300) || "Journal";
  if (body.date !== undefined) {
    const date = body.date === null ? null : asString(body.date, 10);
    if (date && !isIsoDate(date)) return json({ error: "Pick a date." }, 400);
    patch.date = date;
  }
  if (body.mood !== undefined) {
    const mood = asString(body.mood, 40);
    if (mood && !(MOODS as readonly string[]).includes(mood)) return json({ error: "Pick a mood from the list." }, 400);
    patch.mood = mood || null;
  }
  if (body.entry !== undefined) patch.entry = asString(body.entry, 8000);
  return json({ entry: await updateJournal(deps, id, patch) });
}

async function createSummaryRoute(req: Request, deps: Deps): Promise<Response> {
  const body = await readJson(req);
  const week = asString(body.week, 200);
  if (!week) return json({ error: "Name the week first." }, 400);
  const aiUsed = asString(body.aiUsed, 40);
  if (aiUsed && !(AI_TOOLS as readonly string[]).includes(aiUsed)) return json({ error: "Pick an AI from the list." }, 400);
  const weekEnding = optionalDate(body.weekEnding);
  const summary = await createSummary(deps, {
    week,
    weekEnding,
    takeaway: asString(body.takeaway, 8000),
    aiUsed: aiUsed || null,
  });
  return json({ summary }, 201);
}

async function updateRoute(deps: Deps): Promise<Response> {
  return json(await checkForUpdate(deps.cache, deps.fetch, deps.now()));
}

function todayFrom(url: URL): string {
  const today = url.searchParams.get("today") ?? "";
  if (isIsoDate(today)) return today;
  return new Date().toISOString().slice(0, 10);
}

function optionalDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = asString(value, 10);
  if (!isIsoDate(date)) throw new HttpError(400, "That date was not valid.");
  return date;
}
