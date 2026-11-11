/*
 * Launch-sequence dioramas. Each scene is a 3D paper stage; motion is CSS
 * (keyframes + camera transitions) so it stays smooth and respects reduced motion.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { Planet, Rocket } from '../engine';
import { Diorama, Layer, type Camera } from './Diorama';
import { RocketSprite } from './RocketSprite';
import { HillsAndSun, StarWall } from './scenery';
import {
  CloudSprite,
  EarthSprite,
  FlameSprite,
  PadSprite,
  ParachuteSprite,
  PipSprite,
  PlanetSprite,
  PuffSprite,
  TinyStar,
  TowerSprite,
  WaveSprite,
} from './sprites';

export interface SceneProps {
  rocket: Rocket;
  crew: number;
  planet: Planet;
  reduced: boolean;
  /** This scene ends in failure (failure animation plays). */
  failing?: boolean;
  /** Which failure, for the right animation. */
  cause?: 'fuel' | 'heat' | 'signal' | 'radiation' | 'boom';
  /** Short words on the failure sign. */
  sign?: string;
}

/** Camera that moves once after mount (so CSS transitions run). */
function useCamera(from: Camera, to: Camera, delayMs = 60): Camera {
  const [cam, setCam] = useState(from);
  const target = JSON.stringify(to);
  // Re-run when the target changes: a scene can stay mounted across phases (countdown → lift-off).
  useEffect(() => {
    const id = window.setTimeout(() => setCam(JSON.parse(target) as Camera), delayMs);
    return () => window.clearTimeout(id);
  }, [target, delayMs]);
  return cam;
}

/** Status banner during the launch film, in the FRONTIER dialog style. */
function Sign({ text, color = '#f06aa8', style }: { text: string; color?: string; style?: CSSProperties }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[16%] z-10 -translate-x-1/2" style={style}>
      <div className="anim-stamp">
        <div
          className="border-4 bg-navy0 px-5 py-3 text-center font-title text-[clamp(14px,3vw,26px)] leading-snug"
          style={{ borderColor: color, color, boxShadow: 'inset 3px 3px 0 #1e2557, 6px 6px 0 #05060f', textShadow: '3px 3px 0 #05060f' }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function Puffs({ n = 7, spread = 60, up = -90, color }: { n?: number; spread?: number; up?: number; color?: string }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="absolute bottom-0 left-1/2 w-[40%]"
          style={{
            marginLeft: '-20%',
            animation: `puff ${1.4 + (i % 3) * 0.3}s ${i * 0.18}s ease-out infinite`,
            ['--dx' as string]: `${((i * 41) % (spread * 2)) - spread}px`,
            ['--dy' as string]: `${up + (i % 3) * 20}px`,
          }}
        >
          <PuffSprite color={color} />
        </div>
      ))}
    </>
  );
}

/* ---------------- Pad: countdown + lift-off + explosion ---------------- */

export function PadScene({ rocket, crew, reduced, phase }: SceneProps & { phase: 'countdown' | 'liftoff' | 'explode' }) {
  const lift = phase === 'liftoff' && !reduced;
  // Camera follows the rocket with the same easing, a little behind, so the rocket climbs the screen.
  const cam = useCamera({ rx: 3, y: 0 }, lift ? { rx: -6, y: 118 } : { rx: 3, y: 0 }, 900);
  const boom = phase === 'explode';
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!boom) return;
    const id = window.setTimeout(() => setBurst(true), reduced ? 0 : 1100);
    return () => window.clearTimeout(id);
  }, [boom, reduced]);

  const shards = ['#ff7cc6', '#b8a1ff', '#ffe07a', '#74e0c0', '#8fd3ff', '#fff8ef', '#ff7cc6', '#ffb48f', '#b8a1ff', '#ffe07a', '#ff5d73', '#fff8ef'];
  return (
    <Diorama className="h-full w-full" camera={cam} cameraTime={4.2} cameraEase="cubic-bezier(.55,0,.75,.3)" parallax={false}>
      <StarWall />
      <HillsAndSun />
      {/* clouds above the pad that the camera rises past */}
      {[
        [20, 70, -120, 26],
        [78, 95, -60, 22],
        [35, 130, -20, 30],
        [70, 165, 40, 28],
        [25, 205, 80, 34],
      ].map(([x, y, z, w], i) => (
        <Layer key={i} x={x!} y={y!} z={z} w={w!}>
          <CloudSprite color={i % 2 ? '#4a5378' : '#8a94b8'} />
        </Layer>
      ))}
      <Layer x={50} y={6} z={-20} w={32}>
        <PadSprite />
      </Layer>
      <Layer x={61} y={10} z={-30} w={7}>
        <TowerSprite />
      </Layer>
      <Layer x={50} y={10} z={0} w={11}>
        <div
          className={boom && !burst && !reduced ? 'anim-shake' : ''}
          style={
            lift
              ? { animation: 'lift-off 4.2s cubic-bezier(.55,0,.75,.3) 0.9s forwards' }
              : undefined
          }
        >
          {!burst && <RocketSprite rocket={rocket} crew={crew} />}
          {(phase === 'liftoff' || (boom && !burst)) && (
            <div className="mx-auto -mt-[6%] w-[46%]" style={boom ? { transform: 'scaleY(.5)', opacity: 0.8 } : undefined}>
              <FlameSprite />
            </div>
          )}
        </div>
        {phase !== 'countdown' && !burst && (
          <div className="absolute -bottom-[4%] left-1/2 h-[30%] w-[220%] -translate-x-1/2">
            <Puffs color="#f2e6ff" />
          </div>
        )}
        {burst && (
          <div className="absolute bottom-[20%] left-1/2 h-0 w-0">
            {shards.map((c, i) => (
              <span
                key={i}
                className="absolute block"
                style={{
                  width: `${2 + (i % 3)}cqmin`,
                  height: `${3 + (i % 2) * 2}cqmin`,
                  background: c,
                  clipPath: 'polygon(50% 0, 100% 100%, 0 80%)',
                  boxShadow: '0 0 0 2px #05060f',
                  animation: reduced ? undefined : `shard 1.4s cubic-bezier(.2,.8,.4,1) forwards`,
                  ['--dx' as string]: `${Math.cos((i / shards.length) * Math.PI * 2) * (18 + (i % 4) * 6)}cqmin`,
                  ['--dy' as string]: `${Math.sin((i / shards.length) * Math.PI * 2) * (14 + (i % 3) * 6) - 10}cqmin`,
                  ['--rot' as string]: `${(i % 2 ? 1 : -1) * (200 + i * 40)}deg`,
                }}
              />
            ))}
            <div className="absolute -left-[12cqmin] -top-[14cqmin] w-[24cqmin]">
              <div className="anim-pop">
                <PuffSprite color="#ffb48f" />
              </div>
            </div>
          </div>
        )}
      </Layer>
      {burst && (
        <Layer x={22} y={4} z={60} w={12}>
          <div className="anim-pop">
            <PipSprite mood="sad" />
          </div>
        </Layer>
      )}
      <style>{`@keyframes lift-off { from { transform: translateY(0); } to { transform: translateY(-150cqh); } }`}</style>
      {burst && <Sign text="VEHICLE LOST" color="#e04a3a" />}
    </Diorama>
  );
}

/* ---------------- Space: warp travel (and transit failures) ---------------- */

export function SpaceScene({ rocket, crew, planet, reduced, failing, cause, sign, toEarth = false }: SceneProps & { toEarth?: boolean }) {
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!failing) return;
    const id = window.setTimeout(() => setStalled(true), reduced ? 0 : 2000);
    return () => window.clearTimeout(id);
  }, [failing, reduced]);
  const cam = useCamera({ ry: toEarth ? 8 : -8 }, { ry: toEarth ? -4 : 4 }, 60);
  const dir = toEarth ? -1 : 1;
  const heat = stalled && cause === 'heat';

  return (
    <Diorama className="h-full w-full" camera={cam} cameraTime={4} parallax={false}>
      {/* three depths of stars that stream past */}
      {[-700, -400, -150].map((z, d) => (
        <div key={z} className="layer inset-0" style={{ transform: `translateZ(${z}px)` }}>
          <div
            className="absolute inset-y-0"
            style={{
              left: '-100%',
              width: '300%',
              animation: reduced || stalled ? undefined : `stream ${6 - d * 1.6}s linear infinite${toEarth ? ' reverse' : ''}`,
            }}
          >
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i} className="absolute" style={{ left: `${(i * 37 + d * 11) % 100}%`, top: `${(i * 53 + d * 17) % 100}%`, width: `${1.2 + d * 0.6}cqmin` }}>
                <TinyStar color={i % 5 === 0 ? '#ffe07a' : i % 5 === 1 ? '#ffb7e1' : '#fff8ef'} />
              </span>
            ))}
          </div>
        </div>
      ))}
      {/* warp streaks */}
      {!stalled && !reduced &&
        Array.from({ length: 8 }, (_, i) => (
          <Layer key={i} x={50} y={15 + i * 10} z={-100 + i * 20} w={30}>
            <div
              className="h-[0.8cqmin] rounded-full"
              style={{
                background: ['#ff7cc6', '#8fd3ff', '#ffe07a', '#74e0c0'][i % 4],
                animation: `streak ${0.9 + (i % 3) * 0.25}s ${i * 0.13}s linear infinite${toEarth ? ' reverse' : ''}`,
              }}
            />
          </Layer>
        ))}
      {/* destination grows */}
      <Layer x={toEarth ? 16 : 84} y={30} z={-300} w={26}>
        <div style={{ animation: reduced || stalled ? undefined : 'approach 4.4s ease-in forwards', transformOrigin: '50% 50%' }}>
          {toEarth ? <EarthSprite /> : <PlanetSprite planet={planet} />}
        </div>
      </Layer>
      {/* the rocket, flying sideways */}
      <Layer x={50} y={24} z={0} w={14}>
        <div
          style={{
            transform: `rotate(${dir * 90}deg)`,
            animation: stalled && !reduced ? 'drift 3s ease-out forwards' : undefined,
          }}
        >
          <div className={stalled || reduced ? '' : 'anim-bob'}>
            <RocketSprite rocket={rocket} crew={crew} glow={heat ? 'heat' : null} />
            {!stalled && (
              <div className="mx-auto -mt-[6%] w-[40%]">
                <FlameSprite />
              </div>
            )}
          </div>
        </div>
      </Layer>
      {stalled && cause === 'signal' && <div className="static-veil absolute inset-0" aria-hidden="true" />}
      {stalled && (
        <Sign
          text={sign ?? (cause === 'signal' ? 'SIGNAL LOST' : cause === 'radiation' ? 'RADIATION!' : cause === 'heat' ? 'THERMAL FAILURE' : 'OUT OF FUEL')}
          color={cause === 'signal' ? '#39d0e8' : '#f28c28'}
        />
      )}
      <style>{`
        @keyframes stream { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }
        @keyframes streak { from { transform: translateX(160%) scaleX(.3); opacity: 0; } 30% { opacity: 1; } to { transform: translateX(-160%) scaleX(1.4); opacity: 0; } }
        @keyframes approach { from { transform: scale(.35); } to { transform: scale(1.25); } }
        @keyframes drift { to { transform: rotate(${dir * 90 + 70}deg) translate(4cqmin, 6cqmin); } }
        .static-veil { background-image: repeating-linear-gradient(0deg, rgba(255,248,239,.16) 0 3px, transparent 3px 7px), var(--grain); animation: static-move .25s steps(3) infinite; }
        @keyframes static-move { 50% { background-position: 0 4px, 13px 7px; } }
      `}</style>
    </Diorama>
  );
}

/* ---------------- Arrival: landing or orbit (and planet failures) ---------------- */

export function ArriveScene({ rocket, crew, planet, reduced, failing, cause, sign }: SceneProps) {
  const landing = planet.missionType === 'landing';
  const [stage, setStage] = useState<'in' | 'done' | 'fail'>('in');
  useEffect(() => {
    const a = window.setTimeout(() => setStage('done'), reduced ? 0 : 2800);
    const b = failing ? window.setTimeout(() => setStage('fail'), reduced ? 0 : 3300) : 0;
    return () => {
      window.clearTimeout(a);
      if (b) window.clearTimeout(b);
    };
  }, [failing, reduced]);
  const cam = useCamera({ rx: 6, z: -80 }, { rx: 2, z: 0 }, 60);
  const heat = stage === 'fail' && cause === 'heat';

  return (
    <Diorama className="h-full w-full" camera={cam} cameraTime={3} parallax={false}>
      <StarWall />
      {landing ? (
        <>
          {/* the planet as a curved horizon */}
          <Layer x={50} y={0} z={-80} w={200}>
            {/* shift down so only the top of the planet shows, as a horizon at ~26% height */}
            <div style={{ transform: 'translateY(calc(200cqmin - 26cqh))' }}>
              <PlanetSprite planet={planet} />
            </div>
          </Layer>
          <Layer x={50} y={25} z={0} w={10}>
            <div style={{ animation: reduced ? undefined : 'land 2.8s cubic-bezier(.2,.7,.3,1) forwards' }}>
              <div className={stage === 'fail' && cause === 'fuel' && !reduced ? 'anim-shake' : ''}>
                <RocketSprite rocket={rocket} crew={crew} glow={heat ? 'heat' : null} />
                {(stage === 'in' || (stage === 'fail' && cause === 'fuel')) && (
                  <div className="mx-auto -mt-[6%] w-[40%]" style={stage === 'fail' ? { transform: 'scaleY(.35)', opacity: 0.7 } : undefined}>
                    <FlameSprite />
                  </div>
                )}
              </div>
            </div>
            {stage !== 'in' && (
              <div className="absolute -bottom-[2%] left-1/2 h-[25%] w-[240%] -translate-x-1/2">
                <Puffs n={heat ? 8 : 4} up={-50} color={heat ? '#7a6a8f' : '#f2e6ff'} />
              </div>
            )}
          </Layer>
        </>
      ) : (
        <>
          <Layer x={50} y={14} z={-120} w={70}>
            <PlanetSprite planet={planet} />
          </Layer>
          {/* orbit path */}
          <Layer x={50} y={24} z={-60} w={110}>
            <div className="mx-auto aspect-[3/1] w-full rounded-[50%] border-[0.5cqmin] border-dashed border-[#fff8ef]/60" />
          </Layer>
          <Layer x={50} y={30} z={0} w={8}>
            <div style={{ animation: reduced ? undefined : 'orbit 4s linear infinite' }}>
              <div style={{ transform: 'rotate(90deg)' }}>
                <RocketSprite rocket={rocket} crew={crew} glow={heat ? 'heat' : null} />
              </div>
            </div>
          </Layer>
        </>
      )}
      {stage === 'fail' && (
        <Sign
          text={sign ?? (cause === 'heat' ? 'THERMAL FAILURE' : landing ? 'ASCENT ABORTED' : 'OUT OF FUEL')}
          color={cause === 'heat' ? '#e04a3a' : '#f28c28'}
        />
      )}
      {stage === 'done' && !failing && <Sign text={landing ? 'TOUCHDOWN' : 'ORBIT ACHIEVED'} color="#5fd3c8" />}
      <style>{`
        @keyframes land { from { transform: translateY(-80cqh); } to { transform: translateY(0); } }
        @keyframes orbit {
          0% { transform: translate(-45cqmin, 0) scale(.8); z-index: 0; }
          25% { transform: translate(0, 6cqmin) scale(1.1); }
          50% { transform: translate(45cqmin, 0) scale(.8); }
          75% { transform: translate(0, -6cqmin) scale(.6); }
          100% { transform: translate(-45cqmin, 0) scale(.8); }
        }
      `}</style>
    </Diorama>
  );
}

/* ---------------- Splashdown ---------------- */

export function SplashScene({ rocket, crew, reduced }: SceneProps) {
  const [splashed, setSplashed] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => setSplashed(true), 3200);
    return () => window.clearTimeout(id);
  }, [reduced]);
  const capsuleOnly = { ...rocket, engine: null, drive: null, tanks: [], pressure: null };
  return (
    <Diorama className="h-full w-full" camera={{ rx: 4 }} parallax={false}>
      <div className="layer inset-0" style={{ transform: 'translateZ(-800px) scale(1.8)', background: 'linear-gradient(#f28c28, #c13b8a 45%, #3d2a7a)' }} />
      <HillsAndSun />
      <Layer x={50} y={30} z={0} w={13}>
        <div style={{ animation: reduced ? undefined : 'chute 3.2s cubic-bezier(.3,.7,.4,1) forwards' }}>
          <div className={splashed ? '' : 'anim-sway'}>
            <ParachuteSprite />
            <div className="mx-auto -mt-[4%] w-[45%]">
              <RocketSprite rocket={capsuleOnly} crew={crew} />
            </div>
          </div>
        </div>
        {splashed && (
          <div className="absolute -bottom-[8%] left-1/2 h-[30%] w-[200%] -translate-x-1/2">
            <Puffs n={6} up={-40} color="#cfeeff" />
          </div>
        )}
      </Layer>
      {[
        [-140, '#3d8fd6', 0],
        [-60, '#5fa8e8', 1],
        [30, '#8fd3ff', 2],
      ].map(([z, c, i]) => (
        <Layer key={String(z)} x={50} y={-2 - Number(i) * 3} z={Number(z)} w={260}>
          <div style={{ animation: reduced ? undefined : `wave ${2.4 + Number(i) * 0.5}s ease-in-out infinite alternate` }}>
            <WaveSprite color={String(c)} />
          </div>
        </Layer>
      ))}
      {splashed && <Sign text="WELCOME HOME!" color="#5fd3c8" />}
      <style>{`
        @keyframes chute { from { transform: translateY(-90cqh); } to { transform: translateY(0); } }
        @keyframes wave { from { transform: translateX(-3%); } to { transform: translateX(3%); } }
      `}</style>
    </Diorama>
  );
}
