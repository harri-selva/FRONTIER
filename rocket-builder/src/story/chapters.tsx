import { useState } from 'react';
import { PLANETS_BY_DIFFICULTY, findPlanet } from '../data/planets';
import { SYSTEMS } from '../data/space';
import { G0, requiredDeltaV, surfaceGravityG, surfaceOrbitalVelocityKms } from '../engine';
import { PlanetSprite } from '../paper/sprites';
import { Quiz } from './Quiz';
import { Chalkboard, Dialogue, RealNote, Slider, Widget, fmt, fmt0 } from './Shell';

export interface ChapterProps {
  solved: boolean;
  onSolved: () => void;
}

const LY_KM = 9.4607e12;
const YEAR_S = 31557600;
const SUN_IN_EARTH_RADII = 109.1;

/* ------------------------------------------------------------------ */
/* 1. Parallax                                                         */
/* ------------------------------------------------------------------ */

function ParallaxDiagram({ p }: { p: number }) {
  // Angle exaggerated for drawing; the label gives the real value.
  const shift = 14 + p * 70;
  return (
    <svg viewBox="0 0 320 170" className="w-full max-w-md" role="img" aria-label={`Parallax diagram: the star appears to shift by ${p.toFixed(2)} arcseconds`}>
      <rect width="320" height="170" rx="14" fill="#2f2160" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(i * 47) % 320} cy={(i * 29) % 60 + 8} r="1.4" fill="#fff8ef" opacity=".7" />
      ))}
      <circle cx={160 - shift} cy="34" r="5" fill="#ff7cc6" opacity=".5" />
      <circle cx={160 + shift} cy="34" r="5" fill="#ff7cc6" opacity=".5" />
      <circle cx="160" cy="60" r="7" fill="#ffe07a" />
      <text x="172" y="64" fill="#ffe07a" fontSize="11" fontWeight="700">star</text>
      <ellipse cx="160" cy="140" rx="70" ry="14" fill="none" stroke="#fff8ef" strokeDasharray="4 4" opacity=".5" />
      <circle cx="160" cy="140" r="8" fill="#ffb48f" />
      <circle cx="90" cy="140" r="6" fill="#8fd3ff" />
      <circle cx="230" cy="140" r="6" fill="#8fd3ff" />
      <path d="M90 140 L160 60 L230 140" stroke="#b8a1ff" strokeWidth="1.6" fill="none" />
      <path d={`M90 140 L${160 - shift} 34 M230 140 L${160 + shift} 34`} stroke="#ff7cc6" strokeWidth="1" strokeDasharray="3 3" />
      <text x="62" y="162" fill="#e6dcff" fontSize="10">Earth in January</text>
      <text x="200" y="162" fill="#e6dcff" fontSize="10">Earth in July</text>
    </svg>
  );
}

export function ChParallax({ solved, onSolved }: ChapterProps) {
  const [p, setP] = useState(0.768);
  const proxima = findPlanet('Proxima Cen b');
  const d = 1 / p;
  return (
    <>
      <Dialogue
        lines={[
          { who: 'director', text: 'Welcome to Operation Lantern, Agent. First question: how can anyone know how far away a star is? Nobody can stretch a tape measure there.' },
          { who: 'pip', mood: 'wow', text: 'Hold your thumb out and close one eye, then the other. Your thumb jumps! Astronomers do the same with stars, using Earth’s trip around the Sun as the two “eyes”.' },
        ]}
      />
      <Chalkboard formula="distance (parsecs) = 1 ÷ parallax (arcseconds)">
        <p>Parallax is how far a star seems to shift between January and July, measured as a tiny angle.</p>
        <p>1 arcsecond is 1/3,600 of a degree. Your thumb at arm’s length is about 2 degrees: 7,200 arcseconds!</p>
        <p>1 parsec = 3.2616 light-years.</p>
      </Chalkboard>
      <Widget title="Measure a star">
        <ParallaxDiagram p={p} />
        <Slider id="plx" label="Parallax" min={0.05} max={1} step={0.001} value={p} onChange={setP} display={`${fmt(p, 3)} arcseconds`} />
        <p className="mt-2 text-lg font-bold">
          Distance = 1 ÷ {fmt(p, 3)} = <span className="text-[#c2307f]">{fmt(d, 2)} parsecs</span> = {fmt(d * 3.2616, 1)} light-years
        </p>
      </Widget>
      <RealNote>
        Proxima Centauri, the nearest star to the Sun, has a parallax of about 0.768 arcseconds (measured by ESA’s Gaia
        spacecraft). 1 ÷ 0.768 = 1.30 parsecs. The NASA Exoplanet Archive lists {proxima ? fmt(proxima.distancePc, 3) : '1.301'} parsecs. Same answer!
      </RealNote>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'number',
          question: 'A star has a parallax of 0.5 arcseconds. How many parsecs away is it?',
          answer: 2,
          tolerance: 0.01,
          unit: 'parsecs',
          working: <>distance = 1 ÷ 0.5 = 2 parsecs (that’s 2 × 3.2616 ≈ 6.5 light-years).</>,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Light-years and trip times                                       */
/* ------------------------------------------------------------------ */

const VEHICLES = [
  { name: 'Walking', kms: 5 / 3600 },
  { name: 'Car on a motorway', kms: 110 / 3600 },
  { name: 'Voyager 1 probe', kms: 17 },
  { name: 'Light', kms: 299792.458 },
];

export function ChLightYears({ solved, onSolved }: ChapterProps) {
  const targets = [...PLANETS_BY_DIFFICULTY.easy, ...PLANETS_BY_DIFFICULTY.medium].slice(0, 10);
  const [ti, setTi] = useState(0);
  const [vi, setVi] = useState(2);
  const t = targets[ti]!;
  const v = VEHICLES[vi]!;
  const years = (t.distanceLy * LY_KM) / v.kms / YEAR_S;
  return (
    <>
      <Dialogue
        lines={[
          { who: 'pip', text: 'A light-year sounds like time, but it’s a distance: how far light travels in one year. That’s 9.46 trillion kilometres!' },
          { who: 'director', text: 'And that, Agent, is why our mission needs a pretend warp drive. Let’s see why.' },
        ]}
      />
      <Chalkboard formula="time = distance ÷ speed">
        <p>1 light-year = 9,460,700,000,000 km. 1 year = 31,557,600 seconds.</p>
        <p>Voyager 1, the fastest-escaping human-made probe, travels about 17 km every second.</p>
      </Chalkboard>
      <Widget title="How long would the trip take?">
        <div className="flex flex-wrap gap-2">
          <label className="text-sm font-bold" htmlFor="ly-target">
            Destination
          </label>
          <select id="ly-target" value={ti} onChange={(e) => setTi(Number(e.target.value))} className="rounded-lg bg-paper px-2 py-1 font-bold">
            {targets.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name} ({fmt(p.distanceLy, 1)} ly)
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Travel by">
          {VEHICLES.map((x, i) => (
            <button key={x.name} type="button" aria-pressed={vi === i} onClick={() => setVi(i)} className={`pbtn pbtn-sm ${vi === i ? '' : 'pbtn-paper'}`}>
              {x.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-lg font-bold">
          {fmt(t.distanceLy, 2)} ly × 9.46 trillion km ÷ {v.kms < 1 ? `${fmt(v.kms * 3600, 0)} km/h` : `${fmt0(v.kms)} km/s`} ≈{' '}
          <span className="text-[#c2307f]">{years < 100 ? fmt(years, 1) : fmt0(years)} years</span>
        </p>
      </Widget>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'choice',
          question: 'Voyager 1 travels 17 km every second. Roughly how many years would it take to travel just ONE light-year?',
          options: ['176 years', '1,760 years', '17,600 years', '176,000 years'],
          correct: 2,
          working: <>9,460,700,000,000 km ÷ 17 km/s = 556,500,000,000 seconds. ÷ 31,557,600 seconds per year ≈ 17,600 years.</>,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Transits                                                         */
/* ------------------------------------------------------------------ */

function LightCurve({ depth }: { depth: number }) {
  const scale = Math.min(1, depth / 0.03) * 70 + 4;
  const d = `M10 40 L120 40 L135 ${40 + scale} L205 ${40 + scale} L220 40 L330 40`;
  return (
    <svg viewBox="0 0 340 130" className="w-full max-w-md" role="img" aria-label={`Light curve dipping by ${fmt(depth * 100, 2)} percent`}>
      <rect width="340" height="130" rx="14" fill="#2f2160" />
      <path d={d} stroke="#ffe07a" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <text x="12" y="24" fill="#e6dcff" fontSize="11">star brightness</text>
      <text x="200" y="122" fill="#e6dcff" fontSize="11">time →</text>
      <text x="138" y={Math.min(118, 40 + scale + 16)} fill="#ff9fd3" fontSize="11" fontWeight="700">−{fmt(depth * 100, 2)}%</text>
    </svg>
  );
}

export function ChTransit({ solved, onSolved }: ChapterProps) {
  const sys = SYSTEMS['TRAPPIST-1'];
  const starRe = (sys?.starRadiusSun ?? 0.1192) * SUN_IN_EARTH_RADII;
  const e = findPlanet('TRAPPIST-1 e');
  const [r, setR] = useState(e?.radiusRe ?? 0.92);
  const depth = (r / starRe) ** 2;
  return (
    <>
      <Dialogue
        lines={[
          { who: 'pip', mood: 'think', text: 'Most planets are far too small and dim to see. But when one passes in front of its star, the star gets a tiny bit darker. That’s called a transit.' },
          { who: 'director', text: 'Space telescopes watch thousands of stars for these little dips. The size of the dip tells us the size of the planet.' },
        ]}
      />
      <Chalkboard formula="dip = (planet size ÷ star size)²">
        <p>The planet blocks a circle of light. Area grows with size × size, so we square the ratio.</p>
        <p>Turn it around: planet size = star size × √dip.</p>
      </Chalkboard>
      <Widget title="Make a transit">
        <LightCurve depth={depth} />
        <Slider id="tr" label="Planet size (Earth = 1)" min={0.3} max={10} step={0.01} value={r} onChange={setR} display={`${fmt(r, 2)} × Earth`} />
        <p className="mt-2 text-lg font-bold">
          ({fmt(r, 2)} ÷ {fmt(starRe, 1)})² = <span className="text-[#c2307f]">{fmt(depth * 100, 2)}% dimmer</span>
        </p>
        <p className="text-sm">Star: TRAPPIST-1, {fmt(starRe, 1)} × Earth’s size (a small red dwarf).</p>
      </Widget>
      <RealNote>
        TRAPPIST-1 e is {e ? fmt(e.radiusRe, 2) : '0.92'} × Earth’s size, so it dims its star by about{' '}
        {fmt(((e?.radiusRe ?? 0.92) / starRe) ** 2 * 100, 2)}%. Around a Sun-sized star, the same planet would dim it by only{' '}
        {fmt(((e?.radiusRe ?? 0.92) / SUN_IN_EARTH_RADII) ** 2 * 100, 3)}%. That’s why small stars are great places to find small planets.
      </RealNote>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'choice',
          question: 'A planet makes its star 1% dimmer. How big is the planet compared with its star?',
          options: ['1% as wide', '10% as wide', '50% as wide', '100% as wide'],
          correct: 1,
          working: <>dip = (ratio)², so ratio = √dip = √0.01 = 0.1, which is 10% of the star’s width.</>,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Kepler's third law                                               */
/* ------------------------------------------------------------------ */

export function ChKepler({ solved, onSolved }: ChapterProps) {
  const sys = SYSTEMS['TRAPPIST-1'];
  const e = sys?.planets.find((p) => p.name === 'TRAPPIST-1 e');
  const mStar = sys?.starMassSun ?? 0.0898;
  const [P, setP] = useState(e?.periodDays ?? 6.1);
  const [M, setM] = useState(mStar);
  const a = Math.cbrt(M * (P / 365.25) ** 2);
  const realA = Math.cbrt(mStar * ((e?.periodDays ?? 6.1) / 365.25) ** 2);
  return (
    <>
      <Dialogue
        lines={[
          { who: 'director', text: 'Our telescope timed the dips: they repeat every few days. That’s the planet’s year! Now, how far is it from its star?' },
          { who: 'pip', mood: 'wow', text: 'Johannes Kepler figured this out about 400 years ago: the longer a planet’s year, the farther out it orbits.' },
        ]}
      />
      <Chalkboard formula="distance³ = star mass × year²">
        <p>Distance in AU (1 AU = Earth to Sun), star mass in Suns, year in Earth years.</p>
        <p>Check with Earth: 1³ = 1 × 1². ✔</p>
      </Chalkboard>
      <Widget title="Kepler’s calculator">
        <Slider id="kp" label="The planet’s year" min={0.5} max={400} step={0.01} value={P} onChange={setP} display={`${fmt(P, 2)} days`} />
        <Slider id="km" label="Star mass" min={0.08} max={2} step={0.001} value={M} onChange={setM} display={`${fmt(M, 3)} Suns`} />
        <p className="mt-2 text-lg font-bold">
          distance = ∛({fmt(M, 3)} × ({fmt(P, 2)} ÷ 365.25)²) = <span className="text-[#c2307f]">{fmt(a, 4)} AU</span>
        </p>
        <p className="text-sm">That’s {fmt(a * 149.6, 2)} million km. Mercury orbits the Sun at 0.39 AU.</p>
      </Widget>
      <RealNote>
        TRAPPIST-1 e: a year of {fmt(e?.periodDays ?? 6.1, 3)} days around a star of {fmt(mStar, 4)} Suns gives{' '}
        {fmt(realA, 4)} AU. The archive lists {e?.aAu ?? 0.0293} AU. Kepler’s 400-year-old law still works!
      </RealNote>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'number',
          question: 'A planet orbits a Sun-like star (1 Sun of mass) once every 8 years. How far from its star is it, in AU?',
          answer: 4,
          tolerance: 0.05,
          unit: 'AU',
          working: <>distance³ = 1 × 8² = 64. The cube root of 64 is 4 (because 4 × 4 × 4 = 64). So 4 AU.</>,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Gravity                                                          */
/* ------------------------------------------------------------------ */

export function ChGravity({ solved, onSolved }: ChapterProps) {
  const all = [...PLANETS_BY_DIFFICULTY.easy, ...PLANETS_BY_DIFFICULTY.medium, ...PLANETS_BY_DIFFICULTY.hard];
  const [pi, setPi] = useState(all.findIndex((p) => p.name === 'TRAPPIST-1 e'));
  const [kg, setKg] = useState(30);
  const p = all[pi] ?? all[0]!;
  const g = surfaceGravityG(p.massMe, p.radiusRe);
  return (
    <>
      <Dialogue
        lines={[
          { who: 'pip', text: 'Now we know a planet’s size and its mass. Together they tell us how strongly it pulls you down: its gravity.' },
          { who: 'director', mood: 'think', text: 'Gravity matters for our rocket. Stronger gravity means a harder landing and an even harder take-off.' },
        ]}
      />
      <Chalkboard formula="gravity = mass ÷ size²">
        <p>Using Earth units: Earth’s mass = 1, Earth’s size = 1, Earth’s gravity = 1.</p>
        <p>More mass pulls harder. A bigger size puts you farther from the middle, which pulls less.</p>
        <p>Speed to orbit just above the surface ≈ 7.9 km/s × √(mass ÷ size).</p>
      </Chalkboard>
      <Widget title="How heavy would you feel?">
        <label htmlFor="gp" className="text-sm font-bold">
          Planet
        </label>{' '}
        <select id="gp" value={pi} onChange={(e) => setPi(Number(e.target.value))} className="rounded-lg bg-paper px-2 py-1 font-bold">
          {all.map((x, i) => (
            <option key={x.name} value={i}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex items-center gap-3">
          <span className="w-16 shrink-0">
            <PlanetSprite planet={p} />
          </span>
          <p className="font-bold">
            {fmt(p.massMe, 2)} ÷ {fmt(p.radiusRe, 2)}² = <span className="text-[#c2307f]">{fmt(g, 2)} × Earth gravity</span>
          </p>
        </div>
        <Slider id="gk" label="Your weight on Earth" min={10} max={100} step={1} value={kg} onChange={setKg} display={`${kg} kg`} />
        <p className="mt-1 text-lg font-bold">
          On {p.name} you would feel like <span className="text-[#c2307f]">{fmt0(kg * g)} kg</span>. Orbit speed: {fmt(surfaceOrbitalVelocityKms(p.massMe, p.radiusRe), 1)} km/s.
        </p>
      </Widget>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'number',
          question: 'A planet is 2 × Earth’s size and has 8 × Earth’s mass. How many times Earth’s gravity does it have?',
          answer: 2,
          tolerance: 0.01,
          unit: '× Earth',
          working: <>gravity = 8 ÷ 2² = 8 ÷ 4 = 2 × Earth’s gravity.</>,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Rocket equation                                                  */
/* ------------------------------------------------------------------ */

export function ChRocketEquation({ solved, onSolved }: ChapterProps) {
  const e = findPlanet('TRAPPIST-1 e');
  const need = e ? requiredDeltaV(e).totalRequired : 29;
  const [isp, setIsp] = useState(450);
  const [full, setFull] = useState(300);
  const [empty, setEmpty] = useState(40);
  const emptyT = Math.min(empty, full - 1);
  const dv = (isp * G0 * Math.log(full / emptyT)) / 1000;
  return (
    <>
      <Dialogue
        lines={[
          { who: 'director', text: 'Now the big one. In 1903 Konstantin Tsiolkovsky wrote down the most important equation in rocketry.' },
          { who: 'pip', mood: 'wow', text: 'It says how much speed change, called Δv (“delta-v”), a rocket can make by throwing its fuel out of the back.' },
        ]}
      />
      <Chalkboard formula="Δv = Isp × 9.81 × ln(full mass ÷ empty mass)">
        <p>Isp (“specific impulse”) is how efficient the engine is, in seconds. Higher is better.</p>
        <p>ln is the natural logarithm, a button on scientific calculators. Doubling the mass ratio does NOT double Δv. That’s the hard part of rocketry!</p>
      </Chalkboard>
      <Widget title="Rocket lab">
        <Slider id="ri" label="Engine efficiency (Isp)" min={250} max={3000} step={10} value={isp} onChange={setIsp} display={`${fmt0(isp)} s`} />
        <Slider id="rf" label="Full rocket" min={20} max={350} step={1} value={full} onChange={setFull} display={`${full} t`} />
        <Slider id="re" label="Empty rocket (no fuel)" min={5} max={200} step={1} value={empty} onChange={setEmpty} display={`${emptyT} t`} />
        <p className="mt-2 text-lg font-bold">
          {fmt0(isp)} × 9.81 × ln({full} ÷ {emptyT}) = <span className="text-[#c2307f]">{fmt(dv, 1)} km/s</span>
        </p>
        <div className="mt-2 h-4 rounded-full bg-ink/10" aria-hidden="true">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (dv / need) * 100)}%`, background: dv >= need ? '#3cae8e' : '#ff7cc6' }} />
        </div>
        <p className="text-sm">A trip to TRAPPIST-1 e and back needs {fmt(need, 1)} km/s (with a 10% safety margin).</p>
      </Widget>
      <RealNote>Real hydrogen–oxygen engines (like the Space Shuttle’s RS-25) reach an Isp of about 450 seconds. Pull the slider there: even a rocket that is mostly fuel can’t reach {fmt(need, 0)} km/s!</RealNote>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'choice',
          question: 'An engine has Isp 300 s. The rocket weighs 100 t full and 50 t empty. About how much Δv does it get? (ln 2 ≈ 0.693)',
          options: ['0.2 km/s', '2.0 km/s', '20 km/s', '200 km/s'],
          correct: 1,
          working: <>300 × 9.81 × ln(100 ÷ 50) = 2,943 × 0.693 ≈ 2,040 m/s ≈ 2.0 km/s.</>,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Thrust-to-weight                                                 */
/* ------------------------------------------------------------------ */

export function ChLiftOff({ solved, onSolved }: ChapterProps) {
  const [thrust, setThrust] = useState(3000);
  const [mass, setMass] = useState(200);
  const twr = (thrust * 1000) / (mass * 1000 * G0);
  const flies = twr >= 1.2;
  return (
    <>
      <Dialogue
        lines={[
          { who: 'pip', mood: 'think', text: 'Lots of Δv is useless if the rocket can’t get off the ground. The engine must push harder than gravity pulls.' },
          { who: 'director', text: 'Mission rule: thrust must be at least 1.2 times the rocket’s weight.' },
        ]}
      />
      <Chalkboard formula="TWR = thrust ÷ (mass × 9.81)">
        <p>Thrust in newtons (1 kN = 1,000 N), mass in kilograms. Weight = mass × 9.81 on Earth.</p>
        <p>TWR below 1: it can’t move. Our rule: at least 1.2.</p>
      </Chalkboard>
      <Widget title="Will it fly?">
        <Slider id="lt" label="Engine thrust" min={500} max={8000} step={50} value={thrust} onChange={setThrust} display={`${fmt0(thrust)} kN`} />
        <Slider id="lm" label="Rocket mass" min={20} max={450} step={5} value={mass} onChange={setMass} display={`${mass} t`} />
        <p className="mt-2 text-lg font-bold">
          {fmt0(thrust * 1000)} ÷ ({fmt0(mass * 1000)} × 9.81) = <span className={flies ? 'text-leaf' : 'text-[#a3203a]'}>TWR {fmt(twr, 2)}</span>{' '}
          {flies ? '✔ Lift-off!' : '✖ Stuck on the pad'}
        </p>
      </Widget>
      <Quiz
        solved={solved}
        onCorrect={onSolved}
        spec={{
          kind: 'number',
          question: 'An engine gives 3,000 kN of thrust. The rocket’s mass is 200 tonnes. What is its TWR? (2 decimal places)',
          answer: 1.53,
          tolerance: 0.02,
          working: <>3,000,000 N ÷ (200,000 kg × 9.81) = 3,000,000 ÷ 1,962,000 ≈ 1.53. More than 1.2, so it lifts off.</>,
        }}
      />
    </>
  );
}
