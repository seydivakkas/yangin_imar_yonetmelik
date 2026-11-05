"""python -m diagram_yonetmelik.evaluate_gnn"""
import hashlib
import json
import math
import numpy as np
import torch
from sklearn.metrics import roc_auc_score

from .gnn_order import violation_energy
from .train_gnn import ROOT, SEEDS, building_splits, embed, pairs, train


@torch.no_grad()
def scores(model, examples):
    return np.array([(label, violation_energy(embed(model, q), embed(model, t)).item())
                     for q, t, label in examples])


def calibrate(validation):
    positive = np.sort(validation[validation[:, 0] == 1, 1])
    if not len(positive):
        raise ValueError("Doğrulama kümesinde pozitif çift bulunamadı")
    return float(positive[len(positive) - 1 - math.floor(len(positive) * .01)])


def summarize(values, tau):
    positive = values[values[:, 0] == 1, 1]
    negative = values[values[:, 0] == 0, 1]
    def distribution(group):
        return dict(zip(["min", "q25", "median", "q75", "max"],
                        np.quantile(group, [0, .25, .5, .75, 1]).tolist()))
    return {"auroc": roc_auc_score(values[:, 0], -values[:, 1]),
            "positive": len(positive), "negative": len(negative),
            "positive_pruned": int(sum(positive > tau)), "negative_pruned": int(sum(negative > tau)),
            "positive_pruned_rate": float(np.mean(positive > tau)), "negative_pruned_rate": float(np.mean(negative > tau)),
            "positive_energy": distribution(positive), "negative_energy": distribution(negative)}


def main():
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    data = ROOT / "data"
    runs = []
    for seed in SEEDS:
        split = building_splits(seed)
        training = pairs(split["train"])
        model, losses = train(seed, training)
        validation = scores(model, pairs(split["validation"]))
        tau = calibrate(validation)
        if seed == SEEDS[0]:  # Sabit dağıtım tohumu, test sonuçlarından önce seçilir.
            path = data / "spatial_order_gnn.pt"
            model.save_weights(str(path))
            calibration = {"model_version": hashlib.sha256(path.read_bytes()).hexdigest(), "tau": tau,
                           "seed": seed, "k_hops": 2, "max_escape_distance_m": 30,
                           "validation": summarize(validation, tau)}
            (data / "gnn_calibration.json").write_text(json.dumps(calibration, indent=2), encoding="utf8")
        runs.append({"seed": seed, "buildings": split, "tau": tau, "eğitim": {"pairs": len(training), "loss_by_epoch": losses},
                     "validation": summarize(validation, tau), "test": summarize(scores(model, pairs(split["test"])), tau)})
    (data / "gnn_eval_metrics.json").write_text(json.dumps(runs, ensure_ascii=False, indent=2), encoding="utf8")


if __name__ == "__main__":
    main()
