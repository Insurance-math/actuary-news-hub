'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import Footer from '../../components/Footer';
import SiteHeader from '../../components/SiteHeader';
import { Status, loadStatus } from '../../lib/news';
import { fmt } from '../../lib/format';

export default function StatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => { loadStatus().then(setStatus).catch(() => setFailure('수집 상태 파일(status.json)이 아직 없습니다. 수집을 한 번 실행하면 생성됩니다.')); }, []);
  const entries = status ? Object.entries(status.sources) : [];
  const run = status?.last_run;
  return <main className="shell">
    <SiteHeader current="/status/" />
    {run && <div className="notice"><div><b>마지막 수집 {fmt(run.started_at)}</b><p>후보 {run.candidates}건 · 신규 저장 {run.added}건 · 실패 피드 {run.failed.length}개{run.failed.length ? ` (${run.failed.join(', ')})` : ''}</p></div></div>}
    {!status && !failure && <div className="articles"><div className="empty">수집 상태를 불러오는 중입니다…</div></div>}
    {failure && <div className="error"><AlertCircle size={17} /> {failure}</div>}
    {status && <section className="articles"><div className="tableWrap"><table className="statusTable">
      <thead><tr><th>소스</th><th>상태</th><th>피드 항목</th><th>저장 후보</th><th>받은 기사 범위(발행)</th><th>마지막 성공</th><th>비고</th></tr></thead>
      <tbody>{entries.map(([name, s]) => <tr key={name}>
        <td data-label="소스"><b>{name}</b></td>
        <td data-label="상태">{s.ok ? <span className="ok"><CheckCircle2 size={14} /> 성공</span> : <span className="fail"><XCircle size={14} /> 실패{s.consecutive_failures > 1 ? ` (${s.consecutive_failures}회 연속)` : ''}</span>}</td>
        <td data-label="피드 항목">{s.ok ? s.entries : '—'}</td>
        <td data-label="저장 후보">{s.ok ? s.kept : '—'}</td>
        <td data-label="받은 기사 범위(발행)" className="note">{s.ok && s.oldest && s.newest ? <>{fmt(s.oldest)} ~<br />{fmt(s.newest)}</> : '—'}
          {s.at_limit && <span className="flag" title="피드가 준 항목 수가 50/100건에 닿았습니다. 더 오래된 기사가 잘렸을 수 있습니다.">상한 도달</span>}
          {s.gap_risk && <span className="flag warn" title="받은 기사 중 가장 오래된 것이 직전 수집 시각보다 늦습니다. 그 사이 기사를 놓쳤을 수 있습니다.">누락 위험</span>}</td>
        <td data-label="마지막 성공">{s.last_success_at ? fmt(s.last_success_at) : '없음'}</td>
        <td data-label="비고" className="note">{s.error ?? (s.skipped.irrelevant ? `관련 없음 제외 ${s.skipped.irrelevant}건` : '')}
          {!!s.filtered?.length && <details><summary>걸러진 제목 샘플 {s.filtered.length}건</summary><ul className="filteredList">{s.filtered.map((t, i) => <li key={i}>{t}</li>)}</ul></details>}</td>
      </tr>)}</tbody></table></div></section>}
    <Footer />
  </main>;
}
