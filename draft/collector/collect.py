"""RSS metadata collector. No article fulltext; no automatic deletion.
Run via GitHub Actions, configured with Supabase server secrets.
"""
from __future__ import annotations
import os, re, json, html, hashlib, time, logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
import feedparser
import requests

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

def google(q):
    return 'https://news.google.com/rss/search?q='+quote(q+' when:7d')+'&hl=ko&gl=KR&ceid=KR:ko'

# Search RSS is discovery only: Google may link via its intermediate page.
SOURCES = [
 ('보험매일','https://www.fins.co.kr/rss/allArticle.xml','media','보험매일'),
 ('보험저널','https://www.insjournal.co.kr/rss/allArticle.xml','media','보험저널'),
 ('한국보험신문','https://www.insnews.co.kr/rss/allArticle.xml','media','한국보험신문'),
 ('주요 경제지·보험',google('보험 (site:hankyung.com OR site:mk.co.kr OR site:edaily.co.kr OR site:mt.co.kr OR site:yna.co.kr OR site:newsis.com)'),'media',None),
 ('주요 경제지·금융시장',google('(국고채 OR 금리 OR 환율 OR 보험사 자산운용) (site:hankyung.com OR site:mk.co.kr OR site:edaily.co.kr OR site:mt.co.kr OR site:yna.co.kr OR site:newsis.com)'),'media',None),
 ('사회변화·보험',google('(고령화 OR 저출산 OR 인공지능 OR 기후위기 OR 의료비) 보험'),'media',None),
 ('금융위원회 RSS','https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111','press','금융위원회'),
 ('금융위원회 검색',google('site:fsc.go.kr (보험 OR K-ICS OR 실손 OR 생명보험 OR 손해보험)'),'press','금융위원회'),
 ('금융감독원 검색',google('site:fss.or.kr (보험 OR 보험사 OR 지급여력 OR 실손 OR K-ICS)'),'press','금융감독원'),
]
RULES = [
 ('제도·회계·건전성',['ifrs17','ifrs 17','k-ics','kics','지급여력','감독규정','보험업법','보험회계','금융위원회','금융감독원','보험부채','계약서비스마진','책임준비금','건전성']),
 ('생명보험',['생명보험','생보사','종신보험','변액보험','연금보험','삼성생명','한화생명','교보생명','신한라이프']),
 ('손해보험',['손해보험','손보사','자동차보험','실손','화재보험','삼성화재','현대해상','db손해보험','메리츠화재']),
 ('금융시장·자산운용',['국고채','기준금리','시장금리','금리인하','금리인상','채권','환율','부동산','자산운용','듀레이션','alm','한국은행']),
 ('보험경영·판매',['보험판매','판매수수료','보험설계사','보험대리점','신계약','해약률','경영전략','csm','보험료','상품개발']),
 ('위험관리·재보험',['재보험','코리안리','자연재해','대재해','위험관리','스트레스 테스트','손해율','사이버보험']),
 ('사회·인구·기술 변화',['고령화','저출산','출산율','인구감소','기대수명','의료비','헬스케어','ai','인공지능','기후변화','기후위기','요양','치매','비급여'])
]
KEYWORDS=['보험','생보','손보','계리','연금','실손','재보험','ifrs','k-ics','금리','채권','국고채','환율','고령','저출산','출산율','기후','인공지능','의료비','요양','금융감독','금융위원','지급여력','인구','csm']
IMPORTANT=['k-ics','ifrs17','지급여력','보험부채','csm','금리','보험업법','손해율','인구','고령','실손보험','재보험']

def classify(title):
    s=title.casefold()
    matches=[(cat,[w for w in words if w.casefold() in s]) for cat,words in RULES]
    matches.sort(key=lambda x:len(x[1]),reverse=True)
    category,hits=matches[0]
    score=min(5,2+min(2,len(hits))+int(any(w.casefold() in s for w in IMPORTANT)))
    tags=list(dict.fromkeys(w for _,ws in matches for w in ws))[:5]
    return category,tags,score,any(w.casefold() in s for w in KEYWORDS)

def clean(text):
    text=html.unescape(re.sub(r'<[^>]*>', '', text or '')).strip()
    return re.sub(r'\s+', ' ',text)

def parse_date(entry):
    for k in ['published_parsed','updated_parsed']:
        t=entry.get(k)
        if t:
            return datetime(*t[:6],tzinfo=timezone.utc).isoformat()
    for k in ['published','updated']:
        v=entry.get(k)
        if v:
            try:return parsedate_to_datetime(v).astimezone(timezone.utc).isoformat()
            except (ValueError,TypeError): pass
    # Avoid falsely treating discovery time as publication time.
    return None

def collect_source(row):
    name,url,kind,fixed_source=row
    response=requests.get(url,timeout=15,headers={'User-Agent':'ActuaryNewsHub/2.0 (personal RSS reader)','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml'})
    response.raise_for_status()
    feed=feedparser.parse(response.content)
    if feed.bozo and not feed.entries:
        raise ValueError(f'invalid feed: {feed.bozo_exception}')
    results=[]
    for entry in feed.entries[:100]:
        raw=clean(entry.get('title',''))
        if not raw:continue
        source=fixed_source or (raw.rsplit(' - ',1)[-1].strip() if ' - ' in raw else name)
        title=raw.rsplit(' - ',1)[0].strip() if not fixed_source and ' - ' in raw else raw
        link=(entry.get('link') or '').strip()
        if not link.startswith(('https://','http://')):continue
        published=parse_date(entry)
        if not published: continue
        cat,tags,score,relevant=classify(title)
        if not relevant:continue
        if kind=='press' and not re.search('보험|실손|K-ICS|지급여력|계리|보험금|보험료|CSM',title,re.I):continue
        uid=hashlib.sha256(re.sub(r'\s+','',title.casefold()).encode()).hexdigest()[:32]
        results.append({'id':uid,'title':title,'url':link,'source':source,'source_type':kind,'published_at':published,'category':cat,'tags':tags,'score':score,'feed_name':name})
    return results

def save(rows):
    base=os.environ['SUPABASE_URL'].rstrip('/')
    key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    url=base+'/rest/v1/articles?on_conflict=id'
    headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=minimal'}
    for i in range(0,len(rows),100):
        chunk=rows[i:i+100]
        r=requests.post(url,headers=headers,json=chunk,timeout=30)
        if not r.ok:
            raise RuntimeError('Supabase write HTTP '+str(r.status_code)+': '+r.text[:240])

def main():
    if not os.getenv('SUPABASE_URL') or not os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
        raise RuntimeError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY GitHub secret')
    articles={}; failed=[]
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(collect_source,s):s[0] for s in SOURCES}
        for future in as_completed(futures):
            name=futures[future]
            try:
                found=future.result()
                logging.info('%s: %d candidates',name,len(found))
                for a in found:
                    if a['id'] not in articles or (a['source_type']=='press' and articles[a['id']]['source_type']!='press'):
                        articles[a['id']]=a
            except Exception as e:
                failed.append(name)
                logging.warning('%s failed: %s',name,str(e)[:180])
    if not articles:
        raise RuntimeError('No articles fetched; check RSS availability and URLs')
    save(list(articles.values()))
    logging.info('Stored %d candidates, failed feeds: %s',len(articles),', '.join(failed) or 'none')

if __name__=='__main__':main()
