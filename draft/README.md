# Actuary News Hub — GitHub Actions + Supabase + Vercel

윈도우 PC를 꺼두어도 GitHub Actions가 약 15분 간격으로 RSS/검색 피드 메타데이터를 수집하고, Supabase에 저장하며, Vercel에서 웹사이트를 제공합니다. **배포 이전에는 동작하지 않습니다.** 클라우드 무료 요금제 한도와 콘텐츠 이용약관은 주기적으로 확인하세요.

## 배포 순서 (Windows 11 / PowerShell)

### 1. 계정 준비
- GitHub 무료 계정 https://github.com
- Supabase 무료 계정 https://supabase.com
- Vercel 무료 Hobby 계정 https://vercel.com
- Git, Node.js 22 LTS 설치 권장 (GitHub 웹 업로드만 한다면 Git 필수 아님)

### 2. Supabase 프로젝트 생성
1. Supabase `New project` 생성, Region 가까운 지역으로 선택.
2. `SQL Editor > New query`에서 `supabase/schema.sql` 전체를 실행.
3. `Project Settings > API` 또는 최신 대시보드의 API Keys 메뉴에서 **Project URL**과 서버용 비밀키(`service_role` legacy key 또는 호환 가능한 secret key)를 확인. 키 형식과 지원 방식은 서비스 화면 지침을 따르세요.
4. 비밀키는 소스 코드나 브라우저에 입력하지 말고, 아래 GitHub Secrets와 Vercel Environment Variables에만 저장.

### 3. GitHub 비공개 저장소
1. GitHub에서 **Private repository** 생성 (예: `actuary-news-hub`).
2. 이 프로젝트 파일 전체(`.github` 숨김 폴더 포함)를 저장소에 업로드. ZIP 자체가 아니라 ZIP 내부 파일을 업로드해야 합니다.
3. `Settings > Secrets and variables > Actions > New repository secret`에서 두 개 등록:
   - `SUPABASE_URL` = Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = 서버용 비밀키
4. `Actions > Collect insurance news > Run workflow`를 눌러 첫 수집 실행.
5. 성공 로그 확인 후 Supabase `Table Editor > articles`에서 데이터가 생성됐는지 확인.
6. 이후 워크플로 `schedule`가 UTC 기준 매 15분 실행됩니다. GitHub Actions는 실행이 지연되거나 누락될 수 있고, 무료 실행시간 한도에 영향을 받습니다.

### 4. Vercel에 웹사이트 배포
1. Vercel에 GitHub 로그인 후 `Add New > Project`에서 방금 만든 저장소를 Import.
2. Framework는 Next.js (보통 자동 인식), Root Directory는 저장소 루트로 설정.
3. `Environment Variables`에 아래 두 가지를 **서버 환경변수**로 등록:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. `Deploy` 클릭. 완료된 `*.vercel.app` 주소로 접속.
5. URL이 공개되면 **로그인 없이 누구나 볼 수 있습니다.** 비밀번호/비공개가 필요하면 별도 보호를 추가해야 합니다.

### 5. 확인 및 유지보수
- `Actions > Collect insurance news` 최근 성공 여부 확인.
- Supabase `articles` 수와 데이터 사용량 확인. **자동 삭제 없음.** 무료 DB는 500MB 한도가 있어 5년 보관을 보장하지 않습니다.
- Supabase 무료 프로젝트는 활동이 적으면 일시 중지될 수 있습니다.
- 15분 내 모든 기사 반영이 보장되지 않으며, RSS 원본이 과거 기사를 제한하면 누락될 수 있습니다.
- 북마크와 마지막 확인 시각은 각 브라우저 `localStorage`에 저장되어 PC를 바꾸거나 브라우저 데이터를 삭제하면 사라집니다.
- 자동 백업은 제공하지 않습니다. 정기 백업과 데이터 이관 계획이 필요합니다.

## 로컬 개발
```powershell
npm install
Copy-Item .env.example .env.local
# .env.local에 실제 값을 입력한 후
npm run dev
```
`http://localhost:3000` 접속. 로컬에서 웹사이트만 실행되며 RSS 수집은 GitHub Actions에서 수행합니다.

## 데이터 흐름
`GitHub Actions > collector/collect.py > Supabase REST API (service_role key) > Next.js /api/news 서버 > 브라우저`

- Supabase 테이블은 RLS가 활성화되고 일반 사용자에게 별도 정책을 부여하지 않습니다.
- 서비스 비밀키는 반드시 서버에서만 사용하고 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- 기사 전문을 다운로드하거나 저장하지 않습니다. 제목·출처·URL·일시·분류 정보를 저장합니다.
- Google 뉴스 검색 RSS는 해당 중간 링크로 이동할 수 있으며 제공처별 재사용·장기보관 조건을 확인해야 합니다.
- 금융감독원 자료는 검색 기반으로 발견되며 공식 직접 수집과 동일한 완전성을 보장하지 않습니다.

## 제약 및 향후 확장
- 수집량이 늘어나면 Supabase 500MB 한도에 도달합니다. 검색 인덱스, 백업 용량 등도 고려해야 합니다.
- 현재 앱은 데이터 서버 페이징(50건씩)을 지원합니다.
- 제목과 URL에 대한 장기 보관이 허용되지 않는 뉴스 소스가 있다면 해당 소스를 `collector/collect.py`에서 제외하거나 보관 정책을 따로 구현해야 합니다.
- '새 뉴스'는 **기사 발행 시각**을 기준으로 합니다. 수집 시각 기준으로 전환하려면 `collected_at`을 API에 연결하면 됩니다.
