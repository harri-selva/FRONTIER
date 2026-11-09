import type { ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'div' | 'article';
  id?: string;
}

/** Arcade-cabinet panel with a neon marquee header. */
export function Cabinet({ title, right, children, className = '', bodyClassName = 'p-4 sm:p-5', as = 'section', id }: Props) {
  const Tag = as;
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag className={`cabinet ${className}`} aria-labelledby={title !== undefined ? headingId : undefined} id={id}>
      {title !== undefined && (
        <div className="cabinet-marquee">
          <span aria-hidden="true">◆</span>
          <h2 id={headingId} className="m-0 flex-1 text-[0.7rem] font-normal leading-relaxed">
            {title}
          </h2>
          {right}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}
