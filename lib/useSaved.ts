'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Article } from './news';

const KEY = 'actuary-news-hub-v3';
export type Saved = { bookmarks: Record<string, Article>; lastConfirmed: string | null; readIds: string[] };
const EMPTY: Saved = { bookmarks: {}, lastConfirmed: null, readIds: [] };
const read = (): Saved => { try { const r = localStorage.getItem(KEY); return r ? { ...EMPTY, ...JSON.parse(r) } : EMPTY; } catch { return EMPTY; } };

/** 북마크·읽음·확인시각: 기기(브라우저)별 localStorage만 사용 */
export function useSaved() {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSaved(read()); setReady(true); }, []);
  const update = useCallback((fn: (s: Saved) => Saved) => {
    setSaved(s => { const n = fn(s); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} return n; });
  }, []);
  const toggleBookmark = useCallback((a: Article) => update(s => { const b = { ...s.bookmarks }; if (b[a.id]) delete b[a.id]; else b[a.id] = a; return { ...s, bookmarks: b }; }), [update]);
  const markRead = useCallback((id: string) => update(s => s.readIds.includes(id) ? s : { ...s, readIds: [...s.readIds, id].slice(-1500) }), [update]);
  return { saved, ready, update, toggleBookmark, markRead };
}
