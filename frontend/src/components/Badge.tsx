import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "good" | "warn" | "bad" | "info";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  title?: string;
};

export function Badge({ children, tone = "neutral", dot = false, title }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
