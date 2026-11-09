import {
  CREW_MASS_KG,
  CREW_RADIATION_MIN,
  DIFFICULTY_CONFIG,
  DV_EARTH_TO_ORBIT_KMS,
  DV_RETURN_CORRECTIONS_KMS,
  EARTH_REENTRY_TEMP_K,
  MAX_LAUNCH_MASS_KG,
  MIN_TWR,
} from '../engine';
import { DATA_RETRIEVED, DATA_SOURCE_URL } from '../data/planets';
import { PretendStamp, RealStamp } from './ui';

function F({ children }: { children: string }) {
  return <p className="my-1.5 overflow-x-auto rounded-lg bg-[#f1e4d0] px-3 py-1.5 font-mono text-sm text-ink">{children}</p>;
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-1 text-lg font-extrabold">{title}</h3>
      <div className="text-[0.95rem] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/** "How it works": the real maths, for curious kids and grown-ups. */
export function GrownUps() {
  return (
    <div>
      <p className="mb-4">
        Planet facts marked <RealStamp /> come from the{' '}
        <a className="font-semibold underline" href={DATA_SOURCE_URL} target="_blank" rel="noreferrer">
          NASA Exoplanet Archive
        </a>{' '}
        (retrieved {DATA_RETRIEVED}). Parts marked <PretendStamp /> don’t exist. Real rockets can’t reach other stars: at
        Voyager 1’s speed, the nearest exoplanet is about 73,000 years away. The pretend warp drive is how the game gets
        you there. Everything else uses real rocket physics.
      </p>
      <Sec title="Can it lift off?">
        <F>{`thrust ÷ (mass × 9.81) ≥ ${MIN_TWR}`}</F>
        Also, the launch pad holds at most {(MAX_LAUNCH_MASS_KG / 1000).toFixed(0)} t (a game rule).
      </Sec>
      <Sec title="Fuel power (Δv), from the real rocket equation">
        <F>Δv = Isp × 9.81 × ln(full mass ÷ empty mass)</F>
        Stacked tanks drop off when empty, like rocket stages (one shared engine is a game simplification).
      </Sec>
      <Sec title="Fuel needed for the round trip">
        <F>{`Earth to space ${DV_EARTH_TO_ORBIT_KMS} km/s (real approximate figure)`}</F>
        <F>Rocky planet: land + take off = 2 × 1.2 × orbital speed</F>
        <F>Gas/ice planet: orbit in + out = 2 × 0.25 × orbital speed</F>
        <F>{`Trip home corrections ${DV_RETURN_CORRECTIONS_KMS} km/s, then everything × 1.1 for safety`}</F>
        Orbital speed ≈ 7.9 km/s × √(mass ÷ radius), from the real mass and radius. A planet up to 1.6 Earth radii is
        treated as rocky; bigger ones as gas or ice. That cut-off is a game simplification.
      </Sec>
      <Sec title="Why the pretend engines?">
        Landing on and leaving an Earth-size planet takes about 19 km/s. The best real engine (hydrogen + oxygen) reaches
        only about 12 km/s in this game, so real engines can get to space but not land on another world. That is real
        physics.
      </Sec>
      <Sec title="Other checks">
        Warp range ≥ 2 × distance. Radio range ≥ distance (Pilot and Commander). Shield ≥ planet temperature and ≥{' '}
        {EARTH_REENTRY_TEMP_K.toLocaleString('en-US')} K for coming home (Pilot and Commander). Tank pump matches the fuel
        and holds enough (Commander). Each astronaut adds {CREW_MASS_KG.toLocaleString('en-US')} kg; on Commander, crews
        need shield radiation rating ≥ {CREW_RADIATION_MIN}.
      </Sec>
      <Sec title="Levels and budgets">
        <ul className="list-disc pl-5">
          {Object.values(DIFFICULTY_CONFIG).map((d) => (
            <li key={d.id}>
              {d.label}: ${d.budget.toLocaleString('en-US')}M. {d.summary}
            </li>
          ))}
        </ul>
      </Sec>
      <Sec title="Score (0–1000, then the crew bonus)">
        Mission up to 400 (how far you got), smart fuel and thrust up to 200, saving money up to 200, sensible parts up
        to 100, good fuel balance up to 100. Crew bonus: ×(1 + 0.1 per astronaut) if you make it home, ×(1 − 0.15 per
        astronaut) if not. Each level is 10 tries; your average goes on the high-score board.
      </Sec>
      <p className="text-sm text-ink/80">A fan-made educational game. Not made or endorsed by NASA.</p>
    </div>
  );
}
