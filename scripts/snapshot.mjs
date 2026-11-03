// Writes public/data.json: a full data snapshot served with the site, so first
// paint never depends on GitHub's unauthenticated rate limit. Runs before every
// build. Set GITHUB_TOKEN to lift the limit to 5,000 requests/hour.
import { readFile, writeFile } from "node:fs/promises";
import { fetchCore, fetchRepoDetails } from "../src/lib/fetchers.js";

const OUT = new URL("../public/data.json", import.meta.url);
const token = process.env.GITHUB_TOKEN;

let previous = null;
try {
  previous = JSON.parse(await readFile(OUT, "utf8"));
} catch {
  // No earlier snapshot.
}

try {
  const core = await fetchCore(token);
  if (!core.calendar) throw new Error("contributions API unavailable");
  const { details, failed } = await fetchRepoDetails(core.repos, previous?.details, token);
  const missing = failed.filter((name) => !details[name]);
  if (missing.length) throw new Error(`no language data for ${missing.join(", ")}`);

  const snapshot = { ...core, details, fetchedAt: Date.now() };
  await writeFile(OUT, JSON.stringify(snapshot));
  const kb = Math.round(JSON.stringify(snapshot).length / 1024);
  console.log(`snapshot: ${core.repos.length} repos, ${core.events.length} events, ${core.calendar.length} days (${kb} KB)`);
} catch (err) {
  if (!previous) {
    console.error(`snapshot: ${err.message}. Retry later or set GITHUB_TOKEN.`);
    process.exit(1);
  }
  console.warn(`snapshot: ${err.message}; keeping snapshot from ${new Date(previous.fetchedAt).toLocaleString()}`);
}
