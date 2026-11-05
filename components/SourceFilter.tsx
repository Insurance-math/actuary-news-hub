'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { SourceOption } from '../lib/sources';

type Props = { options: SourceOption[]; selected: string[]; onChange: (next: string[]) => void };

/** 언론사 다중 선택 드롭다운(기사 수 많은 순) + 선택 칩. 바깥 클릭·Esc 로 닫힘. */
export default function SourceFilter({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const toggle = (name: string) => onChange(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  return <div className="sourceFilter" ref={box}>
    <button ref={btn} type="button" className={'sourceBtn' + (selected.length ? ' on' : '')} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      언론사{selected.length > 0 && <b>{selected.length}</b>}<ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className="sourcePanel" role="group" aria-label="언론사 선택">
      <div className="sourcePanelHead"><span>언론사 {options.length}곳 · 기사 수 순</span><button type="button" disabled={!selected.length} onClick={() => onChange([])}>전체 해제</button></div>
      <ul>{options.map(o => <li key={o.name}>
        <label><input type="checkbox" checked={selected.includes(o.name)} onChange={() => toggle(o.name)} /><span className="sname">{o.name}</span><span className="scount">{o.count.toLocaleString()}</span></label>
      </li>)}</ul>
    </div>}
  </div>;
}

export function SourceChips({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  if (!selected.length) return null;
  return <div className="sourceChips" aria-label="선택한 언론사">
    {selected.map(s => <span key={s} className="chip">{s}<button type="button" aria-label={`${s} 선택 해제`} onClick={() => onChange(selected.filter(x => x !== s))}><X size={13} aria-hidden="true" /></button></span>)}
    <button type="button" className="chipClear" onClick={() => onChange([])}>전체 해제</button>
  </div>;
}
