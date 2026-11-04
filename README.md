# Actuary News Hub

보험계리사 시험 준비·팀 공유용 뉴스 대시보드. 기사 **제목·링크·출처·발행시각**만 모아 보여주는 정적 사이트입니다(본문·요약·이미지는 저장하지 않음).

- 사이트: https://insurance-math.github.io/actuary-news-hub/
- 구조: GitHub Actions에서 Python 수집기 → `data/YYYY-MM.json` 커밋 → Next.js 정적 빌드 → GitHub Pages 배포. 서버·DB·비밀키 없음.

## 운영
- **수집·갱신(아침 1회)**: GitHub → Actions → "Collect and deploy" → **Run workflow**. 완료되면 사이트가 자동 갱신됩니다.
- 코드를 `main`에 push하면 수집 없이 빌드·배포만 실행됩니다.
- 최초 1회: 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정.
- 일부 피드가 실패하거나 비어 있어도 실행은 계속되고, 기존 데이터·사이트는 유지됩니다. 실패 피드는 Actions 로그의 `WARNING ... 실패`에서 확인합니다.

## 로컬 개발 (Node 22, Python 3)
```
python3 -m venv .venv && .venv/bin/pip install -r collector/requirements.txt
.venv/bin/python collector/collect.py      # data/ 갱신 (--dry-run 가능)
npm install && npm test && npm run build   # out/ 생성
npm run dev                                # http://localhost:3000/actuary-news-hub/
```

## 데이터
- `data/YYYY-MM.json`(발행시각 기준 월별), `data/index.json`(월 목록·건수·바이트·마지막 수집 시각). 자동 삭제 없음.
- 기사 ID는 추적 파라미터를 제거한 URL의 해시. 같은 제목+출처는 합치고 구글 중간 링크보다 직접 링크를 우선합니다.
- 키워드가 맞지 않으면 카테고리는 `미분류`(7개 탭에는 안 보이고 "전체"에서만 표시).
- `config/keywords.json`: 키워드 추이 차트의 키워드(한 곳에서 관리). 수집 실행 시 `data/trends.json`(주별 집계)이 과거분까지 다시 만들어집니다. `data/status.json`은 소스별 수집 결과입니다.
- **새 뉴스**는 `collected_at`(수집시각) > 마지막 "확인 완료" 시각 기준입니다(늦게 수집된 과거 발행 기사 누락 방지). 화면 표시 시각은 발행시각.
- 북마크·읽음·확인 시각은 브라우저 localStorage에만 저장되며 기기 간 동기화되지 않습니다.

## 용량 추적
`data/index.json`의 `months[].bytes`로 월별 크기를 확인합니다. 현재 약 170KB/월 수준이며, 5년 누적 목표는 약 80MB로 가정합니다. 클라이언트는 최근 2개월만 먼저 읽고 검색 시 과거 월을 불러옵니다.

## 백업·복구
데이터는 git 저장소에 커밋되므로 이력이 곧 백업입니다. 복구: `git log -- data/` 로 시점을 찾아 `git checkout <커밋> -- data/` 후 커밋.

## 소스와 약관 (점검 필요)
| 소스 | 방식 | 비고 |
|---|---|---|
| 보험매일·보험저널·한국보험신문 | 공식 RSS | 메타데이터(제목·링크)만 저장. 약관 확인 필요 |
| 한경·매경·이데일리·머니투데이·연합·뉴시스 | 구글 뉴스 검색 RSS | 구글 중간 링크(원문으로 리다이렉트) 사용. 약관 확인 필요 |
| 금융위원회 | 공식 RSS + 구글 검색 | 공식 RSS는 2026-11-04 기준 503(점검 중) → 재확인 필요 |
| 금융감독원 | 구글 검색 | 직접 수집이 아님(화면에 표시) |

공개 저장소·사이트입니다. 개인정보·키·내부 메모를 올리지 마세요.
