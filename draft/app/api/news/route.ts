import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const CATEGORIES = ['제도·회계·건전성','생명보험','손해보험','금융시장·자산운용','보험경영·판매','위험관리·재보험','사회·인구·기술 변화'];
const COLUMNS='id,title,url,source,source_type,published_at,category,tags,score,feed_name';
export async function GET(req:NextRequest){
  const endpoint=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!endpoint||!key)return NextResponse.json({error:'Supabase 환경변수가 아직 설정되지 않았습니다.'},{status:503});
  const input=req.nextUrl.searchParams;
  const page=Math.max(1,Math.min(10000,Number(input.get('page'))||1));
  const pageSize=50;
  const tab=input.get('tab')||'전체 뉴스';
  const category=input.get('category')||'전체';
  const sort=input.get('sort')==='important'?'important':'latest';
  const query=(input.get('q')||'').trim().slice(0,100);
  const since=input.get('since')||'';
  const params=new URLSearchParams({select:COLUMNS,limit:String(pageSize),offset:String((page-1)*pageSize),order:sort==='important'?'score.desc,published_at.desc':'published_at.desc'});
  if(tab==='감독당국 보도자료')params.set('source_type','eq.press');
  if(CATEGORIES.includes(category))params.set('category','eq.'+category);
  if(tab==='새 뉴스'&&since&&!Number.isNaN(Date.parse(since)))params.set('published_at','gt.'+new Date(since).toISOString());
  if(query){
    // PostgREST like filter. Escape wildcards and syntax to avoid uncontrolled expressions.
    const escaped=query.replace(/[,*()%]/g,' ').replace(/\s+/g,' ').trim();
    if(escaped)params.set('or',`(title.ilike.*${escaped}*,source.ilike.*${escaped}*)`);
  }
  try{
    const response=await fetch(endpoint.replace(/\/$/,'')+'/rest/v1/articles?'+params.toString(),{
      headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'},cache:'no-store'
    });
    if(!response.ok)throw new Error('Database HTTP '+response.status);
    const rows=await response.json() as Array<Record<string,unknown>>;
    const countHeader=response.headers.get('content-range')||'';
    const total=Number(countHeader.split('/')[1]);
    return NextResponse.json({articles:rows.map(r=>({id:r.id,title:r.title,url:r.url,source:r.source,sourceType:r.source_type,publishedAt:r.published_at,category:r.category,tags:r.tags,score:r.score,feedName:r.feed_name})),total:Number.isFinite(total)?total:rows.length,page,pageSize,checkedAt:new Date().toISOString(),disclaimer:'RSS·검색 제공 범위 및 게시 시각에 따라 누락이 발생할 수 있습니다.'},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('News API failed:',e);return NextResponse.json({error:'뉴스 DB 조회에 실패했습니다. 수집 실행 및 환경변수를 확인하세요.'},{status:502});}
}
