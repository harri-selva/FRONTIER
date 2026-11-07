"""Review helper for vocab.csv.

Prints (1) SUSPECTS: single-word concepts spread evenly across finance,
biology and medicine (generic words usually are), and (2) the most common
single-word concepts. Nothing is deleted: copy real junk into
GENERIC_PHRASES in frontier_data.py and rerun vocab.

Usage: python pipeline/review_vocab.py data/vocab.csv [spread_threshold] [n]
"""
import sys
import pandas as pd

path = sys.argv[1] if len(sys.argv) > 1 else "data/vocab.csv"
threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.85
n = int(sys.argv[3]) if len(sys.argv) > 3 else 150


def grid(words):
    for i in range(0, len(words), 6):
        print("  ".join(f"{w:<20}" for w in words[i:i + 6]))


v = pd.read_csv(path)
single = v[~v["concept"].str.contains(" ")]

if "spread" in v.columns:
    sus = single[single["spread"] >= threshold]
    print(f"SUSPECTS: {len(sus)} single-word concepts with spread >= {threshold} "
          f"(evenly used across fields, likely generic):\n")
    grid(sus["concept"].tolist())
    multi = v[v["concept"].str.contains(" ") & (v["spread"] >= 0.95)]
    print(f"\nAlso {len(multi)} multi-word phrases with spread >= 0.95 (usually fine, skim):\n")
    grid(multi["concept"].head(60).tolist())
    print()

print(f"{len(single):,} single-word concepts out of {len(v):,} total. Top {n}:\n")
grid(single.head(n)["concept"].tolist())
