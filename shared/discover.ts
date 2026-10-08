import type { Cache } from "./cache";
import type { AppConfig } from "./config";
import { NotionError, plainTitle, type NotionClient, type SchemaProperty } from "./notion";
import { DATABASES, countLabel, missingRequired, type DatabaseSpec, type NormalizedProp } from "./schema";
import type { DbKey, SetupReport } from "./types";

export const DISCOVERY_CACHE_KEY = "databases-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_PAGES = 4;

export type ResolvedDb = {
  id: string;
  kind: "data_source" | "database";
  title: string;
  properties: Record<string, NormalizedProp>;
  missing: string[];
};

export type Discovery = {
  tokenFound: boolean;
  tokenError: string | null;
  byKey: Record<DbKey, ResolvedDb | null>;
};

type CacheShape = {
  v: 1;
  at: number;
  byKey: Record<DbKey, ResolvedDb | null>;
};

const TOKEN_ERROR =
  "Notion rejected the token. In Netlify, open Site configuration → Environment variables, check NOTION_TOKEN, then redeploy.";

export async function discoverDatabases(
  config: AppConfig,
  notion: NotionClient | null,
  cache: Cache,
  refresh: boolean,
): Promise<Discovery> {
  if (!config.notionToken || !notion) {
    return { tokenFound: false, tokenError: null, byKey: emptyByKey() };
  }

  try {
    const cached = refresh ? null : await readCache(cache);
    const byKey = cached ?? (await searchAndLoad(config, notion));
    const withOverrides = await applyOverrides(byKey, config, notion);
    if (!cached) {
      await cache.set(DISCOVERY_CACHE_KEY, { v: 1, at: Date.now(), byKey: withOverrides } satisfies CacheShape);
    }
    return { tokenFound: true, tokenError: null, byKey: withOverrides };
  } catch (error) {
    if (error instanceof NotionError && (error.status === 401 || error.code === "unauthorized")) {
      return { tokenFound: false, tokenError: TOKEN_ERROR, byKey: emptyByKey() };
    }
    throw error;
  }
}

export async function toSetupReport(discovery: Discovery, notion: NotionClient | null): Promise<SetupReport> {
  const databases = await Promise.all(
    DATABASES.map(async (spec) => {
      const resolved = discovery.byKey[spec.key];
      const found = Boolean(resolved);
      const ready = Boolean(resolved && resolved.missing.length === 0);
      let count = 0;
      if (ready && resolved && notion && discovery.tokenFound) {
        count = await countRows(notion, resolved);
      }
      return {
        key: spec.key,
        label: spec.label,
        found,
        ready,
        count,
        countLabel: countLabel(spec, count, ready, found),
        missingProperties: resolved?.missing ?? [],
      };
    }),
  );
  return {
    tokenFound: discovery.tokenFound,
    tokenError: discovery.tokenError,
    databases,
    foundCount: databases.filter((row) => row.ready).length,
    total: 4,
  };
}

async function searchAndLoad(config: AppConfig, notion: NotionClient): Promise<Record<DbKey, ResolvedDb | null>> {
  const byKey = emptyByKey();
  const sources = await searchAll(notion);
  const used = new Set<string>();
  for (const spec of DATABASES) {
    if (config.overrides[spec.key]) continue;
    const match = matchPreferred(sources, spec.titles, used);
    if (!match) continue;
    used.add(match.id);
    byKey[spec.key] = await loadOne(notion, match.id, spec);
  }
  return byKey;
}

async function applyOverrides(
  byKey: Record<DbKey, ResolvedDb | null>,
  config: AppConfig,
  notion: NotionClient,
): Promise<Record<DbKey, ResolvedDb | null>> {
  const next = { ...byKey };
  for (const spec of DATABASES) {
    const override = config.overrides[spec.key];
    if (!override) continue;
    if (next[spec.key]?.id === override && next[spec.key]?.missing) continue;
    next[spec.key] = await loadOne(notion, override, spec);
  }
  return next;
}

async function readCache(cache: Cache): Promise<Record<DbKey, ResolvedDb | null> | null> {
  const raw = (await cache.get(DISCOVERY_CACHE_KEY)) as CacheShape | null;
  if (!raw || raw.v !== 1 || typeof raw.at !== "number") return null;
  if (Date.now() - raw.at > DAY_MS) return null;
  return raw.byKey ?? null;
}

function emptyByKey(): Record<DbKey, ResolvedDb | null> {
  return { tasks: null, habits: null, journal: null, weekly: null };
}

async function searchAll(notion: NotionClient): Promise<{ id: string; title: string }[]> {
  const found: { id: string; title: string }[] = [];
  let object: "data_source" | "database" = "data_source";
  let cursor: string | undefined;
  for (let page = 0; page < SEARCH_PAGES; page += 1) {
    let result;
    try {
      result = await notion.search({ object, cursor });
    } catch (error) {
      if (page === 0 && object === "data_source" && error instanceof NotionError && error.status === 400) {
        object = "database";
        result = await notion.search({ object, cursor });
      } else {
        throw error;
      }
    }
    for (const item of result.results) {
      const title = plainTitle(item);
      if (title) found.push({ id: item.id, title });
    }
    if (!result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return found;
}

function matchPreferred(sources: { id: string; title: string }[], titles: string[], used: Set<string>) {
  for (const title of titles) {
    const hit = sources.find((source) => !used.has(source.id) && source.title.trim().toLowerCase() === title);
    if (hit) return hit;
  }
  return null;
}

async function loadOne(notion: NotionClient, id: string, spec: DatabaseSpec): Promise<ResolvedDb | null> {
  try {
    const retrieved = await notion.retrieve(id);
    const properties = normalizeProps(retrieved.properties);
    return {
      id: retrieved.id,
      kind: retrieved.kind,
      title: retrieved.title || spec.label,
      properties,
      missing: missingRequired(properties, spec),
    };
  } catch (error) {
    if (error instanceof NotionError && (error.status === 404 || error.code === "object_not_found")) return null;
    throw error;
  }
}

function normalizeProps(raw: Record<string, SchemaProperty> | undefined): Record<string, NormalizedProp> {
  const out: Record<string, NormalizedProp> = {};
  for (const [name, prop] of Object.entries(raw ?? {})) {
    const options = prop.select?.options ?? prop.status?.options ?? prop.multi_select?.options ?? [];
    out[name] = { type: prop.type, options: options.map((option) => option.name) };
  }
  return out;
}

async function countRows(notion: NotionClient, db: ResolvedDb): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  for (let page = 0; page < 3; page += 1) {
    const result = await notion.query(
      { id: db.id, kind: db.kind },
      { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    );
    count += result.results.length;
    if (!result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return count;
}
