import { shiftIso, weekdayName } from "../shared/dates";
import { displayVersion } from "../shared/semver";
import type { Habit, HomePayload, JournalEntry, SetupReport, Summary, Task, UpdateInfo, Weekday } from "../shared/types";
import { APP_VERSION, GITHUB_URL } from "../shared/version";
import type { Client } from "./api";

function days(on: Weekday[]): Habit["days"] {
  return {
    Mon: on.includes("Mon"),
    Tue: on.includes("Tue"),
    Wed: on.includes("Wed"),
    Thu: on.includes("Thu"),
    Fri: on.includes("Fri"),
    Sat: on.includes("Sat"),
    Sun: on.includes("Sun"),
  };
}

export function createMockClient(today: string): Client {
  let signedIn = false;
  let tasks: Task[] = [
    { id: "task-mum", title: "Call Mum about Sunday lunch", status: "Not started", list: "Today", due: null },
    { id: "task-bill", title: "Pay the electricity bill", status: "Not started", list: "Today", due: today },
    { id: "task-books", title: "Return library books", status: "Done", list: "Today", due: null },
    { id: "task-veg", title: "Buy vegetables for the week", status: "Not started", list: "Today", due: null },
    { id: "task-week", title: "Plan next week's meals", status: "Not started", list: "This Week", due: null },
    { id: "task-some", title: "Mend the garden chair", status: "Not started", list: "Someday", due: null },
  ];
  let habits: Habit[] = [
    { id: "habit-walk", title: "Walk 10 minutes", why: "", days: days(["Mon", "Tue", "Wed", "Thu", "Fri"]), streak: 5, checkedToday: true },
    { id: "habit-read", title: "Read 10 pages", why: "", days: days(["Tue", "Wed", "Thu"]), streak: 3, checkedToday: true },
    { id: "habit-lights", title: "Lights out by 11", why: "", days: days(["Wed"]), streak: 1, checkedToday: false },
  ];
  let journal: JournalEntry[] = [
    { id: "j1", title: "A good chat", date: shiftIso(today, -1), mood: "🙂 Good", entry: "Called Mum about Sunday. Walked after dinner and felt lighter." },
    { id: "j2", title: "Quiet day", date: shiftIso(today, -2), mood: "😐 Okay", entry: "Tired, but I read before bed and slept earlier than usual." },
    { id: "j3", title: "Rain", date: shiftIso(today, -3), mood: "😕 Low", entry: "The afternoon dragged. A short walk still helped." },
  ];
  let summaries: Summary[] = [
    { id: "s1", week: "Week of 28 Sep", weekEnding: shiftIso(today, -10), takeaway: "You kept the walks even on the low days.", aiUsed: "Other" },
    { id: "s2", week: "Week of 21 Sep", weekEnding: shiftIso(today, -17), takeaway: "Small evenings made the week feel kinder.", aiUsed: "Other" },
  ];
  let weeklyFound = false;

  const setup = (): SetupReport => ({
    tokenFound: true,
    tokenError: null,
    foundCount: weeklyFound ? 4 : 3,
    total: 4,
    databases: [
      { key: "tasks", label: "Tasks", found: true, ready: true, count: 12, countLabel: "12 tasks", missingProperties: [] },
      { key: "habits", label: "Habits", found: true, ready: true, count: 3, countLabel: "3 habits", missingProperties: [] },
      { key: "journal", label: "Journal", found: true, ready: true, count: 8, countLabel: "8 entries", missingProperties: [] },
      weeklyFound
        ? { key: "weekly", label: "Weekly Summary", found: true, ready: true, count: summaries.length, countLabel: `${summaries.length} summaries`, missingProperties: [] }
        : { key: "weekly", label: "Weekly Summary", found: false, ready: false, count: 0, countLabel: "Not found", missingProperties: [] },
    ],
  });

  const home = (): HomePayload => {
    const weekday = weekdayName(today);
    return {
      today,
      weekday,
      tasks,
      habits: habits.map((habit) => ({ ...habit, checkedToday: habit.days[weekday] })),
      journal,
      summaries,
    };
  };

  const updateInfo = (): UpdateInfo => ({
    current: APP_VERSION,
    latest: "1.2.0",
    updateAvailable: true,
    releasedAt: "2026-10-08T09:00:00.000Z",
    releasedLabel: "Released 8 Oct · takes about 2 minutes, no coding",
    notes: [
      { tag: "Habits", text: "See your best streak next to this week's" },
      { tag: "Journal", text: "Drafts are kept if you close the app mid-entry" },
      { tag: "Fix", text: "Tasks load faster from Notion" },
    ],
    htmlUrl: `${GITHUB_URL}/releases`,
  });

  return {
    async session() {
      return signedIn;
    },
    async login(password) {
      if (!password.trim()) throw new Error("Enter your app password.");
      signedIn = true;
    },
    async logout() {
      signedIn = false;
    },
    async setup() {
      return setup();
    },
    async home() {
      return home();
    },
    async createTask(title, list, due) {
      const task: Task = { id: `task-${tasks.length + 1}`, title, status: "Not started", list, due };
      tasks = [task, ...tasks];
      return task;
    },
    async updateTask(id, patch) {
      tasks = tasks.map((task) => (task.id === id ? { ...task, ...patch, due: patch.due === undefined ? task.due : patch.due } : task));
      const task = tasks.find((item) => item.id === id);
      if (!task) throw new Error("Unknown task.");
      return task;
    },
    async createHabit(title, why) {
      const habit: Habit = { id: `habit-${habits.length + 1}`, title, why, days: days([]), streak: 0, checkedToday: false };
      habits = [...habits, habit];
      return habit;
    },
    async updateHabit(id, day, checked) {
      habits = habits.map((habit) => {
        if (habit.id !== id) return habit;
        const nextDays = { ...habit.days, [day]: checked };
        const streak = Object.values(nextDays).filter(Boolean).length;
        return { ...habit, days: nextDays, streak, checkedToday: nextDays[weekdayName(today)] };
      });
      const habit = habits.find((item) => item.id === id);
      if (!habit) throw new Error("Unknown habit.");
      return habit;
    },
    async saveJournal(input) {
      if (input.id) {
        journal = journal.map((entry) => (entry.id === input.id ? { ...entry, ...input, id: entry.id } : entry));
        return journal.find((entry) => entry.id === input.id)!;
      }
      const entry: JournalEntry = { id: `j-${journal.length + 1}`, title: input.title, date: input.date, mood: input.mood, entry: input.entry };
      journal = [entry, ...journal];
      return entry;
    },
    async saveSummary(input) {
      const summary: Summary = { id: `s-${summaries.length + 1}`, ...input };
      summaries = [summary, ...summaries];
      weeklyFound = true;
      return summary;
    },
    async update() {
      return updateInfo();
    },
  };
}

export function versionText(): string {
  return displayVersion(APP_VERSION);
}
