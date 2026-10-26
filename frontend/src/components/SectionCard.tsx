import type { ReactNode } from "react";

type SectionCardProps = {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionCard({
  children,
  title,
  eyebrow,
  description,
  actions,
  className = "",
}: SectionCardProps) {
  const hasHeader = title || description || actions;
  return (
    <section className={`card ${className}`.trim()}>
      {hasHeader ? (
        <header className="card__header">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            {title ? <h2 className="card__title">{title}</h2> : null}
            {description ? <p className="card__description">{description}</p> : null}
          </div>
          {actions ? <div className="card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
