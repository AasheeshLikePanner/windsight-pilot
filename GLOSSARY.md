# Glossary

| Term | Plain meaning |
| --- | --- |
| Buying day | The day a purchase decision is made, 1–31 January in this pilot. |
| Delivery day | The next day, when power is delivered: 2 January–1 February. |
| Cutoff | 09:50 UK time on the buying day, using N2EX as the explicit auction assumption. |
| Vintage | A forecast release identified by its publication time. |
| Forecast at cutoff | The latest available release per delivery hour, never a later update. |
| Actual | Elexon’s measured wind generation for a half-hour. |
| Decision point | An hourly forecast paired with the mean of two actual half-hours. |
| MW / GW | Power. 1 GW = 1,000 MW. |
| GWh | Energy over time. One hour at 1 GW supplies 1 GWh. |
| Error | Forecast − actual. Positive means wind fell short; negative means extra wind. |
| Bias | Average signed error; shows whether forecasts tend to overstate or understate output. |
| MAE | Average absolute miss, ignoring its direction. |
| RMSE | An error measure that gives larger misses more weight. |
| nMAE | MAE as a percentage of mean actual output; not a percentage accuracy score. |
| P90 shortfall | 90th percentile of max(error, 0), including zero for surplus hours. |
| Historical buffer | max(0, q90) from earlier errors in the relevant forecast-level group; not a purchase instruction. |
| Lower-wind scenario | max(0, forecast − q90), using earlier data only. |
| Coverage | Matched hours / expected hours. Missing data lowers this percentage. |
| Lead time | Hours between forecast publication and delivery. |
| Historical band | P10–P90 error-based range using available earlier observations; uncalibrated. |
| Hindsight | Actual outcomes known only after the buying decision. |
