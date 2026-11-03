import { useCallback, useEffect, useState } from "react";
import { fetchCore, fetchRepoDetails } from "./fetchers";
import { normalizeCalendar } from "./stats";

export { USERNAME } from "./fetchers";

const CACHE_KEY = "gh-dashboard:v3";
const TTL_MS = 15 * 60 * 1000;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the dashboard still works uncached.
  }
}

/** The snapshot baked in at build time (scripts/snapshot.mjs), served from this site. */
async function loadSnapshot() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const snap = await res.json();
    // Re-clip the calendar so days after the build don't read as future dates.
    return snap.calendar ? { ...snap, calendar: normalizeCalendar(snap.calendar) } : snap;
  } catch {
    return null;
  }
}

/**
 * Shows the newest data on hand right away (local cache or the deployed snapshot),
 * then refreshes live from GitHub in the background. A failed refresh keeps what's
 * already on screen, so rate limits never blank the page.
 */
export function useGitHubData() {
  const [state, setState] = useState(() => {
    const cached = readCache();
    return { data: cached, loading: !cached, error: null };
  });

  const refresh = useCallback(async (force = false) => {
    let base = readCache();
    if (!force && base && Date.now() - base.fetchedAt < TTL_MS) {
      setState({ data: base, loading: false, error: null });
      return;
    }

    const snapshot = await loadSnapshot();
    if (snapshot && (!base || snapshot.fetchedAt > base.fetchedAt)) base = snapshot;
    setState({ data: base, loading: !base, error: null });

    try {
      const core = await fetchCore();
      const { details } = await fetchRepoDetails(core.repos, base?.details);
      const data = { ...core, details, fetchedAt: Date.now() };
      if (!data.calendar && base?.calendar) data.calendar = base.calendar;
      writeCache(data);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: base, loading: false, error: err.message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
