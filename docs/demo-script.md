> Historical script for the previous version. The cutoff, dates, UI and statistics have changed. Use the current app and README when preparing the author’s final video.

# Demo video script (10 minutes max)

Target length: **9:30**. Hard cap: 10:00. The assignment asks for roughly five
minutes of client pitch and five minutes of technical review.

## Before recording

- [ ] Deploy the app and open it in an incognito window.
- [ ] Run `BASE_URL=https://<app> ./scripts/smoke.sh` once.
- [ ] Use a 1080p or 1440p screen recording; hide bookmarks and personal tabs.
- [ ] Close notifications and any window with personal information.
- [ ] Pre-open the Decision Room, Accuracy Lab, and Methodology tabs.
- [ ] Have the Elexon source pages available but do not read the README on camera.

## Part 1: Client pitch (0:00–5:00)

### 0:00–0:40 — The problem

**Show:** Decision Room, default date (31 Jan 2026).

**Say:** “A day-ahead wind desk has to commit before it knows the wind. The
question is not just what the forecast says; it is what the forecast said at the
gate, and how much reserve its error history justifies. WindSight makes that
two-part question visible.”

### 0:40–1:50 — The decision view

**Show:** KPI strip, then the actual-vs-forecast chart.

**Say:** “This is the picture at 11:00 UK time on the day before delivery. The
amber line is the latest WINDFOR vintage published before the gate; the white
line is the outturn. On 31 January the desk would have seen an over-forecast
bias and a forecast energy number about 45 GWh above actual. The shaded band is
the empirical P10–P90 error range for that forecast level, not a confidence
interval from the model.”

**Point at:** forecast energy, actual energy, bias, MAE, within ±1 GW, coverage.

### 1:50–2:50 — The reserve call

**Show:** Decision brief and the two callouts; then Largest misses.

**Say:** “The product turns the error distribution into a reserve number: the
P90 shortfall buffer. It also surfaces the half-hours that hurt most. The point
is not to replace the trader; it is to give them a defensible starting point and
a fast way to challenge the forecast.”

### 2:50–4:10 — The accuracy story

**Show:** Accuracy Lab, full month.

**Say:** “The headline is a 2.1 GW MAE and an 18% nMAE, but the interesting
part is the shape. Bias is positive — the month over-forecast. Error is worse
at higher forecast levels, and the horizon curve shows how accuracy changes as
we move further from delivery. That is the evidence a desk needs before trusting
the next vintage.”

**Point at:** daily error/bias, scatter, distribution, by-hour, by-level,
lead-time table.

### 4:10–5:00 — The honest limits and the ask

**Show:** Methodology, “Known limitations”.

**Say:** “This is one month, national wind, with an assumed gate time and no
price data. It is deliberately a decision-support wedge, not a trading system.
With another iteration I would add actual auction times, price and system
margin, probabilistic calibration, and a scheduled vintage store. The value
today is that it makes the forecast’s error history usable at the moment of
decision.”

## Part 2: Technical review (5:00–9:30)

### 5:00–5:50 — Architecture in one breath

**Show:** `README.md` architecture diagram or the repository tree.

**Say:** “The React SPA and FastAPI API ship in one Docker image. FastAPI serves
the API and the built frontend. The API reads a committed SQLite snapshot; the
live Elexon API is only touched by the ingestion CLI. `analysis.py` is pure
domain logic: it takes records and returns views, with no HTTP or SQL. That is
the main test surface.”

### 5:50–6:50 — Data quirks and ingestion

**Show:** `backend/app/elexon.py` around `actual_wind` and `wind_forecasts`;
then `ingest.py`.

**Say:** “FUELHH ignores generic `from`/`to` and needs settlement dates.
WINDFOR returns a rolling horizon, so we filter delivery start times
client-side and keep only vintages at or before the gate. The snapshot has
1,488 actuals and 8,432 forecast rows. Ingestion is idempotent and writes an
ingest-run record.”

### 6:50–7:50 — Metric and uncertainty choices

**Show:** `backend/app/analysis.py` around `decision_points_for_day`,
`compute_metrics`, and `error_quantiles_by_level`.

**Say:** “Actuals are half-hourly and forecasts hourly, so metrics use the 24
hourly decision points, averaging the two half-hours. The band is a
leave-one-day-out P10/P90 by forecast level with a minimum sample and a global
fallback. It is empirical and explicitly not a calibrated probability.”

### 7:50–8:50 — Tests and deployment

**Show:** terminal `pytest -q`, then `docker build` output or the deployed URL.

**Say:** “Eighteen backend tests cover gate closure, vintage selection,
aggregation, known metric values, quantiles, store idempotence, the Elexon
filtering, snapshot date bounds, and every API endpoint including invalid input.
The frontend build is the typecheck. The Dockerfile is multi-stage and honours `$PORT`; Heroku and
Render can run it directly. The single-image trade-off is documented in the
ADR.”

### 8:50–9:30 — What I would do next

**Say:** “The next technical step is not more UI. It is a scheduled, versioned
snapshot store, actual auction gate times, a rolling backtest, and calibration.
The current build is intentionally small enough to explain end to end.”

## If you run short

- Cut the scatter and distribution detail; keep bias, MAE, and the horizon curve.
- Cut the architecture tree; keep the one-breath architecture and the two data
  quirks.
- Never cut the limitations section; it is part of the pitch.
