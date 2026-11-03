// Pure derivations from GitHub data. Dates are handled as local calendar days
// ("YYYY-MM-DD" keys) so nothing shifts across timezones.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

export function formatDay(key, opts = { month: "short", day: "numeric" }) {
  return fromKey(key).toLocaleDateString("en-US", opts);
}

/** Sort, de-duplicate, and drop future days from the contributions feed. */
export function normalizeCalendar(days, today = new Date()) {
  const todayKey = toKey(today);
  const seen = new Map();
  for (const d of days) {
    if (d.date <= todayKey) seen.set(d.date, { date: d.date, count: d.count, level: d.level });
  }
  return [...seen.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Calendar as a dense map so missing days read as zero. */
function countsByKey(calendar) {
  const map = new Map();
  for (const d of calendar) map.set(d.date, d.count);
  return map;
}

/**
 * Current and longest streaks of consecutive days with contributions.
 * Today with no contributions yet doesn't break the current streak.
 */
export function getStreaks(calendar, today = new Date()) {
  const counts = countsByKey(calendar);
  let longest = { length: 0, start: null, end: null };
  let run = { length: 0, start: null };

  for (const d of calendar) {
    if (d.count > 0) {
      const prev = toKey(addDays(fromKey(d.date), -1));
      if (run.length && counts.get(prev) > 0) run.length += 1;
      else run = { length: 1, start: d.date };
      if (run.length > longest.length) longest = { length: run.length, start: run.start, end: d.date };
    } else {
      run = { length: 0, start: null };
    }
  }

  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!(counts.get(toKey(cursor)) > 0)) cursor = addDays(cursor, -1);
  let current = 0;
  let currentStart = null;
  while (counts.get(toKey(cursor)) > 0) {
    current += 1;
    currentStart = toKey(cursor);
    cursor = addDays(cursor, -1);
  }

  return { current, currentStart, longest };
}

/** Sunday-aligned weekly buckets for the last `weeks` weeks (the last may be partial). */
export function bucketWeeks(calendar, weeks, today = new Date()) {
  const counts = countsByKey(calendar);
  const thisWeek = startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const todayKey = toKey(today);
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    let count = 0;
    let activeDays = 0;
    for (let i = 0; i < 7; i++) {
      const key = toKey(addDays(start, i));
      if (key > todayKey) break;
      const c = counts.get(key) || 0;
      count += c;
      if (c > 0) activeDays += 1;
    }
    const startKey = toKey(start);
    out.push({
      key: startKey,
      label: formatDay(startKey),
      tooltipLabel: `Week of ${formatDay(startKey, { month: "short", day: "numeric", year: "numeric" })}`,
      count,
      activeDays,
    });
  }
  return out;
}

/** Monthly buckets from `since` (a Date) through the current month. */
export function bucketMonths(calendar, since, today = new Date()) {
  const totals = new Map();
  const active = new Map();
  for (const d of calendar) {
    const k = d.date.slice(0, 7);
    totals.set(k, (totals.get(k) || 0) + d.count);
    if (d.count > 0) active.set(k, (active.get(k) || 0) + 1);
  }
  const out = [];
  const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor <= end) {
    const key = toKey(cursor).slice(0, 7);
    out.push({
      key,
      label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      tooltipLabel: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      count: totals.get(key) || 0,
      activeDays: active.get(key) || 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Trailing moving average; the first window-1 points average what exists so far. */
export function rollingAverage(values, window) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(sum / Math.min(i + 1, window));
  }
  return out;
}

export function sumRange(calendar, fromKeyInclusive, toKeyInclusive) {
  let total = 0;
  let activeDays = 0;
  for (const d of calendar) {
    if (d.date >= fromKeyInclusive && d.date <= toKeyInclusive) {
      total += d.count;
      if (d.count > 0) activeDays += 1;
    }
  }
  return { total, activeDays };
}

/** Percent change, or null when there's no baseline to compare against. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Human phrasing of a change; tiny baselines read as "up from N" rather than "+2460%". */
export function describeChange(current, previous, period) {
  if (!previous) return current ? { text: `none in the ${period}`, tone: "good" } : { text: `none in the ${period}`, tone: null };
  const tone = current >= previous ? "good" : "bad";
  if (previous < 20) return { text: `${current >= previous ? "up" : "down"} from ${previous} in the ${period}`, tone };
  const pct = Math.round(percentChange(current, previous));
  return { text: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs ${period}`, tone };
}

export function weekdayTotals(calendar) {
  const totals = WEEKDAYS.map((name, i) => ({ day: name, index: i, count: 0 }));
  for (const d of calendar) totals[fromKey(d.date).getDay()].count += d.count;
  return totals;
}

export function yearlyTotals(calendar, sinceYear) {
  const byYear = new Map();
  for (const d of calendar) {
    const y = Number(d.date.slice(0, 4));
    byYear.set(y, (byYear.get(y) || 0) + d.count);
  }
  const years = [...byYear.keys()];
  if (!years.length) return [];
  const first = Math.min(sinceYear ?? Infinity, ...years);
  const last = Math.max(...years);
  const out = [];
  for (let y = first; y <= last; y++) out.push({ year: String(y), count: byYear.get(y) || 0 });
  return out;
}

export function bestDay(calendar) {
  let best = null;
  for (const d of calendar) if (!best || d.count > best.count) best = d;
  return best && best.count > 0 ? best : null;
}

export function bestMonth(calendar) {
  const months = bucketMonths(calendar, calendar.length ? fromKey(calendar[0].date) : new Date());
  let best = null;
  for (const m of months) if (!best || m.count > best.count) best = m;
  return best && best.count > 0 ? best : null;
}

/**
 * Language breakdown across non-fork repos.
 * mode "bytes" weights by bytes of code (from the languages API, falling back to
 * the repo's primary language when byte data is missing); mode "repos" counts
 * how many repos use each language at all.
 */
export function languageBreakdown(repos, details, mode = "bytes") {
  const stats = new Map();
  const bump = (name, bytes, repo) => {
    const s = stats.get(name) || { name, bytes: 0, repos: new Set() };
    s.bytes += bytes;
    s.repos.add(repo);
    stats.set(name, s);
  };

  for (const repo of repos) {
    if (repo.fork) continue;
    const langs = details[repo.name]?.languages;
    if (langs && Object.keys(langs).length) {
      for (const [name, bytes] of Object.entries(langs)) bump(name, bytes, repo.name);
    } else if (repo.language) {
      bump(repo.language, 0, repo.name);
    }
  }

  const rows = [...stats.values()].map((s) => ({
    name: s.name,
    bytes: s.bytes,
    repoCount: s.repos.size,
    value: mode === "bytes" ? s.bytes : s.repos.size,
  }));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return rows
    .filter((r) => r.value > 0)
    .map((r) => ({ ...r, share: total ? r.value / total : 0 }))
    .sort((a, b) => b.value - a.value || b.bytes - a.bytes);
}

/** Keep rows named in `keep` (a Set) and fold the rest into a single "Other" row. */
export function foldOther(rows, keep) {
  const head = rows.filter((r) => keep.has(r.name));
  const tail = rows.filter((r) => !keep.has(r.name));
  if (!tail.length) return head;
  return [
    ...head,
    {
      name: "Other",
      other: tail.map((r) => r.name),
      bytes: tail.reduce((a, r) => a + r.bytes, 0),
      repoCount: null,
      value: tail.reduce((a, r) => a + r.value, 0),
      share: tail.reduce((a, r) => a + r.share, 0),
    },
  ];
}

export function repoStatus(repo, now = new Date()) {
  if (repo.archived) return "archived";
  const months = (now - new Date(repo.pushed_at || repo.updated_at)) / (30 * DAY_MS);
  if (months < 3) return "active";
  if (months < 12) return "idle";
  return "dormant";
}

export function relativeTime(iso, now = new Date()) {
  const diff = now - new Date(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365.25)}y ago`;
}

export function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export function formatShare(share) {
  const pct = share * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export const formatNumber = (n) => (n ?? 0).toLocaleString("en-US");
