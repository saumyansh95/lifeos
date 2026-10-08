import { useEffect, useMemo, useState } from "react";
import { fillWeeklyPrompt } from "../shared/prompt";
import type { Habit, HomePayload, SetupReport, Task, TaskList, UpdateInfo, Weekday } from "../shared/types";
import { APP_VERSION } from "../shared/version";
import { createHttpClient, mockEnabled, type Client } from "./api";
import { HabitsIcon, JournalIcon, LeafMark, SunIcon, TasksIcon, WeekIcon } from "./icons";
import { createMockClient } from "./mock";
import {
  GuideScreen,
  HabitsScreen,
  JournalScreen,
  LoginScreen,
  SetupScreen,
  TasksScreen,
  TodayScreen,
  UpdateSheet,
  WeekScreen,
  copyText,
} from "./screens";

type Phase = "loading" | "login" | "setup" | "app";
type Tab = "today" | "tasks" | "habits" | "journal" | "week";

const UPDATE_KEY = "lifeos-update-cache";
const HIDE_KEY = "lifeos-update-hide";
const SETUP_KEY = "lifeos-setup";

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function go(next: string) {
    window.history.pushState(null, "", next);
    setPath(next);
  }

  if (path === "/guide") return <GuideScreen onBack={() => go("/")} />;
  return <Shell onGuide={() => go("/guide")} />;
}

function Shell({ onGuide }: { onGuide: () => void }) {
  const today = useMemo(todayIso, []);
  const params = new URLSearchParams(window.location.search);
  const forced = mockEnabled() ? params.get("screen") : null;
  const client = useMemo<Client>(() => (mockEnabled() ? createMockClient(today) : createHttpClient()), [today]);
  const [phase, setPhase] = useState<Phase>(forced === "login" ? "login" : forced === "setup" ? "setup" : "loading");
  const [tab, setTab] = useState<Tab>("today");
  const [report, setReport] = useState<SetupReport | null>(null);
  const [home, setHome] = useState<HomePayload | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [sheet, setSheet] = useState(forced === "update");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (forced === "login") return;
    if (forced === "setup") {
      void loadSetup();
      return;
    }
    if (forced === "today" || forced === "update") {
      void enterApp();
      return;
    }
    void boot();
    // The client is stable for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function boot() {
    try {
      const ok = await client.session();
      if (!ok) {
        setPhase("login");
        return;
      }
      await afterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Life OS.");
      setPhase("login");
    }
  }

  async function afterLogin() {
    const next = await client.setup();
    setReport(next);
    const ack = localStorage.getItem(SETUP_KEY);
    if (next.foundCount === next.total || ack === "skip") {
      if (next.foundCount === next.total) localStorage.setItem(SETUP_KEY, "ready");
      await enterApp();
      return;
    }
    setPhase("setup");
  }

  async function loadSetup(refresh = false) {
    setBusy(true);
    try {
      setReport(await client.setup(refresh));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check Notion.");
    } finally {
      setBusy(false);
    }
  }

  async function enterApp() {
    setPhase("app");
    try {
      setHome(await client.home(today));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your Notion.");
    }
    void loadUpdate();
  }

  async function loadUpdate() {
    try {
      const raw = localStorage.getItem(UPDATE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; info: UpdateInfo };
        if (Date.now() - cached.at < 24 * 60 * 60 * 1000) {
          setUpdate(hidden(cached.info) ? null : cached.info);
          return;
        }
      }
    } catch {
      // Ignore a broken cache and check again.
    }
    try {
      const info = await client.update();
      localStorage.setItem(UPDATE_KEY, JSON.stringify({ at: Date.now(), info }));
      setUpdate(hidden(info) ? null : info);
    } catch {
      // Offline, or no release yet. Stay quiet.
    }
  }

  function hidden(info: UpdateInfo): boolean {
    return localStorage.getItem(HIDE_KEY) === info.latest;
  }

  async function onLogin(password: string, keep: boolean) {
    setBusy(true);
    setError(null);
    try {
      await client.login(password, keep);
      await afterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That password doesn't match.");
    } finally {
      setBusy(false);
    }
  }

  async function mutate(run: () => Promise<void>) {
    setError(null);
    try {
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notion couldn't save that.");
    }
  }

  async function copyPrompt() {
    if (!home) return;
    const text = fillWeeklyPrompt(home.journal, home.today);
    const ok = await copyText(text);
    setCopied(true);
    if (!ok) setPrompt(text);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (phase === "loading") return <div className="app-loading">Opening Life OS…</div>;
  if (phase === "login") return <LoginScreen onSubmit={onLogin} error={error} busy={busy} />;
  if (phase === "setup") {
    return report ? (
      <SetupScreen
        report={report}
        busy={busy}
        onRefresh={() => void loadSetup(true)}
        onSkip={() => {
          localStorage.setItem(SETUP_KEY, "skip");
          void enterApp();
        }}
        onOpen={() => {
          localStorage.setItem(SETUP_KEY, "ready");
          void enterApp();
        }}
      />
    ) : (
      <div className="app-loading">Checking your Notion…</div>
    );
  }

  if (!home) return <div className="app-loading">Loading your Notion…</div>;

  return (
    <div className="shell">
      <button type="button" className="avatar floating" aria-label="Account" onClick={() => setMenu((open) => !open)}>
        <LeafMark />
      </button>
      <main>
        {menu ? (
          <div className="menu">
            <button type="button" onClick={() => { setMenu(false); setPhase("setup"); void loadSetup(true); }}>Check Notion</button>
            <button type="button" onClick={() => { setMenu(false); onGuide(); }}>Guide</button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                void client.logout().then(() => setPhase("login"));
              }}
            >
              Lock
            </button>
            <p>Life OS {APP_VERSION}</p>
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {tab === "today" ? (
          <TodayScreen
            home={home}
            banner={update}
            onDismissBanner={() => {
              if (update?.latest) localStorage.setItem(HIDE_KEY, update.latest);
              setUpdate(null);
            }}
            onOpenUpdate={() => setSheet(true)}
            onAddTask={(title) => void mutate(async () => {
              const task = await client.createTask(title, "Today", null);
              setHome({ ...home, tasks: [task, ...home.tasks] });
            })}
            onToggleTask={(task: Task) => void mutate(async () => {
              const next = await client.updateTask(task.id, { status: task.status === "Done" ? "Not started" : "Done" });
              setHome({ ...home, tasks: home.tasks.map((item) => (item.id === task.id ? next : item)) });
            })}
            onToggleHabit={(habit: Habit) => void mutate(async () => {
              const next = await client.updateHabit(habit.id, home.weekday, !habit.checkedToday, home.today);
              setHome({ ...home, habits: home.habits.map((item) => (item.id === habit.id ? next : item)) });
            })}
            onJournal={() => setTab("journal")}
            onCopy={() => void copyPrompt()}
            copied={copied}
          />
        ) : null}
        {tab === "tasks" ? (
          <TasksScreen
            tasks={home.tasks}
            onAdd={(title, list: TaskList) => void mutate(async () => {
              const task = await client.createTask(title, list, null);
              setHome({ ...home, tasks: [task, ...home.tasks] });
            })}
            onToggle={(task) => void mutate(async () => {
              const next = await client.updateTask(task.id, { status: task.status === "Done" ? "Not started" : "Done" });
              setHome({ ...home, tasks: home.tasks.map((item) => (item.id === task.id ? next : item)) });
            })}
            onMove={(task, list) => void mutate(async () => {
              const next = await client.updateTask(task.id, { list });
              setHome({ ...home, tasks: home.tasks.map((item) => (item.id === task.id ? next : item)) });
            })}
          />
        ) : null}
        {tab === "habits" ? (
          <HabitsScreen
            habits={home.habits}
            weekday={home.weekday}
            onAdd={(title) => void mutate(async () => {
              const habit = await client.createHabit(title, "", home.today);
              setHome({ ...home, habits: [...home.habits, habit] });
            })}
            onToggle={(habit, day: Weekday) => void mutate(async () => {
              const next = await client.updateHabit(habit.id, day, !habit.days[day], home.today);
              setHome({ ...home, habits: home.habits.map((item) => (item.id === habit.id ? next : item)) });
            })}
          />
        ) : null}
        {tab === "journal" ? (
          <JournalScreen
            entries={home.journal}
            today={home.today}
            onSave={(input) => void mutate(async () => {
              const entry = await client.saveJournal(input);
              const rest = home.journal.filter((item) => item.id !== entry.id);
              setHome({ ...home, journal: [entry, ...rest] });
            })}
          />
        ) : null}
        {tab === "week" ? (
          <WeekScreen
            home={home}
            copied={copied}
            prompt={prompt}
            onCopy={() => void copyPrompt()}
            onSave={(input) => void mutate(async () => {
              const summary = await client.saveSummary(input);
              setHome({ ...home, summaries: [summary, ...home.summaries] });
            })}
          />
        ) : null}
      </main>
      <nav className="nav">
        <button type="button" className={tab === "today" ? "on" : undefined} onClick={() => setTab("today")}><SunIcon />Today</button>
        <button type="button" className={tab === "tasks" ? "on" : undefined} onClick={() => setTab("tasks")}><TasksIcon />Tasks</button>
        <button type="button" className={tab === "habits" ? "on" : undefined} onClick={() => setTab("habits")}><HabitsIcon />Habits</button>
        <button type="button" className={tab === "journal" ? "on" : undefined} onClick={() => setTab("journal")}><JournalIcon />Journal</button>
        <button type="button" className={tab === "week" ? "on" : undefined} onClick={() => setTab("week")}><WeekIcon />Week</button>
      </nav>
      {sheet && update ? <UpdateSheet info={update} onClose={() => setSheet(false)} /> : null}
    </div>
  );
}
