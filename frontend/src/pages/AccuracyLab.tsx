import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarRange,
  Crosshair,
  Gauge,
  Percent,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchAccuracy, fetchDates, fetchMeta } from "../api";
import { axisProps, COLORS, gridProps, tooltipStyle } from "../chartTheme";
import { DataTable, type Column } from "../components/DataTable";
import { DateField } from "../components/DateField";
import { KpiCard } from "../components/KpiCard";
import { SectionCard } from "../components/SectionCard";
import { EmptyState, ErrorNotice, LoadingBlock } from "../components/States";
import {
  dateLabel,
  dateTime,
  gwh,
  gw,
  gwTick,
  mw,
  pct,
  periodLabel,
  rangeLabel,
  signedMw,
} from "../format";
import type {
  Accuracy,
  DateCoverage,
  LeadRow,
  LevelRow,
  Meta,
  WorstRow,
} from "../types";

function toneForMae(mae: number): "good" | "warn" | "bad" {
  if (mae <= 1_200) return "good";
  if (mae <= 2_200) return "warn";
  return "bad";
}

function toneForNmae(nmae: number): "good" | "warn" | "bad" {
  if (nmae <= 15) return "good";
  if (nmae <= 25) return "warn";
  return "bad";
}

function toneForShare(share: number): "good" | "warn" | "bad" {
  if (share >= 60) return "good";
  if (share >= 35) return "warn";
  return "bad";
}

function shortBin(label: string): string {
  return label.replace(" to ", "…").replace(" GW", "");
}

export function AccuracyLab() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dates, setDates] = useState<DateCoverage[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchMeta(controller.signal), fetchDates(controller.signal)])
      .then(([metaData, dateRows]) => {
        if (controller.signal.aborted) return;
        setMeta(metaData);
        setDates(dateRows);
        setIndexError(null);
        setIndexLoading(false);
        setLoading(dateRows.length > 0);
        const first = dateRows[0]?.date ?? "";
        const last = dateRows.at(-1)?.date ?? "";
        setFrom((current) =>
          dateRows.some((row) => row.date === current) ? current : first,
        );
        setTo((current) =>
          dateRows.some((row) => row.date === current) ? current : last,
        );
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setIndexLoading(false);
        setIndexError(
          reason instanceof Error ? reason.message : "Could not load the data index.",
        );
      });
    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!from || !to) {
      setAccuracy(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (from > to) {
      setAccuracy(null);
      setLoading(false);
      setError("The start date must be on or before the end date.");
      setErrorRetryable(false);
      return;
    }
    const controller = new AbortController();
    setAccuracy(null);
    setLoading(true);
    setError(null);
    fetchAccuracy(from, to, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setAccuracy(data);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error ? reason.message : "Could not load accuracy data.",
        );
        setErrorRetryable(true);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [from, to, reloadKey]);

  const summary = accuracy?.summary;
  const maxAxis = useMemo(
    () =>
      Math.max(5_000, Math.ceil((accuracy?.max_axis_mw ?? 10_000) / 5_000) * 5_000),
    [accuracy],
  );

  const distributionRows = useMemo(
    () =>
      (accuracy?.distribution ?? []).map((bin) => ({
        ...bin,
        shortLabel: shortBin(bin.label),
      })),
    [accuracy],
  );

  const worstColumns: Column<WorstRow>[] = [
    {
      header: "Date",
      render: (row) => dateLabel(row.date),
    },
    {
      header: "Hour",
      render: (row) => <span className="mono">{periodLabel(row.start_time)}</span>,
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
      className: "hide-xs",
      render: (row) => mw(row.actual_mw),
    },
    {
      header: "Error",
      align: "right",
      render: (row) => (
        <span className={row.error_mw > 0 ? "num--pos" : "num--neg"}>
          {signedMw(row.error_mw)}
        </span>
      ),
    },
    {
      header: "Lead",
      align: "right",
      className: "hide-sm",
      render: (row) => `${row.lead_time_hours.toFixed(1)} h`,
    },
  ];

  const levelColumns: Column<LevelRow>[] = [
    { header: "Forecast level", render: (row) => row.level },
    {
      header: "Points",
      align: "right",
      className: "hide-sm",
      render: (row) => row.n,
    },
    {
      header: "MAE",
      align: "right",
      render: (row) => mw(row.mae_mw),
    },
    {
      header: "Bias",
      align: "right",
      className: "hide-xs",
      render: (row) => (
        <span className={row.bias_mw >= 0 ? "num--pos" : "num--neg"}>
          {signedMw(row.bias_mw)}
        </span>
      ),
    },
    {
      header: "nMAE",
      align: "right",
      className: "hide-sm",
      render: (row) => pct(row.nmae_pct),
    },
    {
      header: "Within ±1 GW",
      align: "right",
      className: "hide-sm",
      render: (row) => pct(row.within_1gw_pct),
    },
  ];

  const leadColumns: Column<LeadRow>[] = [
    { header: "Horizon", render: (row) => row.lead_time },
    {
      header: "Vintage points",
      align: "right",
      className: "hide-sm",
      render: (row) => row.n,
    },
    {
      header: "MAE",
      align: "right",
      render: (row) => mw(row.mae_mw),
    },
    {
      header: "Bias",
      align: "right",
      render: (row) => (
        <span className={row.bias_mw >= 0 ? "num--pos" : "num--neg"}>
          {signedMw(row.bias_mw)}
        </span>
      ),
    },
    {
      header: "nMAE",
      align: "right",
      className: "hide-xs",
      render: (row) => pct(row.nmae_pct),
    },
  ];

  const dateOptions = dates.map((row) => ({
    value: row.date,
    label: dateLabel(row.date),
  }));

  const firstDate = dates[0]?.date ?? "";
  const lastDate = dates.at(-1)?.date ?? "";
  const quickRanges = dates.length
    ? [
        { label: "Full month", start: firstDate, end: lastDate },
        {
          label: "First 7 days",
          start: firstDate,
          end: dates[Math.min(6, dates.length - 1)].date,
        },
        {
          label: "Last 7 days",
          start: dates[Math.max(0, dates.length - 7)].date,
          end: lastDate,
        },
      ]
    : [];

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Accuracy lab</div>
          <h1>Where the forecast earns its keep</h1>
          <p className="page-subtitle">
            A month-long review of the pre-gate wind forecast. The headline is
            not one error number; it is how the error changes with time of day,
            forecast level, and lead time.
          </p>
        </div>
        <div className="page-actions">
          <DateField
            id="accuracy-from"
            label="From"
            value={from}
            options={dateOptions}
            onChange={setFrom}
            disabled={dateOptions.length === 0}
          />
          <DateField
            id="accuracy-to"
            label="To"
            value={to}
            options={dateOptions}
            onChange={setTo}
            disabled={dateOptions.length === 0}
          />
        </div>
      </header>

      {quickRanges.length ? (
        <div className="range-buttons" style={{ marginBottom: 18 }}>
          {quickRanges.map((range) => {
            const active = from === range.start && to === range.end;
            return (
              <button
                key={range.label}
                type="button"
                className={`button${active ? " button--active" : " button--ghost"}`}
                onClick={() => {
                  setFrom(range.start);
                  setTo(range.end);
                }}
              >
                <CalendarRange size={14} />
                {range.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {indexError ? (
        <ErrorNotice
          message={indexError}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      ) : null}

      {error ? (
        <ErrorNotice
          message={error}
          onRetry={
            errorRetryable ? () => setReloadKey((key) => key + 1) : undefined
          }
        />
      ) : null}

      {!accuracy &&
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
          <SectionCard title="Loading accuracy data">
            <LoadingBlock lines={8} />
          </SectionCard>
        </>
      ) : null}

      {!accuracy &&
      !error &&
      !indexError &&
      !indexLoading &&
      !loading &&
      dates.length === 0 ? (
        <EmptyState
          title="No cached Elexon data"
          message="Rebuild the Elexon snapshot, then reload this page to review accuracy."
        />
      ) : null}

      {accuracy && summary && summary.n > 0 ? (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Mean absolute error"
              value={mw(summary.mae_mw)}
              hint={`${pct(summary.nmae_pct)} of mean actual`}
              tone={toneForMae(summary.mae_mw)}
              icon={<Target size={16} />}
            />
            <KpiCard
              label="RMSE"
              value={mw(summary.rmse_mw)}
              hint="Penalises large misses"
              tone={toneForMae(summary.rmse_mw)}
              icon={<Activity size={16} />}
            />
            <KpiCard
              label="Bias"
              value={signedMw(summary.bias_mw)}
              hint={
                summary.bias_mw >= 0
                  ? "Forecast above actual"
                  : "Forecast below actual"
              }
              tone={Math.abs(summary.bias_mw) <= 1_000 ? "good" : "warn"}
              icon={<Gauge size={16} />}
            />
            <KpiCard
              label="nMAE"
              value={pct(summary.nmae_pct)}
              hint="MAE ÷ mean actual"
              tone={toneForNmae(summary.nmae_pct)}
              icon={<Percent size={16} />}
            />
            <KpiCard
              label="Within ±1 GW"
              value={pct(summary.within_1gw_pct)}
              hint={`${summary.n} hourly points`}
              tone={toneForShare(summary.within_1gw_pct)}
              icon={<Crosshair size={16} />}
            />
            <KpiCard
              label="Coverage"
              value={pct(summary.coverage_pct)}
              hint={`${summary.decision_points} decision points · ${summary.vintage_points.toLocaleString("en-GB")} vintage rows`}
              tone={summary.coverage_pct >= 99 ? "good" : "warn"}
              icon={<BarChart3 size={16} />}
            />
          </div>

          <div className="grid-2">
            <SectionCard
              eyebrow={rangeLabel(accuracy.range.from, accuracy.range.to)}
              title="Daily error and bias"
              description="Mean absolute error by delivery day, with the signed bias overlaid. A positive bias is an over-forecast."
            >
              <div
                className="chart chart--medium"
                role="img"
                aria-label="Daily mean absolute error bars with signed forecast bias over the selected range."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={accuracy.daily}
                    margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => dateLabel(value)}
                      interval="preserveStartEnd"
                      minTickGap={34}
                      {...axisProps}
                    />
                    <YAxis
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelFormatter={(label) => dateLabel(String(label))}
                      formatter={(value, name) => {
                        const numeric = Number(value);
                        return [
                          Number.isNaN(numeric) ? "—" : mw(numeric),
                          String(name),
                        ];
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                    <Bar
                      dataKey="mae_mw"
                      name="MAE"
                      fill={COLORS.band}
                      fillOpacity={0.7}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="bias_mw"
                      name="Bias"
                      stroke={COLORS.forecast}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard
              title="Forecast vs actual"
              description="Each dot is an hourly decision point. The diagonal is perfect foresight."
            >
              <div
                className="chart chart--medium"
                role="img"
                aria-label="Scatter plot of hourly forecast wind against actual wind, with a diagonal perfect-foresight reference line."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis
                      type="number"
                      dataKey="actual_mw"
                      name="Actual"
                      domain={[0, maxAxis]}
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <YAxis
                      type="number"
                      dataKey="forecast_mw"
                      name="Forecast"
                      domain={[0, maxAxis]}
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "#e2e8f0" }}
                      formatter={(value, name) => {
                        const numeric = Number(value);
                        return [
                          Number.isNaN(numeric) ? "—" : mw(numeric),
                          String(name),
                        ];
                      }}
                    />
                    <ReferenceLine
                      segment={[
                        { x: 0, y: 0 },
                        { x: maxAxis, y: maxAxis },
                      ]}
                      stroke={COLORS.axis}
                      strokeDasharray="4 4"
                    />
                    <Scatter
                      name="Hourly point"
                      data={accuracy.scatter}
                      fill={COLORS.band}
                      fillOpacity={0.55}
                      isAnimationActive={false}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <div className="grid-2 grid-2--even">
            <SectionCard
              title="Error distribution"
              description="How often the forecast missed by each width, and in which direction."
            >
              <div
                className="chart chart--small"
                role="img"
                aria-label="Histogram of signed hourly forecast errors, split into negative shortfall bins and positive over-forecast bins."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distributionRows}
                    margin={{ top: 8, right: 10, bottom: 18, left: 20 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis
                      dataKey="shortLabel"
                      interval="preserveStartEnd"
                      minTickGap={18}
                      tick={{ fill: COLORS.axis, fontSize: 9.5 }}
                      tickLine={false}
                      axisLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      allowDecimals={false}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelFormatter={(label) => `${label} GW`}
                      formatter={(value) => [
                        `${Number(value)} points`,
                        "Frequency",
                      ]}
                    />
                    <Bar dataKey="count" name="Frequency" isAnimationActive={false}>
                      {distributionRows.map((row) => (
                        <Cell
                          key={row.bin_start_mw}
                          fill={
                            row.bin_start_mw < 0 ? COLORS.surplus : COLORS.error
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-note">
                Negative bins are under-forecasts; positive bins are
                over-forecasts. January skews heavily to the right, which is the
                month&apos;s dominant bias.
              </p>
            </SectionCard>

            <SectionCard
              title="Error by hour of day"
              description="Mean absolute error for each delivery hour across the selected range."
            >
              <div
                className="chart chart--small"
                role="img"
                aria-label="Bar chart of mean absolute forecast error by delivery hour of day."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={accuracy.by_hour}
                    margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={26} {...axisProps} />
                    <YAxis
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelFormatter={(label) => `${label} UTC`}
                      formatter={(value) => [
                        mw(Number(value)),
                        "Mean absolute error",
                      ]}
                    />
                    <Bar
                      dataKey="mae_mw"
                      name="MAE"
                      fill={COLORS.forecast}
                      fillOpacity={0.75}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <div className="grid-2 grid-2--even">
            <SectionCard
              title="Accuracy by lead time"
              description="Every stored vintage, bucketed by how far ahead the delivery hour was. This is the model's horizon curve."
            >
              <div
                className="chart chart--small"
                role="img"
                aria-label="Bar chart of mean absolute error and line of bias across forecast lead-time buckets."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={accuracy.by_lead_time}
                    margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="lead_time" {...axisProps} />
                    <YAxis
                      tickFormatter={(value: number) => gwTick(value)}
                      {...axisProps}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      formatter={(value, name) => {
                        const numeric = Number(value);
                        return [
                          Number.isNaN(numeric) ? "—" : mw(numeric),
                          String(name),
                        ];
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                    />
                    <Bar
                      dataKey="mae_mw"
                      name="MAE"
                      fill={COLORS.band}
                      fillOpacity={0.65}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="bias_mw"
                      name="Bias"
                      stroke={COLORS.forecast}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard
              title="Accuracy by forecast level"
              description="Aggregate accuracy splits by the size of the forecast, not by the hour."
            >
              <DataTable
                columns={levelColumns}
                rows={accuracy.by_level}
                rowKey={(row) => row.level}
                empty="No level buckets for this range."
              />
            </SectionCard>
          </div>

          <SectionCard
            eyebrow="Horizon detail"
            title="Lead-time table"
            description="The same horizon curve in numbers, including the count of vintage points in each bucket."
            className="mb-18"
          >
            <DataTable
              columns={leadColumns}
              rows={accuracy.by_lead_time}
              rowKey={(row) => row.lead_time}
              empty="No lead-time buckets for this range."
            />
          </SectionCard>

          <SectionCard
            eyebrow="Outliers"
            title="Largest misses in the range"
            description="Sorted by absolute hourly error. Useful for asking whether the misses cluster around a weather regime or an hour."
          >
            <DataTable
              columns={worstColumns}
              rows={accuracy.worst}
              rowKey={(row) => row.start_time}
              empty="No matched hourly points for this range."
            />
          </SectionCard>

          <SectionCard
            eyebrow="Method"
            title="Reading the accuracy lab"
            description="Summary and distribution use the gate-time vintage. The horizon view uses every stored vintage."
          >
            <div className="stack">
              {accuracy.notes.map((note) => (
                <div className="callout callout--info" key={note}>
                  {note}
                </div>
              ))}
              <div className="stat-inline">
                <div>
                  <div className="small-label">Forecast energy</div>
                  <strong>{gwh(summary.forecast_energy_gwh)}</strong>
                </div>
                <div>
                  <div className="small-label">Actual energy</div>
                  <strong>{gwh(summary.actual_energy_gwh)}</strong>
                </div>
                <div>
                  <div className="small-label">Mean forecast</div>
                  <strong>{gw(summary.mean_forecast_mw)}</strong>
                </div>
                <div>
                  <div className="small-label">Mean actual</div>
                  <strong>{gw(summary.mean_actual_mw)}</strong>
                </div>
                <div>
                  <div className="small-label">P90 abs error</div>
                  <strong>{mw(summary.p90_abs_error_mw)}</strong>
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}

      {accuracy && summary && summary.n === 0 ? (
        <EmptyState
          title="No accuracy data in this range"
          message="Try a wider date range, or rebuild the Elexon snapshot."
        />
      ) : null}

      <p className="page-footer">
        {accuracy
          ? `${rangeLabel(accuracy.range.from, accuracy.range.to)} · ${summary?.n ?? 0} hourly decision points.`
          : "Accuracy lab."}
        {meta?.last_ingest?.finished_at
          ? ` Cache refreshed ${dateTime(meta.last_ingest.finished_at)}.`
          : ""}{" "}
        Elexon FUELHH and WINDFOR.
        {summary?.vintage_points
          ? ` ${summary.vintage_points.toLocaleString("en-GB")} vintage rows analysed.`
          : ""}
      </p>
    </>
  );
}
