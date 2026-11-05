'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, Newspaper, Search, ShieldCheck, Clock3, AlertCircle, SlidersHorizontal } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import DateBar, { DateFilter } from '../components/DateBar';
import SourceFilter, { SourceChips } from '../components/SourceFilter';
import { Article, CATEGORIES } from '../lib/news';
import { addDays, countByDate, dayHeading, kstDate, shiftMonth, todayKst } from '../lib/dates';
import { matchSources, sourceOptions } from '../lib/sources';
import { fmt } from '../lib/format';
import { isNewArticle, isUnreadNew, visibleInNewTab } from '../lib/newsFilter';
import { useNews } from '../lib/useNews';
import { useSaved } from '../lib/useSaved';

type Tab = '새 뉴스' | '전체 뉴스' | '감독당국 보도자료' | '북마크';
const TABS: Tab[] = ['새 뉴스', '전체 뉴스', '감독당국 보도자료', '북마크'];
const PAGE = 50;

export default function Home() {
  const [tab, setTab] = useState<Tab>('새 뉴스');
  const [category, setCategory] = useState<string>('전체');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sort, setSort] = useState<'latest' | 'important'>('latest');
  const [page, setPage] = useState(1);
  // 날짜 필터는 탭별로 보관한다. 전체 뉴스 탭만 처음에 '오늘'(KST)이 눌린 상태이고, '해제'한 선택은 새로고침 전까지 유지된다.
  const [dateFilters, setDateFilters] = useState<Partial<Record<Tab, DateFilter>>>({});
  const today = todayKst();
  const stored = dateFilters[tab];
  const dateFilter: DateFilter = stored !== undefined ? stored : tab === '전체 뉴스' ? { from: today, to: today } : null;
  const setDateFilter = (f: DateFilter) => setDateFilters(s => ({ ...s, [tab]: f }));
  const [sources, setSources] = useState<string[]>([]);  // 선택한 언론사(비면 전체)
  const [calMonth, setCalMonth] = useState(todayKst().slice(0, 7));
  const [showRead, setShowRead] = useState(false);            // 새 뉴스 탭: 읽은 기사 다시 보기(기본 숨김)
  const [justRead, setJustRead] = useState<Set<string>>(new Set()); // 방금 읽어 곧 사라질 카드(짧은 페이드 후 제거)
  const timers = useRef<number[]>([]);
  const { saved, ready, update, toggleBookmark, markRead, unmarkRead, readSet } = useSaved();
  // 달력 월의 KST 날짜는 UTC 월 샤드 경계에 걸칠 수 있어 앞뒤 월도 함께 불러온다
  const { index, all, failure, loading, loadingMore } = useNews(search.trim() ? 'all' : [shiftMonth(calMonth, -1), calMonth, shiftMonth(calMonth, 1)]);
  const baseline = saved.lastConfirmed;
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  // 제목 클릭·휠클릭·Enter 로 읽음 처리. 새 뉴스 탭에서는 클릭 이벤트가 끝난 직후(새 탭 열기가 시작된 뒤)에 카드를 제거한다.
  const handleRead = useCallback((id: string) => {
    markRead(id);
    if (tab !== '새 뉴스') return;
    setJustRead(s => new Set(s).add(id));
    timers.current.push(window.setTimeout(() => setJustRead(s => { const n = new Set(s); n.delete(id); return n; }), 250));
  }, [markRead, tab]);

  const base = useMemo(() => {
    let r: Article[] = tab === '북마크' ? Object.values(saved.bookmarks) : all;
    if (tab === '새 뉴스') r = r.filter(a => visibleInNewTab(a, { baseline, read: readSet, showRead, justRead }));
    if (tab === '감독당국 보도자료') r = r.filter(a => a.source_type === 'press');
    if (category !== '전체') r = r.filter(a => a.category === category); // '미분류'는 7개 탭에 안 나오고 '전체'에서만
    if (unreadOnly) r = r.filter(a => !readSet.has(a.id));
    const q = search.trim().toLowerCase();
    if (q) r = r.filter(a => [a.title, a.source, a.category, ...a.tags].join(' ').toLowerCase().includes(q));
    return [...r].sort((a, b) => sort === 'important' ? b.score - a.score || b.published_at.localeCompare(a.published_at) : b.published_at.localeCompare(a.published_at));
  }, [tab, all, category, search, sort, baseline, saved.bookmarks, unreadOnly, readSet, showRead, justRead]);
  const bySource = useMemo(() => matchSources(base, sources), [base, sources]);
  const dayCounts = useMemo(() => countByDate(bySource), [bySource]); // 달력 표시용(날짜 필터 제외, 언론사 선택은 반영)
  const inDate = (a: Article) => !dateFilter || (kstDate(a.published_at) >= dateFilter.from && kstDate(a.published_at) <= dateFilter.to);
  const rows = useMemo(() => bySource.filter(inDate), [bySource, dateFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  // 언론사 드롭다운 건수: 현재 탭·날짜·카테고리·검색·안 읽은 것 조건에 맞춘 값(언론사 선택 자체는 제외)
  const sourceOpts = useMemo(() => sourceOptions(base.filter(inDate), sources), [base, dateFilter, sources]); // eslint-disable-line react-hooks/exhaustive-deps
  const perDay = useMemo(() => countByDate(rows), [rows]);

  // 새 뉴스 건수(탭 배지): 마지막 확인 이후 수집 + 안 읽음. 읽은 기사는 빠진다(방금 읽어 사라지는 중인 카드는 이미 제외).
  const newCount = useMemo(() => all.filter(a => isUnreadNew(a, baseline, readSet)).length, [all, baseline, readSet]);
  const hiddenReadCount = useMemo(() => all.filter(a => isNewArticle(a, baseline) && readSet.has(a.id) && !justRead.has(a.id)).length, [all, baseline, readSet, justRead]);
  const lastPage = Math.max(1, Math.ceil(rows.length / PAGE));
  const curPage = Math.min(page, lastPage);  // 읽은 기사가 빠져 페이지 수가 줄어도 범위를 벗어나지 않게
  const pageRows = rows.slice((curPage - 1) * PAGE, curPage * PAGE);
  const markDone = () => { update(s => ({ ...s, lastConfirmed: new Date().toISOString() })); setPage(1); };

  return <>
    <nav className="primary" aria-label="주요 메뉴">{TABS.map(t =>
      <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setCategory('전체'); setSources([]); setPage(1); }}>
        {t === '새 뉴스' ? <Clock3 size={16} /> : t === '감독당국 보도자료' ? <ShieldCheck size={16} /> : t === '북마크' ? <Bookmark size={16} /> : <Newspaper size={16} />} {t}{t === '새 뉴스' && ready && !loading && <span className="count" aria-label={`안 읽은 새 뉴스 ${newCount}건`}>{newCount.toLocaleString()}</span>}
      </button>)}</nav>
    <div className="catRow">
      <div className="catOuter"><nav className="categories" aria-label="뉴스 카테고리">{(['전체', ...CATEGORIES] as const).map(c =>
        <button key={c} className={category === c ? 'chosen' : ''} onClick={() => { setCategory(c); setPage(1); }}>{c}</button>)}</nav></div>
      <SourceFilter options={sourceOpts} selected={sources} onChange={v => { setSources(v); setPage(1); }} />
    </div>
    <SourceChips selected={sources} onChange={v => { setSources(v); setPage(1); }} />
    <div className="toolbar">
      <div className="search"><Search size={16} /><input aria-label="뉴스 검색" placeholder="기사 제목·언론사 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      <label className="sort"><SlidersHorizontal size={15} /><select value={sort} onChange={e => { setSort(e.target.value as 'latest' | 'important'); setPage(1); }}><option value="latest">최신순</option><option value="important">중요도순</option></select></label>
      <label className="sort unread" title="제목을 클릭해 연 기사는 읽음으로 기록됩니다(새 뉴스 범위의 읽음 기록은 우선 보관)"><input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setPage(1); }} /> 안 읽은 것만</label>
    </div>
    <DateBar filter={dateFilter} onChange={f => { setDateFilter(f); setPage(1); }} counts={dayCounts} month={calMonth} onMonth={setCalMonth} />
    {tab === '새 뉴스' && <div className="notice"><div><b>마지막 확인 완료 이후 수집된 기사</b><p>{baseline ? `마지막 확인 완료: ${fmt(baseline)}` : '처음 접속했습니다. 보관 중인 뉴스를 모두 새 뉴스로 표시합니다.'} · 수집시각 기준(표시 시각은 발행시각)</p></div><button className="confirm" disabled={!ready} onClick={markDone}><Check size={15} /> 새 뉴스 확인 완료</button></div>}
    {tab === '새 뉴스' && (hiddenReadCount > 0 || showRead) && <div className="readToggleRow"><button type="button" className="readToggle" aria-pressed={showRead} onClick={() => { setShowRead(v => !v); setPage(1); }}>{showRead ? `읽은 기사 ${hiddenReadCount}건 표시 중 · 숨기기` : `읽은 기사 ${hiddenReadCount}건 숨김 · 다시 보기`}</button></div>}
    {tab === '감독당국 보도자료' && <div className="notice"><div><b>금융위원회 · 금융감독원 관련 자료</b><p>금융위는 공식 RSS와 검색으로 발견한 자료를 함께 보여주며, 금융감독원은 직접 수집이 아니라 검색으로 발견한 자료입니다. 누락될 수 있습니다.</p></div></div>}
    <div className="listHead"><h3>{tab} <small>{rows.length.toLocaleString()}건</small></h3><span>{loadingMore ? '과거 기사 불러오는 중…' : index?.updated_at ? `마지막 수집 ${fmt(index.updated_at)}` : '수집 이력 없음'}</span></div>
    {failure && <div className="error"><AlertCircle size={17} /> {failure}</div>}
    <section className="articles">{!ready || (loading && tab !== '북마크') ? <div className="empty">뉴스를 불러오는 중입니다…</div> : pageRows.length === 0
      ? (tab === '전체 뉴스' && dateFilter && dateFilter.from === today && dateFilter.to === today
        ? <div className="empty"><Newspaper size={27} /><b>오늘 올라온 기사가 아직 없습니다</b><p>{category !== '전체' || search.trim() || sources.length || unreadOnly ? '선택한 카테고리·검색·언론사 조건 기준입니다. ' : '수집은 매일 아침 이뤄집니다. '}어제 기사를 확인해 보세요.</p><button type="button" className="confirm" onClick={() => { const y = addDays(today, -1); setDateFilter({ from: y, to: y }); setCalMonth(y.slice(0, 7)); setPage(1); }}>어제 보기</button></div>
        : <div className="empty"><Newspaper size={27} /><b>표시할 기사가 없습니다.</b><p>새 뉴스 확인 여부, 검색어, 수집 실행 결과를 확인하세요.</p></div>)
      : pageRows.map((a, i) => { const d = kstDate(a.published_at); const head = sort === 'latest' && (i === 0 || d !== kstDate(pageRows[i - 1].published_at));
        return <Fragment key={a.id}>{head && <div className="dayhead">{dayHeading(d)}<small>· {perDay[d]}건</small></div>}
          <ArticleCard a={a} baseline={baseline} showDiscovery={tab === '감독당국 보도자료'} bookmarked={!!saved.bookmarks[a.id]} read={readSet.has(a.id)} dim={tab === '새 뉴스' || tab === '전체 뉴스'} fading={justRead.has(a.id)} onBookmark={toggleBookmark} onRead={handleRead} onUnread={tab === '새 뉴스' && showRead ? unmarkRead : undefined} /></Fragment>; })}</section>
    {rows.length > PAGE && <div className="pagination"><button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>이전</button><span>{curPage} / {lastPage} 페이지</span><button disabled={curPage >= lastPage} onClick={() => setPage(curPage + 1)}>다음</button></div>}
  </>;
}
