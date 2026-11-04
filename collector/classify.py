"""제목 키워드 기반 분류기. 규칙은 config/categories.json 한 곳에서 관리한다."""
from __future__ import annotations
import json
import re
from functools import lru_cache
from pathlib import Path

UNCATEGORIZED = '미분류'  # 7개 카테고리 탭에는 노출하지 않고 '전체'에서만 보인다
TIERS = {'strong': 3, 'company': 2, 'normal': 1}
DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / 'config' / 'categories.json'
_ASCII = re.compile(r'^[a-z0-9\- ]+$')


def _squash(s: str) -> str:
    return re.sub(r'\s+', '', s.casefold())


class Matcher:
    """한글 등: 띄어쓰기 무시 부분일치 / 영문·숫자만 있는 키워드: 영숫자 단어 경계 일치."""

    def __init__(self, keyword: str):
        self.keyword = keyword
        k = keyword.casefold()
        if _ASCII.match(k):
            self.kind, self.pat = 'word', re.compile(r'(?<![a-z0-9])' + re.escape(k).replace(r'\ ', r'\s*') + r'(?![a-z0-9])')
        else:
            self.kind, self.pat = 'sub', _squash(keyword)

    def find(self, text: str, squashed: str) -> int:
        """첫 매칭 위치(없으면 -1)."""
        if self.kind == 'word':
            m = self.pat.search(text)
            return m.start() if m else -1
        return squashed.find(self.pat)


class Classifier:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.priority = cfg['priority']
        self.rules: dict[str, list[tuple[Matcher, int]]] = {}
        for cat, spec in cfg['categories'].items():
            items = [(Matcher(k), w) for tier, w in TIERS.items() for k in spec.get(tier, [])]
            items += [(Matcher(k), w) for k, w in spec.get('weighted', {}).items()]
            self.rules[cat] = items
        m = lambda ks: [Matcher(k) for k in ks]
        self.exclude, self.unless = m(cfg['exclude']['keywords']), m(cfg['exclude']['unless'])
        self.combos = [(m(x['any']), m(x['with'])) for x in cfg['exclude'].get('combos', [])]
        self.low = m(cfg['low_importance']['keywords'])
        self.low_max = cfg['low_importance']['max_score']
        self.important = m(cfg['important'])
        self.relevance = [_squash(k) for k in cfg['relevance_keywords']]
        self.hints = cfg.get('feed_hints', {})

    @staticmethod
    def _any(ms: list[Matcher], text: str, sq: str) -> bool:
        return any(x.find(text, sq) >= 0 for x in ms)

    def classify(self, title: str, feed_name: str | None = None) -> dict:
        text, sq = title.casefold(), _squash(title)
        relevant = any(k in sq for k in self.relevance)
        scores: dict[str, int] = {}
        hits: list[tuple[int, int, str]] = []  # (-weight, 위치, 키워드)
        for cat, items in self.rules.items():
            found = [(mt, w, mt.find(text, sq)) for mt, w in items]
            found = [f for f in found if f[2] >= 0]
            for mt, w, pos in found:
                # 같은 카테고리에서 더 긴 키워드에 포함되는 키워드('금리' ⊂ '기준금리')는 이중 계산하지 않는다
                if any(o is not mt and _squash(mt.keyword) != _squash(o.keyword) and _squash(mt.keyword) in _squash(o.keyword) for o, _, _ in found):
                    continue
                scores[cat] = scores.get(cat, 0) + w
                hits.append((-w, pos, mt.keyword))
        tags = list(dict.fromkeys(k for _, _, k in sorted(hits)))[:5]

        excluded = self._any(self.exclude, text, sq) or any(self._any(a, text, sq) and self._any(w, text, sq) for a, w in self.combos)
        if excluded and not self._any(self.unless, text, sq):
            return {'category': UNCATEGORIZED, 'sub_categories': [], 'tags': tags, 'score': 2, 'relevant': relevant}

        hint = self.hints.get(feed_name or '')
        if scores:
            top = max(scores.values())
            tied = [c for c in self.priority if scores.get(c) == top]
            category = tied[0]  # 동점이면 priority 순 (피드 단서는 쓰지 않는다)
        elif hint:
            category, top = hint, 0  # 키워드가 전혀 없을 때만 피드 단서
        else:
            category, top = UNCATEGORIZED, 0
        sub = [c for c, _ in sorted(scores.items(), key=lambda x: -x[1]) if c != category and scores[c] > 0]

        score = 2 + (top >= 3) + (top >= 6) + self._any(self.important, text, sq)
        score = min(5, score)
        if self._any(self.low, text, sq):
            score = min(score, self.low_max)
        return {'category': category, 'sub_categories': sub, 'tags': tags, 'score': int(score), 'relevant': relevant}


@lru_cache(maxsize=None)
def load(path: str | None = None) -> Classifier:
    return Classifier(json.loads(Path(path or DEFAULT_CONFIG).read_text(encoding='utf-8')))


def classify(title: str, feed_name: str | None = None) -> dict:
    return load().classify(title, feed_name)
