import type { Cache } from "./cache";
import type { NotionClient } from "./notion";
import type { AppConfig } from "./config";

export type Deps = {
  config: AppConfig;
  notion: NotionClient | null;
  cache: Cache;
  fetch: typeof fetch;
  now: () => number;
};
