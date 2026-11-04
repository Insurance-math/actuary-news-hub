export const fmt = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '날짜 미상' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(d);
};
