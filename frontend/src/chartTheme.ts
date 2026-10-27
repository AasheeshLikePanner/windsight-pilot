import type { CSSProperties } from "react";

export const COLORS = {
  actual: "#f2f2f2",
  forecast: "#fbbf24",
  band: "#5eead4",
  error: "#f87171",
  shortfall: "#fb923c",
  surplus: "#60a5fa",
  grid: "#2a2a2a",
  axis: "#8a8a8a",
  panel: "#1a1a1a",
};

export const tooltipStyle: CSSProperties = {
  backgroundColor: "#1e1e1e",
  border: "1px solid #383838",
  borderRadius: 4,
  color: "#f2f2f2",
  fontSize: 11.5,
  padding: "9px 11px",
};

export const tooltipLabelStyle: CSSProperties = { color: COLORS.axis };
export const tooltipItemStyle: CSSProperties = { color: COLORS.actual };
export const tooltipWrapperStyle: CSSProperties = {
  fontSize: 12,
  color: COLORS.axis,
};
export const referenceLineStyle = { stroke: "#5a5a5a", strokeWidth: 1 };

export const axisProps = {
  stroke: COLORS.axis,
  tick: { fill: COLORS.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: COLORS.grid,
  strokeDasharray: "3 5",
  vertical: false,
} as const;
