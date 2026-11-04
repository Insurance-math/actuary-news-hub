import assert from 'node:assert/strict';
import { isNewArticle } from '../lib/newsFilter.ts';

// 시나리오: 어제 10:00에 확인 완료. 오늘 09:00에 수집됐지만 발행은 어제 08:00 (구글 검색에 늦게 잡힘)
const baseline = '2026-11-03T10:00:00+00:00';
const late = { published_at: '2026-11-03T08:00:00+00:00', collected_at: '2026-11-04T09:00:00+00:00' };
assert.equal(isNewArticle(late, baseline), true, '늦게 수집된 과거 발행 기사가 새 뉴스에서 빠짐');
assert.equal(late.published_at > baseline, false, '(참고) 발행시각 기준이면 누락되는 케이스');

// 확인 이전에 수집된 기사는 새 뉴스가 아님
assert.equal(isNewArticle({ published_at: '2026-11-03T05:00:00+00:00', collected_at: '2026-11-03T09:00:00+00:00' }, baseline), false);
// 첫 방문은 전체
assert.equal(isNewArticle(late, null), true);
// 확인 완료 직후 새로고침해도 기준 유지 → 같은 기사들은 계속 새 뉴스 아님
assert.equal(isNewArticle(late, '2026-11-04T10:00:00+00:00'), false);
console.log('new-news tests passed');
