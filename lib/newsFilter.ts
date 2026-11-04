/** 새 뉴스 판정: 수집시각(collected_at) > 마지막 확인 시각. 첫 방문(기준 없음)은 전부 새 뉴스.
 *  발행시각 기준이면 늦게 수집된 과거 발행 기사가 누락되므로 수집시각을 기본으로 쓴다. */
export function isNewArticle(a: { collected_at: string; published_at: string }, baseline: string | null): boolean {
  if (!baseline) return true;
  return (a.collected_at || a.published_at) > baseline;
}
