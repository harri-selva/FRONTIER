import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Accessible modal built on <dialog>: focus trap, Esc to close, focus restore. */
export function Modal({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="modal-title"
      className="cabinet m-auto max-h-[90vh] w-[min(920px,94vw)] overflow-hidden p-0 text-haze backdrop:bg-[#0d0221]/80"
    >
      <div className="cabinet-marquee">
        <span aria-hidden="true">◆</span>
        <h2 id="modal-title" className="m-0 flex-1 text-[0.7rem] font-normal">
          {title}
        </h2>
        <button type="button" className="rounded px-2 py-1 text-void hover:bg-white/30" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="max-h-[calc(90vh-3rem)] overflow-y-auto p-4 sm:p-6">{children}</div>
    </dialog>
  );
}
