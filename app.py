"""Vercel entrypoint; Docker uses the same application via app.main."""

from backend.app.main import app

__all__ = ["app"]
