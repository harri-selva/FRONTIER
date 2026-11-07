"""
Which papers belong to which FRONTIER field (planet).

Only two fields are real: QUANT and MEDICINE.

Step 1 (no network needed) - a CANDIDATE list, used to decide which papers to
fetch metadata for:
  QUANT    candidate: primary category q-fin.* or econ.*, OR the paper's concepts
           "vote" finance (average of share_finance/share_medicine/share_biology
           from Person A's vocabulary; the largest wins)
  MEDICINE candidate: primary category physics.med-ph, OR concepts vote medicine

Step 2 (after arXiv metadata is fetched) - the FINAL rule, using the paper's
full list of arXiv categories (primary + cross-lists):
  QUANT    = has any q-fin.* category, or primary category econ.*
  MEDICINE = has physics.med-ph among its categories
  A paper that qualifies for both goes to the field of its primary category,
  otherwise to the field its concepts vote for. (Each paper is in ONE field.)
If metadata is missing for a candidate, we fall back to the candidate rule.
"""

import numpy as np
import pandas as pd

FIELDS = ["quant", "medicine"]
VOTE_COLS = {"finance": "share_finance", "medicine": "share_medicine", "biology": "share_biology"}


def primary_group(primary_cat: pd.Series) -> pd.Series:
    """quant / medicine / biology / other from the arXiv primary category alone."""
    pc = primary_cat.fillna("")
    return pd.Series(np.select(
        [pc.str.startswith("q-fin") | pc.str.startswith("econ"),
         pc == "physics.med-ph",
         pc.str.startswith("q-bio")],
        ["quant", "medicine", "biology"], "other"), index=primary_cat.index)


def concept_vote(concepts: pd.Series, vocab: pd.DataFrame) -> pd.Series:
    """For each paper: 'quant', 'medicine', 'biology' or '' by average concept field share."""
    shares = vocab.set_index("concept")[list(VOTE_COLS.values())]
    names = np.array(["quant", "medicine", "biology"])
    lookup = {c: row for c, row in zip(shares.index, shares.to_numpy())}
    out = []
    for cs in concepts:
        rows = [lookup[c] for c in cs if c in lookup]
        out.append(names[int(np.argmax(np.mean(rows, axis=0)))] if rows else "")
    return pd.Series(out, index=concepts.index)


def candidate_field(papers: pd.DataFrame, vocab: pd.DataFrame) -> pd.Series:
    """Step 1: '' if the paper can't be Quant or Medicine."""
    grp = primary_group(papers["primary_cat"])
    vote = concept_vote(papers["concepts"], vocab)
    cand = np.where(grp.isin(FIELDS), grp,
                    np.where((grp == "other") & vote.isin(FIELDS), vote, ""))
    return pd.Series(cand, index=papers.index)


def final_field(papers: pd.DataFrame, vocab: pd.DataFrame) -> pd.Series:
    """Step 2: needs a `categories` column (space separated) where metadata exists."""
    grp = primary_group(papers["primary_cat"])
    vote = concept_vote(papers["concepts"], vocab)
    cand = candidate_field(papers, vocab)
    cats = papers.get("categories", pd.Series("", index=papers.index)).fillna("")
    has_meta = cats != ""
    is_q = cats.str.contains(r"(?:^|\s)q-fin\.", regex=True) | papers["primary_cat"].str.startswith("econ")
    is_m = cats.str.contains(r"(?:^|\s)physics\.med-ph(?:\s|$)", regex=True)
    both = is_q & is_m
    field = np.select(
        [both & grp.isin(FIELDS), both & vote.isin(FIELDS), is_q, is_m],
        [grp, vote, "quant", "medicine"], "")
    # no metadata -> keep the candidate rule
    field = np.where(has_meta, field, cand)
    return pd.Series(field, index=papers.index)
