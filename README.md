# WindSight

**Understand tomorrow’s wind forecast before buying power.**

A small React + Python app for a UK utility’s day-ahead buying team, using only Elexon wind data.

- **Decision Room:** the forecast available at the buying cutoff, with earlier error history. Actual outcomes are hidden until you choose to review them.
- **Accuracy Lab:** typical misses, bias, large errors and data coverage across a chosen range.
- **Methodology:** plain-English explanations of the numbers and assumptions.

**Live app:** Vercel deployment pending verification.

**Demo video:** the author will add the final unlisted YouTube link.

## Run

With Docker:

```bash
docker build -t windsight .
docker run --rm -p 8000:8000 windsight
```

Open [localhost:8000](http://localhost:8000). The data snapshot is included; no API key or data download is needed.

Without Docker (Python 3.12+, Node 20+):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
npm --prefix frontend run build
python -m uvicorn app:app --port 8000
```

For frontend hot reload, run `npm --prefix frontend run dev` in another terminal.

## Code map

| Location | What it does |
| --- | --- |
| `frontend/src/pages/` | Three user-facing views |
| `frontend/src/components/` | Shared UI; `hooks/` loads snapshot metadata |
| `frontend/src/api.ts`, `types.ts` | API requests and response types |
| `backend/app/api.py`, `main.py` | HTTP routes and serving the React build |
| `backend/app/analysis.py`, `domain.py` | Forecast selection, metrics and data records |
| `backend/app/elexon.py`, `ingest.py` | Elexon adapter and optional data refresh |
| `backend/app/store.py`, `config.py`, `timeutils.py` | SQLite, scope and timing |
| `backend/data/`, `backend/tests/` | Saved data, provenance and tests |
| `app.py`, `vercel.json` | Vercel entrypoint and build settings |
| `Dockerfile`, `heroku.yml`, `render.yaml` | Container deployment configuration |
| `scripts/`, `docs/` | Smoke checks, architecture note and submission checklist |

Flow: **React → FastAPI → read-only SQLite**. Ingestion runs separately. See the [architecture note](docs/adr/0001-simple-monolith.md) for tradeoffs.

## Key assumptions

- January **buying days** mean delivery from **2 January to 1 February 2026**. API date parameters are delivery dates.
- The pilot uses **N2EX’s 09:50 UK cutoff**; the client’s exchange was unspecified. [Timing source](https://www.nordpoolgroup.com/en/message-center-container/newsroom/exchange-message-list/2020/q4/nord-pool-announces-gb-auction-changes-for-brexit/).
- Actuals: [FUELHH, WIND](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream). Forecasts: [WINDFOR](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream). Two actual half-hours are averaged for each hourly comparison.
- **Positive error = forecast − actual = wind shortfall.** Earlier history excludes future and late-published actuals. Fewer than 20 earlier observations means no uncertainty band.
- National wind data alone cannot determine your utility’s purchase volume. This is a fixed historical pilot, not a live feed or a calibrated risk model. See [GLOSSARY.md](GLOSSARY.md) and the in-app Methodology.

## Check and deploy

```bash
(cd backend && pytest -q && ruff check app tests && ruff format --check app tests)
npm --prefix frontend run build
BASE_URL=http://localhost:8000 ./scripts/smoke.sh
```

Import the repository root into Vercel using the FastAPI preset. `vercel.json` builds React and bundles the snapshot. No runtime secrets are required. Verify the public URL before submitting.

**AI disclosure:** an AI coding assistant helped implement, test and document the app. All generation data comes from Elexon; none is synthetic.
