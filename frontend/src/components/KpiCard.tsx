import type { ReactNode } from "react";

type Tone = "default" | "good" | "warn" | "bad";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: KpiCardProps) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <div className="kpi__top">
        <span className="kpi__label">{label}</span>
        {icon ? <span className="kpi__icon">{icon}</span> : null}
      </div>
      <div className="kpi__value">{value}</div>
      {hint ? <div className="kpi__hint">{hint}</div> : null}
    </div>
  );
}
