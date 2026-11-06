import { describe, expect, it, vi } from "vitest";
import { ServerDataCache } from "../server-data-cache";

describe("server data memory cache", () => {
  it("reuses fresh data and expires it after the garbage-collection window", () => {
    const cache = new ServerDataCache();
    cache.set("user-1:households", ["record"], 100);

    const fresh = cache.get<string[]>("user-1:households", 110, 50);
    expect(fresh?.data).toEqual(["record"]);
    expect(cache.isFresh(fresh!, 30, 120)).toBe(true);
    expect(cache.isFresh(fresh!, 30, 140)).toBe(false);
    expect(cache.get("user-1:households", 161, 50)).toBeUndefined();
  });

  it("deduplicates in-flight requests", async () => {
    const cache = new ServerDataCache();
    const load = vi.fn().mockResolvedValue(["record"]);

    const [first, second] = await Promise.all([
      cache.fetch("user-1:households", load),
      cache.fetch("user-1:households", load),
    ]);

    expect(first).toEqual(["record"]);
    expect(second).toEqual(["record"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not restore sensitive results after the cache is cleared", async () => {
    const cache = new ServerDataCache();
    let resolveRequest!: (value: string[]) => void;
    const request = cache.fetch(
      "user-1:households",
      () => new Promise<string[]>((resolve) => (resolveRequest = resolve)),
    );

    cache.clear();
    resolveRequest(["sensitive record"]);
    await request;

    expect(cache.get("user-1:households")).toBeUndefined();
  });
});
