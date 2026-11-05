import BuildInfo from './BuildInfo';

export default function Footer() {
  return <footer>
    <p>기사 제목·링크·출처·발행시각만 저장하며 본문·이미지는 저장하지 않습니다. 구글 뉴스 경유 링크는 구글을 거쳐 원문으로 이동합니다.</p>
    <p>북마크·읽음·확인 시각은 이 브라우저(localStorage)에만 저장되며 기기 간 동기화되지 않습니다. 캐시를 지우면 초기화됩니다. 읽음 기록은 최근 1,500건까지만 보관됩니다.</p>
    <p>공개 사이트입니다. 매일 아침 자동 수집되며, 수집 시각은 수집 상태 페이지에서 볼 수 있습니다.</p>
    <BuildInfo />
  </footer>;
}
