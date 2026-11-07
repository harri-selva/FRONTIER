// Hash routing (works on any static host, including GitHub Pages):
//   #/                         galaxy
//   #/medicine                 planet
//   #/medicine/<land-slug>     island network
//   #/medicine/<land-slug>/c/<conceptId>    concept selected
//   #/medicine/<land-slug>/g/<gapId>        gap selected
//   #/backtest  #/gaps  #/method
import { useEffect, useState } from "react";
import type { FieldId } from "./data";

export type Route =
  | { view: "galaxy" }
  | { view: "planet"; field: FieldId }
  | { view: "land"; field: FieldId; land: string; concept?: number; gap?: string }
  | { view: "backtest"; field?: FieldId }
  | { view: "gaps" }
  | { view: "method" };

export function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (p[0] === "backtest") return { view: "backtest", field: (p[1] as FieldId) || undefined };
  if (p[0] === "gaps") return { view: "gaps" };
  if (p[0] === "method") return { view: "method" };
  if (p[0] === "medicine" || p[0] === "quant") {
    const field = p[0] as FieldId;
    if (!p[1]) return { view: "planet", field };
    const r: Route = { view: "land", field, land: p[1] };
    if (p[2] === "c" && p[3]) r.concept = Number(p[3]);
    if (p[2] === "g" && p[3]) r.gap = p[3];
    return r;
  }
  return { view: "galaxy" };
}

export function href(r: Route): string {
  switch (r.view) {
    case "galaxy": return "#/";
    case "planet": return `#/${r.field}`;
    case "land": {
      let s = `#/${r.field}/${r.land}`;
      if (r.gap) s += `/g/${r.gap}`; else if (r.concept !== undefined) s += `/c/${r.concept}`;
      return s;
    }
    case "backtest": return r.field ? `#/backtest/${r.field}` : "#/backtest";
    case "gaps": return "#/gaps";
    case "method": return "#/method";
  }
}

export function go(r: Route, replace = false) {
  const h = href(r);
  if (replace) history.replaceState(null, "", h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setR(parse(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

/** One level up (ESC / back button). */
export function parent(r: Route): Route | null {
  switch (r.view) {
    case "galaxy": return null;
    case "planet": return { view: "galaxy" };
    case "land": return r.gap || r.concept !== undefined ? { view: "land", field: r.field, land: r.land } : { view: "planet", field: r.field };
    default: return { view: "galaxy" };
  }
}
