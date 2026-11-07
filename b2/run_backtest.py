"""Main result: train on 2013 features (labels 2014-2016), test on 2016 features
(labels 2017-2025). Compares the model with popularity, common neighbours, random.

Run:  python b2/run_backtest.py     (run it ONCE on real data - no tuning)
"""
import common as K
import config as C


def main():
    K.check_split(C.MAIN["train"], C.MAIN["test"])
    print("Loading data...")
    train = K.load_features(*C.MAIN["train"])
    test = K.load_features(*C.MAIN["test"])

    print("Training...")
    model = K.train_model(train)

    print("Evaluating on test set...")
    results = K.evaluate(test["label"], K.all_scores(model, test))
    print("\n" + K.fmt(results))
    K.save(results, "backtest_metrics.csv")

    imp = K.feature_importance(model, test)
    print("\nFeature importance (drop in PR-AUC when shuffled):\n" + K.fmt(imp))
    K.save(imp, "feature_importance.csv")
    K.save_params()

    m, pop = (results.set_index("method").loc[x] for x in ["model", "popularity"])
    verdict = "BEATS" if m["p@1000"] > pop["p@1000"] and m["auc"] > pop["auc"] else "does NOT beat"
    print(f"\nModel {verdict} popularity "
          f"(p@1000 {m['p@1000']:.3f} vs {pop['p@1000']:.3f}, "
          f"AUC {m['auc']:.3f} vs {pop['auc']:.3f})")


if __name__ == "__main__":
    main()
