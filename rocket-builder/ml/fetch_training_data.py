"""Download training data for the planet-mass model from the NASA Exoplanet Archive.

Keeps only planets whose radius AND mass were both measured:
  * tran_flag = 1           -> the planet transits, so the radius is measured
  * pl_bmassprov = 'Mass'   -> a true mass (not a minimum mass, not a
                               mass-radius estimate, which would be circular)

Usage:  ml/.venv/bin/python ml/fetch_training_data.py
        ml/.venv/bin/python ml/fetch_training_data.py --from-json saved.json   (offline / proxied setups)
Writes: ml/data/training.csv (committed so training is reproducible)
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
COLS = [
    "pl_name", "hostname", "pl_rade", "pl_bmasse", "pl_bmassprov", "pl_orbper",
    "pl_eqt", "st_mass", "st_teff", "st_rad", "tran_flag", "disc_year",
]
QUERY = (
    f"select {','.join(COLS)} from pscomppars "
    "where tran_flag = 1 "
    "and pl_rade is not null and pl_bmasse is not null and pl_orbper is not null "
    "and pl_eqt is not null and st_mass is not null and st_teff is not null"
)
OUT = Path(__file__).parent / "data" / "training.csv"


def query_url() -> str:
    return f"{TAP}?{urllib.parse.urlencode({'query': QUERY, 'format': 'json'})}"


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "--from-json":
        rows = json.loads(Path(sys.argv[2]).read_text())
    elif len(sys.argv) == 2 and sys.argv[1] == "--print-url":
        print(query_url())
        return
    else:
        req = urllib.request.Request(query_url(), headers={"User-Agent": "exoplanet-rocket-builder/1.0"})
        with urllib.request.urlopen(req, timeout=120) as res:
            rows = json.load(res)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow([f"# NASA Exoplanet Archive pscomppars, retrieved {date.today().isoformat()}"])
        w.writerow(COLS)
        # Keep true masses only (filtered here rather than in the query string).
        rows = [r for r in rows if r.get("pl_bmassprov") == "Mass"]
        for r in sorted(rows, key=lambda r: r["pl_name"]):
            w.writerow([r[c] for c in COLS])
    print(f"Wrote {len(rows)} planets to {OUT}")


if __name__ == "__main__":
    main()
