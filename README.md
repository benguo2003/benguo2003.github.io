# benguo2003.github.io

A live GitHub dashboard for [@benguo2003](https://github.com/benguo2003): contribution history, streaks, languages by bytes of code, and every repo with commit counts. It ships with a data snapshot from build time and refreshes live in the browser, so it stays current without a redeploy.

## What's on it

- **Activity over time**: weekly or monthly contributions (12W / 6M / 1Y / All) with a rolling average, peak, active days and change vs the prior period, plus a table view
- **Languages**: share of bytes written across own repos (or share of repos), from each repo's languages endpoint
- **Calendar heatmap** for any year back to 2019, **weekday rhythm**, **year-by-year** totals, and highlights (best day, busiest month, longest-running project…)
- **Repositories**: searchable, filterable, sortable, with per-repo language strips, commits and code size
- **Activity feed** of recent public events, grouped by day
- Light and dark themes

## Data sources

| Data | Source |
| --- | --- |
| Profile, repos, events | GitHub REST API (unauthenticated) |
| Languages & commit counts per repo | `/repos/:repo/languages`, `/repos/:repo/contributors` (cached by `pushed_at`) |
| Contribution calendar | [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) |

Every build bakes a full snapshot into `data.json` (`scripts/snapshot.mjs`), so the page renders instantly from its own origin and never depends on GitHub's 60 requests/hour unauthenticated limit. The browser then refreshes live in the background with about 3 requests, refetching per-repo languages and commits only for repos pushed since the snapshot. If the refresh fails, the snapshot stays on screen. Results are cached in `localStorage` for 15 minutes.

The snapshot needs about 30 GitHub requests. Set `GITHUB_TOKEN` when building to use the 5,000/hour authenticated limit.

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (Vitest)
npm run snapshot  # refresh public/data.json (also runs before every build)
npm run build     # production build into dist/
npm run deploy    # test, build, and publish dist/ to the gh-pages branch
```

Built with Vite, React 19, Tailwind CSS v4 and Recharts.
