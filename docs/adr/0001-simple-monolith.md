# ADR 0001: One application, explicit snapshot ingestion

Status: accepted, updated for the January purchase-decision interpretation.

The pilot is read-only, fixed in scope and small enough to ship as React + FastAPI + a committed SQLite snapshot. One origin avoids separate-service configuration. No live Elexon request is required to load the app.

The Elexon adapter owns upstream field names and request quirks. The store owns SQL. The analysis module owns cutoff selection and metrics; its calculation functions are pure, while its view functions coordinate store reads. The API validates dates and serializes results. React handles presentation, controls and request states.

Docker builds React, then runs FastAPI serving the UI and API. Vercel uses a thin root `app.py` entrypoint to the same FastAPI application and bundles the snapshot. API access is read-only so it works on immutable deployment filesystems. Refresh remains a separate CLI task.

## Decisions that protect the user’s interpretation

- January means buying days, so delivery runs 2 January–1 February.
- N2EX 09:50 UK time is explicit because the client’s exchange is unspecified.
- Forecast summaries do not require actuals to exist.
- Earlier-error history excludes hours not complete by the cutoff and actual records published after it or without publication timestamps.
- Bands require 20 eligible observations. We show unavailable evidence instead of fitting on future days.
- Realised outcomes are opt-in on the Decision Room and retrospective in the Accuracy Lab.

## Tradeoffs

A committed snapshot gives repeatable demos without an external database. It does not preserve every actual revision or update itself. Python dependency ranges are bounded but not a complete transitive lock. There is no committed browser test framework; browser verification is recorded separately.

No source abstraction, queue, warehouse, user system or framework migration is justified by the current scope. A larger live product would first need a versioned data store, actual market-calendar configuration and rolling validation.
