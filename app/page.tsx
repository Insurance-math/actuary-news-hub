'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Check, ExternalLink, Newspaper, Search, ShieldCheck, Clock3, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { isNewArticle } from '../lib/newsFilter';
import { Article, CATEGORIES, DataIndex, isGoogleDiscovery, isSafeUrl, loadIndex, loadMonth } from '../lib/news';

type Tab = '새 뉴스' | '전체 뉴스' | '감독당국 보도자료' | '북마크';
const TABS: Tab[] = ['새 뉴스', '전체 뉴스', '감독당국 보도자료', '북마크'];
const KEY = 'actuary-news-hub-v3';
const PAGE = 50;
type Saved = { bookmarks: Record<string, Article>; lastConfirmed: string | null; readIds: string[] };
const EMPTY: Saved = { bookmarks: {}, lastConfirmed: null, readIds: [] };

const fmt = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '날짜 미상' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(d);
};
const readSaved = (): Saved => { try { const r = localStorage.getItem(KEY); return r ? { ...EMPTY, ...JSON.parse(r) } : EMPTY; } catch { return EMPTY; } };

export default function Home() {
  const [tab, setTab] = useState<Tab>('새 뉴스');
  const [category, setCategory] = useState<string>('전체');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'latest' | 'important'>('latest');
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [byMonth, setByMonth] = useState<Record<string, Article[]>>({});
  const [failure, setFailure] = useState('');
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => { setSaved(readSaved()); setReady(true); }, []);
  const update = useCallback((fn: (s: Saved) => Saved) => {
    setSaved(s => { const n = fn(s); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} return n; });
  }, []);

  // 최근 2개월 먼저, 검색어가 있으면 전체 월 지연 로딩. 월 파일 하나가 실패해도 나머지는 표시.
  useEffect(() => { loadIndex().then(setIndex).catch(e => setFailure(`데이터 인덱스를 읽지 못했습니다: ${e.message}`)); }, []);
  const wanted = useMemo(() => {
    const m = index?.months.map(x => x.month) ?? [];
    return search.trim() ? m : m.slice(0, 2);
  }, [index, search]);
  useEffect(() => {
    wanted.filter(m => !(m in byMonth)).forEach(m => {
      loadMonth(m).then(rows => setByMonth(p => ({ ...p, [m]: rows })))
        .catch(e => { setByMonth(p => ({ ...p, [m]: [] })); setFailure(`${m} 데이터를 읽지 못했습니다: ${e.message}`); });
    });
  }, [wanted, byMonth]);

  const all = useMemo(() => Object.values(byMonth).flat(), [byMonth]);
  const baseline = saved.lastConfirmed;

  const rows = useMemo(() => {
    let r: Article[] = tab === '북마크' ? Object.values(saved.bookmarks) : all;
    if (tab === '새 뉴스') r = r.filter(a => isNewArticle(a, baseline));
    if (tab === '감독당국 보도자료') r = r.filter(a => a.source_type === 'press');
    if (category !== '전체') r = r.filter(a => a.category === category); // '미분류'는 7개 탭에 안 나오고 '전체'에서만
    const q = search.trim().toLowerCase();
    if (q) r = r.filter(a => [a.title, a.source, a.category, ...a.tags].join(' ').toLowerCase().includes(q));
    return [...r].sort((a, b) => sort === 'important' ? b.score - a.score || b.published_at.localeCompare(a.published_at) : b.published_at.localeCompare(a.published_at));
  }, [tab, all, category, search, sort, baseline, saved.bookmarks]);

  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const markDone = () => { update(s => ({ ...s, lastConfirmed: new Date().toISOString() })); setPage(1); };
  const toggleBookmark = (a: Article) => update(s => { const b = { ...s.bookmarks }; if (b[a.id]) delete b[a.id]; else b[a.id] = a; return { ...s, bookmarks: b }; });
  const loading = !index && !failure;

  return <main className="shell">
    <header className="top"><div className="brand"><div className="logo"><Newspaper size={23} /></div><div><h1>Actuary News Hub</h1><p>보험산업 · 보험계리 · 금융시장</p></div></div></header>
    <nav className="primary" aria-label="주요 메뉴">{TABS.map(t =>
      <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setCategory('전체'); setPage(1); }}>
        {t === '새 뉴스' ? <Clock3 size={16} /> : t === '감독당국 보도자료' ? <ShieldCheck size={16} /> : t === '북마크' ? <Bookmark size={16} /> : <Newspaper size={16} />} {t}
      </button>)}</nav>
    <div className="catOuter"><nav className="categories" aria-label="뉴스 카테고리">{(['전체', ...CATEGORIES] as const).map(c =>
      <button key={c} className={category === c ? 'chosen' : ''} onClick={() => { setCategory(c); setPage(1); }}>{c}</button>)}</nav></div>
    <div className="toolbar">
      <div className="search"><Search size={16} /><input aria-label="뉴스 검색" placeholder="기사 제목·언론사 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      <label className="sort"><SlidersHorizontal size={15} /><select value={sort} onChange={e => { setSort(e.target.value as 'latest' | 'important'); setPage(1); }}><option value="latest">최신순</option><option value="important">중요도순</option></select></label>
    </div>
    {tab === '새 뉴스' && <div className="notice"><div><b>마지막 확인 완료 이후 수집된 기사</b><p>{baseline ? `마지막 확인 완료: ${fmt(baseline)}` : '처음 접속했습니다. 보관 중인 뉴스를 모두 새 뉴스로 표시합니다.'} · 수집시각 기준(표시 시각은 발행시각)</p></div><button className="confirm" disabled={!ready} onClick={markDone}><Check size={15} /> 새 뉴스 확인 완료</button></div>}
    {tab === '감독당국 보도자료' && <div className="notice"><div><b>금융위원회 · 금융감독원 관련 자료</b><p>금융위는 공식 RSS와 검색으로 발견한 자료를 함께 보여주며, 금융감독원은 직접 수집이 아니라 검색으로 발견한 자료입니다. 누락될 수 있습니다.</p></div></div>}
    <div className="listHead"><h3>{tab} <small>{rows.length.toLocaleString()}건</small></h3><span>{index?.updated_at ? `마지막 수집 ${fmt(index.updated_at)}` : '수집 이력 없음'}</span></div>
    {failure && <div className="error"><AlertCircle size={17} /> {failure}</div>}
    <section className="articles">{loading ? <div className="empty">뉴스를 불러오는 중입니다…</div> : pageRows.length === 0
      ? <div className="empty"><Newspaper size={27} /><b>표시할 기사가 없습니다.</b><p>새 뉴스 확인 여부, 검색어, 수집 실행 결과를 확인하세요.</p></div>
      : pageRows.map(a => <article className="article" key={a.id}><div className="articleMain">
        <div className="meta">
          <span className={a.source_type === 'press' ? 'pill official' : 'pill'}>{a.category}</span>
          {a.source_type === 'press' && <span className="officialText">{a.feed_name.includes('RSS') ? '공식 RSS' : '검색으로 발견'}</span>}
          <span>{a.source}</span><span className="dot">·</span><time dateTime={a.published_at}>{fmt(a.published_at)}</time>
          {baseline && isNewArticle(a, baseline) && <span className="new">NEW</span>}
        </div>
        {isSafeUrl(a.url)
          ? <a className="headline" href={a.url} target="_blank" rel="noopener noreferrer" onClick={() => update(s => ({ ...s, readIds: s.readIds.includes(a.id) ? s.readIds : [...s.readIds, a.id].slice(-1500) }))}>{a.title}<ExternalLink size={15} /></a>
          : <span className="headline">{a.title} <small>(링크 없음)</small></span>}
        <div className="bottomMeta"><span>학습 중요도 {'★'.repeat(a.score)}{'☆'.repeat(Math.max(0, 5 - a.score))}</span>{a.tags.slice(0, 3).map(t => <span className="tag" key={t}>#{t}</span>)}{isGoogleDiscovery(a) && <span className="tag">구글 뉴스 경유</span>}{saved.readIds.includes(a.id) && <span className="read">읽음</span>}</div>
      </div>
        <button aria-label={saved.bookmarks[a.id] ? '북마크 해제' : '북마크 추가'} className="bookmark" onClick={() => toggleBookmark(a)}>{saved.bookmarks[a.id] ? <BookmarkCheck size={20} fill="#e7f1ff" /> : <Bookmark size={20} />}</button>
      </article>)}</section>
    {rows.length > PAGE && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</button><span>{page} / {Math.ceil(rows.length / PAGE)} 페이지</span><button disabled={page * PAGE >= rows.length} onClick={() => setPage(p => p + 1)}>다음</button></div>}
    <footer>
      <p>기사 제목·링크·출처·발행시각만 저장하며 본문·이미지는 저장하지 않습니다. 구글 뉴스 경유 링크는 구글을 거쳐 원문으로 이동합니다.</p>
      <p>북마크·읽음·확인 시각은 이 브라우저(localStorage)에만 저장되며 기기 간 동기화되지 않습니다. 캐시를 지우면 초기화됩니다.</p>
      <p>공개 사이트입니다. 수집은 수동 실행(GitHub Actions)이므로 최신 기사가 아닐 수 있습니다.</p>
    </footer>
  </main>;
}
