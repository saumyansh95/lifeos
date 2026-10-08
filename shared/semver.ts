import type { ReleaseNote } from "./types";

export function parseVersion(value: string): [number, number, number] | null {
  const match = value.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewer(latest: string, current: string): boolean {
  const next = parseVersion(latest);
  const now = parseVersion(current);
  if (!next || !now) return false;
  for (let i = 0; i < 3; i += 1) {
    if (next[i] !== now[i]) return next[i] > now[i];
  }
  return false;
}

export function displayVersion(value: string): string {
  const parsed = parseVersion(value);
  if (!parsed) return value;
  return `v${parsed[0]}.${parsed[1]}.${parsed[2]}`;
}

/** Pulls headings and bullets out of a GitHub Release body. */
export function parseReleaseNotes(body: string): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  let tag = "New";
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("```")) continue;
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      tag = heading[1].replace(/[*_]/g, "").trim() || "New";
      continue;
    }
    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.+)/);
    if (!bullet) continue;
    const labeled = bullet[1].match(/^\*\*([^*]+)\*\*\s*[:\-–]?\s*(.*)$/);
    if (labeled) {
      notes.push({
        tag: labeled[1].replace(/[:\-–]+$/, "").trim() || tag,
        text: labeled[2].trim() || labeled[1].trim(),
      });
      continue;
    }
    notes.push({ tag, text: bullet[1].trim() });
  }
  return notes.slice(0, 8);
}
