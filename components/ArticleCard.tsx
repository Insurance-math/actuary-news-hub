'use client';
import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { Article, isGoogleDiscovery, isSafeUrl } from '../lib/news';
import { isNewArticle } from '../lib/newsFilter';
import { fmt } from '../lib/format';

type Props = { a: Article; baseline: string | null; bookmarked: boolean; read: boolean; rank?: number; onBookmark: (a: Article) => void; onRead: (id: string) => void };

export default function ArticleCard({ a, baseline, bookmarked, read, rank, onBookmark, onRead }: Props) {
  return <article className="article"><div className="articleMain">
    <div className="meta">
      {rank !== undefined && <span className="rank">{rank}</span>}
      <span className={a.source_type === 'press' ? 'pill official' : 'pill'}>{a.category}</span>
      {a.source_type === 'press' && <span className="officialText">{a.feed_name.includes('RSS') ? '공식 RSS' : '검색으로 발견'}</span>}
      <span>{a.source}</span><span className="dot">·</span><time dateTime={a.published_at}>{fmt(a.published_at)}</time>
      {baseline && isNewArticle(a, baseline) && <span className="new">NEW</span>}
    </div>
    {isSafeUrl(a.url)
      ? <a className="headline" href={a.url} target="_blank" rel="noopener noreferrer" onClick={() => onRead(a.id)}>{a.title}<ExternalLink size={15} /></a>
      : <span className="headline">{a.title} <small>(링크 없음)</small></span>}
    <div className="bottomMeta"><span>학습 중요도 {'★'.repeat(a.score)}{'☆'.repeat(Math.max(0, 5 - a.score))}</span>{a.tags.slice(0, 3).map(t => <span className="tag" key={t}>#{t}</span>)}{isGoogleDiscovery(a) && <span className="tag">구글 뉴스 경유</span>}{read && <span className="read">읽음</span>}</div>
  </div>
    <button aria-label={bookmarked ? '북마크 해제' : '북마크 추가'} className="bookmark" onClick={() => onBookmark(a)}>{bookmarked ? <BookmarkCheck size={20} fill="#e7f1ff" /> : <Bookmark size={20} />}</button>
  </article>;
}
