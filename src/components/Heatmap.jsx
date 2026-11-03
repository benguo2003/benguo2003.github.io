import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, bestDay, formatDay, formatNumber, fromKey, toKey } from "../lib/stats";
import { Card, CardHeader, TooltipBox } from "./ui";

const CELL = 11;
const STEP = 14;
const LEFT = 30;
const TOP = 18;

function buildGrid(calendar, year) {
  const byKey = new Map(calendar.map((d) => [d.date, d]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = year === "last" ? addDays(today, -364) : new Date(year, 0, 1);
  const lastDay = year === "last" ? today : new Date(Math.min(new Date(year, 11, 31), today));
  const gridStart = addDays(first, -first.getDay());
  const firstKey = toKey(first);
  const lastKey = toKey(lastDay);

  const cells = [];
  const colMonth = []; // month of each column's first in-range day
  let col = 0;
  for (let d = new Date(gridStart); d <= lastDay; d = addDays(d, 1)) {
    const key = toKey(d);
    if (d.getDay() === 0 && d > gridStart) col += 1;
    if (key < firstKey || key > lastKey) continue;
    const entry = byKey.get(key);
    cells.push({ key, col, row: d.getDay(), count: entry?.count || 0, level: entry?.level || 0 });
    if (colMonth[col] === undefined) colMonth[col] = d;
  }

  const months = [];
  colMonth.forEach((d, c) => {
    if (c === 0 || d.getMonth() !== colMonth[c - 1].getMonth()) {
      months.push({ col: c, label: d.toLocaleDateString("en-US", { month: "short" }) });
    }
  });
  // A partial first month sits too close to the next label; drop it.
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();
  const inRange = calendar.filter((d) => d.date >= firstKey && d.date <= lastKey);
  return { cells, months, cols: col + 1, inRange };
}

export default function Heatmap({ calendar, years, index }) {
  const [year, setYear] = useState("last");
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);

  const grid = useMemo(() => buildGrid(calendar, year), [calendar, year]);
  const total = grid.inRange.reduce((a, d) => a + d.count, 0);
  const active = grid.inRange.filter((d) => d.count > 0).length;
  const best = bestDay(grid.inRange);
  const width = LEFT + grid.cols * STEP + 16; // room for a trailing month label
  const height = TOP + 7 * STEP;

  // On narrow screens the grid scrolls; start at the most recent weeks.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [grid]);

  const onEnter = (e, cell) => {
    const box = e.currentTarget.getBoundingClientRect();
    const host = wrapRef.current.getBoundingClientRect();
    setHover({ cell, x: box.left - host.left + box.width / 2, y: box.top - host.top });
  };

  const chips = ["last", ...years.map((y) => Number(y.year)).reverse()];

  return (
    <Card index={index}>
      <CardHeader
        eyebrow="03 · Calendar"
        title={`${formatNumber(total)} contributions ${year === "last" ? "in the last year" : `in ${year}`}`}
        subtitle={`${active} active days${best ? ` · best day ${formatDay(best.date, { month: "short", day: "numeric", year: "numeric" })} with ${best.count}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Year">
            {chips.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={year === c}
                onClick={() => setYear(c)}
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  year === c ? "bg-ink text-page" : "text-muted ring-1 ring-line hover:text-ink"
                }`}
              >
                {c === "last" ? "Last 12 mo" : c}
              </button>
            ))}
          </div>
        }
      />

      <div ref={wrapRef} className="relative">
        <div ref={scrollRef} className="overflow-x-auto pb-1">
          <svg viewBox={`0 0 ${width} ${height}`} className="block w-full min-w-[680px]" role="img"
            aria-label={`Contribution calendar: ${total} contributions, ${active} active days`}>
            {grid.months.map((m) => (
              <text key={`${m.col}-${m.label}`} x={LEFT + m.col * STEP} y={10} fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">
                {m.label}
              </text>
            ))}
            {["Mon", "Wed", "Fri"].map((d, i) => (
              <text key={d} x={0} y={TOP + (i * 2 + 1) * STEP + 9} fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">
                {d}
              </text>
            ))}
            {grid.cells.map((c) => (
              <rect
                key={c.key}
                x={LEFT + c.col * STEP}
                y={TOP + c.row * STEP}
                width={CELL}
                height={CELL}
                rx={2.5}
                fill={`var(--heat-${c.level})`}
                stroke={hover?.cell.key === c.key ? "var(--ink)" : "none"}
                strokeWidth={1.5}
                onMouseEnter={(e) => onEnter(e, c)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
        </div>
        {hover && (
          <div className="absolute z-10 -translate-x-1/2 -translate-y-full" style={{ left: hover.x, top: hover.y - 6 }}>
            <TooltipBox title={`${hover.cell.count === 0 ? "No" : formatNumber(hover.cell.count)} contribution${hover.cell.count === 1 ? "" : "s"}`}>
              <p className="opacity-75">{fromKey(hover.cell.key).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</p>
            </TooltipBox>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[10.5px] text-muted">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="h-[11px] w-[11px] rounded-[2.5px]" style={{ background: `var(--heat-${l})` }} />
        ))}
        More
      </div>
    </Card>
  );
}
