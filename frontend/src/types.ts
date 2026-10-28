export type Counts = {
  actuals: number;
  forecasts: number;
  delivery_dates: number;
  db_size_mb: number;
};

export type Source = {
  dataset: string;
  description: string;
  url: string;
};

export type Meta = {
  name: string;
  subtitle: string;
  period: { from: string; to: string };
  gate_closure: { local_time: string; timezone: string; rule: string };
  resolution: { actuals: string; forecasts: string };
  counts: Counts;
  last_ingest: {
    id: number;
    started_at: string;
    finished_at: string | null;
    actual_count: number;
    forecast_count: number;
    status: string;
  } | null;
  data_ready: boolean;
  sources: { actuals: Source; forecasts: Source };
  notes: string[];
};

export type DateCoverage = {
  date: string;
  actual_rows: number;
  forecast_hours: number;
  has_actuals: boolean;
  has_forecasts: boolean;
};

export type Metrics = {
  n: number;
  expected_points: number | null;
  coverage_pct: number;
  mean_forecast_mw: number;
  mean_actual_mw: number;
  forecast_energy_gwh: number;
  actual_energy_gwh: number;
  mae_mw: number;
  rmse_mw: number;
  bias_mw: number;
  nmae_pct: number;
  p90_abs_error_mw: number;
  p90_shortfall_mw: number;
  within_1gw_pct: number;
};

export type Vintage = {
  publish_time: string | null;
  lead_time_hours: number | null;
  lead_time_min_hours: number | null;
  lead_time_max_hours: number | null;
  forecast_hours: number;
};

export type Period = {
  start_time: string;
  settlement_period: number;
  forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  abs_error_mw: number | null;
  forecast_publish_time: string | null;
  lead_time_hours: number | null;
  lower_mw: number | null;
  upper_mw: number | null;
  shortfall_buffer_mw: number | null;
  uncertainty_level: string | null;
};

export type UncertaintyBucket = {
  n: number;
  q10_mw: number;
  q90_mw: number;
  fallback: boolean;
};

export type Uncertainty = {
  method: string;
  global: { n: number; q10_mw: number; q90_mw: number };
  levels: Record<string, UncertaintyBucket>;
};

export type Decision = {
  date: string;
  purchase_date: string;
  forecast_summary: { hours: number; energy_gwh: number; mean_mw: number | null };
  history: {
    ready: boolean;
    minimum_points: number;
    points: number;
    metrics: Metrics | null;
    from: string | null;
    to: string | null;
  };
  gate_closure: string;
  gate_closure_label: string;
  latest_publish_time: string | null;
  vintage: Vintage;
  summary: Metrics;
  uncertainty: Uncertainty;
  periods: Period[];
  data_quality: {
    actual_periods: number;
    forecast_hours: number;
    decision_points: number;
    missing_periods: number;
  };
  notes: string[];
};

export type DailyRow = Metrics & { date: string };
export type HourRow = Metrics & { hour: number; label: string };
export type LevelRow = Metrics & {
  level: string;
  low_mw: number | null;
  high_mw: number | null;
};
export type LeadRow = Metrics & {
  lead_time: string;
  low_hours: number;
  high_hours: number | null;
};
export type ScatterPoint = {
  forecast_mw: number;
  actual_mw: number;
  date: string;
  hour: number;
};
export type WorstRow = {
  date: string;
  start_time: string;
  hour: number;
  forecast_mw: number;
  actual_mw: number;
  error_mw: number;
  abs_error_mw: number;
  forecast_publish_time: string;
  lead_time_hours: number;
};
export type DistributionBin = {
  bin_start_mw: number;
  bin_end_mw: number;
  label: string;
  count: number;
};

export type Accuracy = {
  range: { from: string; to: string };
  summary: Metrics & { decision_points: number; vintage_points: number };
  daily: DailyRow[];
  by_hour: HourRow[];
  by_lead_time: LeadRow[];
  by_level: LevelRow[];
  distribution: DistributionBin[];
  scatter: ScatterPoint[];
  max_axis_mw: number;
  worst: WorstRow[];
  uncertainty: Uncertainty;
  notes: string[];
};
