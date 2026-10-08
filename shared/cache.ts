export type Cache = {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
};

export function memoryCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    async get(key) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

/** Netlify Blobs when the function is running on Netlify, otherwise memory. */
export async function openCache(): Promise<Cache> {
  if (process.env.LIFE_OS_CACHE === "memory") return memoryCache();
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "life-os", consistency: "strong" });
    return {
      async get(key) {
        try {
          return (await store.get(key, { type: "json" })) ?? null;
        } catch {
          return null;
        }
      },
      async set(key, value) {
        try {
          await store.setJSON(key, value);
        } catch {
          // A cache miss only means the next request searches Notion again.
        }
      },
    };
  } catch {
    return memoryCache();
  }
}
