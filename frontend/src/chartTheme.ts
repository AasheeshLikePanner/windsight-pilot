import type { CSSProperties } from "react";

export const COLORS = {
  actual: "#f8fafc",
  forecast: "#f5b942",
  band: "#2dd4bf",
  error: "#f87171",
  shortfall: "#fb923c",
  surplus: "#38bdf8",
  grid: "#1e2b45",
  axis: "#8493ad",
  panel: "#0f1a2d",
};

export const tooltipStyle: CSSProperties = {
  backgroundColor: "#0c1627",
  border: "1px solid #24324a",
  borderRadius: 12,
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
  color: "#e2e8f0",
  fontSize: 12,
  padding: "10px 12px",
};

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
