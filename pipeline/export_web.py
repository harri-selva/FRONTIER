"""
Step 4: compute CURRENT gaps (cutoff = last date in the data) and export the
static JSON the website reads, into web/public/data/.

  fields.json                         both planets + summary numbers
  meta.json                           data sources, build time, content mode
  gaps_top.json                       leaderboard: top featured gaps per field
  <field>/lands.json                  islands with positions on the planet
  <field>/concepts.json               every live concept (id, name, land, papers)
  <field>/land_<id>.json              network + gaps + papers for one island (lazy-loaded)
  <field>/backtest.json               validation numbers (from outputs/backtest_<field>.json)

Run:  python pipeline/export_web.py      (after prepare.py and backtest.py)
"""
import json
import math
import re
import sys
import time
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C            # noqa: E402
import generate_content as GC  # noqa: E402
import graph as G             # noqa: E402

SHARED_SHOWN = 12   # shared neighbours listed per gap; the rest are summed
NOW = pd.Timestamp(C.DATA_END) + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1)


def _np(o):
    """json.dumps helper: numpy numbers -> plain Python numbers."""
    return o.item() if hasattr(o, "item") else str(o)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def short_authors(a: str, n=4):
    parts = [p for p in (a or "").split("; ") if p]
    return ", ".join(parts[:n]) + (" et al." if len(parts) > n else "")


def pack_islands(lands, aspect=16 / 9, seed=C.SEED):
    """Place circles (radius ~ sqrt(papers)) without overlap on a 16:9 ocean. Returns x,y,r in 0..1."""
    rng = np.random.default_rng(seed)
    sizes = np.array([l["papers"] for l in lands], float)
    r = 0.06 + 0.11 * np.sqrt(sizes / sizes.max())
    placed = []
    for i in np.argsort(-r):
        best = None
        for _ in range(4000):
            x, y = rng.uniform(r[i] + 0.04, 1 - r[i] - 0.04), rng.uniform(r[i] * aspect + 0.10, 1 - r[i] * aspect - 0.05)
            ok = all(math.hypot(x - px, (y - py) / aspect) > r[i] + pr + 0.025 for px, py, pr, _ in placed)
            if ok:
                # prefer positions close to the centre so the archipelago is compact
                d = math.hypot(x - 0.5, (y - 0.55) / aspect)
                if best is None or d < best[0]:
                    best = (d, x, y)
        if best is None:   # shrink and retry once
            r[i] *= 0.8
            x, y = rng.uniform(0.1, 0.9), rng.uniform(0.2, 0.9)
            best = (0, x, y)
        placed.append((best[1], best[2], r[i], i))
    out = {}
    for x, y, rr, i in placed:
        out[lands[i]["id"]] = (round(x, 4), round(y, 4), round(float(rr), 4))
    return out


def layout(nodes, links, seed=C.SEED):
    """Force layout fitted into a unit disc (the island)."""
    g = nx.Graph()
    g.add_nodes_from(nodes)
    for a, b, w in links:
        g.add_edge(a, b, weight=math.log1p(w))
    pos = nx.spring_layout(g, seed=seed, k=1.6 / math.sqrt(max(len(nodes), 1)), iterations=200, weight="weight")
    P = np.array([pos[n] for n in nodes])
    P -= P.mean(axis=0)
    # rank-based radial normalisation spreads nodes evenly over the disc
    rad = np.hypot(P[:, 0], P[:, 1])
    ang = np.arctan2(P[:, 1], P[:, 0])
    order = np.argsort(np.argsort(rad))
    rr = 0.12 + 0.80 * np.sqrt((order + 0.5) / len(nodes))
    P = np.c_[rr * np.cos(ang), rr * np.sin(ang)]
    # small repulsion so labels/nodes don't sit on top of each other
    for _ in range(60):
        D = P[:, None, :] - P[None, :, :]
        dist = np.hypot(D[..., 0], D[..., 1]) + np.eye(len(P))
        push = np.clip(0.11 - dist, 0, None)[..., None] * D / dist[..., None]
        P += 0.5 * push.sum(axis=1)
        n = np.hypot(P[:, 0], P[:, 1])
        P[n > 0.93] *= (0.93 / n[n > 0.93])[:, None]
    return {n: (round(float(x), 4), round(float(y), 4)) for n, (x, y) in zip(nodes, P)}


def export_field(field, out_root):
    t0 = time.time()
    fd = G.load_field(field, C.PROC)
    con = fd.concepts.set_index("concept_id")
    name = lambda c: con.at[c, "display"]  # noqa: E731
    lands = json.loads((C.PROC / field / "lands.json").read_text())
    land_name = {l["id"]: l["name"] for l in lands}

    # ---- current snapshot and every unlinked pair ---------------------------
    alive = G.alive_mask(fd, NOW, C.MIN_PAPERS, C.MAX_SHARE)
    A, deg = G.snapshot(fd, NOW, alive)
    feats = G.unlinked_pair_features(A, deg, alive)
    feats["pct"] = (feats["ra"].rank(method="average", pct=True) * 100).astype(np.float32)
    feats = feats.sort_values("ra", ascending=False, kind="stable").reset_index(drop=True)
    feats["rank"] = np.arange(1, len(feats) + 1)
    c_land = con["land"].to_numpy()
    u_arr, v_arr = feats["u"].to_numpy(), feats["v"].to_numpy()
    print(f"[{field}] alive concepts {alive.sum():,}, links {A.nnz // 2:,}, unlinked pairs {len(feats):,}")

    recent = G.node_features(fd, NOW)["recent"].to_numpy()
    n_papers = con["n_papers"].to_numpy()
    deg_cut = np.quantile(deg[alive], C.FEATURE_MAX_DEG_PCTL)
    specific = alive & (deg <= deg_cut) & (n_papers >= C.FEATURE_MIN_PAPERS)
    top1 = feats.iloc[: max(1, len(feats) // 100)]

    # ---- per-concept top gaps -----------------------------------------------
    long = pd.DataFrame({"c": np.r_[u_arr, v_arr], "row": np.r_[np.arange(len(feats)), np.arange(len(feats))]})
    long = long.sort_values("row", kind="stable")
    top_by_concept = long.groupby("c").head(C.GAPS_PER_CONCEPT).groupby("c")["row"].apply(list).to_dict()

    def featured(mask_rows, k):
        """Top-k rows by RA with both concepts specific and each concept used <= FEATURE_MAX_PER_CONCEPT times."""
        out, used = [], {}
        for r in mask_rows:
            a, b = int(u_arr[r]), int(v_arr[r])
            if not (specific[a] and specific[b]):
                continue
            if used.get(a, 0) >= C.FEATURE_MAX_PER_CONCEPT or used.get(b, 0) >= C.FEATURE_MAX_PER_CONCEPT:
                continue
            out.append(r)
            used[a], used[b] = used.get(a, 0) + 1, used.get(b, 0) + 1
            if len(out) >= k:
                break
        return out

    # ---- papers --------------------------------------------------------------
    papers = fd.papers.set_index("paper_id")
    has_meta = papers["title"].fillna("") != ""
    ment = fd.mentions.merge(papers[has_meta][[]], left_on="paper_id", right_index=True)
    ment = ment.sort_values("date", ascending=False)
    papers_of = ment.groupby("concept_id")["paper_id"].apply(list).to_dict()
    concepts_of_paper = fd.pc.groupby("paper_id")["concept_id"].apply(list).to_dict()
    paper_cache = {}

    def paper_obj(pid):
        if pid in paper_cache:
            return paper_cache[pid]
        p = papers.loc[pid]
        cs = [c for c in concepts_of_paper.get(pid, []) if alive[c]]
        cs = sorted(cs, key=lambda c: n_papers[c])            # most specific first
        names = [name(c) for c in cs]
        obj = {"id": pid, "title": p["title"], "authors": short_authors(p["authors"]),
               "n_authors": int(p["n_authors"] or 0), "date": str(pd.Timestamp(p["date"]).date()),
               "url": p["url"], "doi": p["doi"] or "", "journal": p["journal_ref"] or "",
               "cat": p["primary_cat"], "concepts": names[:8]}
        s = GC.paper_summary({**obj, "abstract": p["abstract"]}, names)
        obj["summary"], obj["summary_source"] = s["text"], s["source"]
        paper_cache[pid] = obj
        return obj

    neigh = [set() for _ in range(fd.n)]
    coo = A.tocoo()
    for a, b in zip(coo.row, coo.col):
        neigh[a].add(int(b))

    gap_cache = {}

    def gap_obj(r):
        if r in gap_cache:
            return gap_cache[r]
        row = feats.iloc[r]
        a, b = int(row["u"]), int(row["v"])
        shared = sorted(neigh[a] & neigh[b], key=lambda w: deg[w])
        sh = [{"id": int(w), "name": name(w), "deg": int(deg[w]), "ra": round(1.0 / deg[w], 6),
               "aa": round(1.0 / math.log(max(deg[w], 2)), 6), "land": int(c_land[w])} for w in shared]
        # neighbours worth naming in text: real topics (>= FEATURE_MIN_PAPERS papers), largest contribution first
        notable = [x for x in sh if n_papers[x["id"]] >= C.FEATURE_MIN_PAPERS] or sh
        g = {"id": f"{field}-{a}-{b}", "field": field, "u": a, "v": b,
             "u_name": name(a), "v_name": name(b), "u_land": int(c_land[a]), "v_land": int(c_land[b]),
             "u_land_name": land_name[int(c_land[a])], "v_land_name": land_name[int(c_land[b])],
             "u_papers": int(n_papers[a]), "v_papers": int(n_papers[b]),
             "u_deg": int(deg[a]), "v_deg": int(deg[b]),
             "cn": int(row["cn"]), "ra": round(float(row["ra"]), 6), "aa": round(float(row["aa"]), 6),
             "jaccard": round(float(row["jaccard"]), 6), "pa": int(row["pa"]),
             "pct": round(float(row["pct"]), 3), "rank": int(row["rank"]), "n_candidates": int(len(feats)),
             "cross_land": bool(c_land[a] != c_land[b]),
             "shared": sh[:SHARED_SHOWN], "notable": [x["name"] for x in notable[:5]], "shared_total": len(sh),
             "shared_rest_ra": round(float(sum(s["ra"] for s in sh[SHARED_SHOWN:])), 6),
             "shared_rest_aa": round(float(sum(s["aa"] for s in sh[SHARED_SHOWN:])), 6)}
        # evidence: recent real papers on u and v that also mention a shared neighbour
        ev = []
        sset = set(shared)
        for c in (a, b):
            picks = [p for p in papers_of.get(c, []) if sset & set(concepts_of_paper.get(p, []))][:2]
            if not picks:
                picks = papers_of.get(c, [])[:1]
            for p in picks:
                po = paper_obj(p)
                ev.append({"id": p, "title": po["title"], "authors": po["authors"], "date": po["date"],
                           "concept": name(c), "abstract": papers.at[p, "abstract"]})
        g["evidence"] = [e["id"] for e in ev]
        g["content"] = GC.gap_content(g, C.FIELD_NAMES[field], ev)
        # compact form for the website: [concept id, degree]; the site computes 1/deg and 1/ln(deg)
        g["shared"] = [[s["id"], s["deg"]] for s in g["shared"]]
        gap_cache[r] = g
        return g

    out_dir = out_root / field
    out_dir.mkdir(parents=True, exist_ok=True)
    pos = pack_islands(lands)
    lands_out = []
    leaderboard = featured(range(len(feats)), C.GAPS_LEADERBOARD)

    for l in lands:
        L = l["id"]
        members = np.flatnonzero(alive & (c_land == L))
        members = members[np.argsort(-n_papers[members], kind="stable")]
        shown = [int(c) for c in members[:C.NODES_PER_LAND]]
        touch = np.flatnonzero((c_land[u_arr] == L) | (c_land[v_arr] == L))   # already sorted by RA
        feat_rows = featured(touch, C.GAPS_PER_LAND)
        gap_rows = set(feat_rows)
        concept_gaps = {}
        for c in shown:
            rs = top_by_concept.get(c, [])
            concept_gaps[c] = rs
            gap_rows |= set(rs)
        gaps = [gap_obj(r) for r in sorted(gap_rows)]
        # partners of FEATURED gaps on this island that are not yet shown become extra nodes
        extra = sorted({x for r in feat_rows for x in (int(u_arr[r]), int(v_arr[r]))
                        if c_land[x] == L and x not in shown})
        node_ids = shown + extra
        node_set = set(node_ids)
        # existing links: each node's strongest LINKS_PER_NODE links to other shown nodes
        e = fd.edges[(fd.edges["first_date"] <= NOW) & fd.edges["u"].isin(node_set) & fd.edges["v"].isin(node_set)]
        e = e[[alive[a] and alive[b] for a, b in zip(e["u"], e["v"])]]
        best = pd.concat([e.rename(columns={"u": "a", "v": "b"}), e.rename(columns={"v": "a", "u": "b"})])
        best = best.sort_values("n_papers", ascending=False).groupby("a").head(C.LINKS_PER_NODE)
        links = {(min(a, b), max(a, b)): int(w) for a, b, w in zip(best["a"], best["b"], best["n_papers"])}
        xy = layout(node_ids, [(a, b, w) for (a, b), w in links.items()])
        heat = np.log1p(n_papers[node_ids]) / np.log1p(n_papers[node_ids].max())
        nodes = [{"id": c, "name": name(c), "papers": int(n_papers[c]), "recent": int(recent[c]),
                  "deg": int(deg[c]), "heat": round(float(h), 3), "x": xy[c][0], "y": xy[c][1],
                  "extra": c in extra} for c, h in zip(node_ids, heat)]
        concept_papers = {c: papers_of.get(c, [])[:C.PAPERS_PER_CONCEPT] for c in node_ids}
        pids = {p for ps in concept_papers.values() for p in ps} | {p for g in gaps for p in g["evidence"]}
        land_json = {
            "field": field, "land": L, "name": l["name"], "papers": l["papers"],
            "nodes": nodes, "links": [[a, b, w] for (a, b), w in links.items()],
            "gaps": [{k: v for k, v in g.items() if k != "content"} for g in gaps], "featured": [gap_obj(r)["id"] for r in feat_rows],
            "concept_gaps": {str(c): [gap_obj(r)["id"] for r in rs] for c, rs in concept_gaps.items()},
            "concept_papers": {str(c): ps for c, ps in concept_papers.items()},
            "papers": {p: paper_obj(p) for p in sorted(pids)},
        }
        f = out_dir / f"land_{L}.json"
        f.write_text(json.dumps(land_json, separators=(",", ":"), default=_np))
        # generated text lives in its own file: loaded only when the side panel opens
        text = {g["id"]: g["content"] for g in gaps}
        (out_dir / f"land_{L}_text.json").write_text(json.dumps(text, separators=(",", ":"), default=_np))
        n_top1 = int(((c_land[top1["u"].to_numpy()] == L) | (c_land[top1["v"].to_numpy()] == L)).sum())
        x, y, r = pos[L]
        lands_out.append({**l, "slug": slug(l["name"]), "x": x, "y": y, "r": r,
                          "concepts": int(len(members)), "top_gaps": n_top1,
                          "cross_land_gaps": int(sum(g["cross_land"] for g in gaps)),
                          "featured": [gap_obj(r)["u_name"] + " + " + gap_obj(r)["v_name"] for r in feat_rows[:3]],
                          "bytes": f.stat().st_size})
        print(f"   land {L:2d} {l['name']:<34} nodes {len(nodes):3d} gaps {len(gaps):3d} "
              f"papers {len(pids):4d}  {f.stat().st_size / 1024:5.0f} KB + text "
              f"{(out_dir / f'land_{L}_text.json').stat().st_size / 1024:4.0f} KB")

    (out_dir / "lands.json").write_text(json.dumps(lands_out, indent=1, default=_np))
    concepts_out = [{"id": int(c), "name": name(c), "land": int(c_land[c]), "papers": int(n_papers[c])}
                    for c in np.flatnonzero(alive)]
    (out_dir / "concepts.json").write_text(json.dumps(concepts_out, separators=(",", ":"), default=_np))

    # backtest
    bt_path = C.OUT / f"backtest_{field}.json"
    if bt_path.exists():
        (out_dir / "backtest.json").write_text(bt_path.read_text())

    lb = [{k: gap_obj(r)[k] for k in ["id", "u", "v", "u_name", "v_name", "u_land", "v_land", "u_land_name",
                                       "v_land_name", "ra", "cn", "pct", "rank", "cross_land"]}
          for r in leaderboard]
    summary = {"id": field, "name": C.FIELD_NAMES[field], "live": True,
               "papers": int(len(fd.papers)), "lands": len(lands), "concepts": int(alive.sum()),
               "links": int(A.nnz // 2), "candidates": int(len(feats)), "top_gaps": int(len(top1)),
               "first_year": int(fd.papers["date"].min().year), "last_date": C.DATA_END}
    GC.save_cache()
    print(f"[{field}] done in {time.time() - t0:.0f}s")
    return summary, lb


def main():
    out = C.WEB_DATA
    out.mkdir(parents=True, exist_ok=True)
    fields, board = [], {}
    for field in C.FIELDS:
        s, lb = export_field(field, out)
        fields.append(s)
        board[field] = lb
    (out / "fields.json").write_text(json.dumps(fields, indent=1, default=_np))
    (out / "gaps_top.json").write_text(json.dumps(board, separators=(",", ":"), default=_np))
    meta = {"built": time.strftime("%Y-%m-%d %H:%M"), "content_mode": GC.mode(),
            "data_end": C.DATA_END,
            "sources": ["arXiv metadata (export.arxiv.org API)",
                        "Person A concept tagging: data-pipeline branch, paper_concepts_2026.parquet, vocab_2026.csv"]}
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    print("content mode:", GC.mode())


if __name__ == "__main__":
    main()
