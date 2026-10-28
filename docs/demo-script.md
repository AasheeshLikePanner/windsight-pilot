# Video guide: one recording, two parts

Aim for **8–9 minutes total**. Each part is about four minutes, leaving room to click and pause. Bracketed lines are screen cues; say the quoted text naturally. Record both parts in **one unlisted YouTube video**.

## Part 1 — Client presentation (about 4 minutes)

**[0:00–0:35 · Open the live Decision Room]**

“Hi, I’m showing you WindSight, a pilot for your day-ahead buying team. Before you buy power, you need two things: the wind forecast you actually had at decision time, and a clear measure of how wrong that forecast has been. This screen brings those together using national wind data from Elexon.”

**[0:35–1:25 · Point to Buying day, forecast energy and forecast chart]**

“The selected buying day is 31 January. The power is delivered the next day, 1 February. We use 09:50 UK time as the buying cutoff, based on the N2EX auction. The client’s exact auction wasn’t specified, so that is an explicit pilot assumption. For this day, the latest available forecast covers all 24 hours and adds up to about 168 gigawatt-hours of wind. I can see when each hourly forecast was published. The actual result is hidden here, because the buyer would not have known it yet.”

**[1:25–2:25 · Point to the shaded range, earlier miss and P90 shortfall cards]**

“The shaded range comes from earlier forecast errors that were already known by this buying cutoff. Here, the typical earlier miss is about 2,055 megawatts. The P90 shortfall figure is about 4,221 megawatts: a way to see how large previous over-forecasts have been. It is historical evidence, not a guaranteed outcome or an automatic instruction to buy that amount. Your team can compare the hourly wind picture with your own demand and contracted supply, then decide what additional power to secure.”

**[2:25–3:20 · Turn on ‘Show actual results’, then open Accuracy Lab]**

“After delivery, I can reveal actual generation and review how the decision-time forecast performed. In the Accuracy Lab, the full month has 744 hourly comparisons and complete coverage. The mean absolute error is about 2,013 megawatts, or 17.8% of average actual wind. Bias is positive, about 1,730 megawatts, meaning the forecast tended to overestimate wind. The charts show when misses happened and how they changed with forecast level and lead time.”

**[3:20–4:05 · Open Methodology, then return to Decision Room]**

“This page explains every assumption in plain language. The pilot uses only Elexon national wind forecasts and actuals. It does not know your customer demand, contracts or share of wind generation, so it cannot calculate your purchase volume. What it does today is make the decision-time forecast and its measured error easy to understand before a buying decision. That is the foundation we can build on with your own supply data.”

## Part 2 — Technical lead review (about 4 minutes)

**[4:05–4:50 · Show the README code map]**

“Here is the implementation. React renders the three views. FastAPI provides the API and serves the built frontend. The API reads a small SQLite snapshot, so opening the app does not depend on Elexon being available live. Docker packages the app, and a thin `app.py` entry point runs the same FastAPI application on Vercel. The README has the run commands, code map, live link and AI-use disclosure.”

**[4:50–5:45 · Show `elexon.py`, `ingest.py` and `store.py`]**

“Ingestion is separate from serving requests. The Elexon adapter reads FUELHH actuals filtered to WIND and WINDFOR forecasts. Each forecast has a target start time and a publication time. The ingestion step keeps the relevant January buying decisions and writes a repeatable snapshot. The snapshot contains 1,488 half-hour actuals and 8,432 forecast rows. The API opens it read-only, which also suits Vercel’s deployment filesystem.”

**[5:45–6:55 · Show `analysis.py` and the Decision Room]**

“The key rule is in the analysis module: for each delivery hour, select the latest forecast published by the previous day’s 09:50 cutoff. That prevents later forecast updates from leaking into a historical buying decision. WINDFOR is hourly, while FUELHH actuals are half-hourly, so we average two actual periods for each hourly comparison. Error means forecast minus actual; positive error means less wind arrived than forecast. The decision view uses only earlier errors whose actual results had been published by that cutoff. If fewer than 20 earlier observations exist, it does not show a band.”

**[6:55–7:50 · Show `api.py`, frontend pages and tests]**

“The API validates dates and returns decision, accuracy and metadata views. React handles date selection, loading and error states, and it keeps hindsight hidden in the decision screen until the user asks for it. Backend tests cover the cutoff, vintage choice, hourly aggregation, metrics, history timing and API behavior. I ran 31 backend tests, Ruff, the TypeScript and frontend build, a Docker build and run, and a smoke check against the public Vercel URL.”

**[7:50–8:40 · Show the architecture note or Methodology]**

“The deliberate tradeoff is a fixed, committed snapshot. It makes this pilot reproducible and easy to review, but it does not update automatically or preserve every data revision. N2EX timing is an assumption because the client’s exchange was not specified. The error range is historical, not a calibrated probability forecast. For a production version, I would confirm the auction calendar, automate versioned data refreshes, and validate the error ranges over a longer rolling period. This version stays within the requested Elexon-only scope.”

## Recording note

Keep the client part focused on what a buyer can decide. Show code only in Part 2. Add the unlisted video link to the README before submitting.
