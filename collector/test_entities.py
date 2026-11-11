"""보험사·유관기관 매칭 단위 테스트. 실행: python collector/test_entities.py"""
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import collect
from entities import Entities, tag_entities

m = lambda t, s=None: tag_entities(t, s, [])
# 보험사: 정식명으로 통일, 별칭 여러 개, 제목에 나온 순서, 복수 가능
assert m('삼성화재·DB손보, 캐노피우스 인수')['companies'] == ['삼성화재', 'DB손해보험', '캐노피우스']
assert m('KB손해보험과 KB손보')['companies'] == ['KB손해보험'], '같은 회사의 별칭은 한 번만'
assert m('삼성 생명 보험')['companies'] == ['삼성생명'] and m('삼성 보험')['companies'] == [], '띄어쓰기는 무시'
# 모호한 단독 약어는 매칭하지 않는다
for t in ['삼성 현대 한화 KB DB 보험 실적', '현대차 한화솔루션 KB금융 DB하이텍 삼성전자 보험', '신한은행 보험 판매', '하나은행 하나금융 보험']:
    assert m(t)['companies'] == [], t
assert m('한화손보와 한화생명 제휴')['companies'] == ['한화손해보험', '한화생명']
assert m('Munich Re·하노버Re 재보험 요율')['companies'] == ['뮌헨리', '하노버리']
assert m('ABLE생명 아님 / ABL생명 실적')['companies'] == ['ABL생명']
# 유관기관: 별칭, 단어 안에 우연히 들어간 약어는 제외
assert m('금감원, 금융위와 합동 점검')['orgs'] == ['금융감독원', '금융위원회']
assert m('신한은행 금리 인하')['orgs'] == [], "'한은' 이 '신한은행' 안에서 일치하면 안 됨"
assert m('한은 기준금리 동결, 신한은행 영향')['orgs'] == ['한국은행']
assert m('예보료 인상안')['orgs'] == [] and m('예보, 보험계약자 보호 논의')['orgs'] == ['예금보험공사']
assert m('생보협회·손보협회, 보험연구원 공동 세미나')['orgs'] == ['생명보험협회', '손해보험협회', '보험연구원']
assert m('대법원 판결, 국회 계류')['orgs'] == ['법원·대법원', '국회'] or sorted(m('대법원 판결, 국회 계류')['orgs']) == ['국회', '법원·대법원']
# 공식 게시글: 제목에 기관명이 없어도 출처가 그 기관이면 포함
assert m('보험사 지급여력 제도 개선 방안', '금융위원회')['orgs'] == ['금융위원회']
assert m('보험사 지급여력 제도 개선 방안', '한국경제')['orgs'] == []
# 기존 태그와 통일: 보험사·기관 이름인 태그는 제거(필터의 정식명으로 표시), 나머지 태그는 유지
r = tag_entities('금감원, 삼성화재 점검', None, ['금감원', '삼성화재', '실손', '금융위원회'])
assert r['tags'] == ['실손'] and r['orgs'] == ['금융감독원'] and r['companies'] == ['삼성화재']
# 보험사 이름이 나오면 '보험' 단어가 없어도 관련 기사, 스포츠 구단 기사는 제외
rel, c = collect.judge('메리츠화재 3분기 순익 3285억…전년비 29.2%↓', 'media', '보험매일')
assert rel is True and c['category'] != '미분류'
assert collect.judge('KB손보, 현대캐피탈에 3-1 역전승', 'media', '뉴시스')[0] is False
assert collect.judge('삼성 현대 한화 실적 발표', 'media', '뉴시스')[0] is False, '단독 약어는 보험사로 보지 않음'
# 설정 기반: 목록을 바꾸면 결과가 바뀐다
e = Entities([{'name': '테스트보험', 'group': '기타', 'aliases': ['테스트보험']}])
assert e.match('테스트보험 출시') == ['테스트보험'] and e.match('삼성화재') == []

# 기사 저장 필드·재실행 안전: make_article 이 companies/orgs 를 넣고, reclassify 를 두 번 돌려도 같은 결과
a = collect.make_article('금감원, 삼성화재 실손보험 점검', 'https://x/1', '한국경제', 'media', '2026-11-01T00:00:00+00:00', 'c', '주요 경제지·보험')
assert a['companies'] == ['삼성화재'] and a['orgs'] == ['금융감독원'] and '삼성화재' not in a['tags'] and '금감원' not in a['tags']
with tempfile.TemporaryDirectory() as d:
    old = {k: v for k, v in a.items() if k not in ('companies', 'orgs')}
    (Path(d) / '2026-11.json').write_text(json.dumps([old], ensure_ascii=False), encoding='utf-8')
    outs = []
    for _ in range(2):
        collect.reclassify(Path(d))
        outs.append((Path(d) / '2026-11.json').read_text(encoding='utf-8'))
    row = json.loads(outs[0])[0]
    assert row['companies'] == ['삼성화재'] and row['orgs'] == ['금융감독원'] and outs[0] == outs[1]
    collect.rescore(Path(d))  # 점수만 바꾸고 companies/orgs 는 그대로
    assert json.loads((Path(d) / '2026-11.json').read_text(encoding='utf-8'))[0]['companies'] == ['삼성화재']
print('entities tests passed')
