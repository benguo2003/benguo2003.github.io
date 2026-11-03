import { useEffect, useMemo, useState } from "react";
import ActivityChart from "./components/ActivityChart";
import ActivityFeed from "./components/ActivityFeed";
import Header from "./components/Header";
import Heatmap from "./components/Heatmap";
import { Highlights, WeekdayRhythm, YearByYear } from "./components/Insights";
import Languages from "./components/Languages";
import { ReposTable, TopRepos, enrichRepos } from "./components/Repos";
import StatTiles from "./components/StatTiles";
import { Card, Segmented } from "./components/ui";
import { buildLanguageColors } from "./lib/colors";
import { USERNAME, useGitHubData } from "./lib/github";
import {
  addDays,
  bestDay,
  bestMonth,
  describeChange,
  formatBytes,
  formatDay,
  formatNumber,
  getStreaks,
  languageBreakdown,
  relativeTime,
  sumRange,
  toKey,
  weekdayTotals,
  yearlyTotals,
} from "./lib/stats";

const TABS = ["overview", "repos", "activity"];

function useHashTab() {
  const read = () => (TABS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : "overview");
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (next) => {
    history.replaceState(null, "", next === "overview" ? window.location.pathname : `#${next}`);
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [tab, go];
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading GitHub data">
      <div className="flex items-center gap-5">
        <div className="skeleton h-20 w-20 rounded-2xl" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-3 w-44" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton h-[460px] lg:col-span-2" />
        <div className="skeleton h-[460px]" />
      </div>
    </div>
  );
}

function derive({ profile, repos, events, calendar, details }) {
  const today = new Date();
  const cal = calendar || [];
  const since = new Date(profile.created_at);
  const enriched = enrichRepos(repos, details);
  const own = enriched.filter((r) => !r.fork);

  const lastYear = sumRange(cal, toKey(addDays(today, -364)), toKey(today));
  const priorYear = sumRange(cal, toKey(addDays(today, -729)), toKey(addDays(today, -365)));
  const yoy = describeChange(lastYear.total, priorYear.total, "prior year");
  const streaks = getStreaks(cal, today);

  const byBytes = languageBreakdown(repos, details, "bytes");
  const colors = buildLanguageColors(byBytes);
  const totalBytes = byBytes.reduce((a, r) => a + r.bytes, 0);
  const commits = own.reduce((a, r) => a + (r.commits || 0), 0);
  const stars = own.reduce((a, r) => a + r.stargazers_count, 0);
  const forks = own.reduce((a, r) => a + r.forks_count, 0);
  const allTime = cal.reduce((a, d) => a + d.count, 0);

  const push = events.find((e) => e.type === "PushEvent");
  const lastPush = push
    ? { repo: push.repo.name.replace(`${USERNAME}/`, ""), at: push.created_at }
    : own[0] && { repo: own[0].name, at: own[0].pushed_at };

  const [bytesValue, bytesUnit] = formatBytes(totalBytes).split(" ");
  const tiles = [
    {
      label: "Last 12 months", icon: "commit", value: formatNumber(lastYear.total),
      sub: yoy.text,
      tone: yoy.tone,
    },
    {
      label: "Current streak", icon: "flame", value: streaks.current, unit: streaks.current === 1 ? "day" : "days",
      sub: streaks.current ? `since ${formatDay(streaks.currentStart)}` : "next one starts today",
    },
    {
      label: "Longest streak", icon: "flame", value: streaks.longest.length, unit: streaks.longest.length === 1 ? "day" : "days",
      sub: streaks.longest.start
        ? `${formatDay(streaks.longest.start)} – ${formatDay(streaks.longest.end, { month: "short", day: "numeric", year: "numeric" })}`
        : "–",
    },
    { label: "Commits", icon: "commit", value: formatNumber(commits), sub: `across ${own.filter((r) => r.commits).length} of my repos` },
    { label: "Stars", icon: "star", value: formatNumber(stars), sub: `${forks} forks · ${profile.followers} followers` },
    { label: "Code written", icon: "repo", value: bytesValue, unit: bytesUnit, sub: `in ${byBytes.length} languages` },
  ];

  const best = bestDay(cal);
  const month = bestMonth(cal);
  const topRepo = [...own].sort((a, b) => (b.commits || 0) - (a.commits || 0))[0];
  const longest = [...own].sort((a, b) => (new Date(b.pushed_at) - new Date(b.created_at)) - (new Date(a.pushed_at) - new Date(a.created_at)))[0];
  const newest = [...own].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const lifespanYears = longest && (new Date(longest.pushed_at) - new Date(longest.created_at)) / (365.25 * 86_400_000);

  const facts = [
    best && { icon: "flame", label: "Best single day", value: `${best.count} contributions`, sub: formatDay(best.date, { month: "short", day: "numeric", year: "numeric" }) },
    month && { icon: "calendar", label: "Busiest month", value: month.tooltipLabel, sub: `${formatNumber(month.count)} contributions` },
    { icon: "commit", label: "All-time contributions", value: formatNumber(allTime), sub: `since ${since.getFullYear()}` },
    topRepo?.commits && { icon: "repo", label: "Most-committed repo", value: topRepo.name, sub: `${formatNumber(topRepo.commits)} commits` },
    longest && { icon: "branch", label: "Longest-running project", value: longest.name, sub: `${lifespanYears.toFixed(1)} years of pushes` },
    newest && { icon: "tag", label: "Newest repo", value: newest.name, sub: `created ${relativeTime(newest.created_at)}` },
  ].filter(Boolean);

  return {
    since, enriched, colors, tiles, facts, lastPush, hasCalendar: cal.length > 0, cal,
    weekday: weekdayTotals(cal), yearly: yearlyTotals(cal, since.getFullYear()),
  };
}

export default function App() {
  const { data, loading, error, refresh } = useGitHubData();
  const [tab, setTab] = useHashTab();
  const view = useMemo(() => (data ? derive(data) : null), [data]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-6 sm:pt-12 lg:px-8">
      {loading && <Skeleton />}

      {!loading && !data && (
        <Card className="mx-auto max-w-md text-center">
          <p className="font-semibold">Couldn't load GitHub data</p>
          <p className="mt-1 mb-4 text-sm text-ink-2">{error}</p>
          <button onClick={() => refresh(true)} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-page">Try again</button>
        </Card>
      )}

      {view && (
        <>
          <Header profile={data.profile} lastPush={view.lastPush} />

          <nav className="reveal sticky top-3 z-20 my-6 flex justify-center sm:justify-start" style={{ "--i": 1 }}>
            <div className="rounded-full bg-surface/80 p-1 shadow-sm ring-1 ring-line backdrop-blur">
              <Segmented
                label="Section"
                size="lg"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "overview", label: "Overview" },
                  { value: "repos", label: `Repositories · ${view.enriched.filter((r) => !r.fork).length}` },
                  { value: "activity", label: "Activity" },
                ]}
              />
            </div>
          </nav>

          <main className="space-y-4">
            {tab === "overview" && (
              <>
                <StatTiles tiles={view.tiles} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {view.hasCalendar ? (
                    <ActivityChart calendar={view.cal} since={view.since} index={2} />
                  ) : (
                    <Card index={2} className="lg:col-span-2">
                      <p className="text-sm text-muted">Contribution history is temporarily unavailable. Try refreshing in a minute.</p>
                    </Card>
                  )}
                  <Languages repos={data.repos} details={data.details} colors={view.colors} index={3} />
                </div>
                {view.hasCalendar && (
                  <>
                    <Heatmap calendar={view.cal} years={view.yearly} index={4} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <WeekdayRhythm data={view.weekday} index={5} />
                      <YearByYear data={view.yearly} index={6} />
                      <Highlights facts={view.facts} index={7} />
                    </div>
                  </>
                )}
                <TopRepos repos={view.enriched} colorOf={view.colors.colorOf} index={8} onSeeAll={() => setTab("repos")} />
              </>
            )}
            {tab === "repos" && <ReposTable repos={view.enriched} colorOf={view.colors.colorOf} />}
            {tab === "activity" && <ActivityFeed events={data.events} />}
          </main>
        </>
      )}
    </div>
  );
}
