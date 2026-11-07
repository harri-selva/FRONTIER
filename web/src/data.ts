// Types for the static JSON written by pipeline/export_web.py, and cached loaders.
export type FieldId = "medicine" | "quant";

export interface FieldInfo {
  id: FieldId; name: string; live: boolean; papers: number; lands: number; concepts: number;
  links: number; candidates: number; top_gaps: number; first_year: number; last_date: string;
}
export interface LandInfo {
  id: number; name: string; slug: string; papers: number; x: number; y: number; r: number;
  concepts: number; top_gaps: number; cross_land_gaps: number; featured: string[];
}
export interface Concept { id: number; name: string; land: number; papers: number }
export interface Node { id: number; name: string; papers: number; recent: number; deg: number; heat: number; x: number; y: number; extra: boolean }
export interface Gap {
  id: string; field: FieldId; u: number; v: number; u_name: string; v_name: string;
  u_land: number; v_land: number; u_land_name: string; v_land_name: string;
  u_papers: number; v_papers: number; u_deg: number; v_deg: number;
  cn: number; ra: number; aa: number; jaccard: number; pa: number; pct: number; rank: number; n_candidates: number;
  cross_land: boolean; shared: [number, number][]; notable: string[]; shared_total: number;
  shared_rest_ra: number; shared_rest_aa: number; evidence: string[];
}
export interface Paper {
  id: string; title: string; authors: string; n_authors: number; date: string; url: string; doi: string;
  journal: string; cat: string; concepts: string[]; summary: string; summary_source: string;
}
export interface LandData {
  field: FieldId; land: number; name: string; land_papers: number; nodes: Node[]; links: [number, number, number][];
  gaps: Gap[]; featured: string[]; concept_gaps: Record<string, string[]>; concept_papers: Record<string, string[]>;
  papers: Record<string, Paper>;
}
export interface GapText { why: string; title: string; abstract: string; phd: string; masters: string; industry: string; source: string }
export interface Metric {
  n_pairs: number; n_pos: number; base_rate: number; auc: number; "lift@100": number;
  "p@20": number; "p@100": number; "p@1000": number; "p@100_lo": number; "p@100_hi": number;
  "p@20_lo": number; "p@20_hi": number; "p@1000_lo": number; "p@1000_hi": number; top100_max_concept_share?: number;
}
export interface Example {
  u_name: string; v_name: string; rank: number; ra: number; cn: number; predicted_in: number; filled_date: string;
  lead_time_years: number; paper_id: string; title: string; authors: string; url: string;
}
export interface BacktestRun {
  cutoff: number; window_end: string; kind: string; train: { train_pos?: number; best_iteration?: number; importance?: Record<string, number> };
  metrics: Record<string, Metric>; metrics_secondary: Record<string, Metric>; sanity_shuffled_auc_ra?: number;
}
export interface Backtest {
  field: FieldId; run: { timestamp: string; git_commit: string; config_hash: string };
  main: BacktestRun; robustness: BacktestRun[]; examples: Example[]; top100_filled_by_year: Record<string, number>;
  featured_rule?: { rule: string; metrics: Record<string, Metric>; metrics_secondary: Record<string, Metric>;
    examples: Example[]; top100_filled_by_year: Record<string, number> };
}
export interface LeaderRow { id: string; u: number; v: number; u_name: string; v_name: string; u_land: number; v_land: number;
  u_land_name: string; v_land_name: string; ra: number; cn: number; pct: number; rank: number; cross_land: boolean }

const cache = new Map<string, Promise<unknown>>();
export function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(`./data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(path) as Promise<T>;
}

export const api = {
  fields: () => load<FieldInfo[]>("fields.json"),
  lands: (f: FieldId) => load<LandInfo[]>(`${f}/lands.json`),
  concepts: (f: FieldId) => load<Concept[]>(`${f}/concepts.json`),
  land: (f: FieldId, id: number) => load<LandData>(`${f}/land_${id}.json`),
  landText: (f: FieldId, id: number) => load<Record<string, GapText>>(`${f}/land_${id}_text.json`),
  backtest: (f: FieldId) => load<Backtest>(`${f}/backtest.json`),
  leaderboard: () => load<Record<FieldId, LeaderRow[]>>("gaps_top.json"),
};

import { useEffect, useState } from "react";
/** React hook: load JSON, return undefined until ready. */
export function useData<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => {
    let alive = true;
    setV(undefined);
    fn().then((x) => alive && setV(x)).catch((e) => console.error(e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export const fmt = (n: number) => n.toLocaleString("en-GB");
export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
