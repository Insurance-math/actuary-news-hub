import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import StaleNotice from './StaleNotice';

const LINKS = [['/', '뉴스'], ['/week/', '이번 주 핵심'], ['/trends/', '키워드 추이'], ['/status/', '수집 상태']] as const;

export default function SiteHeader({ current }: { current: string }) {
  return <>
    <header className="top"><div className="brand"><div className="logo"><Newspaper size={23} /></div><div><h1>Actuary News Hub</h1><p>보험산업 · 보험계리 · 금융시장</p></div></div></header>
    <nav className="pagelinks" aria-label="페이지 이동">{LINKS.map(([href, label]) =>
      <Link key={href} href={href} className={current === href ? 'active' : ''}>{label}</Link>)}</nav>
    <StaleNotice />
  </>;
}
