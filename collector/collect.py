"""RSS 메타데이터 수집기 (제목·링크·출처·발행시각만 저장, 본문/이미지 저장 안 함).

결과: data/YYYY-MM.json (발행시각 기준 월별 샤드) + data/index.json
사용: python collector/collect.py [--data-dir data] [--dry-run]
비밀키 불필요. 일부 피드가 실패해도 계속 진행한다.
"""
from __future__ import annotations
import argparse, hashlib, html, json, logging, re, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import feedparser
import requests
from trends import write_trends

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
FEED_CAP = 100       # 피드당 처리 상한
FILTER_SAMPLES = 10  # status.json에 남기는 걸러진 제목 샘플 수
UA = 'ActuaryNewsHub/3.0 (personal RSS reader; metadata only)'


def google(q: str) -> str:
    return 'https://news.google.com/rss/search?q=' + quote(q + ' when:7d') + '&hl=ko&gl=KR&ceid=KR:ko'


# (feed_name, url, source_type, 고정 출처명 or None)
SOURCES = [
    ('보험매일', 'https://www.fins.co.kr/rss/allArticle.xml', 'media', '보험매일'),
    ('보험저널', 'https://www.insjournal.co.kr/rss/allArticle.xml', 'media', '보험저널'),
    ('한국보험신문', 'https://www.insnews.co.kr/rss/allArticle.xml', 'media', '한국보험신문'),
    ('주요 경제지·보험', google('보험 (site:hankyung.com OR site:mk.co.kr OR site:edaily.co.kr OR site:mt.co.kr OR site:yna.co.kr OR site:newsis.com)'), 'media', None),
    ('주요 경제지·금융시장', google('(국고채 OR 금리 OR 환율 OR 보험사 자산운용) (site:hankyung.com OR site:mk.co.kr OR site:edaily.co.kr OR site:mt.co.kr OR site:yna.co.kr OR site:newsis.com)'), 'media', None),
    ('사회변화·보험', google('(고령화 OR 저출산 OR 인공지능 OR 기후위기 OR 의료비) 보험'), 'media', None),
    ('금융위원회 RSS', 'https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111', 'press', '금융위원회'),
    ('금융위원회 검색', google('site:fsc.go.kr (보험 OR K-ICS OR 실손 OR 생명보험 OR 손해보험)'), 'press', '금융위원회'),
    ('금융감독원 검색', google('site:fss.or.kr (보험 OR 보험사 OR 지급여력 OR 실손 OR K-ICS)'), 'press', '금융감독원'),
]

RULES = [
    ('제도·회계·건전성', ['ifrs17', 'ifrs 17', 'k-ics', 'kics', '지급여력', '감독규정', '보험업법', '보험회계', '금융위원회', '금융감독원', '보험부채', '계약서비스마진', '책임준비금', '건전성']),
    ('생명보험', ['생명보험', '생보사', '종신보험', '변액보험', '연금보험', '삼성생명', '한화생명', '교보생명', '신한라이프']),
    ('손해보험', ['손해보험', '손보사', '자동차보험', '실손', '화재보험', '삼성화재', '현대해상', 'db손해보험', '메리츠화재']),
    ('금융시장·자산운용', ['국고채', '기준금리', '시장금리', '금리인하', '금리인상', '채권', '환율', '부동산', '자산운용', '듀레이션', 'alm', '한국은행']),
    ('보험경영·판매', ['보험판매', '판매수수료', '보험설계사', '보험대리점', '신계약', '해약률', '경영전략', 'csm', '보험료', '상품개발']),
    ('위험관리·재보험', ['재보험', '코리안리', '자연재해', '대재해', '위험관리', '스트레스 테스트', '손해율', '사이버보험']),
    ('사회·인구·기술 변화', ['고령화', '저출산', '출산율', '인구감소', '기대수명', '의료비', '헬스케어', 'ai', '인공지능', '기후변화', '기후위기', '요양', '치매', '비급여']),
]
KEYWORDS = ['보험', '생보', '손보', '계리', '연금', '실손', '재보험', 'ifrs', 'k-ics', '금리', '채권', '국고채', '환율', '고령', '저출산', '출산율', '기후', '인공지능', '의료비', '요양', '금융감독', '금융위원', '지급여력', '인구', 'csm']
IMPORTANT = ['k-ics', 'ifrs17', '지급여력', '보험부채', 'csm', '금리', '보험업법', '손해율', '인구', '고령', '실손보험', '재보험']
PRESS_RE = re.compile('보험|실손|K-ICS|지급여력|계리|보험금|보험료|CSM', re.I)
TRACKING = re.compile(r'^(utm_.*|fbclid|gclid|oc|ref|from|cid|ocid|mc_.*)$', re.I)


UNCATEGORIZED = '미분류'  # 7개 카테고리 탭에는 노출하지 않고 '전체'에서만 보인다


def classify(title: str):
    s = title.casefold()
    matches = [(c, [w for w in ws if w.casefold() in s]) for c, ws in RULES]
    matches.sort(key=lambda x: len(x[1]), reverse=True)
    cat, hits = matches[0]
    if not hits:
        cat = UNCATEGORIZED
    score = min(5, 2 + min(2, len(hits)) + int(any(w.casefold() in s for w in IMPORTANT)))
    tags = list(dict.fromkeys(w for _, ws in matches for w in ws))[:5]
    return cat, tags, score, any(w.casefold() in s for w in KEYWORDS)


def clean(text: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', text or ''))).strip()


def normalize_url(url: str) -> str:
    p = urlsplit(url.strip())
    q = sorted((k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not TRACKING.match(k))
    host = p.netloc.lower().removeprefix('www.')
    return urlunsplit(('https', host, p.path.rstrip('/') or '/', urlencode(q), ''))


def article_id(url: str) -> str:
    return hashlib.sha256(normalize_url(url).encode()).hexdigest()[:16]


HAS_TZ = re.compile(r'(Z|GMT|UTC|[+-]\d{2}:?\d{2})\s*$', re.I)


def dedupe_key(a) -> str:
    return re.sub(r'\s+', '', a['title']).casefold() + '|' + a['source'].strip().casefold()


def is_google(a) -> bool:
    return urlsplit(a['url']).netloc.endswith('news.google.com')


def prefer(new, old):
    """같은 기사 중복 시 남길 쪽: 직접 링크 > 구글 중간 링크, 공식(press) > media."""
    rank = lambda a: (not is_google(a), a['source_type'] == 'press')
    return new if rank(new) > rank(old) else old


def parse_date(entry):
    """UTC ISO 반환. 국내 전문지 RSS는 타임존 없는 'YYYY-MM-DD HH:MM:SS'(KST)라 -9h 보정."""
    t = entry.get('published_parsed') or entry.get('updated_parsed')
    if not t:
        return None
    dt = datetime(*t[:6], tzinfo=timezone.utc)
    raw = entry.get('published') or entry.get('updated') or ''
    if not HAS_TZ.search(raw):
        dt -= timedelta(hours=9)
    return dt.isoformat()


def collect_source(row, now_iso):
    name, url, kind, fixed = row
    r = requests.get(url, timeout=15, headers={'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml'})
    r.raise_for_status()
    feed = feedparser.parse(r.content)
    if feed.bozo and not feed.entries:
        raise ValueError(f'invalid feed: {feed.bozo_exception}')
    entries = feed.entries[:FEED_CAP]
    out, skipped, filtered, dates = [], {'no_link': 0, 'no_date': 0, 'irrelevant': 0}, [], []
    for e in entries:
        raw = clean(e.get('title', ''))
        link = (e.get('link') or '').strip()
        if not raw or not link.startswith(('http://', 'https://')):
            skipped['no_link'] += 1; continue
        published = parse_date(e)
        if not published:
            skipped['no_date'] += 1; continue
        dates.append(published)
        if fixed:
            source, title = fixed, raw
        elif ' - ' in raw:
            title, source = (s.strip() for s in raw.rsplit(' - ', 1))
        else:
            title, source = raw, name
        cat, tags, score, relevant = classify(title)
        if not relevant or (kind == 'press' and not PRESS_RE.search(title)):
            skipped['irrelevant'] += 1
            if len(filtered) < FILTER_SAMPLES:
                filtered.append(title)
            continue
        out.append({'id': article_id(link), 'title': title, 'url': link, 'source': source, 'source_type': kind,
                    'published_at': published, 'collected_at': now_iso, 'category': cat, 'tags': tags,
                    'score': score, 'feed_name': name})
    stats = {'feed_size': len(feed.entries), 'skipped': skipped, 'filtered': filtered,
             'oldest': min(dates) if dates else None, 'newest': max(dates) if dates else None}
    return out, stats


def load_shard(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return []


def save(rows, data_dir: Path):
    """월별 샤드에 병합(기존 id는 유지). 반환: 새로 추가된 건수."""
    data_dir.mkdir(parents=True, exist_ok=True)
    by_month: dict[str, list] = {}
    for a in rows:
        by_month.setdefault(a['published_at'][:7], []).append(a)
    added = 0
    for month, items in by_month.items():
        path = data_dir / f'{month}.json'
        existing = load_shard(path)
        by_key = {dedupe_key(a): a for a in existing}
        by_id = {a['id'] for a in existing}
        changed = False
        for a in items:
            k = dedupe_key(a)
            if k in by_key:
                better = prefer(a, by_key[k])  # 기존이 구글 링크이고 새 것이 직접 링크면 교체
                if better is not by_key[k]:
                    better['collected_at'] = by_key[k]['collected_at']
                    by_key[k] = better; changed = True
            elif a['id'] not in by_id:
                by_key[k] = a; by_id.add(a['id']); added += 1; changed = True
        if changed:
            merged = sorted(by_key.values(), key=lambda a: a['published_at'], reverse=True)
            path.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    months = sorted((p.stem for p in data_dir.glob('????-??.json')), reverse=True)
    info = [{'month': m, 'count': len(load_shard(data_dir / f'{m}.json')), 'bytes': (data_dir / f'{m}.json').stat().st_size} for m in months]
    index = {'updated_at': datetime.now(timezone.utc).isoformat(), 'months': info}
    (data_dir / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return added


def safe_error(e: Exception) -> str:
    """공개 사이트에 노출되므로 URL(쿼리 포함)을 제거하고 길이를 제한한다."""
    msg = re.sub(r'https?://\S+', '<url>', f'{type(e).__name__}: {e}')
    return msg[:140]


def skipped_stats(stats: dict) -> dict:
    return {'entries': stats['feed_size'], 'skipped': stats['skipped'], 'filtered': stats['filtered'],
            'oldest': stats['oldest'], 'newest': stats['newest']}


def write_status(data_dir: Path, started: str, results: dict, total: int, added: int):
    """실행 결과 저장. 이번에 실패해도 이전의 last_success_at은 유지한다."""
    path = data_dir / 'status.json'
    try:
        prev = json.loads(path.read_text(encoding='utf-8')).get('sources', {})
    except (FileNotFoundError, ValueError):
        prev = {}
    sources = {}
    for name, *_ in SOURCES:
        r = results.get(name, {})
        old = prev.get(name, {})
        ok = r.get('ok', False)
        sources[name] = {
            'ok': ok, 'last_run_at': started,
            'last_success_at': started if ok else old.get('last_success_at'),
            'consecutive_failures': 0 if ok else old.get('consecutive_failures', 0) + 1,
            'entries': r.get('entries', 0), 'kept': r.get('kept', 0), 'skipped': r.get('skipped', {}),
            'filtered': r.get('filtered', []), 'oldest': r.get('oldest'), 'newest': r.get('newest'),
            # 피드가 주는 항목 수가 50/100건에 닿으면 더 오래된 기사가 잘렸을 수 있다
            'at_limit': ok and (r.get('entries') in (50, FEED_CAP) or r.get('entries', 0) > FEED_CAP),
            # 받은 기사 중 가장 오래된 것이 직전 수집 시각보다 늦으면 그 사이 기사를 놓쳤을 수 있다
            'gap_risk': bool(ok and r.get('oldest') and old.get('last_run_at') and r['oldest'] > old['last_run_at']),
            'error': None if ok else r.get('error'),
        }
    status = {'last_run': {'started_at': started, 'finished_at': datetime.now(timezone.utc).isoformat(),
                           'candidates': total, 'added': added,
                           'failed': [n for n, v in sources.items() if not v['ok']]},
              'sources': sources}
    data_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data-dir', default='data')
    ap.add_argument('--config-dir', default='config')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    now_iso = datetime.now(timezone.utc).isoformat()
    articles, failed, results = {}, [], {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futs = {pool.submit(collect_source, s, now_iso): s[0] for s in SOURCES}
        for f in as_completed(futs):
            name = futs[f]
            try:
                found, skipped = f.result()
                logging.info('%s: %d 건 (제외 %s, 피드 %d건)', name, len(found), skipped['skipped'], skipped['feed_size'])
                results[name] = {'ok': True, 'kept': len(found), **skipped_stats(skipped)}
                for a in found:
                    prev = articles.get(dedupe_key(a))
                    articles[dedupe_key(a)] = prefer(a, prev) if prev else a
            except Exception as e:
                failed.append(name)
                results[name] = {'ok': False, 'error': safe_error(e)}
                logging.warning('%s 실패: %s', name, str(e)[:180])
    added = 0
    if not articles:
        logging.warning('수집된 기사 없음 — 기존 데이터 유지')
    elif args.dry_run:
        logging.info('dry-run: %d 건 (저장 안 함)', len(articles))
    else:
        added = save(list(articles.values()), Path(args.data_dir))
        logging.info('후보 %d건, 신규 저장 %d건', len(articles), added)
    if not args.dry_run:
        write_status(Path(args.data_dir), now_iso, results, len(articles), added)
        try:
            write_trends(Path(args.data_dir), Path(args.config_dir) / 'keywords.json')
        except Exception as e:  # 집계 실패가 수집을 막지 않는다
            logging.warning('trends 집계 실패: %s', e)
    logging.info('실패 피드: %s', ', '.join(failed) or '없음')
    return 0  # 부분 실패는 워크플로를 실패시키지 않음


if __name__ == '__main__':
    sys.exit(main())
