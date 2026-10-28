import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";

export function Methodology() {
  return <>
    <PageHeader eyebrow="Methodology" title="Understand the numbers before using them"
      subtitle="What was known when, how errors are measured, and what this pilot can help you decide."
      actions={<Badge tone="info">National wind · Elexon only</Badge>} />
    <div className="methodology stack">
      <SectionCard title="The buying decision">
        <div className="prose">
          <p>Wind is one input to the supply your team needs to secure. Use the forecast to understand expected wind availability, and the measured errors to judge how much that expectation has missed before.</p>
          <p>These are national figures. Without your demand, contracts, and share of wind generation, this app cannot calculate how much electricity your utility should buy. It does not place trades or estimate costs.</p>
        </div>
      </SectionCard>
      <SectionCard title="Buying in January, delivering the next day">
        <div className="prose">
          <p>The assignment covers purchase decisions made from <strong>1–31 January 2026</strong>. We interpret this as delivery from <strong>2 January–1 February 2026</strong>. There are 31 buying days, 744 delivery hours, 1,488 half-hour actuals and 8,432 stored forecast rows.</p>
          <p>We use <strong>Nord Pool N2EX’s 09:50 UK time cutoff</strong> on the day before delivery. The client’s exchange is unspecified, so N2EX is an explicit pilot assumption. Other auctions have different times. January and 1 February are GMT.</p>
          <p>For each delivery hour, choose the latest forecast whose publication time is at or before the cutoff. The hourly table shows the release time for each value; the newest selected release does not imply all hours came from the same release.</p>
          <p><a href="https://www.nordpoolgroup.com/en/message-center-container/newsroom/exchange-message-list/2020/q4/nord-pool-announces-gb-auction-changes-for-brexit/" target="_blank" rel="noreferrer">Nord Pool’s published N2EX timing</a></p>
        </div>
      </SectionCard>
      <SectionCard title="Two sources, one comparable hourly series">
        <div className="prose">
          <p><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">FUELHH</a> supplies actual generation filtered to WIND, every 30 minutes. <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">WINDFOR</a> supplies hourly forecasts with publication timestamps. No other generation or market data is used.</p>
          <p>We average the two actual half-hours to compare with each hourly forecast. An incomplete pair is omitted from accuracy metrics and reduces coverage. The chart repeats the hourly forecast over its two half-hours; it does not invent finer forecast detail.</p>
          <p>MW measures power; GW is 1,000 MW. GWh measures energy over time: sum the hourly MW values and divide by 1,000. Forecast energy uses all available forecast hours. Realised accuracy and energy use matched hours only; check coverage before comparing totals.</p>
        </div>
      </SectionCard>
      <SectionCard title="What each error measure tells you">
        <div className="prose">
          <ul>
            <li><strong>Error = forecast − actual.</strong> Forecast 12 GW and actual 10 GW gives +2 GW: wind came in 2 GW short. Actual 14 GW gives −2 GW: more wind than expected.</li>
            <li><strong>MAE:</strong> the average size of a miss, regardless of direction. A 2 GW MAE means an average absolute difference of 2 GW.</li>
            <li><strong>Bias:</strong> the average signed error. Positive means the forecast tended to overstate wind availability.</li>
            <li><strong>RMSE:</strong> an error measure that gives larger misses more weight.</li>
            <li><strong>nMAE:</strong> MAE divided by mean actual output, as a percentage. It is not a percentage accuracy score.</li>
            <li><strong>P90 absolute error:</strong> the interpolated 90th percentile of absolute hourly errors.</li>
            <li><strong>P90 shortfall:</strong> the 90th percentile of max(error, 0), including zero for surplus hours. It describes historical shortfalls, not a guaranteed buying buffer.</li>
            <li><strong>Within ±1 GW:</strong> the share of matched hours with an absolute error no larger than 1,000 MW.</li>
            <li><strong>Coverage:</strong> matched hours divided by 24 times the number of delivery days.</li>
          </ul>
        </div>
      </SectionCard>
      <SectionCard title="Earlier evidence, separate from hindsight">
        <div className="prose">
          <p>The Decision Room’s historical metrics and band use only completed earlier hours whose actual publication times are no later than the selected buying cutoff. Future days and actuals published later are excluded. Unknown publication times are excluded too.</p>
          <p>At least 20 earlier hourly pairs are required. If fewer exist, we show “not enough earlier evidence” and no band. The first buying days have limited history because we do not import extra months.</p>
          <p>Errors are grouped by forecast level. Each group’s P10 and P90 signed errors define a lower-wind value of max(0, forecast − P90) and an upper-wind value of max(0, forecast − P10). Groups with fewer than 20 observations use all eligible earlier errors. The historical buffer is max(0, P90).</p>
          <p>The range is empirical and uncalibrated. An 80% future coverage guarantee cannot be inferred from it. The stored actuals are the retrieved records with publication timestamps; this snapshot does not preserve every historical actual revision.</p>
          <p>Actual results are hidden by default in the Decision Room and labelled as known later. The Accuracy Lab is explicitly retrospective. Its lead-time view includes only the stored pre-cutoff vintages, with unequal samples across horizons; it does not establish that changing the lead time causes an accuracy change.</p>
        </div>
      </SectionCard>
      <SectionCard title="Pilot limits and provenance">
        <div className="prose">
          <p>This is a fixed historical snapshot, not a live forecasting service. One month cannot establish seasonal performance or reliable tail risk. Refresh is a separate ingestion step; page loads do not call Elexon.</p>
          <p>An AI coding assistant helped with implementation, tests and documentation. Data is retrieved from Elexon; it is not synthetic. The README explains the architecture, reproducible setup and checks.</p>
          <p>WindSight is an independent assignment pilot, not affiliated with Elexon or REint AI.</p>
        </div>
      </SectionCard>
    </div>
  </>;
}
