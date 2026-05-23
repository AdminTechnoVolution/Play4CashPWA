#!/bin/bash
# Azure App Service — read Application Settings, write env-config.js, then pm2 (SPA).
set -e
cd "$(dirname "$0")"
node scripts/generate-runtime-config.mjs env-config.js
PORT="${PORT:-${WEBSITES_PORT:-8080}}"
exec pm2 serve "$(pwd)" "$PORT" --no-daemon --spa
