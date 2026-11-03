import { describe, expect, it } from "vitest";
import {
  bucketMonths,
  bucketWeeks,
  describeChange,
  foldOther,
  formatShare,
  getStreaks,
  languageBreakdown,
  normalizeCalendar,
  percentChange,
  rollingAverage,
  weekdayTotals,
  yearlyTotals,
} from "./stats";

const day = (date, count) => ({ date, count, level: count ? 1 : 0 });
const TODAY = new Date(2026, 10, 2); // Mon Nov 2, 2026

describe("normalizeCalendar", () => {
  it("sorts, dedupes, and drops future days", () => {
    const cal = normalizeCalendar(
      [day("2026-11-03", 5), day("2026-11-01", 1), day("2026-10-31", 2), day("2026-11-01", 4)],
      TODAY
    );
    expect(cal.map((d) => d.date)).toEqual(["2026-10-31", "2026-11-01"]);
    expect(cal[1].count).toBe(4);
  });
});

describe("getStreaks", () => {
  it("counts a streak that ends yesterday when today is still empty", () => {
    const cal = [day("2026-10-30", 1), day("2026-10-31", 2), day("2026-11-01", 3), day("2026-11-02", 0)];
    expect(getStreaks(cal, TODAY).current).toBe(3);
  });

  it("includes today when today has contributions", () => {
    const cal = [day("2026-10-31", 0), day("2026-11-01", 3), day("2026-11-02", 1)];
    const s = getStreaks(cal, TODAY);
    expect(s.current).toBe(2);
    expect(s.currentStart).toBe("2026-11-01");
  });

  it("finds the longest run anywhere in history", () => {
    const cal = [
      day("2026-01-01", 1), day("2026-01-02", 1), day("2026-01-03", 1), day("2026-01-04", 0),
      day("2026-01-05", 1), day("2026-11-02", 0),
    ];
    const s = getStreaks(cal, TODAY);
    expect(s.current).toBe(0);
    expect(s.longest).toEqual({ length: 3, start: "2026-01-01", end: "2026-01-03" });
  });

  it("does not join runs across a missing day", () => {
    const cal = [day("2026-01-01", 1), day("2026-01-03", 1)];
    expect(getStreaks(cal, TODAY).longest.length).toBe(1);
  });
});

describe("bucketWeeks", () => {
  it("buckets into Sunday-aligned weeks ending with the current week", () => {
    const cal = [day("2026-10-25", 2), day("2026-10-31", 3), day("2026-11-01", 4), day("2026-11-02", 1)];
    const weeks = bucketWeeks(cal, 2, TODAY);
    expect(weeks.map((w) => w.key)).toEqual(["2026-10-25", "2026-11-01"]);
    expect(weeks.map((w) => w.count)).toEqual([5, 5]);
    expect(weeks[1].activeDays).toBe(2);
  });
});

describe("bucketMonths", () => {
  it("emits every month in range, including empty ones", () => {
    const cal = [day("2026-08-03", 2), day("2026-10-10", 5)];
    const months = bucketMonths(cal, new Date(2026, 7, 15), TODAY);
    expect(months.map((m) => [m.key, m.count])).toEqual([
      ["2026-08", 2], ["2026-09", 0], ["2026-10", 5], ["2026-11", 0],
    ]);
  });
});

describe("rollingAverage", () => {
  it("averages a trailing window", () => {
    expect(rollingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });
});

describe("percentChange", () => {
  it("returns null without a baseline", () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(15, 10)).toBe(50);
  });
});

describe("describeChange", () => {
  it("uses absolute phrasing for tiny baselines and percentages otherwise", () => {
    expect(describeChange(128, 5, "prior year")).toEqual({ text: "up from 5 in the prior year", tone: "good" });
    expect(describeChange(30, 40, "prior year")).toEqual({ text: "▼ 25% vs prior year", tone: "bad" });
    expect(describeChange(3, 0, "prior year").text).toBe("none in the prior year");
  });
});

describe("weekdayTotals / yearlyTotals", () => {
  it("sums by weekday and fills empty years", () => {
    const cal = [day("2026-11-01", 3), day("2026-11-02", 2), day("2024-01-01", 1)];
    const wd = weekdayTotals(cal);
    expect(wd[0].count).toBe(3); // Sunday
    expect(wd[1].count).toBe(3); // Mondays: Nov 2 2026 + Jan 1 2024
    expect(yearlyTotals(cal, 2023).map((y) => [y.year, y.count])).toEqual([
      ["2023", 0], ["2024", 1], ["2025", 0], ["2026", 5],
    ]);
  });
});

describe("languageBreakdown", () => {
  const repos = [
    { name: "a", fork: false, language: "JavaScript" },
    { name: "b", fork: false, language: "Python" },
    { name: "c", fork: true, language: "Go" },
    { name: "d", fork: false, language: "C++" },
  ];
  const details = {
    a: { languages: { JavaScript: 750, CSS: 50 } },
    b: { languages: { Python: 200 } },
    c: { languages: { Go: 9999 } },
  };

  it("weights by bytes and ignores forks", () => {
    const rows = languageBreakdown(repos, details, "bytes");
    expect(rows.map((r) => r.name)).toEqual(["JavaScript", "Python", "CSS"]);
    expect(rows[0].share).toBeCloseTo(0.75);
  });

  it("counts repos per language, falling back to the primary language", () => {
    const rows = languageBreakdown(repos, details, "repos");
    expect(rows.find((r) => r.name === "C++").repoCount).toBe(1);
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
  });

  it("folds languages outside the kept set into Other", () => {
    const rows = foldOther(languageBreakdown(repos, details, "bytes"), new Set(["JavaScript"]));
    expect(rows.map((r) => r.name)).toEqual(["JavaScript", "Other"]);
    expect(rows[1].other).toEqual(["Python", "CSS"]);
  });
});

describe("formatShare", () => {
  it("never rounds a non-zero share down to 0%", () => {
    expect(formatShare(0.002)).toBe("<1%");
    expect(formatShare(0.053)).toBe("5.3%");
    expect(formatShare(0.531)).toBe("53%");
  });
});
