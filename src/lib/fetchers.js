// Data fetching shared by the browser and the build-time snapshot script
// (scripts/snapshot.mjs), so imports here need explicit .js extensions.
import { normalizeCalendar } from "./stats.js";

export const USERNAME = "benguo2003";
const API = "https://api.github.com";
const CONTRIBUTIONS_API = `https://github-contributions-api.jogruber.de/v4/${USERNAME}?y=all`;

export async function getJSON(url, token) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 204) return null;
  if (!res.ok) {
    const limited = res.status === 403 || res.status === 429;
    throw new Error(limited ? "GitHub API rate limit reached" : `GitHub request failed (${res.status})`);
  }
  return res.json();
}

// Keep only the fields the dashboard reads, so snapshots and caches stay small.
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

const PROFILE_KEYS = ["login", "name", "avatar_url", "html_url", "bio", "location", "followers", "following", "public_repos", "created_at"];
const REPO_KEYS = [
  "id", "name", "fork", "archived", "language", "description", "html_url", "topics",
  "stargazers_count", "forks_count", "created_at", "updated_at", "pushed_at",
];

function slimEvent(e) {
  const p = e.payload || {};
  const pr = p.pull_request && pick(p.pull_request, ["number", "title", "html_url", "merged"]);
  const issue = p.issue && pick(p.issue, ["number", "title", "html_url"]);
  return {
    id: e.id,
    type: e.type,
    created_at: e.created_at,
    repo: { name: e.repo?.name },
    payload: {
      ...pick(p, ["action", "ref", "ref_type", "head", "number", "description"]),
      ...(pr && { pull_request: pr }),
      ...(issue && { issue }),
      ...(p.comment && { comment: { html_url: p.comment.html_url } }),
      ...(p.member && { member: { login: p.member.login } }),
      ...(p.forkee && { forkee: { html_url: p.forkee.html_url } }),
      ...(p.release && { release: pick(p.release, ["tag_name", "name", "html_url"]) }),
    },
  };
}

async function fetchCalendar() {
  try {
    const res = await fetch(CONTRIBUTIONS_API);
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeCalendar(json.contributions || []);
  } catch {
    return null;
  }
}

/** Profile, repos, recent events and the contribution calendar: three GitHub requests. */
export async function fetchCore(token) {
  const [profile, repos, events, calendar] = await Promise.all([
    getJSON(`${API}/users/${USERNAME}`, token),
    getJSON(`${API}/users/${USERNAME}/repos?per_page=100&sort=pushed`, token),
    getJSON(`${API}/users/${USERNAME}/events/public?per_page=100`, token).catch(() => []),
    fetchCalendar(),
  ]);
  return {
    profile: pick(profile, PROFILE_KEYS),
    repos: repos.map((r) => pick(r, REPO_KEYS)),
    events: (events || []).map(slimEvent),
    calendar,
  };
}

/**
 * Per-repo languages (bytes) and the user's commit count. These only change when a
 * repo is pushed to, so entries in `previous` with a matching pushed_at are reused
 * and only changed repos cost requests. Failed lookups keep the previous entry.
 */
export async function fetchRepoDetails(repos, previous = {}, token) {
  const details = {};
  const failed = [];
  await Promise.all(
    repos
      .filter((r) => !r.fork)
      .map(async (repo) => {
        const hit = previous?.[repo.name];
        if (hit && hit.pushedAt === repo.pushed_at) {
          details[repo.name] = hit;
          return;
        }
        try {
          const [languages, contributors] = await Promise.all([
            getJSON(`${API}/repos/${USERNAME}/${repo.name}/languages`, token),
            getJSON(`${API}/repos/${USERNAME}/${repo.name}/contributors?per_page=100`, token),
          ]);
          const me = (contributors || []).find((c) => c.login?.toLowerCase() === USERNAME.toLowerCase());
          details[repo.name] = { pushedAt: repo.pushed_at, languages: languages || {}, commits: me?.contributions ?? 0 };
        } catch {
          failed.push(repo.name);
          if (hit) details[repo.name] = hit; // stale beats nothing
        }
      })
  );
  return { details, failed };
}
