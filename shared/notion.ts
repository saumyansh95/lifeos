export class NotionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type RichText = { plain_text?: string };

export type SchemaProperty = {
  type: string;
  name?: string;
  select?: { options?: { name: string }[] };
  status?: { options?: { name: string }[] };
  multi_select?: { options?: { name: string }[] };
};

export type NotionProperty = {
  type: string;
  title?: RichText[];
  rich_text?: RichText[];
  select?: { name?: string | null } | null;
  status?: { name?: string | null } | null;
  date?: { start?: string | null } | null;
  checkbox?: boolean;
  formula?: { type?: string; string?: string | null; number?: number | null };
};

export type NotionPage = {
  id: string;
  created_time?: string;
  properties: Record<string, NotionProperty>;
};

export type SearchResult = {
  object: string;
  id: string;
  title?: RichText[];
  properties?: Record<string, SchemaProperty>;
};

export type QueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

export type NotionTarget = {
  id: string;
  kind: "data_source" | "database";
};

export type NotionClient = {
  search(args: { object: "data_source" | "database"; cursor?: string }): Promise<{
    results: SearchResult[];
    has_more: boolean;
    next_cursor: string | null;
  }>;
  retrieve(id: string): Promise<{
    id: string;
    kind: "data_source" | "database";
    title: string;
    properties: Record<string, SchemaProperty>;
  }>;
  query(target: NotionTarget, body: Record<string, unknown>): Promise<QueryResponse>;
  createPage(target: NotionTarget, properties: Record<string, unknown>): Promise<NotionPage>;
  updatePage(id: string, properties: Record<string, unknown>): Promise<NotionPage>;
  appendParagraph(id: string, text: string): Promise<void>;
};

const NOTION_VERSION = "2025-09-03";
const ROOT = "https://api.notion.com/v1";

type NotionJson = Record<string, unknown>;

export function createNotionClient(token: string, fetchImpl: typeof fetch = fetch): NotionClient {
  async function call(path: string, init: RequestInit = {}): Promise<NotionJson> {
    const response = await fetchImpl(`${ROOT}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let data: NotionJson = {};
    if (text) {
      try {
        data = JSON.parse(text) as NotionJson;
      } catch {
        data = { message: text.slice(0, 200) };
      }
    }
    if (!response.ok) {
      const message = typeof data.message === "string" ? data.message : `Notion request failed (${response.status})`;
      const code = typeof data.code === "string" ? data.code : "";
      throw new NotionError(message, response.status, code);
    }
    return data;
  }

  return {
    async search({ object, cursor }) {
      const data = await call("/search", {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "object", value: object },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      });
      return {
        results: Array.isArray(data.results) ? (data.results as SearchResult[]) : [],
        has_more: Boolean(data.has_more),
        next_cursor: typeof data.next_cursor === "string" ? data.next_cursor : null,
      };
    },

    async retrieve(id) {
      try {
        const data = await call(`/data_sources/${id}`);
        return normalizeRetrieved(data, "data_source", id);
      } catch (error) {
        if (!(error instanceof NotionError) || (error.status !== 400 && error.status !== 404)) throw error;
      }
      const database = await call(`/databases/${id}`);
      const sources = Array.isArray(database.data_sources) ? database.data_sources : [];
      const first = sources[0] as { id?: string } | undefined;
      if (first?.id) {
        const data = await call(`/data_sources/${first.id}`);
        return normalizeRetrieved(data, "data_source", first.id);
      }
      return normalizeRetrieved(database, "database", id);
    },

    async query(target, body) {
      const path =
        target.kind === "database" ? `/databases/${target.id}/query` : `/data_sources/${target.id}/query`;
      const data = await call(path, { method: "POST", body: JSON.stringify(body) });
      return {
        results: Array.isArray(data.results) ? (data.results as NotionPage[]) : [],
        has_more: Boolean(data.has_more),
        next_cursor: typeof data.next_cursor === "string" ? data.next_cursor : null,
      };
    },

    async createPage(target, properties) {
      const parent =
        target.kind === "database"
          ? { database_id: target.id }
          : { type: "data_source_id", data_source_id: target.id };
      const data = await call("/pages", {
        method: "POST",
        body: JSON.stringify({ parent, properties }),
      });
      return data as unknown as NotionPage;
    },

    async updatePage(id, properties) {
      const data = await call(`/pages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });
      return data as unknown as NotionPage;
    },

    async appendParagraph(id, text) {
      const children = chunkText(text).map((content) => ({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content } }] },
      }));
      if (!children.length) return;
      await call(`/blocks/${id}/children`, {
        method: "PATCH",
        body: JSON.stringify({ children }),
      });
    },
  };
}

function normalizeRetrieved(data: NotionJson, kind: "data_source" | "database", fallbackId: string) {
  return {
    id: typeof data.id === "string" ? data.id : fallbackId,
    kind,
    title: plainTitle(data),
    properties: (data.properties ?? {}) as Record<string, SchemaProperty>,
  };
}

export function plainTitle(data: { title?: RichText[] | string; properties?: Record<string, SchemaProperty> }): string {
  if (typeof data.title === "string") return data.title.trim();
  if (Array.isArray(data.title)) {
    return data.title.map((part) => part.plain_text ?? "").join("").trim();
  }
  return "";
}

function chunkText(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 1800) chunks.push(clean.slice(i, i + 1800));
  return chunks;
}

export function richText(parts: RichText[] | undefined): string {
  return (parts ?? []).map((part) => part.plain_text ?? "").join("");
}

export function titleValue(text: string) {
  return { title: [{ type: "text", text: { content: text.slice(0, 2000) } }] };
}

export function richValue(text: string) {
  if (!text) return { rich_text: [] };
  return { rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }] };
}

export function selectValue(name: string) {
  return { select: { name } };
}

export function statusValue(name: string, type: string) {
  return type === "select" ? { select: { name } } : { status: { name } };
}

export function dateValue(iso: string | null) {
  return { date: iso ? { start: iso } : null };
}

export function checkboxValue(checked: boolean) {
  return { checkbox: checked };
}
