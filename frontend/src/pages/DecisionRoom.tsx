import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  ShieldAlert,
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
  purchaseDate,
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
  const [showOutturn, setShowOutturn] = useState(false);
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
  const historyMetrics = decision?.history.metrics;

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
    label: dateLabel(purchaseDate(row.date)),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Decision room"
        title={decision ? `Wind for ${dateLabel(decision.date)}` : "Plan tomorrow’s wind supply"}
        subtitle={decision ? `Buying on ${longDate(decision.purchase_date)}. Forecasts published by 09:50 UK time, for delivery the following day.` : "Choose a January buying day to see tomorrow’s wind forecast and the earlier errors available at the cut-off."}
        actions={
          <DateField
            id="decision-date"
            label="Buying day · January 2026"
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

      {decision && summary && decision.forecast_summary.hours > 0 ? (
        <>
          <div className="kpi-grid">
            <KpiCard label="Forecast wind energy" value={gwh(decision.forecast_summary.energy_gwh)}
              hint={`${decision.forecast_summary.hours}/24 delivery hours · national total`} icon={<Wind size={16} />} />
            <KpiCard label="Average forecast output" value={gw(decision.forecast_summary.mean_mw)}
              hint="Expected power across available hours" />
            <KpiCard label="Earlier typical miss" value={mw(historyMetrics?.mae_mw)}
              hint={historyMetrics ? `MAE across ${decision.history.points} earlier hours` : "Not enough earlier data"} />
            <KpiCard label="Earlier P90 shortfall" value={mw(historyMetrics?.p90_shortfall_mw)}
              hint="90th percentile of max(forecast − actual, 0)" icon={<ShieldAlert size={16} />} />
          </div>
          <div className="callout callout--info mb-18">
            <strong>Use this in your buying plan.</strong> Less wind means more supply to cover elsewhere.
            Compare the hourly forecast below with your own demand and contracted supply.
            These are national wind figures, not your utility’s allocation; this pilot cannot calculate your purchase volume.
          </div>

          <div className="grid-2">
            <SectionCard
              eyebrow="Delivery day"
              title="Tomorrow’s wind, as known at the cut-off"
              description="The latest available forecast for each hour. The shaded range uses only earlier errors published by this buying cut-off."
              actions={<Badge tone="info">N2EX · 09:50 UK</Badge>}
            >
              <div
                className="chart chart--main"
                role="img"
                aria-label="Wind forecast available at the buying cut-off, with an earlier-data P10 to P90 range when enough history exists."
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
                          Array.isArray(value) ? `${mw(Number(value[0]))}–${mw(Number(value[1]))}` : numeric === null || Number.isNaN(numeric) ? "—" : mw(numeric),
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
                    {showOutturn ? <Line
                      type="linear"
                      dataKey="actual"
                      name="Actual · known later"
                      stroke={COLORS.actual}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    : null}
                    <Line
                      type="stepAfter"
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
              <label className="outturn-toggle">
                <input type="checkbox" checked={showOutturn} onChange={(event) => setShowOutturn(event.target.checked)} />
                Show actual results · known after the buying decision
              </label>
              <p className="chart-note">
                Forecast values repeat across the two half-hours of each hour
                because WINDFOR is hourly. The summary metrics use the 24 hourly
                decision points; the chart shows the 48 settlement periods.
              </p>
            </SectionCard>

            <SectionCard
              eyebrow="At the cut-off"
              title="Before you buy"
              description="Forecast timing and the evidence available for this buying day."
            >
              <div className="brief">
                <div className="brief__row">
                  <span className="brief__label">Gate closure</span>
                  <span className="brief__value">
                    {dateTime(decision.gate_closure)}
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Newest selected release</span>
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
                  <span className="brief__label">Earlier error observations</span>
                  <span className="brief__value">
                    {decision.history.points} hourly pairs
                  </span>
                </div>
                <div className="brief__row">
                  <span className="brief__label">Largest historical buffer</span>
                  <span className="brief__value">{decision.history.ready ? mw(widestBuffer) : "Not enough history"}</span>
                </div>
              </div>

              <div className="callout callout--info">
                {decision.history.ready ? <>
                  <strong>Earlier evidence.</strong> The range uses {decision.history.points} hourly errors
                  from {dateLabel(decision.history.from!)} to {dateLabel(decision.history.to!)} that were published by this cut-off.
                  Positive errors mean actual wind fell below forecast, leaving a supply shortfall to cover.
                </> : <>
                  <strong>Not enough earlier evidence.</strong> Only {decision.history.points} earlier hourly errors
                  are available in this snapshot; at least {decision.history.minimum_points} are needed.
                  We show the forecast without inventing an uncertainty range.
                </>}
              </div>
              <p className="chart-note">A historical range is a starting point for reviewing exposure, not a guaranteed reserve requirement. Actual results below are hindsight.</p>
            </SectionCard>
          </div>

          <SectionCard title="Hourly forecast detail" description="Every delivery hour, its publication time, and a lower-wind scenario from earlier errors." className="mb-18">
            <details>
              <summary>View all 24 delivery hours</summary>
              <DataTable<Period> rows={decision.periods.filter((_, index) => index % 2 === 0)}
                rowKey={(row) => row.start_time}
                columns={[
                  { header: "Hour · UTC", render: (row) => periodLabel(row.start_time) },
                  { header: "Forecast", align: "right", render: (row) => mw(row.forecast_mw) },
                  { header: "Lower wind", align: "right", render: (row) => mw(row.lower_mw) },
                  { header: "Published", render: (row) => dateTime(row.forecast_publish_time) },
                ]} />
            </details>
          </SectionCard>

          {showOutturn ? <>
          <SectionCard title="After delivery: how the forecast performed" description="These results were not available at the buying cut-off." className="mb-18">
            <div className="stat-inline">
              <div><div className="small-label">Actual energy · matched hours</div><strong>{summary.n ? gwh(summary.actual_energy_gwh) : "—"}</strong></div>
              <div><div className="small-label">Typical miss · MAE</div><strong>{summary.n ? mw(summary.mae_mw) : "—"}</strong></div>
              <div><div className="small-label">Average error · bias</div><strong>{summary.n ? signedMw(summary.bias_mw) : "—"}</strong></div>
              <div><div className="small-label">Matched data coverage</div><Badge tone={toneForCoverage(coverage)}>{pct(coverage)}</Badge></div>
            </div>
          </SectionCard>
          <div className="grid-2--even grid-2">
            <SectionCard
              title="Half-hour error"
              description="Forecast minus actual. Positive: wind shortfall. Negative: more wind than forecast."
              actions={
                <Badge tone="neutral">
                  <Clock3 size={12} /> UTC
                </Badge>
              }
            >
              <div
                className="chart chart--small"
                role="img"
                aria-label="Half-hourly forecast error; positive bars indicate wind shortfalls and negative bars indicate more wind than forecast."
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
              description="Largest differences after delivery, ranked by absolute error."
            >
              <DataTable
                columns={worstColumns}
                rows={worstRows}
                rowKey={(row) => row.start_time}
                empty="No matched forecast and actual periods for this day."
              />
            </SectionCard>
          </div>

          </> : null}

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

      {decision && decision.forecast_summary.hours === 0 ? (
        <EmptyState
          title="No pre-cut-off forecast for this day"
          message="Choose another buying day. Missing forecast values are never shown as zero."
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
