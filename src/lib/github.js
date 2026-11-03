import { useCallback, useEffect, useState } from "react";
import { normalizeCalendar } from "./stats";

export const USERNAME = "benguo2003";
const API = "https://api.github.com";
const CONTRIBUTIONS_API = `https://github-contributions-api.jogruber.de/v4/${USERNAME}?y=all`;

const CACHE_KEY = `gh-dashboard:v2:${USERNAME}`;
const DETAILS_KEY = `gh-dashboard:v2:${USERNAME}:repo-details`;
const TTL_MS = 15 * 60 * 1000;

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the dashboard still works uncached.
  }
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 204) return null;
  if (!res.ok) {
    const limited = res.status === 403 || res.status === 429;
    throw new Error(limited ? "GitHub API rate limit reached, try again in a few minutes." : `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Per-repo languages (bytes) and the user's commit count. These only change when
 * a repo is pushed to, so they're cached by pushed_at and survive the main TTL.
 */
async function loadRepoDetails(repos) {
  const cached = readStorage(DETAILS_KEY) || {};
  const next = {};
  await Promise.all(
    repos
      .filter((r) => !r.fork)
      .map(async (repo) => {
        const hit = cached[repo.name];
        if (hit && hit.pushedAt === repo.pushed_at) {
          next[repo.name] = hit;
          return;
        }
        try {
          const [languages, contributors] = await Promise.all([
            getJSON(`${API}/repos/${USERNAME}/${repo.name}/languages`),
            getJSON(`${API}/repos/${USERNAME}/${repo.name}/contributors?per_page=100`),
          ]);
          const me = (contributors || []).find((c) => c.login?.toLowerCase() === USERNAME.toLowerCase());
          next[repo.name] = {
            pushedAt: repo.pushed_at,
            languages: languages || {},
            commits: me?.contributions ?? 0,
          };
        } catch {
          if (hit) next[repo.name] = hit; // stale beats nothing
        }
      })
  );
  writeStorage(DETAILS_KEY, next);
  return next;
}

async function loadCalendar() {
  try {
    const res = await fetch(CONTRIBUTIONS_API);
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeCalendar(json.contributions || []);
  } catch {
    return null;
  }
}

async function loadAll() {
  const [profile, repos, events, calendar] = await Promise.all([
    getJSON(`${API}/users/${USERNAME}`),
    getJSON(`${API}/users/${USERNAME}/repos?per_page=100&sort=pushed`),
    getJSON(`${API}/users/${USERNAME}/events/public?per_page=100`).catch(() => []),
    loadCalendar(),
  ]);
  const details = await loadRepoDetails(repos);
  return { profile, repos, events: events || [], calendar, details, fetchedAt: Date.now() };
}

export function useGitHubData() {
  const [state, setState] = useState(() => {
    const cached = readStorage(CACHE_KEY);
    return { data: cached, loading: !cached, error: null, refreshing: false };
  });

  const refresh = useCallback(async (force = false) => {
    const cached = readStorage(CACHE_KEY);
    if (!force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
      setState({ data: cached, loading: false, error: null, refreshing: false });
      return;
    }
    setState((s) => ({ ...s, refreshing: true, error: null }));
    try {
      const data = await loadAll();
      // Keep the last good calendar if the contributions service hiccups.
      if (!data.calendar && cached?.calendar) data.calendar = cached.calendar;
      writeStorage(CACHE_KEY, data);
      setState({ data, loading: false, error: null, refreshing: false });
    } catch (err) {
      setState({ data: cached, loading: false, error: err.message, refreshing: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
