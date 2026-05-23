import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** VITE_* keys the SPA reads at runtime (must match RuntimeEnvKey in runtimeEnv.ts). */
const RUNTIME_ENV_KEYS = ['VITE_API_URL', 'VITE_GOOGLE_CLIENT_ID'];

/**
 * Writes `env-config.js` so the browser can read Azure App Service Application Settings
 * without rebuilding the SPA.
 *
 * @param {string} outputPath — absolute or relative path to env-config.js
 */
export function generateRuntimeConfig(outputPath) {
  /** @type {Record<string, string>} */
  const config = {};

  for (const key of RUNTIME_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      config[key] = value;
    }
  }

  const body = `window.__P4C_ENV__ = ${JSON.stringify(config)};\n`;
  writeFileSync(outputPath, body, 'utf8');
  return config;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || 'dist/env-config.js';
  generateRuntimeConfig(out);
  console.log(`Wrote runtime config to ${out}`);
}
