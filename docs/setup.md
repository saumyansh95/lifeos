# Set up Life OS

Life OS is a small site you host yourself. Your tasks, habits, journal and weekly summaries stay in your Notion. The site only stores a signed login cookie in the browser, and the Notion token stays in Netlify.

This takes about five minutes. You need free accounts on Notion, GitHub and Netlify.

## 1. Duplicate the template and connect an integration

1. Open the [Life OS template](https://sun-football-e11.notion.site/Life-OS-3f14520002e381119e61d47db1f52361).
2. Tap **Duplicate** and choose your workspace. You should see **Start Here**, **Tasks**, **Habits**, **Journal** and **Weekly Summary**. Weekly Summary contains a database named **Summaries**.
3. Open [notion.so/profile/integrations](https://www.notion.so/profile/integrations) and choose **New integration**.
4. Name it Life OS. Give it permission to read, insert and update content. The template does not need comment access.
5. Copy the internal integration token. You will paste it into Netlify as `NOTION_TOKEN`. It never goes in the Git repo and it is never shown in the app.
6. Open your duplicated Life OS page (the top page, not a single database). Tap **•••**, then **Connections**, and pick the integration. If you connect it only to one database, the other three stay hidden.

The app looks for these properties, with these names and types:

| Database | What the app calls it | Required properties |
| --- | --- | --- |
| Tasks | Tasks | Name (title), Status (status: Not started, In progress, Done), List (select: Today, This Week, Someday), Due (date) |
| Habits | Habits | Habit (title), Mon Tue Wed Thu Fri Sat Sun (checkboxes) |
| Journal | Journal | Title (title), Date (date), Mood (select), Entry (text) |
| Summaries | Weekly Summary | Week (title), Week ending (date), Takeaway (text) |

Mood options in the template are 😄 Great, 🙂 Good, 😐 Okay, 😕 Low and 😩 Rough. Summaries may also have an **AI used** select. Habits may have **Why it matters**, plus formula columns **Streak** and **This week**. Those formulas are optional. When Streak is present, the app shows Notion's number. Otherwise it counts this week's ticks the same way the template does.

If you already know the database IDs you can set `NOTION_TASKS_DB`, `NOTION_HABITS_DB`, `NOTION_JOURNAL_DB` and `NOTION_WEEKLY_DB`. Leave them blank to let Life OS search for the four names.

## 2. Fork the repo

On GitHub, open [github.com/saumyansh95/lifeos](https://github.com/saumyansh95/lifeos) and tap **Fork**. Use Fork, not “Use this template”. A fork can use **Sync fork** later. A template copy cannot.

## 3. Import it into Netlify

1. In Netlify, choose **Add new site**.
2. Choose **Import from Git** and authorize GitHub if it asks.
3. Pick your fork of `lifeos`.
4. Leave the build command and publish directory as they are. They come from `netlify.toml` (`npm run build`, publish `dist`). You do not add a build hook.

## 4. Add NOTION_TOKEN and APP_PASSWORD

On the same screen, before the first deploy, add environment variables:

- `NOTION_TOKEN` — the token from step 1
- `APP_PASSWORD` — the password you will type to open the site

Optional: `SESSION_SECRET`. If you leave it empty, Life OS signs the login cookie with a key derived from `APP_PASSWORD`.

Changing either value later counts as a new deploy.

## 5. Deploy and read the ticks

Deploy and open the site. Sign in with `APP_PASSWORD`. Life OS then checks the token and searches for the four databases.

- A green tick means that database was found and its required properties are there.
- **Not found** usually means the Life OS page is not shared with the integration. Open the page, **••• → Connections**, and pick the integration. Then tap **Check again**.
- A missing property is named in the amber box, for example `Tasks: List`. Add that property in Notion with the same name and type, then check again.

You can skip and use the parts that were found. Weekly Summary can be added later.

## 6. Add it to your home screen

iPhone: open the site in Safari, tap Share, then **Add to Home Screen**.

Android: open the browser menu and choose **Install app** or **Add to Home screen**.

The icon is Life OS. It opens full screen, without the browser bar.

## Day to day

- **Today** is the tasks whose List is Today, plus today's habit ticks and a link to today's journal.
- **Tasks** can also live in This Week or Someday. Done is a status, not a delete.
- **Habits** are seven checkboxes, Monday to Sunday. Clear them on Monday if you want a fresh week. The streak counts back from today and, if today is still empty, starts from yesterday.
- **Journal** is your diary. A draft stays in this browser if you leave mid-entry. Saving writes Title, Date, Mood and Entry to Notion.
- **Week** copies a prompt with the last seven days of entries filled in. Paste it into any free AI chat. Nothing is sent for you. If you want to keep the answer, save it into Summaries.

## Updating

About once a day the app asks GitHub, with no token, for the latest release of [saumyansh95/lifeos](https://github.com/saumyansh95/lifeos/releases). The answer is cached. If you are offline, or the repo has no releases, the app stays quiet.

If a newer `vX.Y.Z` exists:

1. Open your fork on GitHub.
2. Click **Sync fork**, then **Update branch**.
3. Wait about two minutes. Netlify rebuilds from the new commit. Reopen Life OS.

Your Notion data is not part of the repo, so an update cannot overwrite it.

## Netlify free plan

The free plan has **300 credits a month**. That limit is a hard cap. Each production deploy costs **15 credits**, so you get about **20 deploys a month**. Syncing your fork spends a deploy. Changing `NOTION_TOKEN` or `APP_PASSWORD` spends a deploy. Life OS does not rebuild on a timer, and opening the app does not spend a deploy.

If the credits run out, Netlify pauses every free site on the account until the next month, not only Life OS. Normal personal use of the app itself is tiny.

## Prefer Render?

Not in this version. The Notion calls live in `shared/`, separate from the thin function in `netlify/functions/api.ts`, so a later host can reuse them. A Render guide is intentionally not part of v1.
