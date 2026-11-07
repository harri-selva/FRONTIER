"""Turn B2's results into the JSON file the website reads.

Run after run_backtest.py and run_forecast_export.py:
  python b2/export_web.py                       -> outputs/<fake|real>/forecasts.json
  python b2/export_web.py --top 300 --out path.json

Reads from outputs/<fake|real>/: backtest_metrics.csv, feature_importance.csv,
forecast_top.csv, plus concepts.parquet. If concepts.parquet has a category
column (field / primary_cat / category / cat) concepts are coloured by field and
the Medicine and Quant leaderboards fill up; otherwise they show as "Other".
"""
import argparse
import json
from datetime import datetime, timezone

import pandas as pd

import config as C

FIELDS = {
    "medicine": {"name": "Medicine & Biology", "color": "#ff6b8b"},
    "quant": {"name": "Quantitative Finance", "color": "#ffc04d"},
    "ml": {"name": "Machine Learning", "color": "#5cc8ff"},
    "physics": {"name": "Physics & Other", "color": "#a98bff"},
}
# arXiv category prefix -> website field, first match wins
FIELD_RULES = [("q-fin", "quant"), ("q-bio", "medicine"), ("physics.med-ph", "medicine"),
               ("physics.bio-ph", "medicine"), ("cs", "ml"), ("stat", "ml")]
FEATURE_NAMES = {"aa": "adamic_adar", "ra": "resource_alloc", "pa": "pref_attach"}


def field_of(value) -> str:
    v = str(value).strip().lower()
    if v in FIELDS:
        return v
    for prefix, field in FIELD_RULES:
        if v.startswith(prefix):
            return field
    return "physics"


def first_col(df, names):
    return next((c for c in names if c in df.columns), None)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--top", type=int, default=300, help="gaps to export")
    p.add_argument("--out", default=str(C.OUT_DIR / "forecasts.json"))
    a = p.parse_args()

    out_dir = C.OUT_DIR
    top = pd.read_csv(out_dir / "forecast_top.csv").sort_values("score", ascending=False).head(a.top)
    concepts = pd.read_parquet(C.CONCEPTS_FILE)

    # ---- concepts used by the exported gaps ----
    ids = sorted(set(top["u"]).union(top["v"]))
    cdf = concepts[concepts["concept_id"].isin(ids)].set_index("concept_id")
    fcol = first_col(cdf, ["field", "primary_cat", "category", "cat"])
    ycol = first_col(cdf, ["first_year", "first_seen", "year"])
    ncol = first_col(cdf, ["papers", "n_papers", "doc_freq", "count"])
    feature_year, horizon = C.FORECAST["predict"][0], C.FORECAST["train"][1]

    def year_of(v):
        try:
            return int(pd.Timestamp(v).year) if not isinstance(v, (int, float)) else int(v)
        except (ValueError, TypeError):
            return feature_year

    concept_rows = []
    for cid in ids:
        row = cdf.loc[cid] if cid in cdf.index else None
        concept_rows.append({
            "id": int(cid),
            "name": str(row["phrase"]) if row is not None else f"concept {cid}",
            "field": field_of(row[fcol]) if row is not None and fcol else "physics",
            "first_year": year_of(row[ycol]) if row is not None and ycol else feature_year,
            "papers": int(row[ncol]) if row is not None and ncol else 1,
        })
    names = {c["id"]: c["name"] for c in concept_rows}

    gaps = []
    for _, r in top.iterrows():
        u, v = int(r["u"]), int(r["v"])
        gaps.append({
            "a": u, "b": v,
            "score": round(float(r["score"]), 4),
            "cn": int(r.get("cn", 0)),
            "adamic_adar": round(float(r.get("aa", 0)), 3),
            "pref_attach": int(r.get("pa", 0)),
            "growth": int(round(float(r.get("growth_min", 0)) + float(r.get("growth_max", 0)))),
            "bridges": [],
            "brief": (f"Speculative. \"{names[u]}\" and \"{names[v]}\" have not appeared in the same "
                      f"abstract up to {feature_year}, yet share {int(r.get('cn', 0))} neighbouring "
                      f"concepts. Ranked by a model backtested out-of-sample; check prior work first."),
        })

    # ---- backtest ----
    backtest = None
    bt_path = out_dir / "backtest_metrics.csv"
    if bt_path.exists():
        bt = pd.read_csv(bt_path).set_index("method")
        ks = [k for k in C.PARAMS["top_k"] if f"p@{k}" in bt.columns]
        prec = lambda m: [float(bt.loc[m, f"p@{k}"]) if m in bt.index else None for k in ks]
        auc = lambda m: float(bt.loc[m, "auc"]) if m in bt.index and pd.notna(bt.loc[m, "auc"]) else None
        (ty, th), (sy, sh) = C.MAIN["train"], C.MAIN["test"]
        imp = {}
        imp_path = out_dir / "feature_importance.csv"
        if imp_path.exists():
            fi = pd.read_csv(imp_path)
            fi["importance"] = fi["importance"].clip(lower=0)
            total = fi["importance"].sum() or 1
            imp = {FEATURE_NAMES.get(f, f): round(float(x / total), 4)
                   for f, x in zip(fi["feature"], fi["importance"])}
        backtest = {
            "train": f"features <= {ty}, labels {ty + 1}-{ty + th}",
            "test": f"features <= {sy}, labels {sy + 1}-{sy + sh}",
            "model": "gradient boosting (HistGradientBoosting)",
            "candidates": 0, "evaluated": 0, "positives": 0,
            "base_rate": float(bt["base_rate"].iloc[0]),
            "k": ks,
            "precision": {"model": prec("model"), "popularity": prec("popularity"),
                          "random": prec("random")},
            "auc": {k: v for k, v in (("model", auc("model")), ("popularity", auc("popularity")))
                    if v is not None},
            "importance": imp,
        }

    used = sorted({c["field"] for c in concept_rows}) or ["physics"]
    out = {
        "meta": {
            "demo": bool(C.USE_FAKE),
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "data_end": feature_year,
            "horizon": f"{feature_year + 1}-{feature_year + horizon}",
            "source": "B2 model on " + ("FAKE test data" if C.USE_FAKE else "arXiv data"),
            "n_concepts": int(len(concepts)),
            "n_links": 0,
        },
        "fields": [{"id": f, **FIELDS[f]} for f in used],
        "concepts": concept_rows,
        "gaps": gaps,
        "backtest": backtest,
    }
    C.OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"Wrote {len(gaps)} gaps and {len(concept_rows)} concepts to {a.out}")
    if not fcol:
        print("  NOTE: concepts.parquet has no field/category column, so the Medicine and "
              "Quant leaderboards will be empty. Ask Person A to add one.")


if __name__ == "__main__":
    main()
