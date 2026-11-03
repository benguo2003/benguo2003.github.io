# benguo2003.github.io

A live GitHub dashboard for [@benguo2003](https://github.com/benguo2003): contribution history, streaks, languages by bytes of code, and every repo with commit counts. Everything loads client-side, so the page is always current without a redeploy.

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

Responses are cached in `localStorage` for 15 minutes, and per-repo details are cached until the repo is pushed again, so a visit stays well under GitHub's 60 requests/hour unauthenticated limit.

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests for the stats logic (Vitest)
npm run build     # production build into dist/
npm run deploy    # test, build, and publish dist/ to the gh-pages branch
```

Built with Vite, React 19, Tailwind CSS v4 and Recharts.
