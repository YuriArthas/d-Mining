const { readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const root = resolve(__dirname, '..');

function setting(key, fallback) {
  if (Object.hasOwn(process.env, key)) return process.env[key];
  const file = process.env.MINING_LOCAL_TOOLS_FILE || join(root, '.local-tools.json');
  let config;
  try { config = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' && !process.env.MINING_LOCAL_TOOLS_FILE) return fallback;
    throw new Error(`Cannot read local tools configuration ${file}: ${error.message}`);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Local tools configuration must be a JSON object');
  return Object.hasOwn(config, key) ? config[key] : fallback;
}
function required(key) {
  const value = setting(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${key}: set the environment variable or .local-tools.json`);
  return value;
}
function httpUrl(key) {
  const value = required(key);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${key} must be an HTTP(S) URL without credentials, query or fragment`);
  }
  return url.href;
}
function publicRoot() { return httpUrl('MINING_PUBLIC_ROOT').replace(/\/?$/, '/'); }
function gameUrl() { return httpUrl('MINING_GAME_URL'); }
function playwright() {
  const modulePath = setting('MINING_PLAYWRIGHT_MODULE', 'playwright');
  try { return require(modulePath); }
  catch (error) { throw new Error(`Cannot load Playwright; install playwright locally or set MINING_PLAYWRIGHT_MODULE: ${error.message}`); }
}
function telemetryConfig() {
  const endpoint = setting('MINING_LOG_ENDPOINT', '');
  const enabled = setting('MINING_LOG_ENABLED', endpoint ? 'true' : 'false');
  if (![true, false, 'true', 'false', '1', '0'].includes(enabled)) throw new Error('MINING_LOG_ENABLED must be true/false or 1/0');
  if (enabled === false || enabled === 'false' || enabled === '0') return { enabled: false };
  const url = httpUrl('MINING_LOG_ENDPOINT');
  const pathPrefix = setting('MINING_LOG_PATH_PREFIX', '/');
  if (typeof pathPrefix !== 'string' || !pathPrefix.startsWith('/')) throw new Error('MINING_LOG_PATH_PREFIX must start with /');
  return { enabled: true, endpoint: url, pathPrefix };
}
module.exports = { setting, required, httpUrl, publicRoot, gameUrl, playwright, telemetryConfig };
