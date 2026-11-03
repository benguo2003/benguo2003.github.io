import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  addDays,
  bucketMonths,
  bucketWeeks,
  describeChange,
  formatNumber,
  fromKey,
  rollingAverage,
  sumRange,
  toKey,
} from "../lib/stats";
import { Card, CardHeader, Metric, Segmented, TooltipBox } from "./ui";

const RANGES = [
  { value: "12w", label: "12W", weeks: 12, prevLabel: "prior 12 weeks" },
  { value: "6m", label: "6M", weeks: 26, prevLabel: "prior 6 months" },
  { value: "1y", label: "1Y", weeks: 52, prevLabel: "prior year" },
  { value: "all", label: "All" },
];

const AXIS_TICK = { fontSize: 11, fill: "var(--muted)", fontFamily: "var(--font-mono)" };

export default function ActivityChart({ calendar, since, index }) {
  const [range, setRange] = useState("1y");
  const [view, setView] = useState("chart");
  const cfg = RANGES.find((r) => r.value === range);
  const weekly = range !== "all";
  const avgWindow = weekly ? 4 : 3;

  const model = useMemo(() => {
    const today = new Date();
    const buckets = weekly ? bucketWeeks(calendar, cfg.weeks, today) : bucketMonths(calendar, since, today);
    const avg = rollingAverage(buckets.map((b) => b.count), avgWindow);
    const data = buckets.map((b, i) => ({ ...b, avg: Math.round(avg[i] * 10) / 10, partial: i === buckets.length - 1 }));

    const startKey = weekly ? data[0].key : toKey(since);
    const todayKey = toKey(today);
    const current = sumRange(calendar, startKey, todayKey);
    const span = Math.round((today - fromKey(startKey)) / 86_400_000) + 1;

    let change = null;
    if (weekly) {
      const prevStart = toKey(addDays(fromKey(startKey), -cfg.weeks * 7));
      const prevEnd = toKey(addDays(today, -cfg.weeks * 7));
      change = describeChange(current.total, sumRange(calendar, prevStart, prevEnd).total, cfg.prevLabel);
    }

    let peakIndex = -1;
    data.forEach((d, i) => {
      if (d.count > 0 && (peakIndex < 0 || d.count > data[peakIndex].count)) peakIndex = i;
    });

    return { data, total: current.total, activeDays: current.activeDays, span, change, peakIndex };
  }, [calendar, since, weekly, cfg, avgWindow]);

  const { data, total, activeDays, span, change, peakIndex } = model;
  const peak = data[peakIndex];
  const unit = weekly ? "week" : "month";

  return (
    <Card index={index} className="flex flex-col lg:col-span-2">
      <CardHeader
        eyebrow="01 · Contributions"
        title="Activity over time"
        subtitle={`Commits, PRs, issues & reviews per ${unit}, incl. private work`}
        actions={
          <>
            <Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />
            <Segmented label="View" options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} value={view} onChange={setView} />
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Metric
          label="Total"
          value={formatNumber(total)}
          sub={change ? change.text : "since joining"}
          tone={change?.tone}
        />
        <Metric label={`Avg / ${unit}`} value={(total / data.length).toFixed(1)} sub={`over ${data.length} ${unit}s`} />
        <Metric label={`Peak ${unit}`} value={peak ? formatNumber(peak.count) : "–"} sub={peak ? peak.tooltipLabel.replace("Week of ", "wk of ") : "no activity"} />
        <Metric label="Active days" value={`${activeDays}`} sub={`${Math.round((activeDays / span) * 100)}% of ${formatNumber(span)} days`} />
      </div>

      {view === "chart" ? (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs whitespace-nowrap text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--series-1)]" /> Contributions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-[var(--series-2)]" /> {avgWindow}-{unit} average
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--series-1-soft)]" /> In progress
            </span>
          </div>
          <div className="min-h-64 flex-1 sm:min-h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 22, right: 14, left: -8, bottom: 0 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--axis)" }} minTickGap={28} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <TooltipBox
                        title={d.tooltipLabel + (d.partial ? " (so far)" : "")}
                        rows={[
                          { label: "Contributions", value: formatNumber(d.count), color: "var(--series-1)" },
                          { label: `${avgWindow}-${unit} avg`, value: d.avg, color: "var(--series-2)" },
                          { label: "Active days", value: d.activeDays },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" name="Contributions" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}
                  shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    if (!height) return null;
                    const r = Math.min(4, width / 2, height);
                    const fill = payload.partial ? "var(--series-1-soft)" : "var(--series-1)";
                    return (
                      <path
                        fill={fill}
                        d={`M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`}
                      />
                    );
                  }}
                >
                  <LabelList
                    dataKey="count"
                    content={({ x, y, width, index: i, value }) => {
                      if (i !== peakIndex) return null;
                      // Anchor toward the plot's interior so the label never clips at an edge.
                      const pos = i / data.length;
                      const anchor = pos > 0.85 ? "end" : pos < 0.1 ? "start" : "middle";
                      const lx = anchor === "end" ? x + width : anchor === "start" ? x : x + width / 2;
                      return (
                        <text x={lx} y={y - 8} textAnchor={anchor} fontSize={11} fontFamily="var(--font-mono)" fill="var(--ink-2)">
                          peak {value}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Line type="monotone" dataKey="avg" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="max-h-72 overflow-auto rounded-xl ring-1 ring-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left">
              <tr className="eyebrow">
                <th className="px-3 py-2 font-normal">{weekly ? "Week of" : "Month"}</th>
                <th className="px-3 py-2 text-right font-normal">Contributions</th>
                <th className="px-3 py-2 text-right font-normal">Active days</th>
                <th className="px-3 py-2 text-right font-normal">{avgWindow}-{unit} avg</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...data].reverse().map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="px-3 py-1.5 text-ink-2">{d.tooltipLabel.replace("Week of ", "")}{d.partial && " (so far)"}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{d.count}</td>
                  <td className="px-3 py-1.5 text-right text-ink-2">{d.activeDays}</td>
                  <td className="px-3 py-1.5 text-right text-ink-2">{d.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
