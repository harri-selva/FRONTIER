"""Robustness: does the result hold for test years 2012, 2014, 2016, 2018?
Same frozen settings each time, 5-year label horizon.

Run:  python b2/run_robustness.py
"""
import pandas as pd

import common as K
import config as C


def main():
    rows = []
    for test_year, split in C.ROBUSTNESS.items():
        print(f"\n=== Test year {test_year} ===")
        K.check_split(split["train"], split["test"])
        train = K.load_features(*split["train"])
        test = K.load_features(*split["test"])
        model = K.train_model(train)
        res = K.evaluate(test["label"], K.all_scores(model, test))
        res.insert(0, "test_year", test_year)
        print(K.fmt(res))
        rows.append(res)

    out = pd.concat(rows)
    K.save(out, "robustness_metrics.csv")

    wide = out.pivot(index="test_year", columns="method", values="p@1000")
    wide["model_beats_popularity"] = wide["model"] > wide["popularity"]
    print("\np@1000 by test year:\n" + wide.to_string(float_format=lambda x: f"{x:.4f}"))
    print(f"\nModel beats popularity in {wide['model_beats_popularity'].sum()} "
          f"of {len(wide)} years.")


if __name__ == "__main__":
    main()
