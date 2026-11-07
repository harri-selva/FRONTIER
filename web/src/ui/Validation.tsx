// VALIDATION: the backtest, styled as a mission log / high-score screen.
import { useState } from "react";
import type { Backtest, Example, FieldId, Metric } from "../data";
import { api, fmt, pct, useData } from "../data";
import { go } from "../router";

const NAMES: Record<string, string> = {
  resource_allocation: "Resource Allocation (ours)", lightgbm: "LightGBM model", preferential_attachment: "Popularity (pref. attachment)",
  common_neighbours: "Common neighbours", random: "Random guess",
};
const ORDER = ["resource_allocation", "lightgbm", "preferential_attachment", "common_neighbours", "random"];

export default function Validation({ field }: { field?: FieldId }) {
  const [f, setF] = useState<FieldId>(field || "medicine");
  const bt = useData(() => api.backtest(f), [f]);
  return (
    <div className="page">
      <header className="page-head">
        <div className="kicker">MISSION LOG · BACKTEST</div>
        <h1>DID FRONTIER SEE THE FUTURE?</h1>
        <p className="lead">We froze the data at the end of 2018 and asked FRONTIER which pairs of concepts that had <b>never</b> appeared
          together would be the best gaps. Then we checked the real papers published from 2019 to October 2026. Every
          setting was fixed and committed before the first run, and every run is logged.</p>
        <div className="seg" role="tablist">
          {(["medicine", "quant"] as FieldId[]).map((x) => (
            <button key={x} role="tab" aria-selected={f === x} className={`seg-btn ${f === x ? "on" : ""}`}
              onClick={() => { setF(x); go({ view: "backtest", field: x }, true); }}>{x.toUpperCase()}</button>
          ))}
        </div>
      </header>
      {!bt ? <div className="loading">DECRYPTING MISSION LOG...</div> : <Body bt={bt} />}
    </div>
  );
}

function Body({ bt }: { bt: Backtest }) {
  const m = bt.main.metrics, ra = m.resource_allocation, rnd = m.random;
  const fr = bt.featured_rule;
  const examples: Example[] = fr?.examples?.length ? fr.examples : bt.examples;
  const years = Object.entries(bt.top100_filled_by_year);
  return (<>
    <section className="score-hero panel">
      <div className="hero-col">
        <div className="hero-label">PREDICTED IN 2018</div>
        <div className="hero-big">TOP 100 GAPS</div>
        <div className="muted">ranked by Resource Allocation out of {fmt(ra.n_pairs)} never-linked pairs</div>
      </div>
      <div className="hero-arrow" aria-hidden="true">▶</div>
      <div className="hero-col">
        <div className="hero-label">CONFIRMED BY OCT 2026</div>
        <div className="hero-big gold">{Math.round(ra["p@100"] * 100)} / 100</div>
        <div className="muted">were studied together in a real paper · random picks: {Math.round(rnd["p@100"] * 100)}/100 (base rate {pct(ra.base_rate)})</div>
      </div>
      {fr && (<>
        <div className="hero-sep" aria-hidden="true" />
        <div className="hero-col">
          <div className="hero-label">SPECIFIC CONCEPTS ONLY</div>
          <div className="hero-big cyan">{Math.round(fr.metrics.resource_allocation["p@100"] * 100)} / 100</div>
          <div className="muted">vs popularity {Math.round(fr.metrics.preferential_attachment["p@100"] * 100)}/100 and random {Math.round(fr.metrics.random["p@100"] * 100)}/100 (the rule the site uses for featured gaps)</div>
        </div>
      </>)}
    </section>

    <section className="panel">
      <h2 className="h2">TOP-100 GAPS FILLED, YEAR BY YEAR</h2>
      <div className="bars" role="img" aria-label="Cumulative number of the 2018 top-100 gaps filled by each year">
        {years.map(([y, n]) => (
          <div key={y} className="bar-col"><div className="bar-n">{n}</div>
            <div className="bar" style={{ height: `${n * 1.4}px` }} /><div className="bar-y">{y}</div></div>
        ))}
      </div>
      <p className="muted small">Cumulative count of the 100 highest-RA pairs at the end of 2018 that had their first joint paper by each year (2026 is partial, to 29 Oct).</p>
    </section>

    <section className="panel">
      <h2 className="h2">ALL NEVER-LINKED PAIRS · CUTOFF 2018 → OCT 2026</h2>
      <MetricTable metrics={m} />
      <p className="muted small">{fmt(ra.n_pairs)} pairs scored (every unlinked pair of concepts with ≥10 papers by 2018), {fmt(ra.n_pos)} filled ({pct(ra.base_rate, 1)}).
        LightGBM was trained only on the past: features at 2014, labels 2015-2018 ({fmt(bt.main.train.train_pos || 0)} positives), early stopping on a hold-out from that period.
        Sanity check: RA against shuffled labels gives AUC {bt.main.sanity_shuffled_auc_ra?.toFixed(3)} (≈ 0.5, as it should).</p>
    </section>

    {fr && (
      <section className="panel">
        <h2 className="h2">SPECIFIC CONCEPTS ONLY (FEATURED-GAP RULE)</h2>
        <p className="muted small">Same cutoff and window, restricted to pairs where both concepts are specific at 2018 ({fr.rule}). This rule was fixed
          before the first run. Here popularity alone does much worse, and Resource Allocation's advantage is clearest.</p>
        <MetricTable metrics={fr.metrics} />
      </section>
    )}

    <section className="panel">
      <h2 className="h2">CONFIRMED PREDICTIONS (EXAMPLES)</h2>
      <div className="hits">
        {examples.slice(0, 5).map((e) => (
          <article key={e.paper_id + e.u_name} className="hit">
            <div className="hit-top"><span className="badge live">HIT</span> RANK #{e.rank} IN {e.predicted_in}
              <span className="hit-lead">LEAD TIME {e.lead_time_years.toFixed(1)} YRS</span></div>
            <div className="hit-pair">{e.u_name} <span className="plus">+</span> {e.v_name}</div>
            <div className="muted small">First paper to study them together ({e.filled_date}):</div>
            <a className="paper-title" href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a>
            <div className="paper-meta">{shortAuthors(e.authors)} · arXiv:{e.paper_id}</div>
          </article>
        ))}
      </div>
    </section>

    <section className="panel">
      <h2 className="h2">ROBUSTNESS · FOUR CUTOFFS, FIXED 4-YEAR WINDOW</h2>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Cutoff</th><th>Window</th><th className="r">Pairs</th><th className="r">Base rate</th><th className="r">RA P@100</th>
          <th className="r">RA AUC</th><th className="r">LightGBM AUC</th><th className="r">Popularity AUC</th><th className="r">CN AUC</th><th className="r">Random AUC</th></tr></thead>
        <tbody>
          {bt.robustness.map((r) => {
            const x = r.metrics;
            return (<tr key={r.cutoff}><td>{r.cutoff}</td><td className="muted">{r.cutoff + 1}–{r.window_end.slice(0, 4)}</td>
              <td className="r">{fmt(x.random.n_pairs)}</td><td className="r">{pct(x.random.base_rate, 1)}</td>
              <td className="r hl">{x.resource_allocation["p@100"].toFixed(2)}</td><td className="r hl">{x.resource_allocation.auc.toFixed(3)}</td>
              <td className="r">{x.lightgbm?.auc.toFixed(3) ?? "–"}</td><td className="r">{x.preferential_attachment.auc.toFixed(3)}</td>
              <td className="r">{x.common_neighbours.auc.toFixed(3)}</td><td className="r">{x.random.auc.toFixed(3)}</td></tr>);
          })}
        </tbody>
      </table></div>
    </section>

    <section className="panel">
      <h2 className="h2">STRICTER TEST · GAP COUNTS AS FILLED ONLY AFTER 2 JOINT PAPERS</h2>
      <p className="muted small">Pre-registered secondary definition (fixed before the first run): a single passing mention is not enough.</p>
      <MetricTable metrics={bt.main.metrics_secondary} />
    </section>

    <section className="panel two-col">
      <div>
        <h2 className="h2">LEAKAGE SAFEGUARDS</h2>
        <ul className="ticks">
          <li>Every feature uses only papers dated on or before the cutoff (tested with a paper planted one day later).</li>
          <li>Concepts only count if they already had ≥10 papers by the cutoff (no "future-famous" concepts).</li>
          <li>Medicine islands for the backtest are re-clustered from pre-cutoff papers only.</li>
          <li>The model trains on an earlier period whose labels end at the cutoff.</li>
          <li>When and where a gap was filled is never used as a feature (asserted in code).</li>
          <li>No text embeddings anywhere in the features.</li>
        </ul>
      </div>
      <div>
        <h2 className="h2">RUN RECORD</h2>
        <table className="tbl"><tbody>
          <tr><td>Run at</td><td>{bt.run.timestamp}</td></tr>
          <tr><td>Code commit</td><td className="mono">{bt.run.git_commit}</td></tr>
          <tr><td>Config fingerprint</td><td className="mono">{bt.run.config_hash}</td></tr>
          <tr><td>Every run logged in</td><td className="mono">runs.csv</td></tr>
        </tbody></table>
        <p className="muted small">Honest caveat: a "filled" gap means the two concepts appeared in the same paper, which can be a passing mention.
          The stricter 2-paper test above guards against that.</p>
      </div>
    </section>
  </>);
}

function MetricTable({ metrics }: { metrics: Record<string, Metric> }) {
  return (
    <div className="tbl-wrap"><table className="tbl score">
      <thead><tr><th>Ranker</th><th className="r">P@20</th><th className="r">P@100 (95% CI)</th><th className="r">P@1000</th><th className="r">AUC</th><th className="r">Lift@100</th></tr></thead>
      <tbody>
        {ORDER.filter((k) => metrics[k]).map((k) => {
          const x = metrics[k];
          return (<tr key={k} className={k === "resource_allocation" ? "ours" : ""}>
            <td>{NAMES[k]}</td><td className="r">{x["p@20"].toFixed(2)}</td>
            <td className="r">{x["p@100"].toFixed(2)} <span className="muted">[{x["p@100_lo"].toFixed(2)}–{x["p@100_hi"].toFixed(2)}]</span></td>
            <td className="r">{x["p@1000"].toFixed(3)}</td><td className="r">{x.auc.toFixed(3)}</td><td className="r">{x["lift@100"].toFixed(1)}×</td>
          </tr>);
        })}
      </tbody>
    </table></div>
  );
}

const shortAuthors = (a: string) => { const p = a.split("; "); return p.slice(0, 3).join(", ") + (p.length > 3 ? " et al." : ""); };
