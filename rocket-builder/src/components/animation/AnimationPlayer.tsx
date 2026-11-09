import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipName } from '../../engine';
import { findClip, type ClipSource } from './sources';

interface Props {
  clip: ClipName;
  /** Stop partway: 0..1 of the clip's length. */
  cutAt?: number;
  /** Called once when the clip ends (or is cut). */
  onEnded: () => void;
  /** Freeze on the current frame (used under failure overlays). */
  paused?: boolean;
  /** Reduced motion: show a still, labelled frame and advance quickly. */
  reduced?: boolean;
}

const PLACEHOLDER_MS = 3500;
const REDUCED_MS = 1200;

const LABEL: Record<ClipName, string> = {
  takeoff: 'Lift-off',
  explosion: 'Launch failure',
  orbit_arrival: 'Cruise to the planet',
};

/**
 * Plays one of the three hand-drawn clips (video, animated image, Lottie or
 * PNG frame sequence) found in public/animations/, or a labelled placeholder.
 */
export function AnimationPlayer({ clip, cutAt, onEnded, paused = false, reduced = false }: Props) {
  const [source, setSource] = useState<ClipSource | null>(null);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Stable identity so child timers are not reset by parent re-renders.
  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndedRef.current();
  }, []);

  useEffect(() => {
    let alive = true;
    endedRef.current = false;
    setSource(null);
    void findClip(clip).then((s) => alive && setSource(s));
    return () => {
      alive = false;
    };
  }, [clip, cutAt]);

  // Reduced motion: still frame, short hold, advance.
  useEffect(() => {
    if (!reduced || !source || paused) return;
    const id = window.setTimeout(finish, REDUCED_MS);
    return () => window.clearTimeout(id);
  }, [reduced, source, paused, finish]);

  if (!source) return <Frame clip={clip}><p className="readout text-cyber">Loading…</p></Frame>;

  if (reduced) {
    return (
      <Frame clip={clip}>
        {source.kind === 'video' ? (
          <video src={source.src} muted playsInline preload="metadata" className="h-full w-full object-contain" aria-hidden="true" />
        ) : source.kind === 'image' ? (
          <p className="readout text-haze">{LABEL[clip]} (animation paused: reduced motion)</p>
        ) : (
          <Placeholder clip={clip} still />
        )}
      </Frame>
    );
  }

  switch (source.kind) {
    case 'video':
      return <VideoClip src={source.src} cutAt={cutAt} paused={paused} onEnded={finish} clip={clip} />;
    case 'image':
      return <TimedClip clip={clip} ms={source.durationMs * (cutAt ?? 1)} paused={paused} onEnded={finish}><img src={source.src} alt="" className="h-full w-full object-contain" /></TimedClip>;
    case 'frames':
      return <FramesClip clip={clip} urls={source.urls} fps={source.fps} cutAt={cutAt} paused={paused} onEnded={finish} />;
    case 'lottie':
      return <LottieClip clip={clip} src={source.src} cutAt={cutAt} paused={paused} onEnded={finish} />;
    case 'placeholder':
      return (
        <TimedClip clip={clip} ms={PLACEHOLDER_MS * (cutAt ?? 1)} paused={paused} onEnded={finish}>
          <Placeholder clip={clip} />
        </TimedClip>
      );
  }
}

function Frame({ clip, children }: { clip: ClipName; children: React.ReactNode }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-void" role="img" aria-label={`Animation: ${LABEL[clip]}`}>
      {children}
    </div>
  );
}

function VideoClip({ src, cutAt, paused, onEnded, clip }: { src: string; cutAt?: number; paused: boolean; onEnded: () => void; clip: ClipName }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => onEnded()); // autoplay blocked: move on
  }, [paused, onEnded]);
  return (
    <Frame clip={clip}>
      <video
        ref={ref}
        src={src}
        muted
        playsInline
        autoPlay
        className="h-full w-full object-contain"
        onEnded={onEnded}
        onError={onEnded}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (cutAt !== undefined && v.duration > 0 && v.currentTime >= v.duration * cutAt) {
            v.pause();
            onEnded();
          }
        }}
      />
    </Frame>
  );
}

function TimedClip({ clip, ms, paused, onEnded, children }: { clip: ClipName; ms: number; paused: boolean; onEnded: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(onEnded, ms);
    return () => window.clearTimeout(id);
  }, [ms, paused, onEnded]);
  return <Frame clip={clip}>{children}</Frame>;
}

function FramesClip({ clip, urls, fps, cutAt, paused, onEnded }: { clip: ClipName; urls: string[]; fps: number; cutAt?: number; paused: boolean; onEnded: () => void }) {
  const [i, setI] = useState(0);
  const last = Math.max(0, Math.floor((urls.length - 1) * (cutAt ?? 1)));
  useEffect(() => {
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }, [urls]);
  useEffect(() => {
    if (paused) return;
    if (i >= last) {
      onEnded();
      return;
    }
    const id = window.setTimeout(() => setI((n) => n + 1), 1000 / fps);
    return () => window.clearTimeout(id);
  }, [i, last, fps, paused, onEnded]);
  return (
    <Frame clip={clip}>
      <img src={urls[i]} alt="" className="h-full w-full object-contain" />
    </Frame>
  );
}

function LottieClip({ clip, src, cutAt, paused, onEnded }: { clip: ClipName; src: string; cutAt?: number; paused: boolean; onEnded: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const anim = useRef<import('lottie-web').AnimationItem | null>(null);
  useEffect(() => {
    let alive = true;
    void import('lottie-web').then(({ default: lottie }) => {
      if (!alive || !host.current) return;
      const a = lottie.loadAnimation({ container: host.current, renderer: 'svg', loop: false, autoplay: true, path: src });
      anim.current = a;
      a.addEventListener('complete', onEnded);
      a.addEventListener('data_failed', onEnded);
      if (cutAt !== undefined) {
        a.addEventListener('enterFrame', () => {
          if (a.totalFrames > 0 && a.currentFrame >= a.totalFrames * cutAt) {
            a.pause();
            onEnded();
          }
        });
      }
    });
    return () => {
      alive = false;
      anim.current?.destroy();
      anim.current = null;
    };
  }, [src, cutAt, onEnded]);
  useEffect(() => {
    if (paused) anim.current?.pause();
  }, [paused]);
  return (
    <Frame clip={clip}>
      <div ref={host} className="h-full w-full" />
    </Frame>
  );
}

/** Clearly labelled stand-in until the real animation file is added. */
function Placeholder({ clip, still = false }: { clip: ClipName; still?: boolean }) {
  const anim = still ? '' : `ph-${clip}`;
  return (
    <div className="relative h-full w-full">
      <style>{`
        @keyframes ph-takeoff { from { transform: translate(-50%, 0); } to { transform: translate(-50%, -160%); } }
        @keyframes ph-explosion { 0% { transform: translate(-50%,-50%) scale(.2); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(3); opacity: 0; } }
        @keyframes ph-orbit_arrival { from { transform: translate(-50%,-50%) scale(.35); } to { transform: translate(-50%,-50%) scale(1.4); } }
        .ph-takeoff { animation: ph-takeoff ${PLACEHOLDER_MS}ms ease-in forwards; }
        .ph-explosion { animation: ph-explosion 900ms ease-out 3 forwards; }
        .ph-orbit_arrival { animation: ph-orbit_arrival ${PLACEHOLDER_MS}ms linear forwards; }
      `}</style>
      {clip === 'takeoff' && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-neon/40 to-transparent" />
          <div className={`absolute bottom-[20%] left-1/2 h-24 w-8 -translate-x-1/2 rounded-t-full border-2 border-cyber bg-haze/80 ${anim}`} />
        </>
      )}
      {clip === 'explosion' && <div className={`absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fff,#ffb86b_35%,#ff4fd8_70%,transparent_72%)] ${anim}`} />}
      {clip === 'orbit_arrival' && (
        <div className={`absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff9cee,#b13bff_60%,#1a0b3d)] ${anim}`} />
      )}
      <div className="absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] rounded-md border-2 border-dashed border-sunset bg-void/85 px-3 py-2 text-center">
        <p className="font-display text-[0.6rem] text-sunset">PLACEHOLDER · {clip}</p>
        <p className="mt-1 text-xs text-haze">
          Drop <code>public/animations/{clip}.mp4</code> (or .webm, .gif, .json) to replace.
        </p>
      </div>
    </div>
  );
}
