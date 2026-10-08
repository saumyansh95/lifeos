import { openCache } from "../../shared/cache";
import { readConfig } from "../../shared/config";
import type { Deps } from "../../shared/deps";
import { createNotionClient } from "../../shared/notion";
import { route } from "../../shared/router";
import type { Config, Context } from "@netlify/functions";

export default async function handler(req: Request, _context: Context): Promise<Response> {
  return route(req, await liveDeps());
}

export async function liveDeps(): Promise<Deps> {
  const config = readConfig();
  return {
    config,
    notion: config.notionToken ? createNotionClient(config.notionToken) : null,
    cache: await openCache(),
    fetch: globalThis.fetch.bind(globalThis),
    now: () => Date.now(),
  };
}

export const config: Config = {
  path: [
    "/api/session",
    "/api/setup",
    "/api/home",
    "/api/tasks",
    "/api/tasks/:id",
    "/api/habits",
    "/api/habits/:id",
    "/api/journal",
    "/api/journal/:id",
    "/api/summaries",
    "/api/update",
  ],
};
