import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepoDetails } from "./fetchers";

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("fetchRepoDetails", () => {
  const repos = [
    { name: "same", fork: false, pushed_at: "2026-01-01" },
    { name: "changed", fork: false, pushed_at: "2026-11-01" },
    { name: "forked", fork: true, pushed_at: "2026-11-01" },
  ];
  const previous = {
    same: { pushedAt: "2026-01-01", languages: { Go: 10 }, commits: 4 },
    changed: { pushedAt: "2026-06-01", languages: { Go: 5 }, commits: 1 },
  };

  it("only requests repos pushed since the previous data, skipping forks", async () => {
    const fetch = vi.fn(async (url) =>
      url.endsWith("/languages") ? json({ Rust: 99 }) : json([{ login: "benguo2003", contributions: 7 }])
    );
    vi.stubGlobal("fetch", fetch);

    const { details, failed } = await fetchRepoDetails(repos, previous);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([url]) => url.includes("/changed/"))).toBe(true);
    expect(details.same).toBe(previous.same);
    expect(details.changed).toEqual({ pushedAt: "2026-11-01", languages: { Rust: 99 }, commits: 7 });
    expect(details.forked).toBeUndefined();
    expect(failed).toEqual([]);
  });

  it("keeps the previous entry when GitHub rate-limits a lookup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "rate limited" }, 403)));
    const { details, failed } = await fetchRepoDetails(repos, previous);
    expect(failed).toEqual(["changed"]);
    expect(details.changed).toBe(previous.changed);
  });
});
