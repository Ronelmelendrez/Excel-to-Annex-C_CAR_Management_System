export type CacheSnapshot<T> = {
  data: T;
  updatedAt: number;
};

type CacheEntry = {
  data: unknown;
  updatedAt: number;
  lastAccessedAt: number;
  generation: number;
};

const DEFAULT_GC_TIME = 5 * 60_000;

export class ServerDataCache {
  private entries = new Map<string, CacheEntry>();
  private requests = new Map<string, Promise<unknown>>();
  private generation = 0;

  get<T>(key: string, now = Date.now(), gcTime = DEFAULT_GC_TIME): CacheSnapshot<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (now - entry.lastAccessedAt >= gcTime) {
      this.entries.delete(key);
      return undefined;
    }

    entry.lastAccessedAt = now;
    return { data: entry.data as T, updatedAt: entry.updatedAt };
  }

  isFresh(snapshot: CacheSnapshot<unknown>, staleTime: number, now = Date.now()): boolean {
    return now - snapshot.updatedAt < staleTime;
  }

  set<T>(key: string, data: T, now = Date.now()): void {
    this.entries.set(key, {
      data,
      updatedAt: now,
      lastAccessedAt: now,
      generation: this.generation,
    });
  }

  fetch<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.requests.get(key);
    if (existing) return existing as Promise<T>;

    const generation = this.generation;
    const request = loader().then((data) => {
      if (generation === this.generation) this.set(key, data);
      return data;
    });
    this.requests.set(key, request);
    void request.finally(() => {
      if (this.requests.get(key) === request) this.requests.delete(key);
    }).catch(() => undefined);
    return request;
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.requests.clear();
  }
}

export const serverDataCache = new ServerDataCache();
