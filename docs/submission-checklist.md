# Submission checklist

## Repository

- [ ] Public GitHub repository with an anonymous name (no full name in the repo
      name, README, commit author, or screenshots).
- [ ] `.venv/`, `frontend/node_modules/`, `frontend/dist/`, caches, and `.env`
      are not committed.
- [ ] `backend/data/windsight.db` and `backend/data/ingest-summary.json` are
      committed.
- [ ] README includes the live URL, video URL, data sources, how to run, AI-tool
      disclosure, and limitations.
- [ ] `git status` is clean after the final commit.
- [ ] Check commit history for personal email addresses if the repo is anonymous.

## App

- [ ] `docker build -t windsight .` succeeds.
- [ ] `docker run --rm -p 8000:8000 windsight` serves the SPA at `/`.
- [ ] `/api/health`, `/api/decision?date=2026-01-15`, and
      `/api/accuracy?from=2026-01-01&to=2026-01-31` respond.
- [ ] Deep link `/accuracy` and `/methodology` work on refresh.
- [ ] Desktop and mobile layouts checked.
- [ ] `pytest -q` and `ruff check app tests` pass.
- [ ] `npm run build` passes.

## Deployment

- [ ] Live URL opens in an incognito window with no login.
- [ ] `BASE_URL=https://<app> ./scripts/smoke.sh` passes.
- [ ] Health check path is `/api/health`.
- [ ] The snapshot is present in the deployed container.
- [ ] No secrets are required at runtime.

## Video

- [ ] Public/unlisted video link opens in an incognito window.
- [ ] Under 10:00; about 5 minutes client pitch + 5 minutes technical review.
- [ ] Shows the live app, the decision view, the accuracy view, tests, and the
      limitations.
- [ ] Audio is audible; no personal notifications or tabs.
- [ ] The link is in the README or submission form.

## Submission form

- [ ] Live URL.
- [ ] Repository URL.
- [ ] Video URL.
- [ ] AI tools disclosed.
- [ ] URLs re-checked in incognito immediately before submitting.
