"""제목·출처 정규화 + 기존 데이터(data/*.json) 일괄 정리(멱등)."""
from __future__ import annotations
import json
import re
from pathlib import Path

ORG_SUFFIX = re.compile(r'\s+[-–|]\s+(금융위원회|금융감독원)\s*$')


def strip_org_suffix(title: str) -> str:
    """감독당국 제목 끝의 기관명 접미사(' - 금융위원회', ' - 금융감독원 - 금융감독원' 등)를 반복 제거."""
    prev = None
    while prev != title:
        prev, title = title, ORG_SUFFIX.sub('', title)
    return title.strip()


def normalize_article(a: dict) -> dict:
    a['title'] = strip_org_suffix(a['title'])
    return a


def normalize_shards(data_dir: Path) -> int:
    """기존 월 파일의 제목/출처를 현재 규칙으로 다시 정리하고, 정리 결과 같아진 기사는 합친다. 바뀐 파일 수 반환."""
    changed = 0
    for path in sorted(data_dir.glob('????-??.json')):
        rows = json.loads(path.read_text(encoding='utf-8'))
        before = json.dumps(rows, ensure_ascii=False)
        rows = [normalize_article(a) for a in rows]
        if json.dumps(rows, ensure_ascii=False) != before:
            path.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
            changed += 1
    return changed
