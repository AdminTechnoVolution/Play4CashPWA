import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** VITE_* keys the SPA reads at runtime (must match RuntimeEnvKey in runtimeEnv.ts). */
const RUNTIME_ENV_KEYS = ['VITE_API_URL', 'VITE_GOOGLE_CLIENT_ID'];

/**
 * Writes `env-config.js` from Azure App Service Application Settings (process.env).
 * @param {string} outputPath
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
  const out = process.argv[2] || 'env-config.js';
  const config = generateRuntimeConfig(out);
  console.log(`Wrote runtime config to ${out} (${Object.keys(config).join(', ') || 'empty'})`);
}
