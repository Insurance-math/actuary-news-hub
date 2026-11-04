import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Actuary News Hub | 보험계리 뉴스',description:'보험계리사 공부를 위한 개인 뉴스 대시보드'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
