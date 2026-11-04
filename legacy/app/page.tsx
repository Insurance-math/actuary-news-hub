'use client';
import {useEffect,useMemo,useState,useCallback} from 'react';
import {Bookmark,BookmarkCheck,ExternalLink,RefreshCw,Newspaper,Search,ShieldCheck,Clock3,AlertCircle,Check,SlidersHorizontal} from 'lucide-react';
import {Article,CATEGORIES,Category} from '../lib/news';
type Tab='새 뉴스'|'전체 뉴스'|'감독당국 보도자료'|'북마크';
type Payload={articles:Article[];checkedAt:string;page:number;pageSize:number;total:number};
const TABS:Tab[]=['새 뉴스','전체 뉴스','감독당국 보도자료','북마크'];
const KEY='actuary-news-cloud-v2';
type Saved={bookmarks:Record<string,Article>;lastConfirmed:string|null;currentSessionStart:string|null;readIds:string[]};
const EMPTY:Saved={bookmarks:{},lastConfirmed:null,currentSessionStart:null,readIds:[]};
function fmt(value:string){const d=new Date(value);return isNaN(d.getTime())?'날짜 미상':new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(d)}
function safeRead():Saved{try{const raw=localStorage.getItem(KEY);return raw?{...EMPTY,...JSON.parse(raw)}:EMPTY}catch{return EMPTY}}
export default function Home(){
 const [tab,setTab]=useState<Tab>('새 뉴스');
 const [category,setCategory]=useState<Category|'전체'>('전체');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState<'latest'|'important'>('latest');
 const [page,setPage]=useState(1);
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(false);
 const [failure,setFailure]=useState('');
 const [saved,setSaved]=useState<Saved>(EMPTY);
 const [ready,setReady]=useState(false);
 useEffect(()=>{const prior=safeRead();const start=new Date().toISOString();const next={...prior,currentSessionStart:prior.currentSessionStart||start};setSaved(next);localStorage.setItem(KEY,JSON.stringify(next));setReady(true)},[]);
 const updateSaved=useCallback((fn:(s:Saved)=>Saved)=>{setSaved(s=>{const n=fn(s);try{localStorage.setItem(KEY,JSON.stringify(n))}catch{}return n})},[]);
 const baseline=saved.lastConfirmed||null;
 const load=useCallback(async()=>{
   if(!ready)return;
   setLoading(true);setFailure('');
   try{
     const p=new URLSearchParams({page:String(page),tab,category,sort,q:search});
     if(tab==='새 뉴스'&&baseline)p.set('since',baseline);
     const res=await fetch('/api/news?'+p.toString(),{cache:'no-store'});
     const json=await res.json();if(!res.ok)throw new Error(json.error||`HTTP ${res.status}`);
     setData(json as Payload);
   }catch(e){setFailure(e instanceof Error?e.message:'뉴스를 읽지 못했습니다.')}
   finally{setLoading(false)}
 },[ready,page,tab,category,sort,search,baseline]);
 useEffect(()=>{if(tab==='북마크')return;load();const id=setInterval(()=>{if(document.visibilityState==='visible')load()},5*60*1000);return()=>clearInterval(id)},[load,tab]);
 const rows=useMemo(()=>{
   if(tab!=='북마크')return data?.articles||[];
   let result=Object.values(saved.bookmarks);
   if(category!=='전체')result=result.filter(a=>a.category===category);
   if(search.trim()){const q=search.toLowerCase();result=result.filter(a=>[a.title,a.source,a.category,...a.tags].join(' ').toLowerCase().includes(q))}
   return result.sort((a,b)=>sort==='important'?b.score-a.score||b.publishedAt.localeCompare(a.publishedAt):b.publishedAt.localeCompare(a.publishedAt));
 },[tab,data,category,saved.bookmarks,search,sort]);
 const onBookmark=(a:Article)=>updateSaved(s=>{const bookmarks={...s.bookmarks};if(bookmarks[a.id])delete bookmarks[a.id];else bookmarks[a.id]=a;return {...s,bookmarks}});
 const markDone=()=>{updateSaved(s=>({...s,lastConfirmed:new Date().toISOString(),currentSessionStart:new Date().toISOString()}));setPage(1)};
 const changeTab=(t:Tab)=>{setTab(t);setCategory('전체');setPage(1);setData(null)};
 const total=tab==='북마크'?rows.length:data?.total||0;
 return <main className="shell"><header className="top"><div className="brand"><div className="logo"><Newspaper size={23}/></div><div><h1>Actuary News Hub</h1><p>보험산업 · 보험계리 · 금융시장</p></div></div><button className="refresh" onClick={()=>load()} disabled={loading||tab==='북마크'} title="뉴스 목록 다시 읽기"><RefreshCw size={16} className={loading?'spin':''}/> <span>{loading?'불러오는 중':'새로고침'}</span></button></header>
 <section className="hero"><div><span className="eyebrow">PERSONAL NEWS DESK · CLOUD</span><h2>놓친 보험 뉴스를<br/><em>한곳에서 확인하세요.</em></h2><p>서버가 15분 간격으로 수집하고, 과거 기사도 누적 보관합니다.</p></div><div className="heroStats"><div><strong>{tab==='북마크'?Object.keys(saved.bookmarks).length:(data?data.total:'—')}</strong><span>{tab==='북마크'?'북마크 수':'현재 탭 기사'}</span></div><div><strong>{Object.keys(saved.bookmarks).length}</strong><span>저장한 기사</span></div></div></section>
 <nav className="primary" aria-label="주요 메뉴">{TABS.map(t=><button key={t} onClick={()=>changeTab(t)} className={tab===t?'active':''}>{t==='새 뉴스'?<Clock3 size={16}/>:t==='감독당국 보도자료'?<ShieldCheck size={16}/>:t==='북마크'?<Bookmark size={16}/>:<Newspaper size={16}/>} {t}</button>)}</nav>
 <div className="catOuter"><nav className="categories" aria-label="뉴스 카테고리">{(['전체',...CATEGORIES] as const).map(c=><button key={c} className={category===c?'chosen':''} onClick={()=>{setCategory(c);setPage(1)}}>{c}</button>)}</nav></div>
 <div className="toolbar"><div className="search"><Search size={16}/><input aria-label="뉴스 검색" placeholder="기사 제목·언론사 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><label className="sort"><SlidersHorizontal size={15}/><select value={sort} onChange={e=>{setSort(e.target.value as 'latest'|'important');setPage(1)}}><option value="latest">최신순</option><option value="important">중요도순</option></select></label></div>
 {tab==='새 뉴스'&&<div className="notice"><div><b>마지막 확인 완료 이후 발행된 기사</b><p>{baseline?`마지막 확인 완료: ${fmt(baseline)}`:'처음 접속했습니다. 현재 보관 중인 뉴스를 모두 새 뉴스로 표시합니다.'} · 기사 발행일 기준</p></div><button onClick={markDone} disabled={!ready} className="confirm"><Check size={15}/> 새 뉴스 확인 완료</button></div>}
 {tab==='감독당국 보도자료'&&<div className="notice"><div><b>금융위원회 · 금융감독원 발표</b><p>금융위 공식 RSS와 검색 보조 피드, 금감원 검색 보조 피드로 구성했습니다. 공식 피드 제공 범위 외 자료는 누락될 수 있습니다.</p></div></div>}
 <div className="listHead"><h3>{tab} <small>{total.toLocaleString()}건</small></h3><span>{data?.checkedAt?`목록 조회 ${fmt(data.checkedAt)}`:'조회 대기 중'}</span></div>
 {failure&&<div className="error"><AlertCircle size={17}/> {failure} <button onClick={()=>load()}>다시 시도</button></div>}
 <section className="articles">{loading&&!data&&tab!=='북마크'?<div className="empty">뉴스를 불러오는 중입니다…</div>:rows.length===0?<div className="empty"><Newspaper size={27}/><b>표시할 기사가 없습니다.</b><p>새 뉴스 확인 여부, 검색어, 수집 실행 결과를 확인하세요.</p></div>:rows.map(a=><article className="article" key={a.id}><div className="articleMain"><div className="meta"><span className={a.sourceType==='press'?'pill official':'pill'}>{a.category}</span>{a.sourceType==='press'&&<span className="officialText">공식기관 관련</span>}<span>{a.source}</span><span className="dot">·</span><time dateTime={a.publishedAt}>{fmt(a.publishedAt)}</time>{baseline&&new Date(a.publishedAt)>new Date(baseline)&&<span className="new">NEW</span>}</div><a className="headline" href={a.url} target="_blank" rel="noopener noreferrer" onClick={()=>updateSaved(s=>({...s,readIds:s.readIds.includes(a.id)?s.readIds:[...s.readIds,a.id].slice(-1500)}))}>{a.title}<ExternalLink size={15}/></a><div className="bottomMeta"><span>학습 중요도 {'★'.repeat(a.score)}{'☆'.repeat(5-a.score)}</span>{a.tags.slice(0,3).map(t=><span className="tag" key={t}>#{t}</span>)}{saved.readIds.includes(a.id)&&<span className="read">읽음</span>}</div></div><button aria-label={saved.bookmarks[a.id]?'북마크 해제':'북마크 추가'} title={saved.bookmarks[a.id]?'북마크 해제':'북마크 추가'} className="bookmark" onClick={()=>onBookmark(a)}>{saved.bookmarks[a.id]?<BookmarkCheck size={20} fill="#e7f1ff"/>:<Bookmark size={20}/>}</button></article>)}</section>
 {tab!=='북마크'&&total>50&&<div className="pagination"><button disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page} / {Math.ceil(total/50)} 페이지</span><button disabled={page*50>=total||loading} onClick={()=>setPage(p=>p+1)}>다음</button></div>}
 <footer><p>클라우드 수집: GitHub Actions 15분 간격(예약 실행 지연 가능) · Supabase 기사 누적 저장 · Vercel 화면 제공</p><p>기사 전문을 저장하지 않습니다. RSS/검색 피드의 저장·재사용 조건에 맞는 데이터만 장기 보관하세요. 출처별 수집 결과가 누락될 수 있습니다.</p><p>북마크와 확인 완료 시각은 이 브라우저에만 저장됩니다. 로그인 없는 웹사이트이므로 주소를 아는 다른 사람도 사이트에 접근할 수 있습니다.</p></footer></main>
}
