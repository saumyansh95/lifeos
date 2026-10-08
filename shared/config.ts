import { deriveSessionSecret } from "./session";
import type { DbKey } from "./types";

export type AppConfig = {
  notionToken: string;
  appPassword: string;
  sessionSecret: string;
  overrides: Partial<Record<DbKey, string>>;
};

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const appPassword = env.APP_PASSWORD?.trim() ?? "";
  const sessionSecret = env.SESSION_SECRET?.trim() || (appPassword ? deriveSessionSecret(appPassword) : "");
  return {
    notionToken: env.NOTION_TOKEN?.trim() ?? "",
    appPassword,
    sessionSecret,
    overrides: {
      tasks: cleanId(env.NOTION_TASKS_DB),
      habits: cleanId(env.NOTION_HABITS_DB),
      journal: cleanId(env.NOTION_JOURNAL_DB),
      weekly: cleanId(env.NOTION_WEEKLY_DB),
    },
  };
}

function cleanId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
