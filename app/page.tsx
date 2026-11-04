'use client';
import { Fragment, useMemo, useState } from 'react';
import { Bookmark, Check, Newspaper, Search, ShieldCheck, Clock3, AlertCircle, SlidersHorizontal } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import Footer from '../components/Footer';
import SiteHeader from '../components/SiteHeader';
import DateBar, { DateFilter } from '../components/DateBar';
import { Article, CATEGORIES } from '../lib/news';
import { countByDate, dayHeading, kstDate, shiftMonth, todayKst } from '../lib/dates';
import { fmt } from '../lib/format';
import { isNewArticle } from '../lib/newsFilter';
import { useNews } from '../lib/useNews';
import { useSaved } from '../lib/useSaved';

type Tab = '새 뉴스' | '전체 뉴스' | '감독당국 보도자료' | '북마크';
const TABS: Tab[] = ['새 뉴스', '전체 뉴스', '감독당국 보도자료', '북마크'];
const PAGE = 50;

export default function Home() {
  const [tab, setTab] = useState<Tab>('새 뉴스');
  const [category, setCategory] = useState<string>('전체');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'latest' | 'important'>('latest');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [calMonth, setCalMonth] = useState(todayKst().slice(0, 7));
  const { saved, ready, update, toggleBookmark, markRead } = useSaved();
  // 달력 월의 KST 날짜는 UTC 월 샤드 경계에 걸칠 수 있어 앞뒤 월도 함께 불러온다
  const { index, all, failure, loading } = useNews(search.trim() ? 'all' : [shiftMonth(calMonth, -1), calMonth, shiftMonth(calMonth, 1)]);
  const baseline = saved.lastConfirmed;

  const base = useMemo(() => {
    let r: Article[] = tab === '북마크' ? Object.values(saved.bookmarks) : all;
    if (tab === '새 뉴스') r = r.filter(a => isNewArticle(a, baseline));
    if (tab === '감독당국 보도자료') r = r.filter(a => a.source_type === 'press');
    if (category !== '전체') r = r.filter(a => a.category === category); // '미분류'는 7개 탭에 안 나오고 '전체'에서만
    const q = search.trim().toLowerCase();
    if (q) r = r.filter(a => [a.title, a.source, a.category, ...a.tags].join(' ').toLowerCase().includes(q));
    return [...r].sort((a, b) => sort === 'important' ? b.score - a.score || b.published_at.localeCompare(a.published_at) : b.published_at.localeCompare(a.published_at));
  }, [tab, all, category, search, sort, baseline, saved.bookmarks]);
  const dayCounts = useMemo(() => countByDate(base), [base]); // 달력 표시용(날짜 필터 제외)
  const rows = useMemo(() => dateFilter ? base.filter(a => { const d = kstDate(a.published_at); return d >= dateFilter.from && d <= dateFilter.to; }) : base, [base, dateFilter]);
  const perDay = useMemo(() => countByDate(rows), [rows]);

  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const markDone = () => { update(s => ({ ...s, lastConfirmed: new Date().toISOString() })); setPage(1); };

  return <main className="shell">
    <SiteHeader current="/" />
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
    <DateBar filter={dateFilter} onChange={f => { setDateFilter(f); setPage(1); }} counts={dayCounts} month={calMonth} onMonth={setCalMonth} />
    {tab === '새 뉴스' && <div className="notice"><div><b>마지막 확인 완료 이후 수집된 기사</b><p>{baseline ? `마지막 확인 완료: ${fmt(baseline)}` : '처음 접속했습니다. 보관 중인 뉴스를 모두 새 뉴스로 표시합니다.'} · 수집시각 기준(표시 시각은 발행시각)</p></div><button className="confirm" disabled={!ready} onClick={markDone}><Check size={15} /> 새 뉴스 확인 완료</button></div>}
    {tab === '감독당국 보도자료' && <div className="notice"><div><b>금융위원회 · 금융감독원 관련 자료</b><p>금융위는 공식 RSS와 검색으로 발견한 자료를 함께 보여주며, 금융감독원은 직접 수집이 아니라 검색으로 발견한 자료입니다. 누락될 수 있습니다.</p></div></div>}
    <div className="listHead"><h3>{tab} <small>{rows.length.toLocaleString()}건</small></h3><span>{index?.updated_at ? `마지막 수집 ${fmt(index.updated_at)}` : '수집 이력 없음'}</span></div>
    {failure && <div className="error"><AlertCircle size={17} /> {failure}</div>}
    <section className="articles">{loading ? <div className="empty">뉴스를 불러오는 중입니다…</div> : pageRows.length === 0
      ? <div className="empty"><Newspaper size={27} /><b>표시할 기사가 없습니다.</b><p>새 뉴스 확인 여부, 검색어, 수집 실행 결과를 확인하세요.</p></div>
      : pageRows.map((a, i) => { const d = kstDate(a.published_at); const head = sort === 'latest' && (i === 0 || d !== kstDate(pageRows[i - 1].published_at));
        return <Fragment key={a.id}>{head && <div className="dayhead">{dayHeading(d)}<small>· {perDay[d]}건</small></div>}
          <ArticleCard a={a} baseline={baseline} bookmarked={!!saved.bookmarks[a.id]} read={saved.readIds.includes(a.id)} onBookmark={toggleBookmark} onRead={markRead} /></Fragment>; })}</section>
    {rows.length > PAGE && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</button><span>{page} / {Math.ceil(rows.length / PAGE)} 페이지</span><button disabled={page * PAGE >= rows.length} onClick={() => setPage(p => p + 1)}>다음</button></div>}
    <Footer />
  </main>;
}
