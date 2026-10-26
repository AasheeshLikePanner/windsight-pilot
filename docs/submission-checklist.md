# Submission checklist

## Repository

- [x] Public GitHub repository: <https://github.com/AasheeshLikePanner/windsight-pilot>
      (anonymous repo name; neutral commit author).
- [x] `.venv/`, `frontend/node_modules/`, `frontend/dist/`, caches, and `.env`
      are not committed.
- [x] `backend/data/windsight.db` and `backend/data/ingest-summary.json` are
      committed.
- [x] README includes the live URL, video URL, data sources, how to run, AI-tool
      disclosure, and limitations.
- [x] `git status` is clean after the final commit.
- [x] Commit history uses a GitHub noreply address; commit author is neutral.

## App

- [x] `docker build -t windsight .` succeeds.
- [x] `docker run --rm -p 8000:8000 windsight` serves the SPA at `/`.
- [x] `/api/health`, `/api/decision?date=2026-01-15`, and
      `/api/accuracy?from=2026-01-01&to=2026-01-31` respond.
- [x] Deep link `/accuracy` and `/methodology` work on refresh.
- [x] Desktop and mobile layouts checked.
- [x] `pytest -q` (15 passed) and `ruff check app tests` pass.
- [x] `npm run build` passes.

## Deployment

- [x] Live URL: <https://windsight-sda4.onrender.com> (opens with no login).
- [x] `BASE_URL=https://windsight-sda4.onrender.com ./scripts/smoke.sh` passes.
- [x] Health check path is `/api/health`.
- [x] The snapshot is present in the deployed container (1,488 actuals; 8,432 forecasts).
- [x] No secrets are required at runtime.

## Video

- [x] Captioned walkthrough: <https://github.com/AasheeshLikePanner/windsight-pilot/releases/download/v0.1.0/windsight-silent-walkthrough.mp4>
- [x] 7:28, covering the decision view, accuracy lab, methodology, architecture,
      tests, and deployment.
- [x] Shows the live app, decision view, accuracy view, tests, and limitations.
- [x] Silent by design (captioned); no personal tabs or notifications. Add a
      voiceover from `docs/demo-script.md` if a narrated version is preferred.
- [x] The video link is in the README.

## Submission form

- [ ] Live URL.
- [ ] Repository URL.
- [ ] Video URL.
- [ ] AI tools disclosed.
- [ ] URLs re-checked in incognito immediately before submitting.
