import { ExternalLink } from "lucide-react";

import { Badge } from "../components/Badge";
import { SectionCard } from "../components/SectionCard";

const facts = [
  { label: "Delivery days", value: "31" },
  { label: "Actual half-hours", value: "1,488" },
  { label: "Forecast rows", value: "8,432" },
  { label: "Hourly decisions", value: "744" },
];

export function Methodology() {
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Methodology</div>
          <h1>What this build does, and what it does not</h1>
          <p className="page-subtitle">
            A short, honest account of the data, the decision cut-off, the
            metric definitions, the uncertainty band, and the limits of a
            one-month pilot.
          </p>
        </div>
        <Badge tone="info" dot>
          January 2026 · national wind
        </Badge>
      </header>

      <div className="methodology stack">
        <SectionCard eyebrow="Snapshot" title="The January 2026 pilot">
          <div className="stat-inline">
            {facts.map((fact) => (
              <div key={fact.label}>
                <div className="small-label">{fact.label}</div>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
          <p className="chart-note">
            The app reads a cached SQLite snapshot built from Elexon BMRS. The
            live Elexon API is not called on every page load; ingestion is a
            separate, repeatable step.
          </p>
        </SectionCard>

        <SectionCard eyebrow="The decision" title="What the desk is deciding">
          <div className="prose">
            <p>
              A day-ahead wind desk has to commit to a position before the
              delivery day starts. The useful question is not “what will wind
              generation be?” in the abstract. It is “what did the latest
              forecast available at the cut-off say, and how much reserve does
              its error history justify?”
            </p>
            <p>
              WindSight separates those two questions. The Decision Room shows
              the forecast vintage that was actually available before the
              day-ahead gate closed. The Accuracy Lab shows how that vintage
              performed across the month.
            </p>
            <div className="callout callout--info">
              <strong>Gate closure assumption.</strong> The model uses 11:00 UK
              time on the day before delivery as the cut-off. In January this is
              11:00 GMT. A production build should read the actual auction
              calendar rather than hard-code the hour.
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Data" title="Elexon BMRS datasets">
          <div className="prose">
            <p>
              Both series are national wind. No regional breakdown, embedded
              generation, or other fuel types are included.
            </p>
            <ul>
              <li>
                <strong>Actuals:</strong>{" "}
                <code>FUELHH</code>, filtered to <code>fuelType=WIND</code>.
                Half-hourly settlement periods, generation in MW. The app uses
                the <code>settlementDateFrom</code> and{" "}
                <code>settlementDateTo</code> parameters.
              </li>
              <li>
                <strong>Forecasts:</strong> <code>WINDFOR</code>. Hourly
                delivery hours with a <code>publishTime</code> for each vintage.
                The app fetches a three-day publish window and filters delivery
                hours to the requested day, then keeps only vintages at or
                before gate closure.
              </li>
            </ul>
            <p>
              Source pages:{" "}
              <a
                href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH"
                target="_blank"
                rel="noreferrer"
              >
                FUELHH documentation <ExternalLink size={12} />
              </a>{" "}
              and{" "}
              <a
                href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR"
                target="_blank"
                rel="noreferrer"
              >
                WINDFOR documentation <ExternalLink size={12} />
              </a>
              . The API base is{" "}
              <code>https://data.elexon.co.uk/bmrs/api/v1</code>.
            </p>
            <p>
              A known quirk: <code>FUELHH</code> ignores generic{" "}
              <code>from</code>/<code>to</code> parameters and needs settlement
              dates. <code>WINDFOR</code> returns a rolling forecast horizon,
              so the app filters delivery start times client-side after using
              the publish-time filters.
            </p>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Resolution" title="Half-hours and hours">
          <div className="prose">
            <p>
              Actuals are half-hourly; forecasts are hourly. The decision view
              shows 48 half-hourly periods by repeating each hourly forecast
              across its two settlement periods. That is a display convenience,
              not a claim about within-hour accuracy.
            </p>
            <p>
              All summary metrics use the 24 hourly decision points. For each
              hour, the actual is the mean of its two half-hour readings. An
              incomplete pair is omitted rather than treated as a full-hour
              average, so a data gap shows up as lower coverage. This keeps the
              error calculation on the forecast&apos;s native resolution and
              avoids implying precision the data does not have.
            </p>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Metrics" title="Definitions used in the app">
          <div className="prose">
            <ul>
              <li>
                <strong>Error:</strong> forecast minus actual. Positive means
                the forecast over-predicted wind; negative means a shortfall.
              </li>
              <li>
                <strong>MAE:</strong> mean absolute error across hourly decision
                points, in MW.
              </li>
              <li>
                <strong>RMSE:</strong> root mean squared error. It penalises
                large misses more heavily than MAE.
              </li>
              <li>
                <strong>Bias:</strong> mean signed error. A positive bias is a
                persistent over-forecast.
              </li>
              <li>
                <strong>nMAE:</strong> MAE divided by mean actual generation,
                expressed as a percentage. It makes error comparable across
                days with different wind levels.
              </li>
              <li>
                <strong>P90 absolute error:</strong> the 90th percentile of
                absolute error. Nine in ten hourly misses are at or below this
                level.
              </li>
              <li>
                <strong>P90 shortfall:</strong> the 90th percentile of positive
                error only. This is the reserve a desk would use to cover wind
                coming in below forecast; it deliberately ignores the surplus
                side.
              </li>
              <li>
                <strong>Within ±1 GW:</strong> share of hourly points whose
                absolute error is 1,000 MW or less.
              </li>
              <li>
                <strong>Coverage:</strong> matched decision points divided by
                expected points (24 per delivery day).
              </li>
              <li>
                <strong>Energy:</strong> sum of hourly MW divided by 1,000,
                labelled GWh because the points are hourly.
              </li>
            </ul>
            <div className="callout">
              <strong>January was not a neutral test.</strong> The month shows a
              strong over-forecast bias. That is a property of this sample, not
              a general claim about WINDFOR.
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Uncertainty" title="The empirical band">
          <div className="prose">
            <p>
              The band on the Decision Room is built from signed forecast errors
              over the month, bucketed by forecast level. For a day on screen,
              that day&apos;s errors are excluded; the remaining days set the
              P10/P90 range. Buckets with fewer than 20 observations fall back to
              the global P10/P90.
            </p>
            <p>
              The band is asymmetrical on purpose. A forecast of a given size
              has a different historical downside than upside. The lower edge is{" "}
              <code>max(0, forecast − q90)</code> and the upper edge is{" "}
              <code>max(0, forecast − q10)</code>, where q90 and q10 are signed
              error quantiles. The shortfall buffer is{" "}
              <code>max(0, q90)</code>.
            </p>
            <div className="callout callout--info">
              <strong>Not a probabilistic forecast.</strong> This is an
              empirical error range from 31 days, not a calibrated predictive
              distribution. It is useful for framing reserve, not for pricing
              tail risk.
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Limits" title="Known limitations and next steps">
          <div className="prose">
            <ul>
              <li>
                <strong>One month, one fuel, one country.</strong> January 2026
                national wind is a narrow sample and not a seasonal validation.
              </li>
              <li>
                <strong>Gate closure is an assumption.</strong> The 11:00 UK
                cut-off should be replaced with the actual auction calendar and
                timezone handling.
              </li>
              <li>
                <strong>Hourly forecast resolution.</strong> Half-hourly
                forecast precision is not available in WINDFOR; the app does not
                pretend otherwise.
              </li>
              <li>
                <strong>No market data.</strong> The output is MW and GWh. A
                trading desk also needs prices, system margin, and imbalance
                exposure before this becomes a position-sizing tool.
              </li>
              <li>
                <strong>Vintage selection is simple.</strong> The app uses the
                latest pre-gate vintage per delivery hour. It does not model
                forecast decay or blend vintages.
              </li>
              <li>
                <strong>Next:</strong> actual gate times, a rolling backtest,
                price and margin overlays, probabilistic calibration, regional
                wind, and a proper vintage store rather than a SQLite snapshot.
              </li>
            </ul>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Reproducibility" title="Run it locally">
          <div className="prose">
            <p>Backend and data:</p>
            <pre>
              <code>{`cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m app.ingest --rebuild
uvicorn app.main:app --reload --port 8000`}</code>
            </pre>
            <p>Frontend:</p>
            <pre>
              <code>{`cd frontend
npm ci
npm run dev`}</code>
            </pre>
            <p>
              The Vite dev server proxies <code>/api</code> to{" "}
              <code>localhost:8000</code>. For a single production container,
              build the frontend first and let FastAPI serve{" "}
              <code>frontend/dist</code>.
            </p>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Disclosure" title="AI tools and provenance">
          <div className="prose">
            <p>
              This build was developed with an AI coding assistant for
              scaffolding, implementation, tests, and documentation. Data
              fetching, schema design, metric definitions, and the analysis
              logic were checked against the Elexon API and covered by
              automated tests. No data in the app is synthetic or hand-edited;
              the SQLite snapshot is generated by the ingestion command from
              Elexon BMRS.
            </p>
            <p>
              WindSight is a pilot decision-support concept built for a
              take-home exercise. It is not affiliated with Elexon or REint AI,
              and it is not operational trading advice.
            </p>
          </div>
        </SectionCard>
      </div>

      <p className="page-footer">
        Source data: Elexon BMRS FUELHH and WINDFOR. Snapshot period: 1–31
        January 2026. Built as a day-ahead wind forecasting pilot.
      </p>
    </>
  );
}
