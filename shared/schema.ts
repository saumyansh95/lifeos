import type { DbKey } from "./types";

/**
 * Property names and types read from the public Life OS template
 * (Tasks, Habits, Journal, and the Summaries database on the Weekly Summary page).
 *
 * The Weekly Summary database is titled "Summaries". Discovery accepts that
 * title and "Weekly Summary", and the app always labels it Weekly Summary.
 */
export type PropertySpec = {
  name: string;
  types: string[];
  options?: string[];
};

export type DatabaseSpec = {
  key: DbKey;
  label: string;
  /** Lowercase titles, first match wins. */
  titles: string[];
  noun: { one: string; many: string };
  required: PropertySpec[];
};

export const DATABASES: DatabaseSpec[] = [
  {
    key: "tasks",
    label: "Tasks",
    titles: ["tasks"],
    noun: { one: "task", many: "tasks" },
    required: [
      { name: "Name", types: ["title"] },
      {
        name: "Status",
        types: ["status", "select"],
        options: ["Not started", "In progress", "Done"],
      },
      {
        name: "List",
        types: ["select"],
        options: ["Today", "This Week", "Someday"],
      },
      { name: "Due", types: ["date"] },
    ],
  },
  {
    key: "habits",
    label: "Habits",
    titles: ["habits"],
    noun: { one: "habit", many: "habits" },
    required: [
      { name: "Habit", types: ["title"] },
      { name: "Mon", types: ["checkbox"] },
      { name: "Tue", types: ["checkbox"] },
      { name: "Wed", types: ["checkbox"] },
      { name: "Thu", types: ["checkbox"] },
      { name: "Fri", types: ["checkbox"] },
      { name: "Sat", types: ["checkbox"] },
      { name: "Sun", types: ["checkbox"] },
    ],
  },
  {
    key: "journal",
    label: "Journal",
    titles: ["journal"],
    noun: { one: "entry", many: "entries" },
    required: [
      { name: "Title", types: ["title"] },
      { name: "Date", types: ["date"] },
      {
        name: "Mood",
        types: ["select"],
        options: ["😄 Great", "🙂 Good", "😐 Okay", "😕 Low", "😩 Rough"],
      },
      { name: "Entry", types: ["rich_text"] },
    ],
  },
  {
    key: "weekly",
    label: "Weekly Summary",
    titles: ["summaries", "weekly summary"],
    noun: { one: "summary", many: "summaries" },
    required: [
      { name: "Week", types: ["title"] },
      { name: "Week ending", types: ["date"] },
      { name: "Takeaway", types: ["rich_text"] },
    ],
  },
];

export function databaseSpec(key: DbKey): DatabaseSpec {
  const spec = DATABASES.find((item) => item.key === key);
  if (!spec) throw new Error(`Unknown database ${key}`);
  return spec;
}

export type NormalizedProp = {
  type: string;
  options: string[];
};

export function missingRequired(
  properties: Record<string, NormalizedProp>,
  spec: DatabaseSpec,
): string[] {
  const missing: string[] = [];
  for (const req of spec.required) {
    const prop = properties[req.name];
    const type = prop?.type === "text" ? "rich_text" : prop?.type;
    if (!prop || !type || !req.types.includes(type)) {
      missing.push(req.name);
      continue;
    }
    for (const option of req.options ?? []) {
      if (!prop.options.includes(option)) {
        missing.push(`${req.name} option “${option}”`);
      }
    }
  }
  return missing;
}

export function countLabel(spec: DatabaseSpec, count: number, ready: boolean, found: boolean): string {
  if (!found) return "Not found";
  if (!ready) return "Missing property";
  const word = count === 1 ? spec.noun.one : spec.noun.many;
  return `${count} ${word}`;
}
