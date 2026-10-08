import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { memoryCache } from "../shared/cache";
import { readConfig } from "../shared/config";
import { formatHeadingDate, weekdayName } from "../shared/dates";
import { discoverDatabases, toSetupReport } from "../shared/discover";
import { pageToHabit } from "../shared/life";
import { NotionError, type NotionClient, type NotionPage, type SchemaProperty } from "../shared/notion";
import { fillWeeklyPrompt, WEEKLY_PROMPT } from "../shared/prompt";
import { route } from "../shared/router";
import { deriveSessionSecret, passwordMatches, verifySessionToken, createSessionToken, readCookie, SESSION_COOKIE } from "../shared/session";
import { isNewer, parseReleaseNotes } from "../shared/semver";
import { dayFlags, emptyDays, streakFromDays } from "../shared/streak";
import type { Deps } from "../shared/deps";
import type { JournalEntry } from "../shared/types";
import { WEEKDAYS } from "../shared/types";
import { checkForUpdate } from "../shared/updates";
import { APP_VERSION, GITHUB_RELEASES_API, GITHUB_URL } from "../shared/version";

const ROOT = join(import.meta.dirname, "..");
const TASKS = "11111111-1111-4111-8111-111111111111";
const HABITS = "22222222-2222-4222-8222-222222222222";
const JOURNAL = "33333333-3333-4333-8333-333333333333";
const WEEKLY = "44444444-4444-4444-8444-444444444444";

function schema(names: Record<string, SchemaProperty>): Record<string, SchemaProperty> {
  return names;
}

function select(options: string[]): SchemaProperty {
  return { type: "select", select: { options: options.map((name) => ({ name })) } };
}

function fullSchemas() {
  return {
    [TASKS]: {
      title: "Tasks",
      properties: schema({
        Name: { type: "title" },
        Status: { type: "status", status: { options: ["Not started", "In progress", "Done"].map((name) => ({ name })) } },
        List: select(["Today", "This Week", "Someday"]),
        Due: { type: "date" },
      }),
    },
    [HABITS]: {
      title: "Habits",
      properties: schema({
        Habit: { type: "title" },
        "Why it matters": { type: "rich_text" },
        Mon: { type: "checkbox" },
        Tue: { type: "checkbox" },
        Wed: { type: "checkbox" },
        Thu: { type: "checkbox" },
        Fri: { type: "checkbox" },
        Sat: { type: "checkbox" },
        Sun: { type: "checkbox" },
        Streak: { type: "formula" },
        "This week": { type: "formula" },
      }),
    },
    [JOURNAL]: {
      title: "Journal",
      properties: schema({
        Title: { type: "title" },
        Date: { type: "date" },
        Mood: select(["😄 Great", "🙂 Good", "😐 Okay", "😕 Low", "😩 Rough"]),
        Entry: { type: "rich_text" },
      }),
    },
    [WEEKLY]: {
      title: "Summaries",
      properties: schema({
        Week: { type: "title" },
        "Week ending": { type: "date" },
        Takeaway: { type: "rich_text" },
        "AI used": select(["ChatGPT", "Claude", "Grok", "Gemini", "Other"]),
      }),
    },
  };
}

function createFake(options?: { dropList?: boolean; hideWeekly?: boolean; unauthorized?: boolean }): NotionClient {
  const databases = fullSchemas();
  if (options?.dropList) delete databases[TASKS].properties.List;
  const pages = new Map<string, NotionPage[]>();
  for (const id of Object.keys(databases)) pages.set(id, []);
  if (options?.hideWeekly) pages.delete(WEEKLY);

  function readProps(input: Record<string, unknown>) {
    const properties: NotionPage["properties"] = {};
    for (const [name, raw] of Object.entries(input)) {
      const value = raw as {
        title?: { text?: { content?: string } }[];
        rich_text?: { text?: { content?: string } }[];
        select?: { name?: string };
        status?: { name?: string };
        date?: { start?: string } | null;
        checkbox?: boolean;
      };
      if (value.title) properties[name] = { type: "title", title: value.title.map((part) => ({ plain_text: part.text?.content ?? "" })) };
      else if (value.rich_text) properties[name] = { type: "rich_text", rich_text: value.rich_text.map((part) => ({ plain_text: part.text?.content ?? "" })) };
      else if (value.status) properties[name] = { type: "status", status: { name: value.status.name ?? null } };
      else if (value.select) properties[name] = { type: "select", select: { name: value.select.name ?? null } };
      else if ("date" in value) properties[name] = { type: "date", date: value.date };
      else if ("checkbox" in value) properties[name] = { type: "checkbox", checkbox: Boolean(value.checkbox) };
    }
    return properties;
  }

  return {
    async search() {
      if (options?.unauthorized) throw new NotionError("unauthorized", 401, "unauthorized");
      const results = Object.entries(databases)
        .filter(([id]) => !(options?.hideWeekly && id === WEEKLY))
        .map(([id, db]) => ({ object: "data_source", id, title: [{ plain_text: db.title }] }));
      return { results, has_more: false, next_cursor: null };
    },
    async retrieve(id) {
      const db = databases[id as keyof typeof databases];
      if (!db || (options?.hideWeekly && id === WEEKLY)) throw new NotionError("missing", 404, "object_not_found");
      return { id, kind: "data_source", title: db.title, properties: db.properties };
    },
    async query(target, body) {
      const all = pages.get(target.id) ?? [];
      const pageSize = Number(body.page_size ?? 100);
      const start = body.start_cursor ? Number(body.start_cursor) : 0;
      const slice = all.slice(start, start + pageSize);
      const next = start + pageSize;
      return {
        results: slice,
        has_more: next < all.length,
        next_cursor: next < all.length ? String(next) : null,
      };
    },
    async createPage(target, properties) {
      const page: NotionPage = {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(pages.get(target.id)?.length ?? 0).padStart(12, "0")}`,
        properties: readProps(properties),
      };
      pages.get(target.id)?.push(page);
      return page;
    },
    async updatePage(id, properties) {
      for (const list of pages.values()) {
        const page = list.find((item) => item.id === id);
        if (!page) continue;
        page.properties = { ...page.properties, ...readProps(properties) };
        return page;
      }
      throw new NotionError("missing", 404, "object_not_found");
    },
    async appendParagraph() {},
  };
}

function deps(notion: NotionClient | null, password = "secret-phrase"): Deps {
  return {
    config: readConfig({ APP_PASSWORD: password, NOTION_TOKEN: notion ? "test-token" : "" }),
    notion,
    cache: memoryCache(),
    fetch: async () => new Response(null, { status: 404 }),
    now: () => Date.parse("2026-10-08T12:00:00Z"),
  };
}

async function login(clientDeps: Deps, password = "secret-phrase") {
  const response = await route(new Request("http://localhost/api/session", {
    method: "POST",
    body: JSON.stringify({ password, keep: true }),
  }), clientDeps);
  const cookie = response.headers.get("set-cookie") ?? "";
  const token = readCookie(cookie, SESSION_COOKIE);
  return `${SESSION_COOKIE}=${token}`;
}

describe("session", () => {
  it("rejects a wrong password and accepts the right one", async () => {
    const clientDeps = deps(createFake());
    const wrong = await route(new Request("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({ password: "nope" }),
    }), clientDeps);
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const cookie = await login(clientDeps);
    const home = await route(new Request("http://localhost/api/home?today=2026-10-08", {
      headers: { cookie },
    }), clientDeps);
    expect(home.status).toBe(200);
  });

  it("requires a session on every data function", async () => {
    const clientDeps = deps(createFake());
    for (const path of ["/api/setup", "/api/home", "/api/tasks", "/api/update"]) {
      const response = await route(new Request(`http://localhost${path}`), clientDeps);
      expect(response.status).toBe(401);
    }
  });

  it("signs cookies with SESSION_SECRET when it is set", () => {
    const config = readConfig({ APP_PASSWORD: "secret-phrase", SESSION_SECRET: "separate-secret" });
    expect(config.sessionSecret).toBe("separate-secret");
    const token = createSessionToken(config.sessionSecret, 60, Date.parse("2026-10-08T12:00:00Z"));
    expect(verifySessionToken(config.sessionSecret, token, Date.parse("2026-10-08T12:00:30Z"))).toBe(true);
    expect(verifySessionToken(deriveSessionSecret("secret-phrase"), token, Date.parse("2026-10-08T12:00:30Z"))).toBe(false);
  });

  it("compares passwords without caring about length", () => {
    expect(passwordMatches("secret-phrase", "secret-phrase")).toBe(true);
    expect(passwordMatches("short", "secret-phrase")).toBe(false);
    expect(passwordMatches("", "secret-phrase")).toBe(false);
  });
});

describe("setup", () => {
  it("finds Summaries and reports it as Weekly Summary", async () => {
    const clientDeps = deps(createFake());
    const cookie = await login(clientDeps);
    const response = await route(new Request("http://localhost/api/setup", { headers: { cookie } }), clientDeps);
    const body = await response.json();
    expect(body.tokenFound).toBe(true);
    expect(body.foundCount).toBe(4);
    expect(body.databases.map((row: { label: string }) => row.label)).toEqual([
      "Tasks",
      "Habits",
      "Journal",
      "Weekly Summary",
    ]);
    expect(body.databases.every((row: { ready: boolean }) => row.ready)).toBe(true);
  });

  it("names a missing required property", async () => {
    const clientDeps = deps(createFake({ dropList: true }));
    const cookie = await login(clientDeps);
    const response = await route(new Request("http://localhost/api/setup", { headers: { cookie } }), clientDeps);
    const body = await response.json();
    const tasks = body.databases.find((row: { key: string }) => row.key === "tasks");
    expect(tasks.found).toBe(true);
    expect(tasks.ready).toBe(false);
    expect(tasks.missingProperties).toContain("List");
    expect(body.foundCount).toBe(3);
  });

  it("says the token is missing without calling Notion", async () => {
    const discovery = await discoverDatabases(readConfig({ APP_PASSWORD: "x" }), null, memoryCache(), true);
    const report = await toSetupReport(discovery, null);
    expect(report.tokenFound).toBe(false);
    expect(report.databases.every((row) => row.found === false)).toBe(true);
  });

  it("explains a rejected token", async () => {
    const clientDeps = deps(createFake({ unauthorized: true }));
    const cookie = await login(clientDeps);
    const response = await route(new Request("http://localhost/api/setup", { headers: { cookie } }), clientDeps);
    const body = await response.json();
    expect(body.tokenFound).toBe(false);
    expect(body.tokenError).toMatch(/NOTION_TOKEN/);
  });

  it("marks Weekly Summary not found when Summaries is hidden", async () => {
    const clientDeps = deps(createFake({ hideWeekly: true }));
    const cookie = await login(clientDeps);
    const response = await route(new Request("http://localhost/api/setup", { headers: { cookie } }), clientDeps);
    const body = await response.json();
    const weekly = body.databases.find((row: { key: string }) => row.key === "weekly");
    expect(weekly.found).toBe(false);
    expect(weekly.countLabel).toBe("Not found");
    expect(body.foundCount).toBe(3);
  });
});

describe("records", () => {
  it("creates a task and ticks a habit", async () => {
    const notion = createFake();
    const clientDeps = deps(notion);
    const cookie = await login(clientDeps);
    const created = await route(new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ title: "Call Mum about Sunday lunch", list: "Today", due: "2026-10-08" }),
    }), clientDeps);
    expect(created.status).toBe(201);
    const task = (await created.json()).task;
    expect(task.title).toBe("Call Mum about Sunday lunch");
    expect(task.due).toBe("2026-10-08");

    const habitRes = await route(new Request("http://localhost/api/habits?today=2026-10-08", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ title: "Walk 10 minutes" }),
    }), clientDeps);
    const habit = (await habitRes.json()).habit;
    const patched = await route(new Request(`http://localhost/api/habits/${habit.id}?today=2026-10-08`, {
      method: "PATCH",
      headers: { cookie },
      body: JSON.stringify({ day: "Thu", checked: true }),
    }), clientDeps);
    const next = (await patched.json()).habit;
    expect(next.days.Thu).toBe(true);
    expect(next.checkedToday).toBe(true);
    expect(next.streak).toBe(1);
  });

  it("paginates past the first hundred tasks", async () => {
    const notion = createFake();
    const clientDeps = deps(notion);
    const cookie = await login(clientDeps);
    for (let i = 0; i < 120; i += 1) {
      await route(new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({ title: `Task ${i}`, list: "Today" }),
      }), clientDeps);
    }
    const home = await route(new Request("http://localhost/api/home?today=2026-10-08", { headers: { cookie } }), clientDeps);
    const body = await home.json();
    expect(body.tasks.length).toBe(120);
  });
});

describe("streak and prompt", () => {
  const today = "2026-10-08";

  it("knows 8 Oct 2026 is Thursday", () => {
    expect(weekdayName(today)).toBe("Thu");
    expect(formatHeadingDate(today)).toBe("Thursday, 8 Oct");
  });

  it("counts the template streak, skipping an unticked today", () => {
    const days = emptyDays();
    days.Mon = true;
    days.Tue = true;
    days.Wed = true;
    expect(streakFromDays(dayFlags(days), today)).toBe(3);
    days.Thu = true;
    expect(streakFromDays(dayFlags(days), today)).toBe(4);
    expect(streakFromDays(WEEKDAYS.map(() => true), "2026-10-11")).toBe(7);
    expect(streakFromDays(dayFlags(emptyDays()), "2026-10-05")).toBe(0);
  });

  it("prefers the Notion formula text when it is present", () => {
    const page: NotionPage = {
      id: HABITS,
      properties: {
        Habit: { type: "title", title: [{ plain_text: "Walk 10 minutes" }] },
        Mon: { type: "checkbox", checkbox: true },
        Streak: { type: "formula", formula: { type: "string", string: "🔥 5 days" } },
      },
    };
    expect(pageToHabit(page, today).streak).toBe(5);
  });

  it("fills the weekly prompt with journal entries and drops the placeholder", () => {
    const entries: JournalEntry[] = [
      { id: "1", title: "A good chat", date: "2026-10-07", mood: "🙂 Good", entry: "Called Mum. Walked after dinner." },
      { id: "2", title: "Old", date: "2026-09-01", mood: "😐 Okay", entry: "This is too old to include." },
    ];
    const prompt = fillWeeklyPrompt(entries, today);
    expect(prompt).toContain("**Mood trend:**");
    expect(prompt).toContain("Called Mum. Walked after dinner.");
    expect(prompt).not.toContain("[PASTE YOUR LAST 7 JOURNAL ENTRIES HERE]");
    expect(prompt).not.toContain("too old");
    expect(WEEKLY_PROMPT).toContain("[PASTE YOUR LAST 7 JOURNAL ENTRIES HERE]");
  });
});

describe("updates", () => {
  it("treats a missing release as no update", async () => {
    const info = await checkForUpdate(memoryCache(), async () => new Response("missing", { status: 404 }));
    expect(info.updateAvailable).toBe(false);
    expect(info.current).toBe(APP_VERSION);
  });

  it("shows a newer vX.Y.Z and parses the changelog", async () => {
    const info = await checkForUpdate(memoryCache(), async (url) => {
      expect(url).toBe(GITHUB_RELEASES_API);
      return new Response(JSON.stringify({
        tag_name: "v1.2.0",
        published_at: "2026-10-08T09:00:00Z",
        html_url: `${GITHUB_URL}/releases/tag/v1.2.0`,
        body: ["### Habits", "- See your best streak next to this week's", "### Fix", "- Tasks load faster from Notion"].join("\n"),
      }));
    });
    expect(info.updateAvailable).toBe(true);
    expect(info.latest).toBe("1.2.0");
    expect(info.notes.map((note) => note.tag)).toEqual(["Habits", "Fix"]);
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("0.9.0", "1.0.0")).toBe(false);
  });

  it("fails silently when the release check cannot connect", async () => {
    const info = await checkForUpdate(memoryCache(), async () => {
      throw new Error("offline");
    });
    expect(info.updateAvailable).toBe(false);
  });

  it("parses labelled bullets", () => {
    const notes = parseReleaseNotes("- **Journal:** Drafts are kept if you close the app mid-entry");
    expect(notes).toEqual([{ tag: "Journal", text: "Drafts are kept if you close the app mid-entry" }]);
  });
});

describe("public repo hygiene", () => {
  it("matches package.json version 1.0.0", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
    expect(pkg.version).toBe("1.0.0");
    expect(APP_VERSION).toBe("1.0.0");
  });

  it("keeps netlify.toml free of schedules and extra build hooks", () => {
    const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
    expect(toml).toContain('command = "npm run build"');
    expect(toml).toContain('publish = "dist"');
    expect(toml).toContain('directory = "netlify/functions"');
    expect(toml).toContain("timeout = 10");
    expect(toml).not.toMatch(/^\s*schedule\s*=/im);
    expect(toml).not.toMatch(/build_hooks/i);
  });

  it("contains no private ids, tokens, staff names or business names", () => {
    const words = [
      "vik" + "ram",
      "dev" + "endra",
      "vish" + "nu",
      "foun" + "der",
      "pass" + "key",
      "web" + "authn",
      "staff-" + "tasks",
      "x" + "ai",
      "gum" + "road",
      "ntn" + "_",
      "54663" + "e9e",
      "8e78c" + "2e2",
      "be312" + "874",
      "5d53d" + "071",
      "6569c" + "676",
      "ab8a4" + "6af",
      "3fe07" + "7d8",
    ];
    const banned = [
      ...words.map((word) => new RegExp(word, "i")),
      /(?:^|[^a-z])sk-[a-z0-9]/i,
      new RegExp("[A-Z0-9._%+-]+" + "@" + "[A-Z0-9.-]+\\.[A-Z]{2,}", "i"),
    ];
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(text)) hits.push(`${relative(ROOT, file)} matched ${pattern}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const skip = new Set(["node_modules", "dist", ".netlify", ".git"]);
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx|js|md|toml|json|css|html|svg|txt)$/.test(name) && name !== "package-lock.json") files.push(path);
  }
  return files;
}

describe("hash", () => {
  it("derives a stable session secret", () => {
    const secret = deriveSessionSecret("secret-phrase");
    expect(secret).toBe(createHash("sha256").update("life-os-session:secret-phrase").digest("base64url"));
  });
});
