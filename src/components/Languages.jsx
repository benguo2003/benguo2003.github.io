import { useMemo, useState } from "react";
import { foldOther, formatBytes, formatShare, languageBreakdown } from "../lib/stats";
import { Card, CardHeader, Segmented } from "./ui";

const MODES = [
  { value: "bytes", label: "By code" },
  { value: "repos", label: "By repos" },
];

export default function Languages({ repos, details, colors, index }) {
  const [mode, setMode] = useState("bytes");
  const [hovered, setHovered] = useState(null);

  const { rows, allRows, totalBytes } = useMemo(() => {
    const all = languageBreakdown(repos, details, mode);
    const bytes = languageBreakdown(repos, details, "bytes");
    return {
      rows: foldOther(all, colors.slotted),
      allRows: all,
      totalBytes: bytes.reduce((a, r) => a + r.bytes, 0),
    };
  }, [repos, details, mode, colors]);

  if (!rows.length) {
    return (
      <Card index={index}>
        <CardHeader eyebrow="02 · Languages" title="Languages" />
        <p className="text-sm text-muted">No language data yet.</p>
      </Card>
    );
  }

  const top = rows[0];
  const maxShare = Math.max(...rows.map((r) => r.share));
  const repoCount = repos.filter((r) => !r.fork).length;
  const dim = (name) => (hovered && hovered !== name ? 0.3 : 1);

  return (
    <Card index={index} className="flex flex-col">
      <CardHeader
        eyebrow="02 · Languages"
        title="Languages"
        subtitle={mode === "bytes" ? "Share of bytes written, own repos" : "Share of repos using each language"}
        actions={<Segmented label="Weighting" options={MODES} value={mode} onChange={setMode} />}
      />

      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-3xl font-semibold tracking-tight">{top.name}</p>
          <p className="text-xs text-muted">
            {allRows.length} languages · {formatBytes(totalBytes)} of code · {repoCount} repos
          </p>
        </div>
        <p className="text-3xl font-semibold tracking-tight text-ink-2">{formatShare(top.share)}</p>
      </div>

      {/* Part-to-whole strip with 2px surface gaps between segments */}
      <div className="mb-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={rows.map((r) => `${r.name} ${formatShare(r.share)}`).join(", ")}>
        {rows.map((r) => (
          <div
            key={r.name}
            className="h-full transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
            style={{ flexGrow: r.share, flexBasis: 0, minWidth: 3, background: colors.colorOf(r.name), opacity: dim(r.name) }}
            onMouseEnter={() => setHovered(r.name)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>

      <ul className="-mx-2 flex-1 space-y-0.5" onMouseLeave={() => setHovered(null)}>
        {rows.map((r) => (
          <li
            key={r.name}
            onMouseEnter={() => setHovered(r.name)}
            className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.25rem] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
            style={{ opacity: dim(r.name) }}
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors.colorOf(r.name) }} />
                <span className="truncate">{r.name}</span>
              </p>
              <p className="truncate pl-[18px] font-mono text-[10.5px] text-muted" title={r.other?.join(", ")}>
                {r.other
                  ? r.other.join(", ")
                  : mode === "bytes"
                    ? `${formatBytes(r.bytes)} · ${r.repoCount} repo${r.repoCount === 1 ? "" : "s"}`
                    : `${r.repoCount} repo${r.repoCount === 1 ? "" : "s"} · ${formatBytes(r.bytes)}`}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(r.share / maxShare) * 100}%`, background: colors.colorOf(r.name) }}
              />
            </div>
            <span className="text-right font-mono text-sm tabular-nums">{formatShare(r.share)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
