"""python collector/test_normalize.py"""
from normalize import strip_org_suffix

assert strip_org_suffix('보험정책 - 금융위원회') == '보험정책'
assert strip_org_suffix('보험모집질서 위반신고 - 금융감독원 - 금융감독원') == '보험모집질서 위반신고'
assert strip_org_suffix('실손24 안내 [금융프렌즈] - 금융위원회') == '실손24 안내 [금융프렌즈]'
assert strip_org_suffix('금융위원회 의결 개정안') == '금융위원회 의결 개정안'   # 제목 중간/앞의 기관명은 유지
assert strip_org_suffix('금융감독원 - 금융감독원') == '금융감독원 - 금융감독원'.replace(' - 금융감독원', '')
print('normalize tests passed')
