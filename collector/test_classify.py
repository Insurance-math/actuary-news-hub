"""python collector/test_classify.py"""
from classify import UNCATEGORIZED, classify
from eval_classify import evaluate

c = lambda t, feed=None: classify(t, feed)

# 띄어쓰기 무시 (한글)
assert c('해킹 불안에 기업들…사이버 보험 시장 쑥')['category'] == '위험관리·재보험'
# 영문 약어는 단어 경계: 'ai'가 다른 단어 안에서 걸리지 않는다
assert c('Email gap analysis 보험')['category'] == UNCATEGORIZED
assert c('AI 고객 맞춤 보험 설계')['category'] == '사회·인구·기술 변화'
assert c('보험사 GA 시책 경쟁')['category'] == '보험경영·판매'
# 긴 키워드가 짧은 키워드를 이중 계산하지 않음: 기준금리(3)이지 기준금리+금리(4)가 아니다
assert c('기준금리 동결')['category'] == '금융시장·자산운용'
# 동점은 priority 순 (생명보험 > 손해보험 > ...)
assert c('삼성생명 삼성화재 업무협약')['category'] == '생명보험'
assert 'sub_categories' in c('삼성생명 한화손보')
# 다중 라벨: 점수 있는 나머지 카테고리는 sub_categories
r = c('삼성생명 변액보험 판매 호조, 채권 투자 확대')
assert r['category'] == '생명보험' and '금융시장·자산운용' in r['sub_categories']
# 사회보험은 미분류, 보험사 주어가 있으면 제외하지 않음
assert c('고용보험 가입 예술인 22%')['category'] == UNCATEGORIZED
assert c('희귀·중증난치질환자 건강보험 본인부담률 인하')['category'] == UNCATEGORIZED
assert c('보험사 건강보험 설계도 맞춤형 추천 플랜')['category'] != UNCATEGORIZED
# 피드 단서는 키워드가 전혀 없을 때만
assert c('오늘의 시장 전망', '주요 경제지·금융시장')['category'] == '금융시장·자산운용'
assert c('삼성화재 신상품', '주요 경제지·금융시장')['category'] == '손해보험'
assert c('오늘의 시장 전망')['category'] == UNCATEGORIZED
# 대출금리·보금자리론은 분류는 하되 중요도 ≤ 2
r = c('금리 5% 넘고 연체는 3배로…빌리기도 갚기도 버거운 보금자리론')
assert r['category'] == '금융시장·자산운용' and r['score'] <= 2
assert c('K-ICS 비율 하락…지급여력 제도 개편')['score'] == 5
assert c('보험업법 개정')['relevant'] and not c('날씨 맑음')['relevant']

# 정답 샘플 회귀 기준 (학습으로 튜닝, 검증은 별도 보고): 전체 80% 미만이면 규칙 회귀로 본다
allr, val, val2 = evaluate('all'), evaluate('valid'), evaluate('valid2')
assert allr['accuracy'] >= 0.80, allr['accuracy']
assert val['accuracy'] >= 0.70, val['accuracy']
assert val2['accuracy'] >= 0.65, val2['accuracy']  # 새 검증 샘플(튜닝에 쓰지 않음)
print(f"classify tests passed (전체 {allr['accuracy']:.0%}, 검증 {val['accuracy']:.0%}/{val2['accuracy']:.0%}, 예측 미분류 {allr['pred_uncat']:.0%})")
