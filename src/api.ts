import type { Habit, HomePayload, JournalEntry, SetupReport, Summary, Task, TaskList, UpdateInfo, Weekday } from "../shared/types";

export type Client = {
  session(): Promise<boolean>;
  login(password: string, keep: boolean): Promise<void>;
  logout(): Promise<void>;
  setup(refresh?: boolean): Promise<SetupReport>;
  home(today: string): Promise<HomePayload>;
  createTask(title: string, list: TaskList, due: string | null): Promise<Task>;
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "status" | "list" | "due">>): Promise<Task>;
  createHabit(title: string, why: string, today: string): Promise<Habit>;
  updateHabit(id: string, day: Weekday, checked: boolean, today: string): Promise<Habit>;
  saveJournal(input: { id?: string; title: string; date: string; mood: string; entry: string }): Promise<JournalEntry>;
  saveSummary(input: { week: string; weekEnding: string | null; takeaway: string; aiUsed: string | null }): Promise<Summary>;
  update(): Promise<UpdateInfo>;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export function createHttpClient(): Client {
  return {
    async session() {
      const data = await request<{ ok: boolean }>("/api/session");
      return data.ok;
    },
    async login(password, keep) {
      await request("/api/session", { method: "POST", body: JSON.stringify({ password, keep }) });
    },
    async logout() {
      await request("/api/session", { method: "DELETE" });
    },
    setup(refresh = false) {
      return request<SetupReport>(`/api/setup${refresh ? "?refresh=1" : ""}`);
    },
    home(today) {
      return request<HomePayload>(`/api/home?today=${today}`);
    },
    async createTask(title, list, due) {
      const data = await request<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, list, due }),
      });
      return data.task;
    },
    async updateTask(id, patch) {
      const data = await request<{ task: Task }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return data.task;
    },
    async createHabit(title, why, today) {
      const data = await request<{ habit: Habit }>(`/api/habits?today=${today}`, {
        method: "POST",
        body: JSON.stringify({ title, why }),
      });
      return data.habit;
    },
    async updateHabit(id, day, checked, today) {
      const data = await request<{ habit: Habit }>(`/api/habits/${id}?today=${today}`, {
        method: "PATCH",
        body: JSON.stringify({ day, checked }),
      });
      return data.habit;
    },
    async saveJournal(input) {
      if (input.id) {
        const data = await request<{ entry: JournalEntry }>(`/api/journal/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        return data.entry;
      }
      const data = await request<{ entry: JournalEntry }>("/api/journal", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.entry;
    },
    async saveSummary(input) {
      const data = await request<{ summary: Summary }>("/api/summaries", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.summary;
    },
    update() {
      return request<UpdateInfo>("/api/update");
    },
  };
}

export function mockEnabled(): boolean {
  if (import.meta.env.VITE_MOCK === "1") return true;
  return import.meta.env.DEV && new URLSearchParams(location.search).has("mock");
}
