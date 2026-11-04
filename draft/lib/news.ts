export const CATEGORIES = [
  '제도·회계·건전성','생명보험','손해보험','금융시장·자산운용','보험경영·판매','위험관리·재보험','사회·인구·기술 변화'
] as const;
export type Category=typeof CATEGORIES[number];
export type Article={id:string;title:string;url:string;source:string;sourceType:'press'|'media';publishedAt:string;category:Category;tags:string[];score:number;feedName:string};
const rules:{category:Category;words:string[]}[]=[
 {category:'제도·회계·건전성',words:['ifrs17','ifrs 17','k-ics','kics','지급여력','감독규정','보험업법','보험회계','회계기준','금융위원회','금융감독원','보험부채','계약서비스마진','csM','책임준비금','건전성','보험정책']},
 {category:'생명보험',words:['생명보험','생보사','종신보험','변액보험','연금보험','사망보험','삼성생명','한화생명','교보생명','미래에셋생명','동양생명','신한라이프','kb라이프']},
 {category:'손해보험',words:['손해보험','손보사','자동차보험','실손보험','실손의료','실손24','화재보험','장기보험','삼성화재','현대해상','db손해보험','메리츠화재','한화손해보험','kb손해보험']},
 {category:'금융시장·자산운용',words:['국고채','기준금리','시장금리','금리인하','금리인상','채권','환율','원달러','외환','부동산 pf','대체투자','자산운용','듀레이션','alm','한국은행','투자수익']},
 {category:'보험경영·판매',words:['보험판매','판매수수료','보험설계사','독립보험대리점','ga','신계약','해약률','보험사 실적','보험회사 실적','경영전략','배당','보험영업','csm','보험료','상품개발']},
 {category:'위험관리·재보험',words:['재보험','코리안리','자연재해','대재해','위험관리','스트레스 테스트','보험리스크','리스크관리','사이버보험','손해율']},
 {category:'사회·인구·기술 변화',words:['고령화','고령사회','초고령','저출산','출산율','인구감소','기대수명','의료기술','헬스케어','ai','인공지능','기후변화','기후위기','디지털보험','인슈어테크','요양','치매','비급여']}
];
const keyWords=['보험','생보','손보','계리','연금','실손','재보험','ifrs','k-ics','금리','채권','국고채','환율','고령','저출산','출산율','기후','인공지능','ai','의료비','비급여','요양','건강보험','금융감독','금융위원','지급여력','보험금','보험료','위험률','운용','재무건전성','인구'];
export function classify(title:string):{category:Category;tags:string[];score:number;relevant:boolean}{
 const s=title.toLowerCase();
 const matches=rules.map(r=>({category:r.category,hits:r.words.filter(w=>s.includes(w.toLowerCase()))}));
 const ranked=[...matches].sort((a,b)=>b.hits.length-a.hits.length);
 const first=ranked[0];
 const important=['k-ics','ifrs17','지급여력','보험부채','csM','금리','보험업법','손해율','인구','고령','실손보험','보험료','재보험'];
 const score=Math.min(5,Math.max(2,2+Math.min(2,first.hits.length)+ (important.some(x=>s.includes(x.toLowerCase()))?1:0)));
 const tags=matches.flatMap(x=>x.hits).filter((x,i,a)=>a.indexOf(x)===i).slice(0,5);
 return {category:first.category,tags,score,relevant:keyWords.some(w=>s.includes(w.toLowerCase()))};
}
export function stripHtml(s:string){return s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()}
export function normalizeTitle(s:string){return stripHtml(s).replace(/\s+-\s+[^-]{2,30}$/,'').trim()}
export function stableId(s:string){let h=2166136261;for(const c of s){h=Math.imul(h^c.charCodeAt(0),16777619)}return (h>>>0).toString(36)}
