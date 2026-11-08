// HUD: breadcrumbs + back, and a persistent VALIDATION button on every level.
import { useEffect, useMemo, useState } from "react";
import type { Route } from "../router";
import { go, parent } from "../router";
import { settings, useSettings, reducedMotion } from "../settings";
import { sfx } from "../sound";
import { Stage, type Scene } from "../engine/Stage";
import { C } from "../engine/palette";
import { Frame } from "../engine/pixel";
import { rng } from "../engine/noise";

export interface Crumb { label: string; route: Route }

export function Hud({ route, crumbs }: { route: Route; crumbs: Crumb[] }) {
  const s = useSettings();
  const up = parent(route);
  return (
    <header className="hud">
      <div className="hud-left">
        {up && (<button className="btn sm back" onClick={() => { sfx.back(); go(up); }} aria-label="Back one level (Esc)">◀ BACK</button>)}
        <a className="logo" href="#/" onClick={() => sfx.blip()}>FRONTIER</a>
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="crumb">
              <span className="sep" aria-hidden="true">›</span>
              {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span>
                : <a href="#" onClick={(e) => { e.preventDefault(); sfx.blip(); go(c.route); }}>{c.label}</a>}
            </span>
          ))}
        </nav>
      </div>
      <div className="hud-right">
        <button className={`btn sm hud-proof ${route.view === "backtest" ? "on" : ""}`} onClick={() => { sfx.select(); go({ view: "backtest" }); }}>▶ VALIDATION</button>
        <button className={`btn sm ${route.view === "gaps" ? "on" : ""}`} onClick={() => { sfx.select(); go({ view: "gaps" }); }}>TOP GAPS</button>
        <button className={`btn sm ${route.view === "method" ? "on" : ""}`} onClick={() => { sfx.select(); go({ view: "method" }); }}>HOW IT WORKS</button>
        <button className={`btn sm icon ${s.crt ? "on" : ""}`} aria-pressed={s.crt} onClick={() => settings.set({ crt: !s.crt })} title="CRT effect">CRT</button>
        <button className={`btn sm icon ${s.sound ? "on" : ""}`} aria-pressed={s.sound}
          onClick={() => { settings.set({ sound: !s.sound }); setTimeout(() => sfx.select(), 0); }} title="Sound effects" aria-label="Sound effects">
          {s.sound ? "♪ ON" : "♪ OFF"}
        </button>
      </div>
    </header>
  );
}

const BOOT = [
  "FRONTIER OBSERVATORY v1.0",
  "LOADING ARXIV ARCHIVE ........ 35,813 PAPERS",
  "TAGGING CONCEPTS ............. 5,423 LIVE",
  "CALIBRATING TELESCOPE ........ OK",
  "REPLAYING 2018 → 2026 ........ BACKTEST OK",
  "2 WORLDS CHARTED · 12 SECTORS UNDER CONSTRUCTION",
];

export function Boot({ onDone }: { onDone: () => void }) {
  const rm = reducedMotion();
  const [n, setN] = useState(rm ? 999 : 0);
  useEffect(() => {
    if (rm) return;
    const id = setInterval(() => setN((k) => k + 1), 28);
    return () => clearInterval(id);
  }, [rm]);
  useEffect(() => {
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [onDone]);
  let left = n;
  return (
    <div className="boot" onClick={onDone} role="dialog" aria-label="Start screen">
      <div className="boot-inner">
        {BOOT.map((line, i) => {
          const show = Math.max(0, Math.min(line.length, left));
          left -= line.length + 6;
          return show > 0 ? <div key={i} className="boot-line">{line.slice(0, show)}</div> : null;
        })}
        {left > 0 && <div className="boot-press blink-text">PRESS ANY KEY TO START</div>}
        <button className="btn boot-skip" onClick={onDone}>SKIP ▶</button>
      </div>
    </div>
  );
}

/** Calm twinkling starfield behind text pages. */
class StarsScene implements Scene {
  stars: { x: number; y: number; p: number; b: boolean }[] = []; w = 0; h = 0;
  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const r = rng(3);
    this.stars = Array.from({ length: Math.round((w * h) / 300) }, () => ({ x: r() * w, y: r() * h, p: r() * 6, b: r() < 0.05 }));
  }
  draw(f: Frame, t: number) {
    f.clear(C.navy0);
    for (let y = 0; y < this.h; y += 2) if ((y / 2) % 2 === 0) for (let x = (y % 4) / 2; x < this.w; x += 4) if (y > this.h * 0.7) f.pset(x, y, C.navy1);
    const rm = reducedMotion();
    for (const s of this.stars) {
      const tw = rm ? 1 : Math.sin(t * 1.3 + s.p);
      f.pset(s.x, s.y, tw > 0.5 ? C.white : tw > -0.3 ? C.slate : C.navy2);
      if (s.b && tw > 0.3) { f.pset(s.x - 1, s.y, C.lavender); f.pset(s.x + 1, s.y, C.lavender); f.pset(s.x, s.y - 1, C.lavender); f.pset(s.x, s.y + 1, C.lavender); }
    }
  }
}
export function Starfield() {
  const scene = useMemo(() => new StarsScene(), []);
  return <div className="scene bgstars"><Stage scene={scene} /></div>;
}
