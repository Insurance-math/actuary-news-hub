import { addDays, weekRange } from './dates.ts';

export type TrendWeek = { week_start: string; counts: Record<string, number>; total: number };
export type Trends = { generated_at: string; keywords: string[]; weeks: TrendWeek[] };

/** 이번 주(월요일 시작)를 끝으로 최근 n주를 만든다. 기사가 없던 주는 0으로 채운다. */
export function lastWeeks(t: Trends, today: string, n = 12): TrendWeek[] {
  const end = weekRange(today)[0];
  const byStart = new Map(t.weeks.map(w => [w.week_start, w]));
  return Array.from({ length: n }, (_, i) => {
    const ws = addDays(end, -7 * (n - 1 - i));
    return byStart.get(ws) ?? { week_start: ws, counts: Object.fromEntries(t.keywords.map(k => [k, 0])), total: 0 };
  });
}

export function niceMax(v: number): number {
  if (v <= 5) return 5;
  const step = v <= 20 ? 5 : v <= 50 ? 10 : 50;
  return Math.ceil(v / step) * step;
}
