export const LISTS = ["Today", "This Week", "Someday"] as const;
export type TaskList = (typeof LISTS)[number];

export const STATUSES = ["Not started", "In progress", "Done"] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MOODS = ["😄 Great", "🙂 Good", "😐 Okay", "😕 Low", "😩 Rough"] as const;
export type Mood = (typeof MOODS)[number];

export const AI_TOOLS = ["ChatGPT", "Claude", "Grok", "Gemini", "Other"] as const;
export type AiTool = (typeof AI_TOOLS)[number];

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  list: TaskList;
  due: string | null;
};

export type Habit = {
  id: string;
  title: string;
  why: string;
  days: Record<Weekday, boolean>;
  streak: number;
  checkedToday: boolean;
};

export type JournalEntry = {
  id: string;
  title: string;
  date: string | null;
  mood: string | null;
  entry: string;
};

export type Summary = {
  id: string;
  week: string;
  weekEnding: string | null;
  takeaway: string;
  aiUsed: string | null;
};

export type SetupDatabase = {
  key: DbKey;
  label: string;
  found: boolean;
  ready: boolean;
  count: number;
  countLabel: string;
  missingProperties: string[];
};

export type SetupReport = {
  tokenFound: boolean;
  tokenError: string | null;
  databases: SetupDatabase[];
  foundCount: number;
  total: 4;
};

export type HomePayload = {
  today: string;
  weekday: Weekday;
  tasks: Task[];
  habits: Habit[];
  journal: JournalEntry[];
  summaries: Summary[];
};

export type ReleaseNote = {
  tag: string;
  text: string;
};

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releasedAt: string | null;
  releasedLabel: string;
  notes: ReleaseNote[];
  htmlUrl: string;
};

export type DbKey = "tasks" | "habits" | "journal" | "weekly";
