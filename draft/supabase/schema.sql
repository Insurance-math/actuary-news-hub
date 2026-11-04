-- Supabase > SQL Editor에서 1회 실행.
create table if not exists public.articles (
 id text primary key,
 title text not null,
 url text not null,
 source text not null,
 source_type text not null check (source_type in ('media','press')),
 published_at timestamptz not null,
 category text not null,
 tags jsonb not null default '[]'::jsonb,
 score smallint not null default 2,
 feed_name text not null,
 collected_at timestamptz not null default now()
);
create index if not exists articles_published_idx on public.articles (published_at desc);
create index if not exists articles_category_published_idx on public.articles (category, published_at desc);
create index if not exists articles_source_published_idx on public.articles (source_type, published_at desc);
-- 공개 브라우저에서 DB에 직접 접근할 수 없도록 설정.
alter table public.articles enable row level security;
-- anon/authenticated 정책을 만들지 않음. 읽기/쓰기는 서버의 service_role에서만 수행.
-- 기사 자동 만료/삭제 정책 없음.
