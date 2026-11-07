"""Print single-word concepts from vocab.csv, most common first, for manual review.

Usage: python pipeline/review_vocab.py data/vocab.csv 150
"""
import sys
import pandas as pd

path = sys.argv[1] if len(sys.argv) > 1 else "data/vocab.csv"
n = int(sys.argv[2]) if len(sys.argv) > 2 else 150
v = pd.read_csv(path)
single = v[~v["concept"].str.contains(" ")]
print(f"{len(single):,} single-word concepts out of {len(v):,} total. Top {n}:\n")
words = single.head(n)["concept"].tolist()
for i in range(0, len(words), 6):
    print("  ".join(f"{w:<18}" for w in words[i:i + 6]))
