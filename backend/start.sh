#!/bin/sh
set -eu

# `exec` makes Uvicorn PID 1 so SIGTERM reaches it directly for graceful shutdown.
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}"
