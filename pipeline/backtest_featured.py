"""
Step 3b: backtest the website's FEATURED-gap rule (frozen in config.py before the
first backtest run): Resource Allocation, but only for pairs where BOTH concepts are
"specific" at the cutoff (degree <= the field's 75th percentile, >= 20 papers).

Same honest setup as backtest.py: main cutoff 2018, labels to the end of the data,
every qualifying unlinked pair is scored, results appended to runs.csv.
Also picks the example hits shown on the Validation page from this rule.

Run:  python pipeline/backtest_featured.py      (after backtest.py)
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import backtest as B  # noqa: E402
import config as C    # noqa: E402
import graph as G     # noqa: E402


def specific_mask(fd, t, alive, deg):
    m = fd.mentions[fd.mentions["date"] <= t]
    papers = np.bincount(m["concept_id"].to_numpy(), minlength=fd.n)
    cut = np.quantile(deg[alive], C.FEATURE_MAX_DEG_PCTL)
    return alive & (deg <= cut) & (papers >= C.FEATURE_MIN_PAPERS)


def main():
    ctx = B.run_context()
    for field in C.FIELDS:
        rng = np.random.default_rng(C.SEED + 1)
        fd = G.load_field(field, C.PROC)
        t = G.end_of_year(C.MAIN_CUTOFF)
        kw = dict(min_papers=C.MIN_PAPERS, max_share=C.MAX_SHARE, med_params=B.MED_PARAMS)
        test = G.features_at(fd, t, B.DATA_END, **kw)
        alive = G.alive_mask(fd, t, C.MIN_PAPERS, C.MAX_SHARE)
        _, deg = G.snapshot(fd, t, alive)
        spec = specific_mask(fd, t, alive, deg)
        sub = test[spec[test["u"].to_numpy()] & spec[test["v"].to_numpy()]].reset_index(drop=True)
        scores = {"resource_allocation": sub["ra"].to_numpy(np.float64) + rng.uniform(0, 1e-9, len(sub)),
                  "preferential_attachment": sub["pa"].to_numpy(np.float64) + rng.uniform(0, 1e-9, len(sub)),
                  "common_neighbours": sub["cn"].to_numpy(np.float64) + rng.uniform(0, 1e-9, len(sub)),
                  "random": rng.random(len(sub))}
        res, rows = {"rule": f"both concepts: degree <= {C.FEATURE_MAX_DEG_PCTL:.0%} percentile, "
                             f">= {C.FEATURE_MIN_PAPERS} papers (at the cutoff)",
                     "metrics": {}, "metrics_secondary": {}}, []
        u, v = sub["u"].to_numpy(), sub["v"].to_numpy()
        for name, s in scores.items():
            for col, store in [("label", "metrics"), ("label2", "metrics_secondary")]:
                m = B.metrics(s, sub[col].to_numpy(), u, v)
                res[store][name] = m
                rows.append({**ctx, "field": field, "kind": "main_featured_rule", "cutoff": C.MAIN_CUTOFF,
                             "window_end": C.DATA_END,
                             "label": "primary(>=1 joint paper)" if col == "label" else "secondary(>=2 joint papers)",
                             "ranker": name, **m})
        res["examples"], res["top100_filled_by_year"] = B.example_hits(fd, sub, scores, C.MAIN_CUTOFF, n_show=5)
        B.log_runs(rows)
        path = C.OUT / f"backtest_{field}.json"
        out = json.loads(path.read_text())
        out["featured_rule"] = res
        path.write_text(json.dumps(out, indent=2, default=str))
        print(f"\n=== {C.FIELD_NAMES[field]}: featured rule, cutoff {C.MAIN_CUTOFF} ({len(sub):,} pairs) ===")
        B.print_table({"metrics": res["metrics"], "train": {}}, brief=True)
        print("  secondary: " + ", ".join(f"{k} P@100={x['p@100']:.2f} AUC={x['auc']:.3f}"
                                         for k, x in res["metrics_secondary"].items()))
        for e in res["examples"]:
            print(f"  HIT #{e['rank']:>3} {e['u_name']} + {e['v_name']} -> {e['filled_date']} "
                  f"({e['lead_time_years']} yrs) {e['paper_id']}: {e['title'][:70]}")


if __name__ == "__main__":
    main()
