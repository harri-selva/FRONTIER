"""Forecast: train on 2022 features (labels 2023-2025), score every 2025 pair,
and export the top predictions with readable concept names.

Outputs:
  forecast_top.csv      top N pairs we predict will meet for the first time
  stage_candidates.csv  shortlist for Person D (top pairs, each concept used once)

Run:  python b2/run_forecast_export.py
"""
import pandas as pd

import common as K
import config as C


def main():
    print("Loading data...")
    train = K.load_features(*C.FORECAST["train"])
    future = K.load_features(*C.FORECAST["predict"], need_label=False)
    concepts = pd.read_parquet(C.CONCEPTS_FILE)[["concept_id", "phrase"]]
    names = concepts.set_index("concept_id")["phrase"]

    print("Training...")
    model = K.train_model(train)

    future["score"] = K.model_scores(model, future)
    top = future.nlargest(C.PARAMS["forecast_top_n"], "score").copy()
    top.insert(0, "rank", range(1, len(top) + 1))
    top["concept_a"] = top["u"].map(names)
    top["concept_b"] = top["v"].map(names)
    if top[["concept_a", "concept_b"]].isna().any().any():
        print("  WARNING: some u/v ids are not in concepts.parquet - ask B1/Person A")
    cols = ["rank", "u", "v", "concept_a", "concept_b", "score"] + C.FEATURES
    K.save(top[cols], "forecast_top.csv")

    # Stage candidates: walk down the ranking, skip pairs that reuse a concept,
    # so Person D gets varied pairs rather than one popular concept many times.
    used, picks = set(), []
    for _, r in top.iterrows():
        if r["u"] in used or r["v"] in used:
            continue
        picks.append(r)
        used.update([r["u"], r["v"]])
        if len(picks) == C.PARAMS["stage_top_n"]:
            break
    stage = pd.DataFrame(picks)[["rank", "concept_a", "concept_b", "score", "cn", "is_2hop"]]
    K.save(stage, "stage_candidates.csv")
    K.save_params()
    print(f"\n{len(stage)} stage candidates for Person D. Top 10:\n" + K.fmt(stage.head(10)))


if __name__ == "__main__":
    main()
