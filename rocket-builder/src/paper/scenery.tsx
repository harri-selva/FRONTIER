import { COMPONENTS_BY_ID } from '../data/components';
import type { Rocket } from '../engine';
import { resolveBuild } from '../store/resolve';
import { Layer } from './Diorama';
import { CloudSprite, HillSprite, SunSprite, TinyStar } from './sprites';

/** A fixed, pretty rocket for decoration (title screen). */
export const DEMO_ROCKET: Rocket = resolveBuild({
  payload: 'payload-capsule',
  engine: 'engine-hydrolox',
  drive: 'drive-warp',
  tanks: ['tank-hydrolox', 'tank-hydrolox'],
  comms: 'comms-quantum',
  pressure: null,
  protection: 'protect-pica',
});
void COMPONENTS_BY_ID;

const STAR_SPOTS = [
  [6, 88], [14, 70], [22, 92], [31, 78], [44, 95], [52, 72], [61, 88], [70, 76], [79, 93], [88, 70], [95, 85],
  [9, 55], [37, 60], [66, 58], [91, 52], [18, 40], [82, 42],
] as const;

/** Star wall at the back of a diorama. */
export function StarWall({ z = -600, count = STAR_SPOTS.length }: { z?: number; count?: number }) {
  return (
    <>
      {STAR_SPOTS.slice(0, count).map(([x, y], i) => (
        <Layer key={i} x={x} y={y} z={z} w={i % 3 === 0 ? 3.2 : 2}>
          <div className="anim-twinkle" style={{ animationDelay: `${(i % 7) * 0.35}s` }}>
            <TinyStar color={i % 4 === 0 ? '#ffe07a' : i % 4 === 1 ? '#ffb7e1' : '#fff8ef'} />
          </div>
        </Layer>
      ))}
    </>
  );
}

/** Rolling paper hills in three depths, plus a vaporwave sun. */
export function HillsAndSun({ sun = true }: { sun?: boolean }) {
  return (
    <>
      {sun && (
        <Layer x={50} y={16} z={-520} w={48}>
          <SunSprite />
        </Layer>
      )}
      <Layer x={50} y={-3} z={-380} w={220}>
        <HillSprite color="#2b2f73" dark="#141a3f" />
      </Layer>
      <Layer x={30} y={-6} z={-200} w={170}>
        <HillSprite color="#3d2a7a" dark="#0b0e2a" />
      </Layer>
      <Layer x={75} y={-9} z={-60} w={170}>
        <HillSprite color="#1e2557" dark="#05060f" />
      </Layer>
    </>
  );
}

export function DriftingClouds({ z = -300 }: { z?: number }) {
  return (
    <>
      <Layer x={14} y={62} z={z} w={22}>
        <div className="anim-bob" style={{ animationDuration: '6s' }}>
          <CloudSprite />
        </div>
      </Layer>
      <Layer x={86} y={70} z={z - 80} w={18}>
        <div className="anim-bob" style={{ animationDuration: '7.5s', animationDelay: '1s' }}>
          <CloudSprite color="#4a5378" />
        </div>
      </Layer>
    </>
  );
}
