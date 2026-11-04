"""정답 샘플로 분류 정확도 측정.  python collector/eval_classify.py [--errors] [--split train|valid|all]"""
import argparse, collections, json, sys
from pathlib import Path
from classify import UNCATEGORIZED, classify

SAMPLES = Path(__file__).resolve().parent.parent / 'tests' / 'classify_samples.json'


def evaluate(split='all'):
    rows = [r for r in json.loads(SAMPLES.read_text(encoding='utf-8')) if split in ('all', r['split'])]
    bad, ok = [], 0
    for r in rows:
        pred = classify(r['title'], r['feed_name'])['category']
        if pred == r['label']:
            ok += 1
        else:
            bad.append((r, pred))
    n = len(rows)
    return {'n': n, 'accuracy': ok / n, 'pred_uncat': sum(classify(r['title'], r['feed_name'])['category'] == UNCATEGORIZED for r in rows) / n,
            'true_uncat': sum(r['label'] == UNCATEGORIZED for r in rows) / n, 'errors': bad}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--errors', action='store_true'); ap.add_argument('--split', default='all')
    a = ap.parse_args()
    for sp in ('train', 'valid', 'all'):
        r = evaluate(sp)
        print(f"{sp:5} n={r['n']:3} 정확도 {r['accuracy']:.1%}  예측 미분류 {r['pred_uncat']:.1%}  (정답 미분류 {r['true_uncat']:.1%})")
    if a.errors:
        for r, pred in evaluate(a.split)['errors']:
            print(f"{'?' if r['ambiguous'] else ' '} [{r['split']}] 정답={r['label']} / 규칙={pred} | {r['title'][:60]}")
