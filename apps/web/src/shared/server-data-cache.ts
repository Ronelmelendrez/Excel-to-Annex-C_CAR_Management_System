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
  private keyGenerations = new Map<string, number>();
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
    const keyGeneration = this.keyGenerations.get(key) ?? 0;
    const request = loader().then((data) => {
      if (generation === this.generation && keyGeneration === (this.keyGenerations.get(key) ?? 0)) {
        this.set(key, data);
      }
      return data;
    });
    this.requests.set(key, request);
    void request.finally(() => {
      if (this.requests.get(key) === request) this.requests.delete(key);
    }).catch(() => undefined);
    return request;
  }

  delete(key: string): void {
    this.keyGenerations.set(key, (this.keyGenerations.get(key) ?? 0) + 1);
    this.entries.delete(key);
    this.requests.delete(key);
  }

  deletePrefix(prefix: string): void {
    const keys = new Set([
      ...this.entries.keys(),
      ...this.requests.keys(),
      ...this.keyGenerations.keys(),
    ]);
    for (const key of keys) {
      if (key.startsWith(prefix)) this.delete(key);
    }
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.requests.clear();
    this.keyGenerations.clear();
  }
}

export const serverDataCache = new ServerDataCache();

export function householdListCacheKey(userId: string): string {
  return `households:${userId}:list`;
}

export function householdStatsCacheKey(userId: string): string {
  return `households:${userId}:stats`;
}

export function carDraftsCacheKey(userId: string): string {
  return `cars:${userId}:drafts`;
}

export function carTemplatesCacheKey(userId: string): string {
  return `cars:${userId}:templates`;
}

export function dashboardSummaryCacheKey(userId: string, scope: string): string {
  return `dashboard:${userId}:${scope}:summary`;
}
