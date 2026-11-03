import { useMemo, useState } from "react";
import { formatBytes, formatNumber, relativeTime, repoStatus } from "../lib/stats";
import { Card, CardHeader, Icon, Segmented } from "./ui";

const STATUS_STYLE = {
  active: { dot: "var(--series-3)", label: "Active" },
  idle: { dot: "var(--series-4)", label: "Idle" },
  dormant: { dot: "var(--axis)", label: "Dormant" },
  archived: { dot: "var(--axis)", label: "Archived" },
};

/** Thin stacked bar of a repo's languages by bytes. */
function LanguageStrip({ languages, colorOf, className = "" }) {
  const entries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (!total) return <div className={`h-1.5 rounded-full bg-surface-2 ${className}`} />;
  return (
    <div className={`flex h-1.5 gap-[2px] overflow-hidden rounded-full ${className}`}
      title={entries.map(([n, v]) => `${n} ${Math.round((v / total) * 100)}%`).join(" · ")}>
      {entries.map(([name, bytes]) => (
        <div key={name} className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ flexGrow: bytes, flexBasis: 0, minWidth: 2, background: colorOf(name) }} />
      ))}
    </div>
  );
}

function LangLabel({ repo, colorOf }) {
  if (!repo.language) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: colorOf(repo.language) }} />
      {repo.language}
    </span>
  );
}

export function enrichRepos(repos, details) {
  return repos.map((r) => {
    const d = details[r.name];
    const codeBytes = d ? Object.values(d.languages || {}).reduce((a, b) => a + b, 0) : 0;
    return { ...r, commits: d?.commits ?? null, languages: d?.languages, codeBytes, status: repoStatus(r) };
  });
}

export function TopRepos({ repos, colorOf, index, onSeeAll }) {
  const top = useMemo(
    () =>
      repos
        .filter((r) => !r.fork)
        .sort((a, b) => (b.commits ?? 0) + b.stargazers_count * 10 - ((a.commits ?? 0) + a.stargazers_count * 10) ||
          new Date(b.pushed_at) - new Date(a.pushed_at))
        .slice(0, 6),
    [repos]
  );

  return (
    <Card index={index}>
      <CardHeader
        eyebrow="07 · Projects"
        title="Top repositories"
        subtitle="Ranked by my commits and stars"
        actions={
          <button onClick={onSeeAll} className="font-mono text-[11px] text-muted hover:text-ink">
            All {repos.filter((r) => !r.fork).length} repos →
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((repo) => (
          <a
            key={repo.id}
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line transition-all hover:-translate-y-0.5 hover:bg-surface-2 hover:shadow-md"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 font-semibold">
                <Icon name="repo" size={14} className="text-muted" />
                <span className="truncate group-hover:text-accent">{repo.name}</span>
              </p>
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_STYLE[repo.status].dot }} />
                {relativeTime(repo.pushed_at)}
              </span>
            </div>
            <p className="mb-4 line-clamp-2 min-h-10 text-sm text-ink-2">{repo.description || "No description"}</p>
            <LanguageStrip languages={repo.languages} colorOf={colorOf} className="mt-auto mb-3" />
            <div className="flex items-center gap-4 text-xs text-ink-2">
              <LangLabel repo={repo} colorOf={colorOf} />
              {repo.commits != null && (
                <span className="flex items-center gap-1"><Icon name="commit" size={12} className="text-muted" />{formatNumber(repo.commits)}</span>
              )}
              {repo.stargazers_count > 0 && (
                <span className="flex items-center gap-1"><Icon name="star" size={12} className="text-muted" />{repo.stargazers_count}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}

const SORTS = {
  pushed: { label: "Recently pushed", fn: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at) },
  commits: { label: "Most commits", fn: (a, b) => (b.commits ?? -1) - (a.commits ?? -1) },
  stars: { label: "Most stars", fn: (a, b) => b.stargazers_count - a.stargazers_count },
  size: { label: "Most code", fn: (a, b) => b.codeBytes - a.codeBytes },
  created: { label: "Newest", fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  name: { label: "Name", fn: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) },
};

const selectClass =
  "h-8 rounded-full bg-surface-2 px-3 font-mono text-[11px] text-ink-2 ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)]";

export function ReposTable({ repos, colorOf }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [sort, setSort] = useState("pushed");
  const [showForks, setShowForks] = useState(false);

  const forkCount = repos.filter((r) => r.fork).length;
  const languages = useMemo(
    () => [...new Set(repos.flatMap((r) => Object.keys(r.languages || {}).concat(r.language || [])))].sort(),
    [repos]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos
      .filter((r) => showForks || !r.fork)
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => language === "all" || r.language === language || r.languages?.[language])
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.topics?.some((t) => t.includes(q)))
      .sort(SORTS[sort].fn);
  }, [repos, query, status, language, sort, showForks]);

  return (
    <Card index={1}>
      <CardHeader eyebrow="Repositories" title={`${rows.length} repositor${rows.length === 1 ? "y" : "ies"}`} subtitle="Every public repo, with my commit counts and code size" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, description, topic…"
          aria-label="Search repositories"
          className="h-8 min-w-0 flex-1 basis-56 rounded-full bg-surface-2 px-4 text-sm ring-1 ring-line outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-[var(--series-1)]"
        />
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "idle", label: "Idle" }, { value: "dormant", label: "Dormant" }]}
        />
        <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass}>
          <option value="all">All languages</option>
          {languages.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        {forkCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted">
            <input type="checkbox" checked={showForks} onChange={(e) => setShowForks(e.target.checked)} className="accent-[var(--series-1)]" />
            forks ({forkCount})
          </label>
        )}
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_4.5rem_4rem_5rem_6rem] gap-4 border-b border-line px-3 pb-2 md:grid">
        {["Repository", "Languages", "Commits", "Stars", "Code", "Pushed"].map((h, i) => (
          <span key={h} className={`eyebrow ${i > 1 ? "text-right" : ""}`}>{h}</span>
        ))}
      </div>

      <ul className="divide-y divide-line">
        {rows.map((repo) => (
          <li key={repo.id}>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-1 gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_9rem_4.5rem_4rem_5rem_6rem] md:items-center md:gap-4"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{repo.name}</span>
                  {repo.fork && <span className="rounded-full px-1.5 font-mono text-[10px] font-normal text-muted ring-1 ring-line">fork</span>}
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-normal text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_STYLE[repo.status].dot }} />
                    {STATUS_STYLE[repo.status].label}
                  </span>
                </p>
                <p className="truncate text-xs text-ink-2">{repo.description || "No description"}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <LanguageStrip languages={repo.languages} colorOf={colorOf} />
                <span className="text-[11px] text-ink-2"><LangLabel repo={repo} colorOf={colorOf} /></span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-2 md:contents">
                <span className="tabular-nums md:text-right"><span className="text-muted md:hidden">commits </span>{repo.commits == null ? "–" : formatNumber(repo.commits)}</span>
                <span className="tabular-nums md:text-right"><span className="text-muted md:hidden">stars </span>{repo.stargazers_count}</span>
                <span className="tabular-nums md:text-right"><span className="text-muted md:hidden">code </span>{repo.codeBytes ? formatBytes(repo.codeBytes) : "–"}</span>
                <span className="text-muted md:text-right" title={new Date(repo.pushed_at).toLocaleString()}>{relativeTime(repo.pushed_at)}</span>
              </div>
            </a>
          </li>
        ))}
        {!rows.length && <li className="py-10 text-center text-sm text-muted">No repositories match these filters.</li>}
      </ul>
    </Card>
  );
}
