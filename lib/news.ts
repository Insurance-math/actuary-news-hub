export const CATEGORIES = [
  '제도·회계·건전성', '생명보험', '손해보험', '금융시장·자산운용', '보험경영·판매', '위험관리·재보험', '사회·인구·기술 변화',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const UNCATEGORIZED = '미분류';

export type Article = {
  id: string; title: string; url: string; source: string; source_type: 'media' | 'press';
  published_at: string; collected_at: string; category: string; tags: string[]; score: number; feed_name: string;
};
export type DataIndex = { updated_at: string | null; months: { month: string; count: number; bytes: number }[] };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/data/${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
export const loadIndex = () => getJson<DataIndex>('index.json');
export const loadMonth = (m: string) => getJson<Article[]>(`${m}.json`);

export function isSafeUrl(u: string) { return /^https?:\/\//i.test(u); }
export function isGoogleDiscovery(a: Article) { return /(^|\.)news\.google\.com\//.test(a.url.replace(/^https?:\/\//, '')); }
