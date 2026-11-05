import assert from 'node:assert/strict';
import { isNewArticle, isUnreadNew, visibleInNewTab } from '../lib/newsFilter.ts';

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

// --- 읽음 처리 ---
const A = { id: 'a', ...late };                       // 확인 이후 수집(새 뉴스 대상)
const OLD = { id: 'old', published_at: '2026-11-03T05:00:00+00:00', collected_at: '2026-11-03T09:00:00+00:00' }; // 확인 이전 수집
const none = new Set<string>();
const readA = new Set(['a']);
// 읽지 않은 새 기사만 목록·건수에 포함
assert.equal(isUnreadNew(A, baseline, none), true);
assert.equal(isUnreadNew(A, baseline, readA), false, '읽은 새 기사는 건수에서 제외');
assert.equal(isUnreadNew(OLD, baseline, none), false, '확인 이전 기사는 읽지 않았어도 새 뉴스가 아님');
// 새 뉴스 탭 가시성: 기본은 읽은 기사 숨김
assert.equal(visibleInNewTab(A, { baseline, read: none, showRead: false }), true);
assert.equal(visibleInNewTab(A, { baseline, read: readA, showRead: false }), false, '읽으면 사라진다');
assert.equal(visibleInNewTab(A, { baseline, read: readA, showRead: true }), true, '다시 보기를 켜면 읽은 기사도 보임');
assert.equal(visibleInNewTab(A, { baseline, read: readA, showRead: false, justRead: new Set(['a']) }), true, '방금 읽어 사라지는 중에는 잠깐 유지');
assert.equal(visibleInNewTab(OLD, { baseline, read: none, showRead: true }), false, '다시 보기를 켜도 새 뉴스 범위 밖 기사는 안 나옴');
// 확인 완료 기준은 그대로: 확인 후 새로 수집된 기사만 새 뉴스이고, 확인 전에 읽은 기록은 영향 없음
const afterConfirm = '2026-11-04T10:00:00+00:00';
assert.equal(visibleInNewTab(A, { baseline: afterConfirm, read: none, showRead: true }), false);
assert.equal(visibleInNewTab({ id: 'n', published_at: '2026-11-04T09:00:00+00:00', collected_at: '2026-11-04T11:00:00+00:00' }, { baseline: afterConfirm, read: readA, showRead: false }), true);
// 첫 방문(기준 없음)은 안 읽은 전체
assert.equal(visibleInNewTab(A, { baseline: null, read: none, showRead: false }), true);
console.log('new-news tests passed');
