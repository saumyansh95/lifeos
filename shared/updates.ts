import type { Cache } from "./cache";
import { formatReleased } from "./dates";
import { displayVersion, isNewer, parseReleaseNotes, parseVersion } from "./semver";
import type { UpdateInfo } from "./types";
import { APP_VERSION, GITHUB_RELEASES_API, GITHUB_URL } from "./version";

const CACHE_KEY = "github-release-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

type CachedRelease = {
  at: number;
  info: UpdateInfo;
};

export async function checkForUpdate(cache: Cache, fetchImpl: typeof fetch, now = Date.now()): Promise<UpdateInfo> {
  const cached = (await cache.get(CACHE_KEY)) as CachedRelease | null;
  if (cached?.info && typeof cached.at === "number" && now - cached.at < DAY_MS) {
    return cached.info;
  }
  const info = await fetchLatest(fetchImpl);
  if (info) {
    await cache.set(CACHE_KEY, { at: now, info } satisfies CachedRelease);
    return info;
  }
  return cached?.info ?? none();
}

async function fetchLatest(fetchImpl: typeof fetch): Promise<UpdateInfo | null> {
  try {
    const response = await fetchImpl(GITHUB_RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "life-os",
      },
    });
    if (response.status === 404 || response.status === 403) return none();
    if (!response.ok) return null;
    const data = (await response.json()) as {
      tag_name?: string;
      body?: string;
      published_at?: string;
      html_url?: string;
    };
    const tag = data.tag_name ?? "";
    if (!parseVersion(tag)) return none();
    const latest = tag.replace(/^v/i, "");
    return {
      current: APP_VERSION,
      latest,
      updateAvailable: isNewer(latest, APP_VERSION),
      releasedAt: data.published_at ?? null,
      releasedLabel: formatReleased(data.published_at ?? null),
      notes: parseReleaseNotes(data.body ?? ""),
      htmlUrl: data.html_url || `${GITHUB_URL}/releases`,
    };
  } catch {
    return null;
  }
}

function none(): UpdateInfo {
  return {
    current: APP_VERSION,
    latest: null,
    updateAvailable: false,
    releasedAt: null,
    releasedLabel: "",
    notes: [],
    htmlUrl: `${GITHUB_URL}/releases`,
  };
}

export function versionLabel(): string {
  return displayVersion(APP_VERSION);
}
