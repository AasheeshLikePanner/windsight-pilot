import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Gauge,
  ShieldAlert,
  Target,
  Wind,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchDecision } from "../api";
import {
  axisProps,
  COLORS,
  gridProps,
  referenceLineStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
  tooltipWrapperStyle,
} from "../chartTheme";
import { Badge } from "../components/Badge";
import { DataTable, type Column } from "../components/DataTable";
import { DateField } from "../components/DateField";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { EmptyState, ErrorNotice, LoadingBlock } from "../components/States";
import { errorMessage } from "../errors";
import {
  clockTime,
  dateLabel,
  dateTime,
  gwh,
  gw,
  gwTick,
  longDate,
  mw,
  pct,
  periodLabel,
  signedMw,
} from "../format";
import { useSnapshotIndex } from "../hooks/useSnapshotIndex";
import type { Decision, Period } from "../types";

type ChartRow = {
  label: string;
  forecast: number | null;
  actual: number | null;
  error: number | null;
  band: [number, number] | null;
  shortfallBuffer: number | null;
  leadTime: number | null;
};

function toneForBias(bias: number): "good" | "warn" {
  return Math.abs(bias) <= 1_000 ? "good" : "warn";
}

function toneForError(mae: number): "good" | "warn" | "bad" {
  if (mae <= 1_200) return "good";
  if (mae <= 2_200) return "warn";
  return "bad";
}

function toneForCoverage(coverage: number): "good" | "warn" | "bad" {
  if (coverage >= 100) return "good";
  if (coverage >= 90) return "warn";
  return "bad";
}

export function DecisionRoom() {
  const {
    meta,
    dates,
    loading: indexLoading,
    error: indexError,
    retry: retryIndex,
  } = useSnapshotIndex();
  const [selected, setSelected] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setSelected((current) =>
      dates.some((row) => row.date === current)
        ? current
        : (dates.at(-1)?.date ?? ""),
    );
  }, [dates]);

  useEffect(() => {
    if (!selected) {
      setDecision(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setDecision(null);
    setLoading(true);
    setError(null);
    fetchDecision(selected, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setDecision(data);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason, "Could not load this decision."));
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [selected, reloadKey]);

  const chartRows = useMemo<ChartRow[]>(() => {
    if (!decision) return [];
    return decision.periods.map((period) => ({
      label: periodLabel(period.start_time),
      forecast: period.forecast_mw,
      actual: period.actual_mw,
      error: period.error_mw,
      band:
        period.lower_mw !== null && period.upper_mw !== null
          ? [period.lower_mw, period.upper_mw]
          : null,
      shortfallBuffer: period.shortfall_buffer_mw,
      leadTime: period.lead_time_hours,
    }));
  }, [decision]);

  const errorRows = useMemo(
    () =>
      chartRows.filter(
        (row): row is ChartRow & { error: number } => row.error !== null,
      ),
    [chartRows],
  );

  const worstRows = useMemo(() => {
    if (!decision) return [];
    return [...decision.periods]
      .filter((period) => period.abs_error_mw !== null)
      .sort((a, b) => (b.abs_error_mw ?? 0) - (a.abs_error_mw ?? 0))
      .slice(0, 8);
  }, [decision]);

  const summary = decision?.summary;
  const coverage = summary?.coverage_pct ?? 0;
  const widestBuffer = decision
    ? Math.max(
        0,
        ...decision.periods.map((period) => period.shortfall_buffer_mw ?? 0),
      )
    : 0;
  const overForecast = (summary?.bias_mw ?? 0) >= 0;

  const worstColumns: Column<Period>[] = [
    {
      header: "Half-hour",
      render: (row) => (
        <span className="mono">{periodLabel(row.start_time)}</span>
      ),
    },
    {
      header: "Forecast",
      align: "right",
      className: "hide-sm",
      render: (row) => mw(row.forecast_mw),
    },
    {
      header: "Actual",
      align: "right",
      render: (row) => mw(row.actual_mw),
    },
    {
      header: "Error",
      align: "right",
      render: (row) => (
        <span
          className={
            row.error_mw === null
              ? "muted"
              : row.error_mw > 0
                ? "num--pos"
                : "num--neg"
          }
        >
          {signedMw(row.error_mw)}
        </span>
      ),
    },
    {
      header: "Lead",
      align: "right",
      className: "hide-sm",
      render: (row) =>
        row.lead_time_hours === null ? "—" : `${row.lead_time_hours.toFixed(1)} h`,
    },
  ];

  const dateOptions = dates.map((row) => ({
    value: row.date,
    label: `${dateLabel(row.date)}, ${row.actual_rows}/48 actuals`,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Decision room"
        title={decision ? longDate(decision.date) : "Day-ahead wind decision"}
        subtitle="The picture a trading or operations desk would have seen at gate closure: the latest pre-gate wind forecast, how the day actually landed, and where the shortfall risk sat."
        actions={
          <DateField
            id="decision-date"
            label="Delivery day"
            value={selected}
            options={dateOptions}
            onChange={setSelected}
            disabled={dateOptions.length === 0}
          />
        }
      />

      {indexError ? (
        <ErrorNotice message={indexError} onRetry={retryIndex} />
      ) : null}

      {error ? (
        <ErrorNotice
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      ) : null}

      {!decision &&
      !error &&
      !indexError &&
      (indexLoading || loading) ? (
        <>
          <div className="kpi-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="kpi" key={index}>
                <LoadingBlock lines={2} />
              </div>
            ))}
          </div>
          <SectionCard title="Loading the decision">
            <LoadingBlock lines={8} />
          </SectionCard>
        </>
      ) : null}

      {!decision &&
      !error &&
      !indexError &&
      !indexLoading &&
      !loading &&
      dates.length === 0 ? (
        <EmptyState
          title="No delivery dates in the snapshot"
          message="The cache is empty or incomplete. Rebuild the Elexon snapshot, then reload this page."
        />
      ) : null}

      {decision && summary && summary.n > 0 ? (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Forecast energy"
              value={gwh(summary.forecast_energy_gwh)}
              hint={`${summary.n} hourly decision points`}
              icon={<Wind size={16} />}
            />
            <KpiCard
              label="Actual energy"
              value={gwh(summary.actual_energy_gwh)}
              hint="Elexon FUELHH half-hours"
              icon={<Activity size={16} />}
            />
            <KpiCard
              label="Forecast bias"
              value={signedMw(summary.bias_mw)}
              hint={overForecast ? "Over-forecast on average" : "Under-forecast on average"}
              tone={toneForBias(summary.bias_mw)}
              icon={<Gauge size={16} />}
            />
            <KpiCard
              label="Mean absolute error"
              value={mw(summary.mae_mw)}
              hint={`${pct(summary.nmae_pct)} of mean actual`}
              tone={toneForError(summary.mae_mw)}
              icon={<Target size={16} />}
            />
            <KpiCard
              label="Within ±1 GW"
              value={pct(summary.within_1gw_pct)}
              hint="Share of hourly points"
              tone={summary.within_1gw_pct >= 50 ? "good" : "warn"}
              icon={<ShieldAlert size={16} />}
            />
            <KpiCard
              label="Data coverage"
              value={pct(coverage)}
              hint={`${decision.data_quality.actual_periods}/48 actuals · ${decision.data_quality.forecast_hours} forecast hours`}
              tone={toneForCoverage(coverage)}
              icon={<CalendarDays size={16} />}
            />
          </div>

          <div className="grid-2">
            <SectionCard
              eyebrow="Delivery day"
              title="Actual vs pre-gate forecast"
              description="Half-hourly actuals against the latest WINDFOR vintage published before 11:00 UK time on D-1. The shaded band is the empirical P10–P90 error range for the forecast level."
              actions={
                <Badge tone={overForecast ? "warn" : "info"} dot>
                  {overForecast ? "Over-forecast" : "Under-forecast"}
                </Badge>
              }
            >
              <div
                className="chart chart--main"
                role="img"
                aria-label="Half-hourly actual wind generation against the pre-gate forecast, with a P10 to P90 uncertainty band."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartRows}
                    margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={28} {...axisProps} />
                    <YAxis
                      domain={[0, "auto"]}
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      labelFormatter={(label) => `${label} UTC`}
                      formatter={(value, name) => {
                        const numeric = Array.isArray(value) ? null : Number(value);
                        return [
                          numeric === null || Number.isNaN(numeric)
                            ? "—"
                            : mw(numeric),
                          String(name),
                        ];
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={tooltipWrapperStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="band"
                      name="P10–P90 band"
                      stroke="none"
                      fill={COLORS.band}
                      fillOpacity={0.12}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke={COLORS.actual}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast at gate"
                      stroke={COLORS.forecast}
                      strokeWidth={2.2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-note">
                Forecast values repeat across the two half-hours of each hour
                because WINDFOR is hourly. The summary metrics use the 24 hourly
                decision points; the chart shows the 48 settlement periods.
              </p>
            </SectionCard>

            <SectionCard
              eyebrow="At the cut-off"
              title="Decision brief"
              description="What was knowable before the day-ahead gate closed."
            >
              <div className="brief">
                <div className="brief__row">
                  <span className="brief__label">Gate closure</span>
                  <span className="brief__value">
                    {dateTime(decision.gate_closure)}
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Vintage used</span>
                  <span className="brief__value">
                    {dateTime(decision.vintage.publish_time)}
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Lead time</span>
                  <span className="brief__value">
                    {decision.vintage.lead_time_min_hours !== null &&
                    decision.vintage.lead_time_max_hours !== null
                      ? `${decision.vintage.lead_time_min_hours.toFixed(1)}–${decision.vintage.lead_time_max_hours.toFixed(1)} h`
                      : "—"}
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Forecast hours</span>
                  <span className="brief__value">
                    {decision.data_quality.forecast_hours}/24
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Actual periods</span>
                  <span className="brief__value">
                    {decision.data_quality.actual_periods}/48
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Widest half-hour buffer</span>
                  <span className="brief__value">{mw(widestBuffer)}</span>
                </div>
              </div>

              <div className={`callout${overForecast ? "" : " callout--info"}`}>
                <strong>{overForecast ? "Reserve watch." : "Surplus watch."}</strong>{" "}
                {overForecast
                  ? `The forecast ran ${gw(summary.bias_mw)} above actual on average. The P90 shortfall buffer for the day was ${mw(summary.p90_shortfall_mw)}; that is the reserve this forecast would have justified.`
                  : `The forecast ran ${gw(Math.abs(summary.bias_mw))} below actual on average. The desk would have been long relative to the wind outturn; the P90 shortfall buffer was ${mw(summary.p90_shortfall_mw)}.`}
              </div>
              <div className="callout callout--info">
                <strong>Why this matters.</strong> Wind shortfalls have to be
                covered closer to delivery, often at a worse price. The buffer
                turns an error distribution into a reserve number a desk can
                argue about.
              </div>
            </SectionCard>
          </div>

          <div className="grid-2--even grid-2">
            <SectionCard
              title="Half-hour error"
              description="Forecast minus actual. Positive values are over-forecasts; negative values are shortfalls."
              actions={
                <Badge tone="neutral">
                  <Clock3 size={12} /> UTC
                </Badge>
              }
            >
              <div
                className="chart chart--small"
                role="img"
                aria-label="Half-hourly forecast error; positive bars are over-forecasts and negative bars are shortfalls."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={errorRows}
                    margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={28} {...axisProps} />
                    <YAxis
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      labelFormatter={(label) => `${label} UTC`}
                      formatter={(value) => {
                        const numeric = Number(value);
                        return [
                          Number.isNaN(numeric) ? "—" : signedMw(numeric),
                          "Forecast error",
                        ];
                      }}
                    />
                    <ReferenceLine y={0} {...referenceLineStyle} />
                    <Bar dataKey="error" name="Forecast error" isAnimationActive={false}>
                      {errorRows.map((row) => (
                        <Cell
                          key={row.label}
                          fill={row.error >= 0 ? COLORS.error : COLORS.surplus}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard
              title="Largest misses"
              description="The half-hours that would have hurt the most operationally."
            >
              <DataTable
                columns={worstColumns}
                rows={worstRows}
                rowKey={(row) => row.start_time}
                empty="No matched forecast and actual periods for this day."
              />
            </SectionCard>
          </div>

          <SectionCard
            eyebrow="Method"
            title="How to read this view"
            description="The guardrails behind the numbers."
          >
            <div className="stack">
              {decision.notes.map((note) => (
                <div className="callout callout--info" key={note}>
                  {note}
                </div>
              ))}
              <p className="chart-note">
                Latest published vintage used in this view:{" "}
                {clockTime(decision.latest_publish_time)}. Forecast window:
                {" "}
                {decision.data_quality.forecast_hours} hourly values. Actuals:
                {" "}
                {decision.data_quality.actual_periods} half-hour values.
              </p>
            </div>
          </SectionCard>
        </>
      ) : null}

      {decision && summary && summary.n === 0 ? (
        <EmptyState
          title="No decision data for this day"
          message="The cached snapshot does not have a matched forecast and actual for this date yet."
        />
      ) : null}

      <p className="page-footer">
        Snapshot built from Elexon BMRS.
        {decision ? ` ${dateLabel(decision.date)}.` : ""}
        {meta?.last_ingest?.finished_at
          ? ` Cache refreshed ${dateTime(meta.last_ingest.finished_at)}.`
          : ""}{" "}
        Data source: FUELHH (actuals) and WINDFOR (forecasts).
      </p>
    </>
  );
}
