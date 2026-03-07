import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const USERNAME = "benguo2003";
const GITHUB_API = "https://api.github.com";

// --- Data Fetching Hook ---
function useGitHubData() {
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(`gh_${USERNAME}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < 10 * 60 * 1000) {
        setProfile(parsed.profile);
        setRepos(parsed.repos);
        setEvents(parsed.events);
        setLoading(false);
        return;
      }
    }

    async function fetchAll() {
      try {
        const headers = { Accept: "application/vnd.github.v3+json" };
        const [profileRes, reposRes, eventsRes] = await Promise.all([
          fetch(`${GITHUB_API}/users/${USERNAME}`, { headers }),
          fetch(`${GITHUB_API}/users/${USERNAME}/repos?per_page=100&sort=updated`, { headers }),
          fetch(`${GITHUB_API}/users/${USERNAME}/events/public?per_page=100`, { headers }),
        ]);

        if (!profileRes.ok) throw new Error(`GitHub API error: ${profileRes.status}`);

        const [profileData, reposData, eventsData] = await Promise.all([
          profileRes.json(),
          reposRes.json(),
          eventsRes.json(),
        ]);

        setProfile(profileData);
        setRepos(reposData);
        setEvents(eventsData);

        sessionStorage.setItem(`gh_${USERNAME}`, JSON.stringify({
          ts: Date.now(),
          profile: profileData,
          repos: reposData,
          events: eventsData,
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  return { profile, repos, events, loading, error };
}

// --- Derived Data ---

function getLanguageStats(repos) {
  const counts = {};
  for (const repo of repos) {
    if (repo.fork || !repo.language) continue;
    counts[repo.language] = (counts[repo.language] || 0) + (repo.size || 1);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const langColors = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
    Java: "#b07219", HTML: "#e34c26", CSS: "#563d7c", "C++": "#f34b7d",
    MATLAB: "#e16737", Ruby: "#701516", Go: "#00ADD8", Rust: "#dea584",
    Shell: "#89e051", Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB",
    Jupyter: "#DA5B0B", C: "#555555",
  };
  return Object.entries(counts)
    .map(([name, val]) => ({
      name,
      value: Math.round((val / total) * 100),
      color: langColors[name] || "#6b7280",
    }))
    .sort((a, b) => b.value - a.value);
}

function getWeeklyActivity(events) {
  const weeks = {};
  const now = new Date();
  // Initialize last 13 weeks
  for (let i = 12; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeks[label] = { week: label, commits: 0, prs: 0, issues: 0 };
  }
  const weekLabels = Object.keys(weeks);

  for (const event of events) {
    const eventDate = new Date(event.created_at);
    const diffDays = Math.floor((now - eventDate) / (1000 * 60 * 60 * 24));
    const weekIdx = 12 - Math.floor(diffDays / 7);
    if (weekIdx < 0 || weekIdx > 12) continue;
    const label = weekLabels[weekIdx];
    if (!label) continue;

    if (event.type === "PushEvent") {
      weeks[label].commits += event.payload?.commits?.length || 1;
    } else if (event.type === "PullRequestEvent") {
      weeks[label].prs += 1;
    } else if (event.type === "IssuesEvent") {
      weeks[label].issues += 1;
    }
  }
  return Object.values(weeks);
}

function getRecentActivity(events) {
  const typeLabels = {
    PushEvent: "Pushed to",
    PullRequestEvent: "PR on",
    CreateEvent: "Created",
    IssuesEvent: "Issue on",
    WatchEvent: "Starred",
    ForkEvent: "Forked",
    DeleteEvent: "Deleted branch in",
    IssueCommentEvent: "Commented on",
    PullRequestReviewEvent: "Reviewed PR on",
  };
  const typeColors = {
    PushEvent: "#6366f1",
    PullRequestEvent: "#06b6d4",
    CreateEvent: "#22c55e",
    IssuesEvent: "#f59e0b",
    WatchEvent: "#f59e0b",
    ForkEvent: "#8b5cf6",
    DeleteEvent: "#ef4444",
    IssueCommentEvent: "#06b6d4",
    PullRequestReviewEvent: "#06b6d4",
  };

  return events.slice(0, 15).map((event) => {
    const prefix = typeLabels[event.type] || event.type.replace("Event", "");
    const repoName = event.repo?.name?.replace(`${USERNAME}/`, "") || "";
    let detail = "";
    if (event.type === "PushEvent") {
      const commits = event.payload?.commits || [];
      detail = commits.length > 0 ? commits[0].message : "";
    } else if (event.type === "PullRequestEvent") {
      detail = event.payload?.pull_request?.title || "";
    } else if (event.type === "CreateEvent") {
      detail = `${event.payload?.ref_type || ""}${event.payload?.ref ? `: ${event.payload.ref}` : ""}`;
    } else if (event.type === "IssuesEvent") {
      detail = event.payload?.issue?.title || "";
    }

    const date = new Date(event.created_at);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let time;
    if (diffHours < 1) time = "Just now";
    else if (diffHours < 24) time = `${diffHours}h ago`;
    else if (diffDays < 7) time = `${diffDays}d ago`;
    else time = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return {
      color: typeColors[event.type] || "#6b7280",
      text: `${prefix} ${repoName}`,
      detail,
      time,
    };
  });
}

function buildHeatmapFromEvents(events) {
  const data = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count events by date
  const eventCounts = {};
  for (const event of events) {
    const date = new Date(event.created_at).toISOString().split("T")[0];
    eventCounts[date] = (eventCounts[date] || 0) + 1;
  }

  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();
    data.push({
      date: dateStr,
      count: eventCounts[dateStr] || 0,
      dayOfWeek,
      weekIndex: Math.floor(i / 7),
    });
  }
  return data;
}

function getRepoStatus(repo) {
  const now = new Date();
  const updated = new Date(repo.pushed_at || repo.updated_at);
  const diffMonths = (now - updated) / (1000 * 60 * 60 * 24 * 30);
  if (repo.archived) return "archived";
  if (diffMonths < 3) return "active";
  if (diffMonths < 12) return "maintained";
  return "archived";
}

// --- Components ---

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl animate-pulse"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          BG
        </div>
        <p className="text-gray-500 text-sm">Loading GitHub data...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      <div className="text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-md">
        <p className="text-red-600 font-medium mb-2">Failed to load GitHub data</p>
        <p className="text-gray-500 text-sm mb-4">{message}</p>
        <button onClick={() => { sessionStorage.removeItem(`gh_${USERNAME}`); window.location.reload(); }}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">
          Retry
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md" style={{ transition: "box-shadow 0.2s" }}>
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0" style={{ background: "linear-gradient(135deg, #f0f4ff, #e0e7ff)" }}>
        {icon}
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-emerald-600 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ProfileHeader({ profile }) {
  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <img
              src={profile.avatar_url}
              alt={profile.login}
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-full flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{profile.name || profile.login}</h1>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                @{profile.login}
                {profile.bio && <> &middot; {profile.bio}</>}
                {profile.location && <span className="hidden sm:inline"> &middot; {profile.location}</span>}
              </p>
            </div>
          </div>
          <a href={profile.html_url} target="_blank" rel="noreferrer"
            className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 flex-shrink-0 whitespace-nowrap"
            style={{ transition: "background 0.15s", textDecoration: "none" }}>
            <span className="hidden sm:inline">View on GitHub</span>
            <span className="sm:hidden">GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function ContributionHeatmap({ events }) {
  const data = useMemo(() => buildHeatmapFromEvents(events), [events]);
  const weeks = useMemo(() => {
    const w = [];
    let currentWeek = [];
    let lastWeekIndex = data[0]?.weekIndex;
    for (const d of data) {
      if (d.weekIndex !== lastWeekIndex) {
        w.push(currentWeek);
        currentWeek = [];
        lastWeekIndex = d.weekIndex;
      }
      currentWeek.push(d);
    }
    if (currentWeek.length) w.push(currentWeek);
    return w;
  }, [data]);

  const getColor = useCallback((count) => {
    if (count === 0) return "#ebedf0";
    if (count <= 1) return "#9be9a8";
    if (count <= 3) return "#40c463";
    if (count <= 5) return "#30a14e";
    return "#216e39";
  }, []);

  const totalContributions = data.reduce((sum, d) => sum + d.count, 0);

  // Build month labels from the actual data
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    for (const d of data) {
      const month = new Date(d.date).getMonth();
      if (month !== lastMonth) {
        labels.push(new Date(d.date).toLocaleDateString("en-US", { month: "short" }));
        lastMonth = month;
      }
    }
    return labels;
  }, [data]);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 mb-2">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
          {totalContributions} contributions in the last year
          {totalContributions === 0 && <span className="text-xs text-gray-400 font-normal ml-2">(based on public events)</span>}
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>Less</span>
          {[0, 1, 3, 5, 7].map((v, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: getColor(v) }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-0 mb-1" style={{ paddingLeft: "0px" }}>
        {monthLabels.map((m, i) => (
          <span key={i} className="text-xs text-gray-400" style={{ width: `${100 / monthLabels.length}%`, textAlign: "center" }}>{m}</span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div style={{ display: "flex", gap: "3px" }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  title={`${day.date}: ${day.count} contributions`}
                  style={{
                    width: "12px", height: "12px", borderRadius: "2px",
                    backgroundColor: getColor(day.count),
                    transition: "transform 0.1s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.target.style.transform = "scale(1.3)"; }}
                  onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PinnedRepos({ repos }) {
  // Show top 6 repos by stars, then recency
  const pinned = useMemo(() => {
    return [...repos]
      .filter(r => !r.fork)
      .sort((a, b) => {
        if (b.stargazers_count !== a.stargazers_count) return b.stargazers_count - a.stargazers_count;
        return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
      })
      .slice(0, 6);
  }, [repos]);

  const langColors = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
    Java: "#b07219", HTML: "#e34c26", CSS: "#563d7c", "C++": "#f34b7d",
    MATLAB: "#e16737", Ruby: "#701516", Go: "#00ADD8", Rust: "#dea584",
    Shell: "#89e051",
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Top Repositories</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pinned.map((repo) => (
          <a key={repo.name} href={repo.html_url} target="_blank" rel="noreferrer"
            className="p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm block"
            style={{ transition: "all 0.15s", textDecoration: "none" }}>
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#6b7280"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>
              <p className="font-semibold text-sm text-indigo-600">{repo.name}</p>
            </div>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">{repo.description || "No description"}</p>
            <div className="flex items-center gap-3">
              {repo.language && (
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColors[repo.language] || "#6b7280" }} />
                  <span className="text-xs text-gray-600">{repo.language}</span>
                </div>
              )}
              {repo.stargazers_count > 0 && (
                <div className="flex items-center gap-1">
                  <span style={{ color: "#f59e0b", fontSize: "12px" }}>&#9733;</span>
                  <span className="text-xs text-gray-600">{repo.stargazers_count}</span>
                </div>
              )}
              {repo.forks_count > 0 && (
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="#6b7280"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-1.5 0v.878H6.75v-.878a2.25 2.25 0 1 0-1.5 0ZM8 14.25a.75.75 0 0 1-.75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a.75.75 0 0 1-.75.75Z"/></svg>
                  <span className="text-xs text-gray-600">{repo.forks_count}</span>
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function AllReposTable({ repos }) {
  const [filter, setFilter] = useState("all");

  const reposWithStatus = useMemo(() =>
    repos.filter(r => !r.fork).map(r => ({ ...r, status: getRepoStatus(r) })),
    [repos]
  );

  const filtered = filter === "all" ? reposWithStatus : reposWithStatus.filter(r => r.status === filter);

  const langColors = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
    Java: "#b07219", HTML: "#e34c26", CSS: "#563d7c", "C++": "#f34b7d",
    MATLAB: "#e16737", Ruby: "#701516", Go: "#00ADD8", Rust: "#dea584",
    Shell: "#89e051",
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <h3 className="text-base font-semibold text-gray-900">All Repositories <span className="text-gray-400 font-normal">({reposWithStatus.length})</span></h3>
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 overflow-x-auto">
          {["all", "active", "maintained", "archived"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize whitespace-nowrap ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              style={{ transition: "all 0.15s" }}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map((repo) => (
          <a key={repo.name} href={repo.html_url} target="_blank" rel="noreferrer"
            className="block p-3 rounded-xl hover:bg-gray-50"
            style={{ transition: "background 0.15s", textDecoration: "none" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: langColors[repo.language] || "#6b7280" }} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{repo.name}</p>
                  <p className="text-xs text-gray-500 truncate">{repo.description || "No description"}</p>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium text-center flex-shrink-0 ml-2 ${
                repo.status === "active" ? "bg-emerald-50 text-emerald-700" :
                repo.status === "maintained" ? "bg-blue-50 text-blue-700" :
                "bg-gray-50 text-gray-500"
              }`}>
                {repo.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 ml-5 sm:ml-6">
              <span className="text-xs text-gray-500">{repo.language || "—"}</span>
              <div className="flex items-center gap-1">
                <span style={{ color: "#f59e0b", fontSize: "12px" }}>&#9733;</span>
                <span className="text-xs text-gray-600">{repo.stargazers_count}</span>
              </div>
              {repo.forks_count > 0 && <span className="text-xs text-gray-500">{repo.forks_count} forks</span>}
              <span className="text-xs text-gray-400">
                {new Date(repo.pushed_at || repo.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function RecentTimeline({ events }) {
  const activity = useMemo(() => getRecentActivity(events), [events]);

  if (activity.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <p className="text-sm text-gray-500">No recent public activity.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-1">
        {activity.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50" style={{ transition: "background 0.15s" }}>
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: item.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.text}</p>
              {item.detail && <p className="text-sm text-gray-500 truncate">{item.detail}</p>}
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function GitHubDashboard() {
  const { profile, repos, events, loading, error } = useGitHubData();
  const [activeTab, setActiveTab] = useState("overview");

  const languages = useMemo(() => repos.length ? getLanguageStats(repos) : [], [repos]);
  const weeklyActivity = useMemo(() => events.length ? getWeeklyActivity(events) : [], [events]);

  const totalStars = useMemo(() => repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0), [repos]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!profile) return <ErrorScreen message="No profile data" />;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      <ProfileHeader profile={profile} />

      {/* Tab Nav */}
      <div className="px-4 sm:px-6 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
            {["overview", "repos", "activity"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium capitalize ${activeTab === tab ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
                style={{ transition: "all 0.15s" }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-8 pt-4">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard icon="&#128218;" label="Repositories" value={profile.public_repos} />
                <StatCard icon="&#11088;" label="Stars Earned" value={totalStars} />
                <StatCard icon="&#128101;" label="Followers" value={profile.followers} />
                <StatCard icon="&#128100;" label="Following" value={profile.following} />
              </div>

              <ContributionHeatmap events={events} />
              <PinnedRepos repos={repos} />

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Recent Weekly Activity</h3>
                  <p className="text-sm text-gray-500 mb-4">Commits, PRs, and issues from public events</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={weeklyActivity}>
                      <defs>
                        <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }} />
                      <Area type="monotone" dataKey="commits" stroke="#6366f1" strokeWidth={2.5} fill="url(#gc)" name="Commits" />
                      <Area type="monotone" dataKey="prs" stroke="#06b6d4" strokeWidth={2.5} fill="url(#gp)" name="Pull Requests" />
                      <Area type="monotone" dataKey="issues" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gi)" name="Issues" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Languages</h3>
                  <p className="text-sm text-gray-500 mb-4">Across all repos</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={languages} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value" stroke="none">
                        {languages.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: "8px", fontSize: "13px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {languages.map((l) => (
                      <div key={l.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                          <span className="text-gray-700 text-xs">{l.name}</span>
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{l.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Repos Tab */}
          {activeTab === "repos" && <AllReposTable repos={repos} />}

          {/* Activity Tab */}
          {activeTab === "activity" && <RecentTimeline events={events} />}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-xs text-gray-400">Live data from github.com/{profile.login}</p>
      </div>
    </div>
  );
}
