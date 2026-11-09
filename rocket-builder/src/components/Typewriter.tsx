import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  speedMs?: number;
  instant?: boolean;
  onDone?: () => void;
}

/** Typewriter text. Screen readers get the full text immediately. */
export function Typewriter({ text, speedMs = 22, instant = false, onDone }: Props) {
  const [n, setN] = useState(instant ? text.length : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (instant) {
      setN(text.length);
      doneRef.current?.();
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) {
        window.clearInterval(id);
        doneRef.current?.();
      }
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, instant, speedMs]);

  const done = n >= text.length;
  return (
    <span>
      <span aria-hidden="true" className={done ? '' : 'caret'}>
        {text.slice(0, n)}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
