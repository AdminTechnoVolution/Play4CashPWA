#!/bin/bash
# Azure App Service — read Application Settings, write env-config.js, then run the hardened server.
set -e
cd "$(dirname "$0")"
node scripts/generate-runtime-config.mjs env-config.js
exec node server.mjs
