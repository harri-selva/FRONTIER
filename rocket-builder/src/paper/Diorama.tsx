import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';

/** SVG filter that gives every sprite a white cut-paper edge. Render once. */
export function PaperDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="pp-edge" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="grown" />
          <feFlood floodColor="#fff8ef" result="white" />
          <feComposite in="white" in2="grown" operator="in" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pp-edge-thin" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="grown" />
          <feFlood floodColor="#fff8ef" result="white" />
          <feComposite in="white" in2="grown" operator="in" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export interface Camera {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
}

interface DioramaProps {
  camera?: Camera;
  /** Seconds for camera moves. */
  cameraTime?: number;
  /** CSS timing function for camera moves. */
  cameraEase?: string;
  /** Tilt the world slightly toward the pointer. */
  parallax?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  label?: string;
}

/**
 * A 3D stage. Children are <Layer>s placed at a depth; the camera moves the
 * whole world so nearer layers slide faster (real parallax via perspective).
 */
export function Diorama({ camera = {}, cameraTime = 0.6, cameraEase, parallax = true, className = '', style, children, label }: DioramaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduced } = useReducedMotion();
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!parallax || reduced || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--prx', `${(-py * 4).toFixed(2)}deg`);
    el.style.setProperty('--pry', `${(px * 6).toFixed(2)}deg`);
  };
  const leave = () => {
    ref.current?.style.setProperty('--prx', '0deg');
    ref.current?.style.setProperty('--pry', '0deg');
  };
  const worldStyle = {
    '--cx': `${camera.x ?? 0}cqw`,
    '--cy': `${camera.y ?? 0}cqh`,
    '--cz': `${camera.z ?? 0}px`,
    '--rx': `calc(${camera.rx ?? 0}deg + var(--prx, 0deg))`,
    '--ry': `calc(${camera.ry ?? 0}deg + var(--pry, 0deg))`,
    transitionDuration: `${reduced ? 0 : cameraTime}s`,
    ...(cameraEase ? { transitionTimingFunction: cameraEase } : {}),
  } as CSSProperties;
  return (
    <div
      ref={ref}
      className={`diorama ${className}`}
      style={style}
      onPointerMove={move}
      onPointerLeave={leave}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <div className="world" style={worldStyle}>
        {children}
      </div>
    </div>
  );
}

interface LayerProps {
  /** Centre x as % of the stage width. */
  x: number;
  /** Bottom y as % of the stage height (0 = bottom). */
  y: number;
  /** Depth in px: negative is farther away. */
  z?: number;
  /** Width in % of the smaller stage side (cqmin). */
  w: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Rotate the layer back to lie flat (floors). */
  flat?: boolean;
}

/** A sprite standing in the diorama, anchored at its bottom centre. */
export function Layer({ x, y, z = 0, w, className = '', style, children, flat = false }: LayerProps) {
  return (
    <div
      className={`layer ${className}`}
      style={{
        left: `${x}%`,
        bottom: `${y}%`,
        width: `${w}cqmin`,
        transform: `translate3d(-50%, 0, ${z}px)${flat ? ' rotateX(90deg)' : ''}`,
        transformOrigin: '50% 100%',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
