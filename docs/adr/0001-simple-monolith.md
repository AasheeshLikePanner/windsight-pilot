# ADR 0001: One deployable image with a pure analysis module

- Status: accepted
- Date: 2026-10-26

## Context

WindSight is a timeboxed, read-only pilot. It serves a fixed January 2026
snapshot of two Elexon datasets, exposes a small JSON API, and renders three
React pages. The deployment target is a single public URL, and the assignment
allows Docker plus Heroku (or Vercel). There is no authentication, write path,
or scheduled ingestion requirement.

Two forces pull in different directions:

- the React app and the Python API have different build toolchains;
- the useful part of the product is the analysis, not the HTTP plumbing.

## Decision

Ship **one Docker image**:

1. A Node build stage produces the static React app.
2. A Python 3.12 runtime installs FastAPI, copies the backend and the built
   frontend, and serves both from one process.
3. The API reads a committed SQLite snapshot. Ingestion is a separate CLI
   (`app.ingest`), not a request-time concern.
4. All decision and accuracy logic lives in `backend/app/analysis.py`. It takes
   domain records and returns plain dictionaries; it knows nothing about HTTP,
   SQL, or React.
5. `backend/app/elexon.py` is the only adapter that knows Elexon field names
   and request quirks. `backend/app/api.py` is a thin HTTP adapter over the
   store and analysis module.

The SPA is still a separate source tree with its own dev server. The coupling is
only at build and deploy time.

## Consequences

### Positive

- One URL, one origin, no production CORS.
- One artifact to deploy and roll back.
- The analysis module is a deep module: a small call surface (`decision_view`,
  `accuracy_view` and their inputs) hides the aggregation, quantile, and
  bucketing rules.
- The pure module is the test surface. Most tests do not need HTTP, SQLite, or
  the network.
- A committed snapshot makes demos, tests, and deployments deterministic. The
  live Elexon API is touched only during ingestion.

### Negative

- Data refresh is explicit. The deployed app does not update itself.
- A single image is larger than a static frontend plus a function.
- Vercel cannot run this artifact as-is. A Vercel path would need a split
  static/serverless deployment and a bundled snapshot.
- SQLite is adequate for a read-only 1.3 MB snapshot, not for concurrent
  ingestion at production scale.

## Alternatives considered

| Alternative | Why not now |
| --- | --- |
| Separate frontend and API services | Two deployments, CORS, and configuration drift for no user-visible benefit at this size. |
| Vercel static + Python function | Attractive, but Vercel does not run Docker. The split adapter would need its own tests and file-bundling rules; the assignment allows Heroku. |
| Call Elexon on every request | Slower, rate-limit exposed, non-deterministic tests, and unnecessary for a fixed historical month. |
| Put metrics in the API or React | The metric definitions would be duplicated or trapped behind HTTP. The pure module keeps one source of truth. |

## Seams and the deletion test

The Elexon adapter is the only external seam today. Removing `elexon.py` would
spread request parameters and field parsing across ingestion and analysis, so it
earns its place.

The store seam is also real: it is swapped for a temporary SQLite file in tests.
The analysis module has no adapter yet. If a second data source arrives
(regional wind, ENTSO-E, a price feed), that is the point to introduce a
forecast-source interface rather than guess at one now.

Deleting `analysis.py` would force the API, tests, and UI to re-implement
aggregation and uncertainty logic. It fails the deletion test, which is the
right outcome for a deep module.

## Follow-ups

- Add a scheduled ingestion job and a vintage-versioned store if the product
  moves beyond a fixed pilot.
- Add a second adapter before abstracting the data source.
- Replace the SQLite file with a read replica or warehouse table if the
  snapshot grows or multiple services need it.
