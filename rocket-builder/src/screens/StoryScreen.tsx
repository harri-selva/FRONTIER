import { useState, type ComponentType } from 'react';
import { sfx } from '../paper/sfx';
import { Icon, PipSprite } from '../paper/sprites';
import { useGame } from '../store/gameStore';
import { ChAI } from '../story/ChapterAI';
import { ChLantern } from '../story/ChapterLantern';
import { ChGravity, ChKepler, ChLiftOff, ChLightYears, ChParallax, ChRocketEquation, ChTransit, type ChapterProps } from '../story/chapters';
import { markDone, resetStory, useStory } from '../story/storyState';

interface FileDef {
  id: string;
  title: string;
  teaser: string;
  topic: string;
  Component: ComponentType<ChapterProps>;
}

const FILES: FileDef[] = [
  { id: 'parallax', title: 'The distance trick', teaser: 'How far away is a star?', topic: 'Parallax: d = 1 ÷ p', Component: ChParallax },
  { id: 'lightyears', title: 'Very long trips', teaser: 'Why we need a warp drive', topic: 'Light-years: time = distance ÷ speed', Component: ChLightYears },
  { id: 'transit', title: 'A planet’s shadow', teaser: 'Finding planets you can’t see', topic: 'Transits: dip = (planet ÷ star)²', Component: ChTransit },
  { id: 'kepler', title: 'Kepler’s clock', teaser: 'How far is the planet from its star?', topic: 'Kepler’s 3rd law: a³ = M × P²', Component: ChKepler },
  { id: 'ai', title: 'Weighing a planet with AI', teaser: 'Teach a computer to guess', topic: 'Machine learning: a neural network', Component: ChAI },
  { id: 'gravity', title: 'Gravity check', teaser: 'How heavy would you feel?', topic: 'Gravity: g = M ÷ R²', Component: ChGravity },
  { id: 'rocket', title: 'The rocket equation', teaser: 'How much fuel is enough?', topic: 'Δv = Isp × 9.81 × ln(m₀ ÷ m₁)', Component: ChRocketEquation },
  { id: 'liftoff', title: 'The lift-off rule', teaser: 'Strong enough to leave the ground?', topic: 'TWR = thrust ÷ weight', Component: ChLiftOff },
  { id: 'lantern', title: 'Operation Lantern', teaser: 'One rocket. One launch.', topic: 'Everything together', Component: ChLantern },
];

function Hub({ open }: { open: (i: number) => void }) {
  const story = useStory();
  const go = useGame((s) => s.go);
  const [shred, setShred] = useState(false);
  const doneCount = FILES.filter((f) => story.done.includes(f.id)).length;
  return (
    <div className="gutter mx-auto max-w-4xl pt-6">
      <section className="relative rounded-[28px] bg-[#141a3f] px-5 pb-6 pt-12 shadow-[0_0_0_5px_#05060f,0_10px_0_5px_rgba(20,8,50,.3)]" style={{ backgroundImage: 'var(--grain)', backgroundBlendMode: 'multiply' }} aria-labelledby="story-title">
        <div className="absolute -top-5 left-8 h-10 w-44 rounded-t-2xl bg-[#141a3f]" aria-hidden="true" />
        <span className="stamp anim-stamp absolute right-6 top-5 border-[3px] text-lg text-[#ff7a6b]" style={{ background: 'rgba(255,93,115,.12)' }}>
          Top secret
        </span>
        <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-ink/60">Secret Project</p>
        <h1 id="story-title" className="text-4xl font-black sm:text-5xl">
          Operation Lantern
        </h1>
        <p className="mt-2 max-w-2xl font-medium">
          NASA needs a new agent who understands the maths of space. Open each file, try the experiment, solve the puzzle, and the next file unlocks. The last file is
          the real mission, and you only get one launch.
        </p>
        <p className="mt-2 font-bold">
          {doneCount} of {FILES.length} files complete
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {FILES.map((f, i) => {
            const done = story.done.includes(f.id);
            const unlocked = i === 0 || FILES.slice(0, i).every((x) => story.done.includes(x.id));
            return (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    sfx.pop();
                    open(i);
                  }}
                  className={`paper flex w-full items-start gap-3 p-3 text-left transition ${unlocked ? 'hover:-rotate-1' : 'cursor-not-allowed opacity-60'}`}
                >
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-black ${done ? 'bg-mint' : unlocked ? 'bg-butter' : 'bg-ink/15'}`}>
                    {done ? <Icon name="check" size={18} label="Complete" /> : unlocked ? i + 1 : '🔒'}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold uppercase tracking-wider text-ink/60">File {i + 1}</span>
                    <span className="block font-display text-lg font-extrabold leading-tight">{f.title}</span>
                    <span className="block text-sm">{unlocked ? f.teaser : 'Locked: finish the file before'}</span>
                    {unlocked && <span className="mt-1 block text-xs font-bold text-[#f06aa8]">{f.topic}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="pbtn pbtn-paper" onClick={() => go('title')}>
            <Icon name="home" size={18} /> Home
          </button>
          {!shred ? (
            <button type="button" className="text-sm font-bold underline decoration-2 underline-offset-4" onClick={() => setShred(true)}>
              Shred the files and start over
            </button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2" role="alert">
              <span className="text-sm font-bold">This erases your progress and your one launch.</span>
              <button
                type="button"
                className="pbtn pbtn-sm"
                onClick={() => {
                  resetStory();
                  setShred(false);
                }}
              >
                Shred
              </button>
              <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={() => setShred(false)}>
                Keep
              </button>
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

export function StoryScreen() {
  const story = useStory();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (openIdx === null) return <Hub open={setOpenIdx} />;
  const f = FILES[openIdx]!;
  const done = story.done.includes(f.id);
  const next = FILES[openIdx + 1];
  const Chapter = f.Component;
  return (
    <div className="gutter mx-auto max-w-4xl pt-6">
      <article key={f.id} className="paper relative space-y-5 px-4 pb-6 pt-6 sm:px-6" aria-labelledby="file-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={() => setOpenIdx(null)}>
            <Icon name="back" size={16} /> All files
          </button>
          <span className="stamp text-[#ff7a6b]">Top secret · File {openIdx + 1}</span>
        </div>
        <header>
          <p className="text-sm font-bold text-[#f06aa8]">{f.topic}</p>
          <h1 id="file-title" className="text-4xl font-black">
            {f.title}
          </h1>
        </header>
        <Chapter
          solved={done}
          onSolved={() => {
            markDone(f.id);
          }}
        />
        {f.id !== 'lantern' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[#4a5378] pt-4">
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="w-9">
                <PipSprite mood={done ? 'wow' : 'think'} />
              </span>
              {done ? 'File complete.' : 'Solve the puzzle to unlock the next file.'}
            </span>
            {next && (
              <button
                type="button"
                className="pbtn"
                disabled={!done}
                onClick={() => {
                  sfx.go();
                  setOpenIdx(openIdx + 1);
                  window.scrollTo({ top: 0 });
                }}
              >
                Next file: {next.title} →
              </button>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
