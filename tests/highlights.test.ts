import assert from 'node:assert/strict';
import { weeklyHighlights } from '../lib/highlights.ts';

const mk = (id: string, published_at: string, score: number, category = '생명보험') => ({ id, published_at, score, category }) as any;
const arts = [
  mk('old', '2026-10-28T01:00:00Z', 5),           // 7일 밖
  mk('edge', '2026-10-29T01:00:00Z', 3),           // 10/29 KST = today-6 → 포함
  mk('a', '2026-11-04T01:00:00Z', 4),
  mk('b', '2026-11-03T01:00:00Z', 5),
  mk('c', '2026-11-04T05:00:00Z', 4, '손해보험'),
];
const r = weeklyHighlights(arts, '2026-11-04');
assert.deepEqual(r.map(x => x.id), ['b', 'c', 'a', 'edge']); // 5점, 4점(최신 먼저), 3점
assert.deepEqual(weeklyHighlights(arts, '2026-11-04', 2).map(x => x.id), ['b', 'c']);
assert.deepEqual(weeklyHighlights(arts, '2026-11-04', 20, '손해보험').map(x => x.id), ['c']);
console.log('highlights tests passed');
