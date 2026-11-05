'use client';
import { useEffect, useState } from 'react';
import { loadStatus } from '../lib/news';
import { fmt } from '../lib/format';
import { isStale } from '../lib/stale';

/** 마지막 수집이 36시간보다 오래되면 상단에 지연 안내. 로딩 중·status.json 없음/오류 시에는 보이지 않는다. */
export default function StaleNotice() {
  const [finished, setFinished] = useState<string | null>(null);
  useEffect(() => { loadStatus().then(s => setFinished(s.last_run.finished_at)).catch(() => {}); }, []);
  if (!isStale(finished)) return null;
  return <div className="notice" role="status"><div><b>수집이 지연되고 있습니다 (마지막 수집: {fmt(finished!)})</b><p>자동 수집이 멈췄거나 늦어지고 있어 오래된 기사가 보일 수 있습니다.</p></div></div>;
}
