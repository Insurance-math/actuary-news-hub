"""제목에서 보험사(config/companies.json)·유관기관(config/orgs.json)을 찾는다. 카테고리와 별개의 필터용 메타(companies/orgs 필드).
한글 별칭은 띄어쓰기를 무시한 부분일치, 영문·숫자만인 별칭은 단어 경계, {t,not_before,not_after} 별칭은 앞뒤 글자를 제한한 정규식으로 비교한다.
"""
from __future__ import annotations
import json
import re
from functools import lru_cache
from pathlib import Path

from classify import Matcher, _squash

CONFIG_DIR = Path(__file__).resolve().parent.parent / 'config'


class _Rule:
    """앞뒤 글자를 제한한 별칭(예: '한은' — '신한은행'의 일부가 아니어야 함). 띄어쓰기를 둔 원문 제목에서 찾는다."""

    def __init__(self, spec: dict):
        self.keyword = spec['t']
        pat = re.escape(spec['t'].casefold())
        if spec.get('not_before'):
            pat = f"(?<!{spec['not_before']})" + pat
        if spec.get('not_after'):
            pat += f"(?!{spec['not_after']})"
        self.pat = re.compile(pat)

    def find(self, text: str, squashed: str) -> int:
        m = self.pat.search(text)
        return m.start() if m else -1


class Entities:
    def __init__(self, items: list[dict]):
        self.items = []
        for it in items:
            ms = [(_Rule(a) if isinstance(a, dict) else Matcher(a)) for a in it.get('aliases', [])]
            names = [a['t'] if isinstance(a, dict) else a for a in it.get('aliases', [])]
            self.items.append({'name': it['name'], 'group': it.get('group'), 'matchers': ms, 'aliases': names, 'sources': set(it.get('sources', []))})
        self.alias_keys = {_squash(a) for it in self.items for a in it['aliases'] + [it['name']]}

    def match(self, title: str, source: str | None = None) -> list[str]:
        """제목에 나온 순서대로 정식명 목록(중복 없음). source 가 기관의 공식 출처면 그 기관도 포함."""
        text, sq = title.casefold(), _squash(title)
        found: list[tuple[int, str]] = []
        for it in self.items:
            pos = [p for p in (m.find(text, sq) for m in it['matchers']) if p >= 0]
            if pos:
                found.append((min(pos), it['name']))
            elif source and source in it['sources']:
                found.append((10_000, it['name']))
        return [n for _, n in sorted(found, key=lambda x: x[0])]

    def strip_tags(self, tags: list[str]) -> list[str]:
        """분류 키워드 태그 중 보험사·기관 이름과 같은 것은 빼서(필터의 정식명으로 통일) 중복 표기를 막는다."""
        return [t for t in tags if _squash(t) not in self.alias_keys]


@lru_cache(maxsize=None)
def load(config_dir: str | None = None) -> tuple['Entities', 'Entities']:
    d = Path(config_dir) if config_dir else CONFIG_DIR
    rd = lambda n, k: json.loads((d / n).read_text(encoding='utf-8')).get(k, []) if (d / n).exists() else []
    return Entities(rd('companies.json', 'companies')), Entities(rd('orgs.json', 'orgs'))


def tag_entities(title: str, source: str | None, tags: list[str]) -> dict:
    """{'companies': [...], 'orgs': [...], 'tags': 보험사·기관 이름을 뺀 태그}."""
    comp, orgs = load()
    return {'companies': comp.match(title), 'orgs': orgs.match(title, source), 'tags': orgs.strip_tags(comp.strip_tags(tags))}


@lru_cache(maxsize=None)
def _relevance_cfg() -> dict:
    d = CONFIG_DIR / 'companies.json'
    return json.loads(d.read_text(encoding='utf-8')).get('relevance', {}) if d.exists() else {}


def sports_team_title(title: str) -> bool:
    """보험사 이름이 나오지만 스포츠 구단 기사(삼성화재 블루팡스, KB손보 배구단 등)로 보이는 제목."""
    t = title.casefold()
    return any(w.casefold() in t for w in _relevance_cfg().get('exclude_title_words', [])) and bool(load()[0].match(title))


def company_relevant(title: str) -> bool:
    """제목에 보험사가 나오면 '보험' 단어가 없어도 관련 기사로 본다(config/companies.json relevance). 스포츠 구단 기사 등 제외 단어가 있으면 아니다."""
    cfg = _relevance_cfg()
    if not cfg.get('company_mention_is_relevant'):
        return False
    t = title.casefold()
    if any(w.casefold() in t for w in cfg.get('exclude_title_words', [])):
        return False
    return bool(load()[0].match(title))
