import {
  CREW_MASS_KG,
  CREW_RADIATION_MIN,
  DIFFICULTY_CONFIG,
  DV_EARTH_TO_ORBIT_KMS,
  DV_MARGIN,
  DV_RETURN_CORRECTIONS_KMS,
  EARTH_REENTRY_TEMP_K,
  MAX_LAUNCH_MASS_KG,
  MIN_TWR,
  ROCKY_RADIUS_MAX_RE,
} from '../engine';
import { SourceBadge } from './Badges';
import { fmtInt, money } from './format';

function Formula({ children }: { children: string }) {
  return (
    <p className="readout my-2 overflow-x-auto rounded-lg border border-cyber/40 bg-void/70 px-3 py-2 text-cyber">{children}</p>
  );
}

function Item({ title, kind, children }: { title: string; kind: 'real' | 'derived' | 'game' | 'fiction'; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-1 flex flex-wrap items-center gap-2 font-display text-[0.7rem] text-neonsoft">
        {title} <SourceBadge kind={kind} />
      </h3>
      <div className="text-sm leading-relaxed text-haze">{children}</div>
    </section>
  );
}

export function MathsPanel() {
  return (
    <div>
      <p className="mb-5 text-sm text-haze">
        Every number in the game is either <SourceBadge kind="real" /> from the NASA Exoplanet Archive,{' '}
        <SourceBadge kind="derived" /> from those values with a simple formula, a <SourceBadge kind="game" />, or{' '}
        <SourceBadge kind="fiction" />. Real interstellar travel is far beyond current technology: a probe at Voyager 1’s
        speed (≈ 17 km/s) would need about 73,000 years to reach Proxima Centauri, 4.2 light-years away.
      </p>

      <Item title="Distance" kind="derived">
        <Formula>light-years = parsecs × 3.2616</Formula>
        The archive gives distance in parsecs (sy_dist).
      </Item>

      <Item title="Surface gravity and orbital velocity" kind="derived">
        <Formula>g = M / R²   (Earth units)</Formula>
        <Formula>v_orb ≈ 7.9 km/s × √(M / R)</Formula>
        7.9 km/s is Earth’s circular orbital velocity at the surface. Many masses are estimated from radius or are minimum
        masses (M·sin i); the planet card says which.
      </Item>

      <Item title="Planet type" kind="game">
        Radius ≤ {ROCKY_RADIUS_MAX_RE} Earth radii → “likely rocky”: land and return. Larger → “likely gas/ice-rich, no
        solid surface expected”: orbital survey and return. Real planets near this boundary can go either way.
      </Item>

      <Item title="Δv available (Tsiolkovsky rocket equation)" kind="real">
        <Formula>Δv = Isp × 9.81 × ln(m₀ / m_f)</Formula>
        m₀ is the fully fuelled mass and m_f the mass with tanks empty, using the launch engine’s Isp.{' '}
        <SourceBadge kind="game" label="Staging simplification" /> Stacked tanks are drop tanks: they burn bottom-first and
        each empty tank is jettisoned, so each tank is one Tsiolkovsky step and the steps add up. One engine is shared; a
        real rocket would need an engine per stage.
      </Item>

      <Item title="Launch check" kind="game">
        <Formula>TWR = thrust / (m₀ × 9.81)</Formula>
        The rocket explodes on the pad if TWR &lt; {MIN_TWR}, if launch mass exceeds {fmtInt(MAX_LAUNCH_MASS_KG / 1000)} t
        (pad limit), or (Hard) if the pressure system is missing, incompatible with the propellant or too small for the
        propellant load.
      </Item>

      <Item title="Δv required (chemical phases only)" kind="game">
        <Formula>{`Earth launch to orbit ≈ ${DV_EARTH_TO_ORBIT_KMS} km/s (real approximate figure incl. losses)`}</Formula>
        <Formula>Rocky world, land + take off ≈ 2 × 1.2 × v_orb</Formula>
        <Formula>Gas/ice world, orbit insertion + departure ≈ 2 × 0.25 × v_orb</Formula>
        <Formula>{`Return-leg corrections = ${DV_RETURN_CORRECTIONS_KMS} km/s`}</Formula>
        <Formula>{`Total required = (launch + planet + return) × ${DV_MARGIN}`}</Formula>
        The 1.2 factor covers gravity losses. The survey assumption: the Deep-Space Drive drops the craft into a loose,
        high orbit, so chemical burns only lower it to a survey orbit and raise it again. Re-entry at Earth uses the heat
        shield, not fuel. The return leg is handled by requiring the whole Δv sum plus a 10% margin. The first threshold
        missed sets the failure: below 9.4 km/s you run out of fuel before orbit; below launch + planet you cannot land
        and take off again (or leave orbit); below the full total you run dry on the way home.
      </Item>

      <Item title="Why only exotic engines can land" kind="real">
        Landing on and leaving an Earth-size planet costs about 19 km/s on its own. Even the best real chemical engines
        (hydrogen/oxygen, Isp ≈ 450 s) with three drop tanks reach at most about 12 km/s in this game. That is real physics, so
        landing missions need one of the high-Isp engines badged <SourceBadge kind="fiction" />.
      </Item>

      <Item title="Transit and comms" kind="game">
        <Formula>Drive range ≥ 2 × distance (out and back)</Formula>
        <Formula>Comms range ≥ distance</Formula>
        The Deep-Space Drive is fictional. It stands in for travel that no real technology can do.
      </Item>

      <Item title="Heat and crew" kind="game">
        Protection max temperature ≥ the planet’s equilibrium temperature (real value) and ≥ {fmtInt(EARTH_REENTRY_TEMP_K)} K
        for Earth re-entry (approximate: Space Shuttle tiles peaked near 1,530 K). Each astronaut adds{' '}
        {fmtInt(CREW_MASS_KG)} kg (person, consumables and life-support margin). On Hard, crewed missions need a radiation
        rating ≥ {CREW_RADIATION_MIN}.
      </Item>

      <Item title="Difficulty" kind="game">
        <ul className="list-disc pl-5">
          {Object.values(DIFFICULTY_CONFIG).map((d) => (
            <li key={d.id}>
              <strong>{d.label}</strong> ({money(d.budget)}): {d.summary}
            </li>
          ))}
        </ul>
      </Item>

      <Item title="Scoring (0–1000 before crew multiplier)" kind="game">
        <ul className="list-disc pl-5">
          <li>Mission: 400 for full success; failing at launch 50, in transit 150, at the planet 250, on the way home 350.</li>
          <li>Performance (200): Δv 100–125% of required and TWR 1.3–2.0 score best; under- and over-building both lose points.</li>
          <li>Budget efficiency (200): 0 if over budget; 80 at exactly the budget, more the less you spend.</li>
          <li>Component suitability (100): points off for unnecessary or mismatched parts.</li>
          <li>Resource balance (100): propellant should be 70–92% of launch mass.</li>
          <li>On a failure, budget, suitability and resource points are scaled by how far the mission got.</li>
          <li>Crew multiplier: success ×(1 + 0.1 × crew); failure ×(1 − 0.15 × crew), floored at 0.</li>
        </ul>
      </Item>
    </div>
  );
}
