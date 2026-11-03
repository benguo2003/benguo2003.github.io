import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "../lib/stats";
import { Card, CardHeader, Icon, TooltipBox } from "./ui";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted)", fontFamily: "var(--font-mono)" };

/** Single-series bar chart that emphasizes its maximum and direct-labels it. */
function EmphasisBars({ data, dataKey, valueKey = "count", tooltipTitle, unitLabel = "contributions" }) {
  const max = Math.max(...data.map((d) => d[valueKey]));
  const isHot = (d) => d[valueKey] === max && max > 0;
  return (
    <div className="min-h-48 flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 0, left: -6, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={dataKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={0} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox title={tooltipTitle(payload[0].payload)} rows={[{ label: unitLabel, value: formatNumber(payload[0].value) }]} />
              ) : null
            }
          />
          <Bar dataKey={valueKey} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d[dataKey]} fill={isHot(d) ? "var(--series-1)" : "var(--series-1-soft)"} />
            ))}
            <LabelList
              dataKey={valueKey}
              content={({ x, y, width, value }) =>
                value === max && max > 0 ? (
                  <text x={x + width / 2} y={y - 7} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono)" fill="var(--ink-2)">
                    {formatNumber(value)}
                  </text>
                ) : null
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DAY_NAMES = { Sun: "Sundays", Mon: "Mondays", Tue: "Tuesdays", Wed: "Wednesdays", Thu: "Thursdays", Fri: "Fridays", Sat: "Saturdays" };

export function WeekdayRhythm({ data, index }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const top = [...data].sort((a, b) => b.count - a.count)[0];
  const weekend = data[0].count + data[6].count;
  return (
    <Card index={index} className="flex flex-col">
      <CardHeader
        eyebrow="04 · Rhythm"
        title={top.count ? `Most productive on ${DAY_NAMES[top.day]}` : "Weekly rhythm"}
        subtitle={total ? `${Math.round((weekend / total) * 100)}% of all-time contributions land on weekends` : "No contributions yet"}
      />
      <EmphasisBars data={data} dataKey="day" tooltipTitle={(d) => `${DAY_NAMES[d.day]}, all-time`} />
    </Card>
  );
}

export function YearByYear({ data, index }) {
  const thisYear = String(new Date().getFullYear());
  const best = [...data].sort((a, b) => b.count - a.count)[0];
  return (
    <Card index={index} className="flex flex-col">
      <CardHeader
        eyebrow="05 · History"
        title={best?.count ? `${best.year} was the biggest year` : "Year by year"}
        subtitle={best?.count ? `${formatNumber(best.count)} contributions${best.year === thisYear ? ", and counting" : ""}` : "No contributions yet"}
      />
      <EmphasisBars
        data={data.map((d) => ({ ...d, label: d.year === thisYear ? `${d.year.slice(2)}*` : `'${d.year.slice(2)}` }))}
        dataKey="label"
        tooltipTitle={(d) => (d.year === thisYear ? `${d.year} (year to date)` : d.year)}
      />
    </Card>
  );
}

export function Highlights({ facts, index }) {
  return (
    <Card index={index}>
      <CardHeader eyebrow="06 · Highlights" title="By the numbers" subtitle="Notable records from the full history" />
      <dl className="divide-y divide-line">
        {facts.map((f) => (
          <div key={f.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
              <Icon name={f.icon} size={14} />
            </span>
            <dt className="min-w-0 flex-1 text-sm text-ink-2">{f.label}</dt>
            <dd className="text-right">
              <span className="block text-sm font-semibold">{f.value}</span>
              {f.sub && <span className="block font-mono text-[10.5px] text-muted">{f.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
