"""
Independent hand checks (run after the pipeline):  python qa/hand_checks.py

1. 5 random exported gaps per field: rebuild the co-mention graph from the raw processed
   tables with plain pandas + networkx (NOT the pipeline's code) and recompute
   cn, Jaccard, Adamic-Adar, Resource Allocation and preferential attachment.
   Also check that the pair really has no joint paper and that both concepts are in the same field.
2. Every backtest example hit: the first joint paper is dated inside the label window,
   is the EARLIEST paper mentioning both concepts, and the pair had no joint paper before the cutoff.
Writes qa/hand_checks.md.
"""
import json
import math
import random
from itertools import combinations
from pathlib import Path

import networkx as nx
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC, WEB, OUT = ROOT / "data" / "processed", ROOT / "web" / "public" / "data", ROOT / "outputs"
MIN_PAPERS, MAX_SHARE = 10, 0.10
lines = ["# Hand checks", ""]
ok_all = True


def say(s):
    print(s)
    lines.append(s)


for field in ["medicine", "quant"]:
    papers = pd.read_parquet(PROC / field / "papers.parquet")
    pc = pd.read_parquet(PROC / field / "paper_concepts.parquet")
    concepts = pd.read_parquet(PROC / field / "concepts.parquet").set_index("concept_id")
    # alive concepts at the end of the data
    cnt = pc.groupby("concept_id")["paper_id"].nunique()
    alive = set(cnt[(cnt >= MIN_PAPERS) & (cnt <= MAX_SHARE * len(papers))].index)
    G = nx.Graph()
    G.add_nodes_from(alive)
    for _, grp in pc[pc["concept_id"].isin(alive)].groupby("paper_id")["concept_id"]:
        G.add_edges_from(combinations(sorted(set(grp)), 2))
    say(f"\n## {field}: {G.number_of_nodes():,} concepts, {G.number_of_edges():,} links (rebuilt independently)")

    gaps = []
    for f in sorted((WEB / field).glob("land_*.json")):
        if not f.name.endswith("_text.json"):
            gaps += json.loads(f.read_text())["gaps"]
    random.seed(7)
    sample = random.sample(gaps, 5)
    say("\n| gap | check | exported | recomputed | ok |\n|---|---|---|---|---|")
    for g in sample:
        u, v = g["u"], g["v"]
        shared = list(nx.common_neighbors(G, u, v))
        ref = {
            "no joint paper": (False, G.has_edge(u, v)),
            "same field": (True, u in concepts.index and v in concepts.index and g["field"] == field),
            "cn": (g["cn"], len(shared)),
            "ra": (g["ra"], sum(1 / G.degree(w) for w in shared)),
            "aa": (g["aa"], sum(1 / math.log(max(G.degree(w), 2)) for w in shared)),
            "jaccard": (g["jaccard"], len(shared) / len(set(G[u]) | set(G[v]))),
            "pa": (g["pa"], G.degree(u) * G.degree(v)),
            "listed degrees": (True, all(G.degree(w) == d for w, d in g["shared"])),
        }
        for k, (a, b) in ref.items():
            ok = (abs(a - b) < 1e-3 * max(1, abs(b))) if isinstance(a, float) else a == b
            ok_all &= ok
            say(f"| {g['u_name']} + {g['v_name']} | {k} | {a if not isinstance(a, float) else round(a, 4)} | "
                f"{b if not isinstance(b, float) else round(b, 4)} | {'yes' if ok else 'NO'} |")

    bt = json.loads((OUT / f"backtest_{field}.json").read_text())
    hits = bt["examples"] + bt.get("featured_rule", {}).get("examples", [])
    dates = papers.set_index("paper_id")["date"]
    say("\n| hit | first paper | date | in window 2019-01-01..2026-10-29 | earliest joint paper | no joint paper by 2018 |\n|---|---|---|---|---|---|")
    for h in hits:
        u, v = h["u"], h["v"]
        pu = set(pc.loc[pc["concept_id"] == u, "paper_id"])
        pv = set(pc.loc[pc["concept_id"] == v, "paper_id"])
        joint = sorted(pu & pv, key=lambda p: (dates[p], p))
        first = joint[0] if joint else None
        d = pd.Timestamp(dates[h["paper_id"]])
        inwin = pd.Timestamp("2019-01-01") <= d <= pd.Timestamp("2026-10-29 23:59:59")
        earliest = first == h["paper_id"]
        before = all(pd.Timestamp(dates[p]) > pd.Timestamp("2018-12-31 23:59:59") for p in joint)
        ok_all &= inwin and earliest and before
        say(f"| {h['u_name']} + {h['v_name']} | {h['paper_id']} | {d.date()} | {'yes' if inwin else 'NO'} | "
            f"{'yes' if earliest else 'NO'} | {'yes' if before else 'NO'} |")

say(f"\nALL CHECKS PASSED: {ok_all}")
(ROOT / "qa" / "hand_checks.md").write_text("\n".join(lines) + "\n")
raise SystemExit(0 if ok_all else 1)
