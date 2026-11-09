import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { atmosphereNote, PLANETS_BY_DIFFICULTY } from '../data/planets';
import { requiredDeltaV, requiredDriveRangeLy, type Planet } from '../engine';
import { Diorama, Layer } from '../paper/Diorama';
import { feelsLike, gravityWords, LEVEL } from '../paper/kid';
import { StarWall } from '../paper/scenery';
import { sfx } from '../paper/sfx';
import { Icon, PlanetSprite } from '../paper/sprites';
import { PipSays, RealStamp } from '../paper/ui';
import { useGame } from '../store/gameStore';

const fmt = (n: number, dp = 1) => n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });

function Fact({ icon, big, small, badge }: { icon: Parameters<typeof Icon>[0]['name']; big: string; small: string; badge?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-[#f6ead8] p-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-butter shadow-[0_0_0_3px_#fff8ef,0_4px_0_3px_rgba(42,23,71,.2)]">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-extrabold leading-tight">{big}</p>
        <p className="text-sm text-ink/80">{small}</p>
        {badge && <div className="mt-1">{badge}</div>}
      </div>
    </div>
  );
}

function MoreFacts({ p }: { p: Planet }) {
  const atm = atmosphereNote(p.name);
  const massNote =
    p.massProvenance === 'measured' ? 'measured' : p.massProvenance === 'minimum' ? 'minimum mass (could be more)' : 'estimated from its size';
  const rows: [string, string][] = [
    ['Star', `${p.host}${p.spectralType ? ` (type ${p.spectralType})` : ''}`],
    ['Distance', `${fmt(p.distanceLy, 2)} light-years (${fmt(p.distancePc, 2)} parsecs)`],
    ['Size', `${fmt(p.radiusRe, 2)} × Earth’s width`],
    ['Mass', `${fmt(p.massMe, 2)} × Earth (${massNote})`],
    ['Temperature', `${Math.round(p.eqTempK)} K (equilibrium temperature)`],
    ['Year length', p.orbitalPeriodDays !== null ? `${fmt(p.orbitalPeriodDays, 2)} Earth days` : 'not listed'],
    ['Discovered', `${p.discoveryYear ?? '?'} by ${p.discoveryMethod?.toLowerCase() ?? 'unknown method'}`],
    ['Air', atm ? `${atm.note} (${atm.source})` : 'Not measured yet'],
  ];
  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-[#e3d3bd] p-3">
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold">{k}</dt>
            <dd className="m-0 min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink/75">
        Gravity and orbital speed are worked out from the real mass and size. “Rocky” vs “gas or ice” (from size) is a game
        simplification.{' '}
        <a href={p.archiveUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
          See it in the NASA Exoplanet Archive
        </a>
      </p>
    </div>
  );
}

export function PlanetScreen() {
  const difficulty = useGame((s) => s.difficulty);
  const planetName = useGame((s) => s.planetName);
  const choosePlanet = useGame((s) => s.choosePlanet);
  const go = useGame((s) => s.go);
  const attempts = useGame((s) => (s.difficulty ? s.runs[s.difficulty].attempts : []));
  const planets = difficulty ? PLANETS_BY_DIFFICULTY[difficulty] : [];
  const startIdx = Math.max(0, planets.findIndex((p) => p.name === planetName));
  const [idx, setIdx] = useState(startIdx);
  const [more, setMore] = useState(false);
  const touchX = useRef<number | null>(null);
  useEffect(() => setMore(false), [idx]);

  if (!difficulty) {
    return (
      <div className="p-10 text-center">
        <button type="button" className="pbtn" onClick={() => go('difficulty')}>
          Pick a rank first
        </button>
      </div>
    );
  }
  const p = planets[idx] ?? planets[0]!;
  const n = planets.length;
  const goTo = (i: number) => {
    sfx.whoosh();
    setIdx(((i % n) + n) % n);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') goTo(idx + 1);
    else if (e.key === 'ArrowLeft') goTo(idx - 1);
    else return;
    e.preventDefault();
  };
  const onTouchStart = (e: TouchEvent) => (touchX.current = e.touches[0]?.clientX ?? null);
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current;
    const end = e.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    if (Math.abs(end - start) > 40) goTo(idx + (end < start ? 1 : -1));
    touchX.current = null;
  };
  const temp = feelsLike(p.eqTempK);
  const req = requiredDeltaV(p);
  const tries = attempts.filter((a) => a.planet === p.name);
  const best = tries.length ? Math.max(...tries.map((a) => a.score)) : null;

  return (
    <div className="gutter mx-auto max-w-6xl pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-4xl font-black text-paper drop-shadow-[0_3px_0_rgba(0,0,0,.35)]">Pick a planet</h1>
        <p className="font-semibold text-[#e6dcff]">
          {LEVEL[difficulty].name} planets · {idx + 1} of {n}
        </p>
      </div>

      <section
        className="relative mt-3"
        aria-roledescription="carousel"
        aria-label="Planets"
        onKeyDown={onKey}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Diorama className="h-[min(42vh,360px)] min-h-[250px] rounded-[28px]" camera={{ rx: 2 }}>
          <StarWall z={-700} />
          {planets.map((pl, i) => {
            let off = i - idx;
            if (off > n / 2) off -= n;
            if (off < -n / 2) off += n;
            const visible = Math.abs(off) <= 2;
            return (
              <Layer
                key={pl.name}
                x={50 + off * 30}
                y={14}
                z={-Math.abs(off) * 220}
                w={off === 0 ? 46 : 30}
                style={{ transition: 'left .7s cubic-bezier(.2,.9,.2,1), transform .7s cubic-bezier(.2,.9,.2,1), width .7s', opacity: visible ? 1 : 0 }}
              >
                <div className="anim-sway" style={{ animationDelay: `${i * -0.7}s` }}>
                  <div className="mx-auto h-[40cqh] w-[2px] bg-[#e6dcff]/80" style={{ marginTop: '-40cqh' }} aria-hidden="true" />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => off !== 0 && goTo(i)}
                    className="block w-full cursor-pointer"
                  >
                    <PlanetSprite planet={pl} />
                  </button>
                </div>
              </Layer>
            );
          })}
        </Diorama>
        <button type="button" className="pbtn pbtn-paper pbtn-icon absolute left-3 top-1/2 -translate-y-1/2" onClick={() => goTo(idx - 1)} aria-label="Previous planet">
          <Icon name="back" />
        </button>
        <button type="button" className="pbtn pbtn-paper pbtn-icon absolute right-3 top-1/2 -translate-y-1/2" onClick={() => goTo(idx + 1)} aria-label="Next planet">
          <span className="inline-block rotate-180">
            <Icon name="back" />
          </span>
        </button>
      </section>

      <article key={p.name} className="paper tape anim-rise relative mx-auto -mt-4 max-w-4xl px-5 pb-5 pt-7" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-4xl font-black">{p.name}</h2>
          <RealStamp />
          {best !== null && <span className="sticker">Best score {best}</span>}
        </div>
        <p className="mt-1 text-lg">
          A {p.planetClass === 'rocky' ? 'rocky world' : 'giant gas or ice world'} circling the star {p.host}.{' '}
          <strong>Mission: {p.missionType === 'landing' ? 'land on it and come home.' : 'fly around it and come home.'}</strong>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Fact icon="ruler" big={`${fmt(p.distanceLy)} light-years`} small="away from Earth" />
          <Fact icon="thermo" big={`${temp.c.toLocaleString('en-US')} °C`} small={`${temp.word} (${Math.round(p.eqTempK)} K)`} />
          <Fact icon="gravity" big={`${fmt(p.gravityG)}× gravity`} small={gravityWords(p.gravityG)} />
        </div>
        <button type="button" className="mt-3 text-sm font-bold underline decoration-2 underline-offset-4" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Fewer facts' : 'More facts'}
        </button>
        {more && <MoreFacts p={p} />}
        <div className="mt-4 grid items-end gap-4 md:grid-cols-[1fr_auto]">
          <PipSays mood="think" size={70}>
            You’ll need a warp drive that reaches <strong>{fmt(requiredDriveRangeLy(p))} light-years</strong> (there and back) and{' '}
            <strong>{fmt(req.totalRequired)} km/s</strong> of fuel power.
          </PipSays>
          <button
            type="button"
            className="pbtn pbtn-lg mb-6"
            onClick={() => {
              sfx.go();
              choosePlanet(p.name);
              go('builder');
            }}
          >
            Fly here!
          </button>
        </div>
      </article>
    </div>
  );
}
