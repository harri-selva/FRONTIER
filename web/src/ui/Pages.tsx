// RESEARCH GAPS leaderboard (#/gaps) and HOW IT WORKS manual (#/method).
import { useState } from "react";
import type { FieldId, LandInfo } from "../data";
import { api, fmt, useData } from "../data";
import { go } from "../router";
import { sfx } from "../sound";

export function GapsBoard() {
  const board = useData(() => api.leaderboard(), []);
  const lm = useData(() => api.lands("medicine"), []);
  const lq = useData(() => api.lands("quant"), []);
  const [f, setF] = useState<FieldId>("medicine");
  const lands: LandInfo[] | undefined = f === "medicine" ? lm : lq;
  const rows = board?.[f] ?? [];
  return (
    <div className="page">
      <header className="page-head">
        <div className="kicker">HIGH SCORES · OPEN FRONTIERS</div>
        <h1>TOP RESEARCH GAPS</h1>
        <p className="lead">Pairs of concepts that have <b>never</b> appeared in the same paper (to 29 Oct 2026) but share many specialised
          neighbours, ranked by Resource Allocation. Featured rule: both concepts are specific (not hub words), each concept at most 3 times.
          Click a row to fly to it.</p>
        <div className="seg" role="tablist">
          {(["medicine", "quant"] as FieldId[]).map((x) => (
            <button key={x} role="tab" aria-selected={f === x} className={`seg-btn ${f === x ? "on" : ""}`} onClick={() => setF(x)}>{x.toUpperCase()}</button>
          ))}
        </div>
      </header>
      <section className="panel">
        {!board || !lands ? <div className="loading">LOADING HIGH SCORES...</div> : (
          <div className="tbl-wrap"><table className="tbl arcade">
            <thead><tr><th>#</th><th>GAP</th><th>ISLAND(S)</th><th className="r">RA</th><th className="r">SHARED</th><th className="r">FIELD RANK</th></tr></thead>
            <tbody>
              {rows.map((g, i) => {
                const land = lands.find((l) => l.id === g.u_land)!;
                const open = () => { sfx.select(); go({ view: "land", field: f, land: land.slug, gap: g.id }); };
                return (
                  <tr key={g.id} tabIndex={0} className="clickable" onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                    <td className="rank">{String(i + 1).padStart(2, "0")}</td>
                    <td><b>{g.u_name}</b> <span className="plus">+</span> <b>{g.v_name}</b></td>
                    <td className="muted">{g.cross_land ? <>{g.u_land_name} <span className="badge cross">⇄</span> {g.v_land_name}</> : g.u_land_name}</td>
                    <td className="r">{g.ra.toFixed(3)}</td><td className="r">{g.cn}</td><td className="r">{fmt(g.rank)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

/** Small pixel diagram: u and v share neighbours w1..w3 (original SVG art). */
function RADiagram() {
  const P = (x: number, y: number, c: string, s = 3) => <rect x={x - s / 2} y={y - s / 2} width={s} height={s} fill={c} />;
  const L = (x1: number, y1: number, x2: number, y2: number, dash = false, c = "#8a94b8") =>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="1" strokeDasharray={dash ? "2 2" : undefined} />;
  return (
    <svg viewBox="0 0 120 60" className="diagram" shapeRendering="crispEdges" role="img"
      aria-label="Diagram: concepts u and v are not linked, but both link to w1, w2 and w3">
      {L(15, 30, 60, 10)}{L(15, 30, 60, 30)}{L(15, 30, 60, 50)}{L(105, 30, 60, 10)}{L(105, 30, 60, 30)}{L(105, 30, 60, 50)}
      {L(60, 10, 85, 4)}{L(60, 10, 35, 4)}{L(60, 10, 95, 12)}
      {L(15, 30, 105, 30, true, "#f06aa8")}
      {P(15, 30, "#39d0e8", 6)}{P(105, 30, "#39d0e8", 6)}{P(60, 10, "#ffc94a", 4)}{P(60, 30, "#ffc94a", 4)}{P(60, 50, "#ffc94a", 4)}
      {P(85, 4, "#4a5378")}{P(35, 4, "#4a5378")}{P(95, 12, "#4a5378")}
      <text x="8" y="43" fill="#fff4c2" fontSize="6">u</text><text x="103" y="43" fill="#fff4c2" fontSize="6">v</text>
      <text x="64" y="12" fill="#ffc94a" fontSize="5">w1 (deg 5)</text><text x="64" y="32" fill="#ffc94a" fontSize="5">w2 (deg 2)</text>
      <text x="64" y="52" fill="#ffc94a" fontSize="5">w3 (deg 2)</text>
    </svg>
  );
}

export function Method() {
  return (
    <div className="page manual">
      <header className="page-head">
        <div className="kicker">INSTRUCTION MANUAL</div>
        <h1>HOW FRONTIER WORKS</h1>
        <p className="lead">FRONTIER predicts which research concepts will be studied together for the first time, and proves it with a backtest.</p>
      </header>
      <section className="panel">
        <h2 className="h2">1 · THE DATA</h2>
        <p>35,813 real arXiv papers: <b>Medicine</b> (9,353 papers listed under medical physics) and <b>Quant</b> (26,460 papers in quantitative
          finance and economics), 1997 to 29 October 2026. Each paper's original submission date is used. Concepts are research phrases found in titles
          and abstracts (for example "proton therapy", "limit order book"). Hub words that appear in more than 10% of a field's papers and reviewed
          filler phrases are removed. Titles, authors, DOIs and arXiv categories come from Person A's arXiv metadata file.</p>
        <p><b>Islands</b>: Quant uses arXiv's own sub-categories. Medicine has a single arXiv category, so its 12 islands are found by grouping
          concepts that are often studied together (community detection), then named by hand from each group's most distinctive concepts.</p>
      </section>
      <section className="panel">
        <h2 className="h2">2 · THE MAP</h2>
        <p>Two concepts are <b>linked</b> once at least one paper mentions both. A <b>gap</b> is a pair that has never been linked, inside one
          field only. FRONTIER never pairs a medicine concept with a finance concept.</p>
      </section>
      <section className="panel">
        <h2 className="h2">3 · RESOURCE ALLOCATION (THE GAP SCORE)</h2>
        <div className="manual-row">
          <RADiagram />
          <div>
            <div className="formula">RA(u,v) = Σ<sub>w shared</sub> 1 / degree(w)</div>
            <p>Look at the concepts that both u and v have already been studied with (their <b>shared neighbours</b>). Each one adds
              1 ÷ (how many concepts it is linked to). A specialised shared neighbour (low degree) adds a lot; a hub that touches everything adds little.
              Here: 1/5 + 1/2 + 1/2 = <b>1.2</b>.</p>
            <p className="muted small">The panel also shows common neighbours, Jaccard, Adamic-Adar (1/ln degree) and preferential attachment
              (degree × degree, i.e. "popular concepts meet").</p>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2 className="h2">4 · THE BACKTEST</h2>
        <p>Freeze the data at the end of 2018. Score every never-linked pair. Then look at what really happened from 2019 to October 2026.
          A good score puts the pairs that later met at the top. We compare against random guessing, popularity alone, common neighbours alone and a
          LightGBM model trained on an earlier period. We also repeat it for cutoffs 2014, 2016, 2018 and 2020 with a 4-year window.</p>
        <button className="btn" onClick={() => go({ view: "backtest" })}>SEE THE RESULTS ▶</button>
      </section>
      <section className="panel">
        <h2 className="h2">5 · LEAKAGE SAFEGUARDS</h2>
        <ul className="ticks">
          <li>Only papers dated on or before the cutoff are used for features. A test plants a paper one day after the cutoff and checks nothing changes.</li>
          <li>A concept only counts if it already had 10+ papers by the cutoff, so concepts that became famous later cannot sneak in.</li>
          <li>The future (when and where a gap was filled) is used only for scoring, never as an input (asserted in code).</li>
          <li>All settings were committed before the first test run; every run is logged in runs.csv.</li>
        </ul>
      </section>
      <section className="panel">
        <h2 className="h2">6 · LIMITATIONS</h2>
        <ul className="ticks warn">
          <li>"Filled" means the two concepts appeared in the same abstract. That can be a passing mention, so we also report a stricter 2-paper test.</li>
          <li>Concepts come from automatic phrase tagging, so some noise remains (generic words, synonyms not merged).</li>
          <li>The concept list was chosen using data up to 2026. The 10-papers-by-cutoff rule removes most of that effect, not all of it.</li>
          <li>Popularity explains much of the headline accuracy. Among specific concepts Resource Allocation beats it on AUC in both fields and clearly on the top 100 in Medicine; in Quant the top-100 margin is small (49 vs 42).</li>
          <li>Suggested titles, abstracts and missions are generated text, not existing papers.</li>
        </ul>
      </section>
    </div>
  );
}
