import { useRef, useState } from "react";
import { relativeTime } from "../lib/stats";
import { playThemeTransition } from "../lib/themeTransition";
import { Icon } from "./ui";

function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const animating = useRef(false);

  const apply = (next) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Preference just won't persist.
    }
    setTheme(next);
  };

  const toggle = async (e) => {
    if (animating.current) return;
    const next = theme === "dark" ? "light" : "dark";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(next);

    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    animating.current = true;
    try {
      await playThemeTransition({ x: left + width / 2, y: top + height / 2, theme: next, onCovered: () => apply(next) });
    } finally {
      animating.current = false;
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="group grid h-9 w-9 place-items-center overflow-hidden rounded-full text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <span key={theme} className="theme-icon grid place-items-center">
        <Icon name={theme === "dark" ? "sun" : "moon"} />
      </span>
    </button>
  );
}

const PUSH_RECENCY = [
  { within: 1, color: "var(--series-3)", pulse: true, label: "pushed in the last 24 hours" },
  { within: 7, color: "var(--series-3)", label: "pushed this week" },
  { within: 30, color: "var(--series-4)", label: "pushed this month" },
  { within: Infinity, color: "var(--axis)", label: "no pushes in the last 30 days" },
];

export default function Header({ profile, lastPush }) {
  const joined = new Date(profile.created_at);
  const years = Math.floor((Date.now() - joined) / (365.25 * 86_400_000));
  const recency = lastPush && PUSH_RECENCY.find((r) => Date.now() - new Date(lastPush.at) < r.within * 86_400_000);

  return (
    <header className="reveal flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between" style={{ "--i": 0 }}>
      <div className="flex items-center gap-4 sm:gap-5">
        <img
          src={profile.avatar_url}
          alt=""
          width={80}
          height={80}
          className="h-16 w-16 shrink-0 rounded-2xl ring-1 ring-line sm:h-20 sm:w-20"
        />
        <div className="min-w-0">
          <p className="eyebrow mb-1">github.com/{profile.login}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{profile.name || profile.login}</h1>
          <p className="mt-1 text-sm text-ink-2">{profile.bio}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:items-end">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={profile.html_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-page transition-opacity hover:opacity-85"
          >
            <Icon name="github" /> Follow on GitHub
          </a>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 sm:justify-end">
          {profile.location && (
            <li className="flex items-center gap-1.5"><Icon name="pin" size={12} className="text-muted" />{profile.location}</li>
          )}
          <li className="flex items-center gap-1.5">
            <Icon name="calendar" size={12} className="text-muted" />
            Joined {joined.toLocaleDateString("en-US", { month: "short", year: "numeric" })} · {years}y
          </li>
          <li className="flex items-center gap-1.5">
            <Icon name="person" size={12} className="text-muted" />
            <b className="font-semibold text-ink">{profile.followers}</b> followers · <b className="font-semibold text-ink">{profile.following}</b> following
          </li>
        </ul>
        {lastPush && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted" title={recency.label}>
            <span className="relative flex h-2 w-2" aria-label={recency.label}>
              {recency.pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: recency.color }} />}
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: recency.color }} />
            </span>
            last push → {lastPush.repo} · {relativeTime(lastPush.at)}
          </p>
        )}
      </div>
    </header>
  );
}
