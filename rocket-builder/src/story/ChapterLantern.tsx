import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { findPlanet } from '../data/planets';
import { G0, MIN_TWR, evaluateMission, stagedDeltaV, type CheckId, type MissionResult } from '../engine';
import { kidFailure } from '../paper/kid';
import { FuelSticker } from '../paper/PartCard';
import { RocketSprite } from '../paper/RocketSprite';
import { ArriveScene, PadScene, SpaceScene, SplashScene, type SceneProps } from '../paper/scenes';
import { sfx } from '../paper/sfx';
import { Confetti } from '../paper/ui';
import { resolveBuild } from '../store/resolve';
import type { ChapterProps } from './chapters';
import { Chalkboard, Dialogue, RealNote, fmt } from './Shell';
import { recordLaunch, useStory } from './storyState';

const TARGET = 'TRAPPIST-1 e';
const ENGINES = [
  { id: 'engine-hydrolox', tank: 'tank-hydrolox', label: 'Hydrolox Cluster H-3 (real)' },
  { id: 'engine-gascore', tank: 'tank-lh2', label: 'Gas-Core Nuclear (pretend)' },
  { id: 'engine-fusion', tank: 'tank-lh2', label: 'Fusion Torch (pretend)' },
];

const buildFor = (engine: string, tank: string, n: number) =>
  resolveBuild({ payload: 'payload-probe', engine, drive: 'drive-warp', tanks: Array<string>(n).fill(tank), comms: 'comms-quantum', pressure: null, protection: null });

/* ---------------- the one launch, played as dioramas ---------------- */

type Scene = 'liftoff' | 'explode' | 'space' | 'arrive' | 'home' | 'splash' | 'done';
const DUR: Record<Exclude<Scene, 'done'>, number> = { liftoff: 5200, explode: 3600, space: 4800, arrive: 5000, home: 4600, splash: 5600 };
const CAUSE: Partial<Record<CheckId, SceneProps['cause']>> = { dvOrbit: 'fuel', dvPlanet: 'fuel', dvReturn: 'fuel', driveRange: 'fuel', comms: 'signal', heatPlanet: 'heat', heatReentry: 'heat', radiation: 'radiation' };

function scenesFor(r: MissionResult): Scene[] {
  switch (r.failedPhase) {
    case 'launch':
      return ['explode', 'done'];
    case 'transit':
      return ['liftoff', 'space', 'done'];
    case 'planet':
      return ['liftoff', 'space', 'arrive', 'done'];
    case 'return':
      return ['liftoff', 'space', 'arrive', 'home', 'done'];
    default:
      return ['liftoff', 'space', 'arrive', 'home', 'splash', 'done'];
  }
}

function LaunchFilm({ result, rocket, onClose }: { result: MissionResult; rocket: ReturnType<typeof buildFor>; onClose: () => void }) {
  const { reduced } = useReducedMotion();
  const planet = findPlanet(TARGET)!;
  const scenes = useMemo(() => scenesFor(result), [result]);
  const [i, setI] = useState(0);
  const scene = scenes[i] ?? 'done';
  const last = scenes[scenes.length - 2] ?? 'liftoff';
  const shown: Exclude<Scene, 'done'> = scene === 'done' ? (last as Exclude<Scene, 'done'>) : scene;
  useEffect(() => {
    if (scene === 'done') {
      (result.success ? sfx.win : sfx.sad)();
      return;
    }
    if (scene === 'liftoff') sfx.rumble();
    if (scene === 'explode') window.setTimeout(() => sfx.boom(), reduced ? 0 : 1100);
    const next = i + 1;
    const id = window.setTimeout(() => setI(next), reduced ? 1800 : DUR[scene]);
    return () => window.clearTimeout(id);
  }, [scene, i, reduced, result.success]);
  const failing = !result.success && (scene === last || scene === 'done');
  const props: SceneProps = { rocket, crew: 0, planet, reduced, failing, cause: result.failure ? CAUSE[result.failure.id] ?? 'boom' : undefined };
  const said = result.failure ? kidFailure(result.failure, planet) : null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-night" role="dialog" aria-modal="true" aria-label="Operation Lantern launch">
      <div className="relative flex-1 overflow-hidden">
        {shown === 'liftoff' || shown === 'explode' ? (
          <PadScene {...props} phase={shown} />
        ) : shown === 'space' ? (
          <SpaceScene {...props} />
        ) : shown === 'arrive' ? (
          <ArriveScene {...props} />
        ) : shown === 'home' ? (
          <SpaceScene {...props} toEarth />
        ) : (
          <SplashScene {...props} />
        )}
        {scene === 'done' && (
          <div className="absolute inset-0 flex items-end justify-center p-4 pb-16">
            {result.success && <Confetti />}
            <div className="paper anim-pop w-[min(560px,100%)] px-5 py-4 text-center">
              <p className="font-display text-3xl font-black">{result.success ? 'Operation Lantern: success!' : said?.oops}</p>
              <button type="button" className="pbtn mt-3" onClick={onClose} autoFocus>
                Read the mission log
              </button>
            </div>
          </div>
        )}
      </div>
      {scene !== 'done' && (
        <div className="gutter flex justify-end py-3">
          <button type="button" className="pbtn pbtn-paper" onClick={() => setI(scenes.length - 1)}>
            Skip ⏭
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- chapter ---------------- */

export function ChLantern({ onSolved }: ChapterProps) {
  const story = useStory();
  const planet = findPlanet(TARGET)!;
  const [ei, setEi] = useState(0);
  const [n, setN] = useState(1);
  const [prediction, setPrediction] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [film, setFilm] = useState<{ result: MissionResult; rocket: ReturnType<typeof buildFor> } | null>(null);
  const eng = ENGINES[ei]!;
  const rocket = buildFor(eng.id, eng.tank, n);
  const result = evaluateMission(rocket, planet, 'easy', 0);
  const e = rocket.engine!;
  const dv = stagedDeltaV(rocket, 0).totalMs / 1000;
  const twr = result.twr;
  const need = result.deltaV.totalRequired;
  const flown = story.launch;

  const launch = () => {
    if (prediction === null) return;
    const saved = recordLaunch({
      engine: e.name,
      tanks: n,
      predictedSuccess: prediction,
      success: result.success,
      failedPhase: result.failedPhase,
      oops: result.failure ? kidFailure(result.failure, planet).oops : null,
      deltaV: dv,
      needed: need,
      at: new Date().toISOString(),
    });
    if (!saved) return;
    sfx.go();
    onSolved();
    setFilm({ result, rocket });
  };

  if (flown && !film) {
    const right = flown.predictedSuccess === flown.success;
    return (
      <>
        <Dialogue
          lines={[
            { who: 'director', text: flown.success ? 'Operation Lantern is complete. The probe made it to TRAPPIST-1 e and back. Outstanding work, Agent.' : 'Operation Lantern is over. Space is hard, Agent, and real missions fail too. What matters is understanding why.' },
            { who: 'pip', mood: right ? 'wow' : 'think', text: right ? 'Your prediction was right. You did the maths before you launched, just like real engineers!' : 'Your prediction didn’t match. Look at the numbers below and see where they pointed.' },
          ]}
        />
        <section className="paper relative px-5 py-4" aria-label="Mission log">
          <span className="stamp stamp-pretend absolute right-4 top-4 text-sm">{flown.success ? 'Mission complete' : 'Mission lost'}</span>
          <h3 className="font-display text-2xl font-black">Mission log: Operation Lantern</h3>
          <ul className="mt-2 space-y-1">
            <li>Target: {TARGET}, {fmt(planet.distanceLy, 1)} light-years away</li>
            <li>Engine: {flown.engine}, {flown.tanks} fuel tank{flown.tanks > 1 ? 's' : ''}</li>
            <li>
              Δv: {fmt(flown.deltaV, 1)} km/s of {fmt(flown.needed, 1)} km/s needed
            </li>
            <li>Your prediction: {flown.predictedSuccess ? 'it will make it' : 'it won’t make it'} ({right ? 'correct' : 'not correct'})</li>
            <li>Result: {flown.success ? 'there and back safely' : flown.oops}</li>
            <li className="text-sm text-ink/70">Launched {new Date(flown.at).toLocaleString()}</li>
          </ul>
        </section>
        {flown.success && (
          <section className="rounded-3xl border-[6px] border-double border-[#f06aa8] bg-paper p-6 text-center" aria-label="Certificate">
            <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-ink/60">Certificate</p>
            <p className="mt-2 font-display text-3xl font-black">Secret Agent of Space Maths</p>
            <p className="mt-2">For calculating distances, transits, orbits, gravity and rocket Δv, and flying Operation Lantern to {TARGET}.</p>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {film && <LaunchFilm result={film.result} rocket={film.rocket} onClose={() => setFilm(null)} />}
      <Dialogue
        lines={[
          { who: 'director', text: `This is it, Agent. Operation Lantern: send a probe to ${TARGET} and bring it home. You have ONE launch. No second tries.` },
          { who: 'pip', mood: 'think', text: 'The cabin, warp drive and radio are already fitted. You pick the engine and the fuel. Use your maths from the earlier files!' },
        ]}
      />
      <Chalkboard formula={`need Δv ≥ ${fmt(need, 1)} km/s and TWR ≥ ${MIN_TWR}`}>
        <p>
          Landing on and leaving {TARGET} (orbital speed {fmt(planet.orbitalVelocityKms, 2)} km/s) plus the trip home, with a 10% safety margin.
        </p>
        <p>Each tank drops off when empty, so every tank is its own rocket-equation step: Δv = Isp × 9.81 × ln(start ÷ end), added up.</p>
      </Chalkboard>
      <section className="grid gap-4 rounded-2xl bg-[#1e2557] p-4 md:grid-cols-[1fr_auto]" aria-label="Design the rocket">
        <div>
          <p className="text-sm font-bold">Engine</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Engine">
            {ENGINES.map((x, k) => (
              <button key={x.id} type="button" aria-pressed={ei === k} className={`pbtn pbtn-sm ${ei === k ? '' : 'pbtn-paper'}`} onClick={() => { setEi(k); setPrediction(null); }}>
                {x.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-bold">Fuel tanks</p>
          <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label="Number of tanks">
            {[1, 2, 3].map((k) => (
              <button key={k} type="button" aria-pressed={n === k} className={`pbtn pbtn-sm ${n === k ? '' : 'pbtn-paper'}`} onClick={() => { setN(k); setPrediction(null); }}>
                {k}
              </button>
            ))}
            <FuelSticker fuel={e.propellant} />
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl bg-paper p-3 text-sm">
            <table className="w-full">
              <tbody>
                <tr>
                  <th className="pr-3 text-left">Engine efficiency</th>
                  <td className="tabular">Isp {e.isp} s</td>
                </tr>
                <tr>
                  <th className="pr-3 text-left">Full / empty mass</th>
                  <td className="tabular">
                    {fmt(result.wetMassKg / 1000, 1)} t / {fmt(result.dryMassKg / 1000, 1)} t
                  </td>
                </tr>
                <tr>
                  <th className="pr-3 text-left">TWR = {e.thrust.toLocaleString('en-US')} kN ÷ ({fmt(result.wetMassKg / 1000, 1)} t × 9.81)</th>
                  <td className={`tabular font-bold ${twr >= MIN_TWR ? 'text-leaf' : 'text-[#ff8f86]'}`}>{fmt(twr, 2)}</td>
                </tr>
                <tr>
                  <th className="pr-3 text-left">Δv (all stages added)</th>
                  <td className={`tabular font-bold ${dv >= need ? 'text-leaf' : 'text-[#ff8f86]'}`}>{fmt(dv, 1)} km/s</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-ink/70">
              Check one step yourself: first tank, {e.isp} × {G0} × ln(start ÷ end).
            </p>
          </div>
        </div>
        <div className="mx-auto w-28 md:w-36">
          <RocketSprite rocket={rocket} />
        </div>
      </section>

      <section className="rounded-2xl border-[3px] border-dashed border-[#f06aa8]/50 bg-[#2b1d4f] p-4" aria-label="Prediction and launch">
        <p className="font-display text-xl font-black">Your prediction</p>
        <p className="text-sm">Engineers predict before they launch. Will this rocket get there and back?</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Prediction">
          <button type="button" aria-pressed={prediction === true} className={`pbtn pbtn-sm ${prediction === true ? 'pbtn-mint' : 'pbtn-paper'}`} onClick={() => setPrediction(true)}>
            Yes, it will make it
          </button>
          <button type="button" aria-pressed={prediction === false} className={`pbtn pbtn-sm ${prediction === false ? '' : 'pbtn-paper'}`} onClick={() => setPrediction(false)}>
            No, it won’t
          </button>
        </div>
        {!confirm ? (
          <button type="button" className="pbtn pbtn-lg mt-4" disabled={prediction === null} onClick={() => setConfirm(true)}>
            Launch Operation Lantern
          </button>
        ) : (
          <div className="mt-4 rounded-xl bg-paper p-3" role="alert">
            <p className="font-bold">You only get ONE launch. Are you sure about this design?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="pbtn" onClick={launch}>
                Yes, launch!
              </button>
              <button type="button" className="pbtn pbtn-paper" onClick={() => setConfirm(false)}>
                Let me check again
              </button>
            </div>
          </div>
        )}
      </section>
      <RealNote>
        {TARGET} is a real planet: about Earth-sized, {fmt(planet.distanceLy, 1)} light-years away, in its star’s “temperate” zone. The warp drive is pretend; every other number uses the
        real formulas from your files.
      </RealNote>
    </>
  );
}
