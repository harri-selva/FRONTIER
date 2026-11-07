// The side panel: a retro RPG dialog with five tabs.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Concept, Gap, GapText, LandData, LandInfo, Paper } from "../data";
import { fmt } from "../data";
import { reducedMotion } from "../settings";
import { sfx } from "../sound";

type Tab = "papers" | "gaps" | "why" | "proposal" | "missions";
const TABS: { id: Tab; label: string }[] = [
  { id: "papers", label: "PAPERS" }, { id: "gaps", label: "GAPS" }, { id: "why", label: "WHY IT FITS" },
  { id: "proposal", label: "PROPOSAL" }, { id: "missions", label: "MISSIONS" },
];

// 8x8 pixel icons (original), drawn as SVG rectangles so they stay crisp at any size
const ICONS: Record<Tab | "crystal", string[]> = {
  papers: ["01111100", "01000110", "01011010", "01000010", "01011010", "01000010", "01111110", "00000000"],
  gaps: ["11000011", "11000011", "00100100", "00011000", "00011000", "00100100", "11000011", "11000011"],
  why: ["00111100", "01000010", "00000010", "00001100", "00010000", "00000000", "00010000", "00000000"],
  proposal: ["00000110", "00001110", "00011100", "00111000", "01110000", "11100000", "11000000", "00000000"],
  missions: ["00011000", "00111100", "01111110", "00011000", "00011000", "00011000", "00111100", "00000000"],
  crystal: ["00011000", "00111100", "01101110", "11011111", "11111111", "01111110", "00111100", "00011000"],
};
export function PixelIcon({ name, color = "currentColor", size = 16 }: { name: keyof typeof ICONS; color?: string; size?: number }) {
  const rows = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" className="picon">
      {rows.flatMap((r, y) => [...r].map((b, x) => (b === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} /> : null)))}
    </svg>
  );
}

/** Types text in quickly; click to finish; instant with reduced motion. */
export function Typewriter({ text, speed = 90 }: { text: string; speed?: number }) {
  const [n, setN] = useState(reducedMotion() ? text.length : 0);
  useEffect(() => {
    if (reducedMotion()) { setN(text.length); return; }
    setN(0);
    const id = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(id), k) : k + Math.ceil(text.length / speed))), 16);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span onClick={() => setN(text.length)}>{text.slice(0, n)}{n < text.length && <span className="cursor">█</span>}</span>;
}

export interface PanelProps {
  land: LandData; lands: LandInfo[]; concepts: Map<number, Concept>; text?: Record<string, GapText>;
  concept: number | null; gapId: string | null;
  onGap: (id: string) => void; onConcept: (id: number) => void; onClose: () => void; onLand: (l: LandInfo) => void;
}

export default function DetailPanel(p: PanelProps) {
  const { land, concepts, text } = p;
  const [tab, setTab] = useState<Tab>("papers");
  const gapsById = useMemo(() => new Map(land.gaps.map((g) => [g.id, g])), [land]);
  const gap = p.gapId ? gapsById.get(p.gapId) : undefined;
  const conceptGaps = p.concept !== null ? (land.concept_gaps[String(p.concept)] || []).map((i) => gapsById.get(i)!).filter(Boolean) : [];
  const [pick, setPick] = useState(0);
  useEffect(() => { setPick(0); }, [p.concept]);
  useEffect(() => { setTab(gap ? "gaps" : "papers"); }, [p.gapId, p.concept]);
  const focusGap: Gap | undefined = gap || conceptGaps[pick];
  const node = p.concept !== null ? land.nodes.find((n) => n.id === p.concept) : undefined;
  const cname = p.concept !== null ? (node?.name ?? concepts.get(p.concept)?.name ?? "") : "";

  const papers: Paper[] = useMemo(() => {
    const ids = gap ? [...gap.evidence, ...(land.concept_papers[String(gap.u)] || []).slice(0, 2), ...(land.concept_papers[String(gap.v)] || []).slice(0, 2)]
      : land.concept_papers[String(p.concept)] || [];
    return [...new Set(ids)].map((i) => land.papers[i]).filter(Boolean);
  }, [gap, land, p.concept]);

  const head = gap ? `${gap.u_name} + ${gap.v_name}` : cname;
  const sub = gap
    ? (gap.cross_land ? `CROSS-ISLAND GAP · ${gap.u_land_name} ⇄ ${gap.v_land_name}` : `GAP ON ${gap.u_land_name.toUpperCase()}`)
    : `CONCEPT · ${land.name.toUpperCase()}`;

  return (
    <aside className="detail panel dialog-panel" aria-label="Details">
      <div className="dp-head">
        <div className="portrait" aria-hidden="true"><PixelIcon name="crystal" color={gap ? "#f06aa8" : "#39d0e8"} size={40} /></div>
        <div className="dp-titles">
          <div className="dp-kicker">{gap ? "NEW FRONTIER DETECTED" : "SECTOR SCANNED"}</div>
          <h2 className="dp-title"><Typewriter text={head} key={head} /></h2>
          <div className="dp-sub">{sub}</div>
        </div>
        <button className="btn sm close" onClick={p.onClose} aria-label="Close panel">✕</button>
      </div>
      {node && !gap && (
        <div className="dp-stats">
          <span><b>{fmt(node.papers)}</b> papers</span><span><b>{node.recent}</b> in last 3 yrs</span><span><b>{node.deg}</b> linked concepts</span>
        </div>
      )}
      {gap && (
        <div className="dp-stats">
          <span>RA <b>{gap.ra.toFixed(4)}</b></span><span>top <b>{Math.max(0.01, 100 - gap.pct).toFixed(2)}%</b> of {fmt(gap.n_candidates)} pairs</span>
          <span><b>{gap.cn}</b> shared neighbours</span>
        </div>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "on" : ""}`}
            onClick={() => { sfx.blip(); setTab(t.id); }}>
            <PixelIcon name={t.id} size={14} /> {t.label}
          </button>
        ))}
      </div>
      {!gap && conceptGaps.length > 0 && (tab === "why" || tab === "proposal" || tab === "missions") && (
        <div className="gap-pick">For gap:&nbsp;
          {conceptGaps.map((g, i) => (
            <button key={g.id} className={`chip ${i === pick ? "on" : ""}`} onClick={() => setPick(i)}>
              {g.u === p.concept ? g.v_name : g.u_name}</button>
          ))}
        </div>
      )}
      <div className="dp-body" role="tabpanel">
        {tab === "papers" && <PapersTab papers={papers} gap={gap} />}
        {tab === "gaps" && (gap ? <GapMaths gap={gap} concepts={concepts} lands={p.lands} />
          : <ConceptGaps gaps={conceptGaps} concept={p.concept!} onGap={p.onGap} />)}
        {tab === "why" && <TextBlock gap={focusGap} text={text} render={(t) => (<>
          <p className="why"><Typewriter text={t.why} speed={120} /></p>
          {focusGap && <p className="muted small">Shared neighbours named here: {focusGap.notable.join(", ")}.</p>}
        </>)} />}
        {tab === "proposal" && <TextBlock gap={focusGap} text={text} render={(t) => <Proposal t={t} />} />}
        {tab === "missions" && <TextBlock gap={focusGap} text={text} render={(t) => <Missions t={t} />} />}
      </div>
      {gap && gap.cross_land && (
        <div className="dp-foot">
          {[gap.u_land, gap.v_land].filter((l) => l !== land.land).map((l) => {
            const L = p.lands.find((x) => x.id === l);
            return L ? <button key={l} className="btn sm" onClick={() => p.onLand(L)}>FLY TO {L.name.toUpperCase()} ⇢</button> : null;
          })}
        </div>
      )}
    </aside>
  );
}

function PapersTab({ papers, gap }: { papers: Paper[]; gap?: Gap }) {
  if (!papers.length) return <p className="muted">No papers with metadata for this item.</p>;
  return (<>
    <p className="muted small">{gap ? "Real papers on each side of the gap (none of them studies both concepts together)." : "Most recent papers that mention this concept."}
      {" "}Key concepts are the phrases FRONTIER tagged in each paper; open the arXiv link for the abstract.</p>
    {papers.map((pp) => (
      <article key={pp.id} className="paper">
        <a className="paper-title" href={pp.url} target="_blank" rel="noopener noreferrer">{pp.title}</a>
        <div className="paper-meta">{pp.authors || "Unknown authors"} · {pp.date} · arXiv:{pp.id}{pp.journal ? ` · ${pp.journal}` : ""}</div>
        {pp.summary_source === "template"
          ? <div className="kc"><span className="kc-label">KEY CONCEPTS</span>{pp.concepts.slice(0, 6).map((c) => <span key={c} className="k">{c}</span>)}</div>
          : <p className="paper-sum">{pp.summary}</p>}
        <div className="paper-links">
          <a href={pp.url} target="_blank" rel="noopener noreferrer">arXiv ↗</a>
          {pp.doi && <a href={`https://doi.org/${pp.doi}`} target="_blank" rel="noopener noreferrer">DOI ↗</a>}
        </div>
      </article>
    ))}
  </>);
}

function ConceptGaps({ gaps, concept, onGap }: { gaps: Gap[]; concept: number; onGap: (id: string) => void }) {
  if (!gaps.length) return <p className="muted">No open gaps for this concept.</p>;
  return (<>
    <p className="muted small">Top predicted gaps for this concept, ranked by Resource Allocation (RA). Open one to see the maths.</p>
    {gaps.map((g, i) => (
      <button key={g.id} className="gap-card" onClick={() => { sfx.select(); onGap(g.id); }}>
        <div className="gc-rank">#{i + 1}</div>
        <div className="gc-main">
          <div className="gc-pair">⇢ {g.u === concept ? g.v_name : g.u_name}{g.cross_land && <span className="badge cross">OTHER ISLAND</span>}</div>
          <div className="gc-nums">RA {g.ra.toFixed(4)} · {g.cn} shared neighbours · top {Math.max(0.01, 100 - g.pct).toFixed(2)}% in field</div>
        </div>
      </button>
    ))}
  </>);
}

function GapMaths({ gap, concepts, lands }: { gap: Gap; concepts: Map<number, Concept>; lands: LandInfo[] }) {
  const landName = (id: number) => lands.find((l) => l.id === id)?.name ?? "";
  const shownRA = gap.shared.reduce((s, [, d]) => s + 1 / d, 0);
  const shownAA = gap.shared.reduce((s, [, d]) => s + 1 / Math.log(Math.max(d, 2)), 0);
  const union = gap.u_deg + gap.v_deg - gap.cn;
  return (<>
    <div className="formula">RA(u,v) = Σ<sub>w ∈ shared neighbours</sub> 1 / degree(w)</div>
    <p className="muted small">A shared neighbour is a concept that has appeared in papers with <b>both</b> {gap.u_name} and {gap.v_name}.
      Specialised neighbours (low degree) count most. Largest contributions first.</p>
    <table className="tbl">
      <thead><tr><th>Shared neighbour w</th><th className="r">degree(w)</th><th className="r">1/degree(w)</th></tr></thead>
      <tbody>
        {gap.shared.map(([w, d]) => (
          <tr key={w}><td>{concepts.get(w)?.name ?? `#${w}`}<span className="nb-land">{landName(concepts.get(w)?.land ?? -1)}</span></td>
            <td className="r">{d}</td><td className="r">{(1 / d).toFixed(4)}</td></tr>
        ))}
        {gap.shared_total > gap.shared.length && (
          <tr className="muted"><td colSpan={2}>+ {gap.shared_total - gap.shared.length} more shared neighbours</td><td className="r">{gap.shared_rest_ra.toFixed(4)}</td></tr>
        )}
      </tbody>
      <tfoot><tr><td colSpan={2}><b>RA total</b></td><td className="r"><b>{(shownRA + gap.shared_rest_ra).toFixed(4)}</b></td></tr></tfoot>
    </table>
    <h3 className="h3">OTHER SCORES</h3>
    <table className="tbl">
      <tbody>
        <tr><td>Common neighbours (CN)</td><td className="mono">count of shared neighbours</td><td className="r"><b>{gap.cn}</b></td></tr>
        <tr><td>Jaccard</td><td className="mono">{gap.cn} / ({gap.u_deg} + {gap.v_deg} − {gap.cn}) = {gap.cn}/{union}</td><td className="r"><b>{gap.jaccard.toFixed(4)}</b></td></tr>
        <tr><td>Adamic-Adar</td><td className="mono">Σ 1/ln(degree(w)) = {shownAA.toFixed(3)} + {gap.shared_rest_aa.toFixed(3)}</td><td className="r"><b>{gap.aa.toFixed(4)}</b></td></tr>
        <tr><td>Preferential attachment</td><td className="mono">degree(u) × degree(v) = {gap.u_deg} × {gap.v_deg}</td><td className="r"><b>{fmt(gap.pa)}</b></td></tr>
        <tr><td>Percentile in field</td><td className="mono">rank {fmt(gap.rank)} of {fmt(gap.n_candidates)} unlinked pairs</td><td className="r"><b>{gap.pct.toFixed(3)}</b></td></tr>
      </tbody>
    </table>
    <p className="muted small">Degrees are counted on the graph of all papers up to 29 Oct 2026. Both concepts belong to the same field; FRONTIER never scores cross-field pairs.</p>
  </>);
}

function TextBlock({ gap, text, render }: { gap?: Gap; text?: Record<string, GapText>; render: (t: GapText) => ReactNode }) {
  if (!gap) return <p className="muted">Select a gap first.</p>;
  if (!text) return <p className="muted">RECEIVING TRANSMISSION...</p>;
  const t = text[gap.id];
  if (!t) return <p className="muted">No text for this gap.</p>;
  return (<>
    <div className="pair-line">{gap.u_name} <span className="plus">+</span> {gap.v_name}</div>
    {render(t)}
    <p className="source-note">{t.source === "template" ? "Text assembled from FRONTIER's numbers and real paper titles using templates (no AI writing in this build)."
      : "Text written by Claude at build time from the numbers and real abstracts shown here."}</p>
  </>);
}

function Proposal({ t }: { t: GapText }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="proposal">
      <div className="warn-banner">SUGGESTED - GENERATED, NOT AN EXISTING PAPER</div>
      <h3 className="prop-title">{t.title}</h3>
      <p>{t.abstract}</p>
      <button className="btn sm" onClick={() => {
        navigator.clipboard?.writeText(`${t.title}\n\n${t.abstract}\n\n(Suggested - generated, not an existing paper)`).then(() => setCopied(true));
        setTimeout(() => setCopied(false), 1500);
      }}>{copied ? "COPIED ✓" : "COPY"}</button>
    </div>
  );
}

function Missions({ t }: { t: GapText }) {
  const cards = [
    { k: "PhD", who: "PHD STUDENT", time: "3-4 years", body: t.phd, cls: "q-phd" },
    { k: "MSc", who: "MASTERS STUDENT", time: "6-12 months", body: t.masters, cls: "q-msc" },
    { k: "IND", who: "INDUSTRY RESEARCH (ILLUSTRATIVE: MARSHALL WACE)", time: "pilot study", body: t.industry, cls: "q-ind" },
  ];
  return (<div className="quests">
    {cards.map((c) => (
      <div key={c.k} className={`quest ${c.cls}`}>
        <div className="quest-head"><span className="quest-badge">{c.k}</span>{c.who}<span className="quest-time">{c.time}</span></div>
        <p>{c.body}</p>
      </div>
    ))}
    <p className="muted small">The industry mission is an illustrative example only. It makes no claim about Marshall Wace's actual research or interests.</p>
  </div>);
}
