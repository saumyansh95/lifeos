import { useState } from "react";
import { formatHeadingDate } from "../shared/dates";
import { fillWeeklyPrompt } from "../shared/prompt";
import { displayVersion } from "../shared/semver";
import type { Habit, HomePayload, JournalEntry, SetupReport, Task, TaskList, UpdateInfo, Weekday } from "../shared/types";
import { AI_TOOLS, LISTS, MOODS } from "../shared/types";
import { APP_VERSION, GITHUB_URL, TEMPLATE_DUPLICATE_URL } from "../shared/version";
import { AlertIcon, CheckIcon, CloseIcon, FlameIcon, HabitsIcon, JournalIcon, KeyIcon, LeafMark, PlusIcon, TasksIcon, WeekIcon } from "./icons";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function LoginScreen({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (password: string, keep: boolean) => void;
  error: string | null;
  busy: boolean;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);

  return (
    <form
      className="narrow login"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(password, keep);
      }}
    >
      <div className="login-main">
        <div className="logo-badge">
          <LeafMark />
        </div>
        <h1>Welcome back</h1>
        <p className="lede">Enter your app password to open Life OS.</p>
        <label className="field" htmlFor="password">
          App password
        </label>
        <div className="password">
          <input
            id="password"
            type={show ? "text" : "password"}
            className={show ? "plain" : undefined}
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="button" className="show" onClick={() => setShow((value) => !value)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <label className="checkline">
          <input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} />
          Keep me signed in on this phone
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          Unlock
        </button>
      </div>
      <div className="help">
        <KeyIcon />
        <p>
          <strong>Forgot it?</strong> It's the password you chose when you set up Life OS on Netlify. You can change it any time in your Netlify site settings, under <strong>Environment variables</strong>.
        </p>
      </div>
    </form>
  );
}

function typeIcon(key: SetupReport["databases"][number]["key"]) {
  if (key === "tasks") return <TasksIcon />;
  if (key === "habits") return <HabitsIcon />;
  if (key === "journal") return <JournalIcon />;
  return <WeekIcon />;
}

function fixCopy(report: SetupReport): { title: string; paragraphs: string[] } | null {
  const missing = report.databases.filter((row) => !row.ready);
  if (!report.tokenFound || missing.length === 0) return null;
  const properties = missing.flatMap((row) => row.missingProperties.map((name) => `${row.label}: ${name}`));
  if (properties.length) {
    return {
      title: "A property name doesn't match the template",
      paragraphs: [
        `${properties.join(", ")}.`,
        "Open that database in your duplicated Life OS page and add the missing property with the same name and type.",
      ],
    };
  }
  if (missing.length === 1) {
    return {
      title: `Almost there: ${missing[0].label} is hidden`,
      paragraphs: [
        "Life OS can see some pages but not this one. Usually this means the whole Life OS page isn't shared with your integration yet.",
        "Open your Life OS page in Notion → ••• → Connections → pick your integration.",
      ],
    };
  }
  return {
    title: "Some parts are still hidden",
    paragraphs: [
      `Life OS can't see ${missing.map((row) => row.label).join(", ")}.`,
      "Open your Life OS page in Notion → ••• → Connections → pick your integration.",
    ],
  };
}

export function SetupScreen({
  report,
  busy,
  onRefresh,
  onSkip,
  onOpen,
}: {
  report: SetupReport;
  busy: boolean;
  onRefresh: () => void;
  onSkip: () => void;
  onOpen: () => void;
}) {
  const ready = report.foundCount === report.total && report.tokenFound;
  const fix = fixCopy(report);
  return (
    <section className={ready ? "narrow setup ready" : "narrow setup"}>
      <div>
        <div className="brand">
          <LeafMark />
          Life OS
          <small className="desktop-only">v{APP_VERSION} · first run</small>
        </div>
        <h1 style={{ marginTop: 18 }}>{ready ? "Your Life OS is ready." : "Checking your Notion"}</h1>
        <p className="lede">
          {ready
            ? "We checked your Notion and found everything. From now on, your tasks, habits and journal show up here, and every change goes straight back to your Notion."
            : "Life OS is looking for the four parts of your template. This only happens once."}
        </p>
        {ready ? (
          <div className="ready-points">
            <div className="point">
              <span className="tick soft"><CheckIcon /></span>
              <div>
                <strong>Your template copy</strong>
                <p>Life OS was duplicated into your Notion.</p>
              </div>
            </div>
            <div className="point">
              <span className="tick soft"><CheckIcon /></span>
              <div>
                <strong>Your Notion token</strong>
                <p>Added on Netlify when you deployed. Kept on your site, never shown here.</p>
              </div>
            </div>
            <div className="point">
              <span className="tick soft"><CheckIcon /></span>
              <div>
                <strong>Your Life OS page is shared</strong>
                <p>Your integration can see Tasks, Habits, Journal and Weekly Summary.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div>
        <div className={report.tokenFound ? "token" : "token bad"}>
          <span className="tick">{report.tokenFound ? <CheckIcon /> : <AlertIcon />}</span>
          <div>
            <strong>{report.tokenFound ? "Notion token found" : "Notion token not found"}</strong>
            <p>
              {report.tokenFound
                ? "Life OS can talk to your Notion."
                : report.tokenError || "Add NOTION_TOKEN in Netlify → Site configuration → Environment variables, then redeploy."}
            </p>
          </div>
        </div>
        {ready ? <p className="lede" style={{ marginTop: 0 }}>All four parts of your template were found.</p> : null}
        <div className="card rows">
          {report.databases.map((row) => (
            <div className="row" key={row.key}>
              <span className={`type-icon ${row.key}`}>{typeIcon(row.key)}</span>
              <div className="grow">
                <div className="name">{row.label}</div>
              </div>
              <div className={row.ready ? "meta" : "meta warn"}>{row.countLabel}</div>
              {row.ready ? (
                <span className="tick"><CheckIcon /></span>
              ) : (
                <span className="warn-icon"><AlertIcon /></span>
              )}
            </div>
          ))}
        </div>
        {ready ? <p className="found-line desktop-only">Found Tasks, Habits, Journal and Weekly Summary</p> : null}
        {fix ? (
          <div className="notice">
            <strong>{fix.title}</strong>
            {fix.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}
        {ready ? (
          <button className="btn" type="button" onClick={onOpen}>
            Open Life OS →
          </button>
        ) : (
          <button className="btn" type="button" onClick={onRefresh} disabled={busy}>
            {busy ? "Checking…" : "Check again"}
          </button>
        )}
        {ready ? (
          <p className="footer-note">Tip: on your phone, add Life OS to your Home Screen so it opens like an app.</p>
        ) : (
          <p className="footer-note phone-foot">
            {report.foundCount} of {report.total} found · you can also{" "}
            <button type="button" className="linkish" onClick={onSkip}>
              skip and add it later
            </button>
          </p>
        )}
      </div>
    </section>
  );
}

export function UpdateBanner({ info, onOpen, onDismiss }: { info: UpdateInfo; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="banner">
      <span className="tick" style={{ width: 22, height: 22 }}><LeafMark /></span>
      <div className="grow">
        <strong>New version available: Life OS {displayVersion(info.latest || "")}</strong>
        <div className="links">
          <button type="button" className="linkish" onClick={onOpen}>What's new</button>
          <span>·</span>
          <button type="button" className="linkish" onClick={onOpen}>How to update</button>
        </div>
      </div>
      <button type="button" className="icon-btn" aria-label="Dismiss update" onClick={onDismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}

export function UpdateSheet({ info, onClose }: { info: UpdateInfo; onClose: () => void }) {
  return (
    <div className="sheet-back" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-labelledby="update-title" onClick={(event) => event.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-top">
          <h2 id="update-title">Life OS {displayVersion(info.latest || "")}</h2>
          <span className="you-are">You're on {displayVersion(info.current)}</span>
        </div>
        <p className="released">{info.releasedLabel}</p>
        <div className="eyebrow">What's new</div>
        <div className="card notes">
          {info.notes.length ? (
            info.notes.map((note) => (
              <div className="note" key={`${note.tag}-${note.text}`}>
                <span className={tagClass(note.tag)}>{note.tag}</span>
                <span>{note.text}</span>
              </div>
            ))
          ) : (
            <div className="note">A new version of Life OS is ready.</div>
          )}
        </div>
        <div className="eyebrow">How to update</div>
        <ol className="steps">
          <li><span className="num">1</span><span>Open your copy of Life OS on GitHub.</span></li>
          <li>
            <span className="num">2</span>
            <span>Tap <span className="pill-btn">Sync fork</span>, then <span className="pill-btn">Update branch</span>.</span>
          </li>
          <li><span className="num">3</span><span>That's it. Netlify sees the change and redeploys on its own, in about 2 minutes. Then reopen Life OS.</span></li>
        </ol>
        <p className="lock-note">Your tasks, habits and journal live in your Notion. Updating never touches them.</p>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Later</button>
          <a className="btn" href={GITHUB_URL} target="_blank" rel="noreferrer">Open GitHub ↗</a>
        </div>
      </div>
    </div>
  );
}

function tagClass(tag: string): string {
  const name = tag.toLowerCase();
  if (name.includes("journal")) return "tag journal";
  if (name.includes("fix")) return "tag fix";
  return "tag";
}

export function TodayScreen({
  home,
  banner,
  onDismissBanner,
  onOpenUpdate,
  onAddTask,
  onToggleTask,
  onToggleHabit,
  onJournal,
  onCopy,
  copied,
}: {
  home: HomePayload;
  banner: UpdateInfo | null;
  onDismissBanner: () => void;
  onOpenUpdate: () => void;
  onAddTask: (title: string) => void;
  onToggleTask: (task: Task) => void;
  onToggleHabit: (habit: Habit) => void;
  onJournal: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const [draft, setDraft] = useState("");
  const todayTasks = home.tasks.filter((task) => task.list === "Today");
  const left = todayTasks.filter((task) => task.status !== "Done").length;
  const done = todayTasks.length - left;
  const habitsDone = home.habits.filter((habit) => habit.checkedToday).length;
  const entry = home.journal.find((item) => item.date === home.today);

  return (
    <div>
      <div className="today-head">
        <div>
          <div className="kicker">{formatHeadingDate(home.today)}</div>
          <h1>Today</h1>
        </div>
      </div>
      {banner?.updateAvailable ? <UpdateBanner info={banner} onOpen={onOpenUpdate} onDismiss={onDismissBanner} /> : null}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          onAddTask(draft.trim());
          setDraft("");
        }}
      >
        <input
          aria-label="Add a task for today"
          placeholder="Add a task for today..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="add" type="submit" aria-label="Add task">
          <PlusIcon />
        </button>
      </form>
      <div className="section-label">
        TASKS <span>{left} left · {done} done</span>
      </div>
      <div className="card">
        {todayTasks.length === 0 ? <p className="row">Nothing in Today yet.</p> : todayTasks.map((task) => (
          <button key={task.id} type="button" className={task.status === "Done" ? "task done" : "task"} onClick={() => onToggleTask(task)}>
            <span className={task.status === "Done" ? "circle on" : "circle"}>{task.status === "Done" ? <CheckIcon /> : null}</span>
            <span className="title">{task.title}</span>
            {task.due === home.today && task.status !== "Done" ? <span className="pill">due today</span> : null}
          </button>
        ))}
      </div>
      <div className="section-label">
        HABITS <span>{habitsDone} of {home.habits.length} today</span>
      </div>
      <div className="card">
        {home.habits.length === 0 ? <p className="row">No habits yet.</p> : home.habits.map((habit) => (
          <button key={habit.id} type="button" className="habit" onClick={() => onToggleHabit(habit)}>
            <span className={habit.checkedToday ? "box on" : "box"}>{habit.checkedToday ? <CheckIcon /> : null}</span>
            <span className="title">{habit.title}</span>
            {habit.streak > 0 ? (
              <span className="streak"><FlameIcon /> {habit.streak} {habit.streak === 1 ? "day" : "days"}</span>
            ) : null}
          </button>
        ))}
      </div>
      <button type="button" className="journal-card" onClick={onJournal}>
        <span className="book"><JournalIcon /></span>
        <span className="grow">
          <strong>{entry ? entry.title || "Today's journal" : "Write today's journal"}</strong>
          <small>{entry ? "Open and add a few more lines if you like." : "How was today? A few lines is enough."}</small>
        </span>
        <span className="chev">›</span>
      </button>
      <div className="copy-row">
        <button type="button" className="chip" onClick={onCopy}>
          <LeafMark /> {copied ? "Copied" : "Copy weekly summary prompt"}
        </button>
        <small>Paste it into any free AI chat</small>
      </div>
    </div>
  );
}

export function TasksScreen({
  tasks,
  onAdd,
  onToggle,
  onMove,
}: {
  tasks: Task[];
  onAdd: (title: string, list: TaskList) => void;
  onToggle: (task: Task) => void;
  onMove: (task: Task, list: TaskList) => void;
}) {
  const [title, setTitle] = useState("");
  const [list, setList] = useState<TaskList>("Today");
  return (
    <div>
      <div className="screen-head"><h1>Tasks</h1></div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim(), list);
          setTitle("");
        }}
      >
        <input aria-label="New task" placeholder="Add a task..." value={title} onChange={(event) => setTitle(event.target.value)} />
        <button className="add" type="submit" aria-label="Add task"><PlusIcon /></button>
      </form>
      <label className="field">
        List
        <select value={list} onChange={(event) => setList(event.target.value as TaskList)} style={{ marginTop: 6 }}>
          {LISTS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      {LISTS.map((group) => {
        const rows = tasks.filter((task) => task.list === group);
        return (
          <div className="group" key={group}>
            <h2>{group.toUpperCase()}</h2>
            <div className="card">
              {rows.length === 0 ? <p className="row">Nothing here.</p> : rows.map((task) => (
                <div className="row" key={task.id}>
                  <button type="button" className={task.status === "Done" ? "task done" : "task"} onClick={() => onToggle(task)}>
                    <span className={task.status === "Done" ? "circle on" : "circle"}>{task.status === "Done" ? <CheckIcon /> : null}</span>
                    <span className="title">{task.title}</span>
                  </button>
                  <select aria-label={`Move ${task.title}`} value={task.list} onChange={(event) => onMove(task, event.target.value as TaskList)}>
                    {LISTS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HabitsScreen({
  habits,
  weekday,
  onToggle,
  onAdd,
}: {
  habits: Habit[];
  weekday: Weekday;
  onToggle: (habit: Habit, day: Weekday) => void;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <div>
      <div className="screen-head"><h1>Habits</h1></div>
      <p className="lede">Tick the day you did it. Streaks follow this week's boxes in your template.</p>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim());
          setTitle("");
        }}
      >
        <input aria-label="New habit" placeholder="Add a small habit..." value={title} onChange={(event) => setTitle(event.target.value)} />
        <button className="add" type="submit" aria-label="Add habit"><PlusIcon /></button>
      </form>
      {habits.map((habit) => (
        <div className="card" key={habit.id} style={{ marginBottom: 12 }}>
          <div className="habit">
            <strong className="title">{habit.title}</strong>
            {habit.streak > 0 ? <span className="streak"><FlameIcon /> {habit.streak} {habit.streak === 1 ? "day" : "days"}</span> : null}
          </div>
          <div className="weekdays">
            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as Weekday[]).map((day) => (
              <button key={day} type="button" className={habit.days[day] ? "on" : undefined} onClick={() => onToggle(habit, day)} aria-pressed={habit.days[day]}>
                <small>{day === weekday ? "•" : ""}{day.slice(0, 1)}</small>
                {habit.days[day] ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const DRAFT_KEY = "lifeos-journal-draft";

export function JournalScreen({
  entries,
  today,
  onSave,
}: {
  entries: JournalEntry[];
  today: string;
  onSave: (input: { id?: string; title: string; date: string; mood: string; entry: string }) => void;
}) {
  const existing = entries.find((entry) => entry.date === today);
  const stored = readDraft();
  const [title, setTitle] = useState(existing?.title || stored.title || "");
  const [mood, setMood] = useState(existing?.mood || stored.mood || MOODS[1]);
  const [entry, setEntry] = useState(existing?.entry || stored.entry || "");
  const [date, setDate] = useState(existing?.date || today);

  function remember(next: { title: string; mood: string; entry: string }) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  }

  return (
    <div>
      <div className="screen-head"><h1>Journal</h1></div>
      <p className="lede">A few honest lines. Your diary is never rewritten.</p>
      <form
        className="stack"
        style={{ marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ id: existing?.id, title: title.trim() || "Journal", date, mood, entry });
          localStorage.removeItem(DRAFT_KEY);
        }}
      >
        <label>Date<input className="text-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>
          Mood
          <select value={mood} onChange={(event) => { setMood(event.target.value); remember({ title, mood: event.target.value, entry }); }}>
            {MOODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Title<input className="text-input" value={title} placeholder="Optional" onChange={(event) => { setTitle(event.target.value); remember({ title: event.target.value, mood, entry }); }} /></label>
        <label>Entry<textarea rows={5} value={entry} placeholder="How was today?" onChange={(event) => { setEntry(event.target.value); remember({ title, mood, entry: event.target.value }); }} /></label>
        <button className="btn" type="submit">Save to Notion</button>
      </form>
      <div className="section-label">RECENT</div>
      <div className="card">
        {entries.length === 0 ? <p className="row">No entries yet.</p> : entries.map((item) => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.title || "Untitled"}</strong>
              <div className="meta">{[item.date, item.mood].filter(Boolean).join(" · ")}</div>
              <p>{item.entry}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function readDraft(): { title?: string; mood?: string; entry?: string } {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as { title?: string; mood?: string; entry?: string };
  } catch {
    return {};
  }
}

export function WeekScreen({
  home,
  onSave,
  onCopy,
  copied,
  prompt,
}: {
  home: HomePayload;
  onSave: (input: { week: string; weekEnding: string | null; takeaway: string; aiUsed: string | null }) => void;
  onCopy: () => void;
  copied: boolean;
  prompt: string | null;
}) {
  const [week, setWeek] = useState(`Week of ${formatHeadingDate(home.today)}`);
  const [takeaway, setTakeaway] = useState("");
  const [aiUsed, setAiUsed] = useState<string>("");
  const preview = fillWeeklyPrompt(home.journal, home.today);
  return (
    <div>
      <div className="screen-head"><h1>Week</h1></div>
      <p className="lede">Copy the prompt, paste it into any free AI chat, then save the answer here if you want.</p>
      <button type="button" className="btn" onClick={onCopy}>{copied ? "Copied" : "Copy weekly summary prompt"}</button>
      {prompt ? <pre className="prompt-box">{prompt}</pre> : null}
      <div className="section-label">IN THIS PROMPT</div>
      <div className="card">
        {preview.includes("(No journal entries") ? <p className="row">No entries from the last 7 days.</p> : (
          <pre className="prompt-box">{preview.split("My entries:\n")[1]}</pre>
        )}
      </div>
      <form
        className="stack"
        style={{ marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!week.trim()) return;
          onSave({ week: week.trim(), weekEnding: home.today, takeaway, aiUsed: aiUsed || null });
          setTakeaway("");
        }}
      >
        <label>Week name<input className="text-input" value={week} onChange={(event) => setWeek(event.target.value)} /></label>
        <label>
          AI used
          <select value={aiUsed} onChange={(event) => setAiUsed(event.target.value)}>
            <option value="">Skip</option>
            {AI_TOOLS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Takeaway<textarea rows={4} value={takeaway} placeholder="Paste the answer" onChange={(event) => setTakeaway(event.target.value)} /></label>
        <button className="btn" type="submit">Save summary</button>
      </form>
      <div className="section-label">SAVED</div>
      <div className="card">
        {home.summaries.length === 0 ? <p className="row">No summaries yet.</p> : home.summaries.map((summary) => (
          <div className="row" key={summary.id}>
            <div>
              <strong>{summary.week}</strong>
              <p>{summary.takeaway}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuideScreen({ onBack }: { onBack: () => void }) {
  return (
    <article className="narrow guide">
      <div className="brand">
        <LeafMark /> Life OS · Guide
      </div>
      <p className="kicker" style={{ marginTop: 18 }}>Guide › 2. Host it</p>
      <h1>Host Life OS free on Netlify in 5 minutes</h1>
      <p className="lede">No coding. Everything you set up stays yours.</p>
      <div className="needs">
        <span>You need: free Notion</span>
        <span>free GitHub</span>
        <span>free Netlify</span>
      </div>
      <div className="eyebrow">In Notion</div>
      <ol>
        <li>
          <span className="num">1</span>
          <div>
            <strong>Duplicate the Life OS template and connect an integration.</strong>
            <p>Open the template, tap Duplicate, then at notion.so/profile/integrations create an internal integration. On your Life OS page: ••• → Connections → pick it. Copy the token.</p>
          </div>
        </li>
      </ol>
      <div className="eyebrow">On GitHub and Netlify</div>
      <ol>
        <li>
          <span className="num">2</span>
          <div>
            <strong>Fork <a href={GITHUB_URL}>saumyansh95/lifeos</a> on GitHub.</strong>
            <p>Use Fork, not “Use this template”, so updates are one tap.</p>
          </div>
        </li>
        <li>
          <span className="num">3</span>
          <div>
            <strong>In Netlify: Add new site, then Import from Git, and pick your fork.</strong>
            <p>Build settings are already filled in for you.</p>
          </div>
        </li>
        <li>
          <span className="num">4</span>
          <div>
            <strong>On that screen add NOTION_TOKEN and APP_PASSWORD.</strong>
            <p>Token from step 1. The password can be anything you like.</p>
          </div>
        </li>
        <li>
          <span className="num">5</span>
          <div>
            <strong>Deploy, open the site, and check the setup ticks.</strong>
            <p>Life OS looks for Tasks, Habits, Journal and Weekly Summary.</p>
          </div>
        </li>
        <li>
          <span className="num">6</span>
          <div>
            <strong>Add it to your home screen.</strong>
            <p>On iPhone: Share → Add to Home Screen. On Android: menu → Install app or Add to Home screen.</p>
          </div>
        </li>
      </ol>
      <p className="callout amber">Free Netlify sites stay awake, so Life OS opens instantly.</p>
      <p className="callout green">Updates: open your fork, tap Sync fork, then Update branch. Netlify rebuilds by itself.</p>
      <p className="footer-note"><a href={TEMPLATE_DUPLICATE_URL}>Open the Notion template</a></p>
      <p className="footer-note">Prefer Render? Guide coming later</p>
      <button type="button" className="btn ghost" onClick={onBack}>Back</button>
    </article>
  );
}
