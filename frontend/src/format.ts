const numberFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

const decimalFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const tickFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function mw(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${numberFormat.format(value)} MW`;
}

export function gw(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${decimalFormat.format(value / 1000)} GW`;
}

export function gwh(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${decimalFormat.format(value)} GWh`;
}

export function gwTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  return `${tickFormat.format(value / 1000)}\u00A0GW`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function signedMw(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${numberFormat.format(Math.abs(value))} MW`;
}

export function signedGw(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${decimalFormat.format(Math.abs(value) / 1000)} GW`;
}

export function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function dateTime(iso: string | null): string {
  if (!iso) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso))} UTC`;
}

export function clockTime(iso: string | null): string {
  if (!iso) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso))} UTC`;
}

export function periodLabel(iso: string): string {
  return iso.slice(11, 16);
}

export function rangeLabel(from: string, to: string): string {
  if (from === to) return longDate(from);
  return `${dateLabel(from)} – ${dateLabel(to)}`;
}

export function compact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
