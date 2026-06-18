#!/bin/bash
# Railway injects $PORT at runtime. Default to 8000 for local runs.
exec uvicorn api:app --host 0.0.0.0 --port "${PORT:-8000}"