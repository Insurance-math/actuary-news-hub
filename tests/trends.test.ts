import assert from 'node:assert/strict';
import { lastWeeks, niceMax } from '../lib/trends.ts';

const t = { generated_at: '', keywords: ['K-ICS', '금리'], total: 0, weeks: [
  { week_start: '2026-10-26', counts: { 'K-ICS': 1, '금리': 14 }, total: 53 },
  { week_start: '2026-11-02', counts: { 'K-ICS': 2, '금리': 17 }, total: 251 },
] } as any;
const w = lastWeeks(t, '2026-11-04', 4); // 이번 주 시작 = 11/2
assert.deepEqual(w.map(x => x.week_start), ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
assert.deepEqual(w[0].counts, { 'K-ICS': 0, '금리': 0 }); // 빈 주는 0
assert.equal(w[3].counts['금리'], 17);
assert.equal(lastWeeks(t, '2026-11-08', 1)[0].week_start, '2026-11-02'); // 일요일도 같은 주
assert.equal(niceMax(0), 5); assert.equal(niceMax(17), 20); assert.equal(niceMax(23), 30); assert.equal(niceMax(120), 150);
console.log('trends tests passed');
