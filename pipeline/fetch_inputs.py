"""
Step 0a: copy the two input files we use from the `data-pipeline` branch into data/raw/.

  data/paper_concepts_2026.parquet  -> data/raw/paper_concepts_2026.parquet
  data/vocab_2026.csv               -> data/raw/vocab_2026.csv
  data/paper_metadata.parquet       -> data/raw/paper_metadata.parquet   (Person A: title, authors,
                                       DOI, journal ref and ALL arXiv categories for every paper)

We read them straight out of git so nobody has to copy files by hand.
Run from the repo root:  python pipeline/fetch_inputs.py
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
FILES = ["data/paper_concepts_2026.parquet", "data/vocab_2026.csv", "data/paper_metadata.parquet"]


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "fetch", "origin", "data-pipeline"], cwd=ROOT, check=True)
    for f in FILES:
        blob = subprocess.run(["git", "show", f"origin/data-pipeline:{f}"], cwd=ROOT,
                              check=True, capture_output=True).stdout
        out = RAW / Path(f).name
        out.write_bytes(blob)
        print(f"wrote {out} ({len(blob):,} bytes)")


if __name__ == "__main__":
    main()
