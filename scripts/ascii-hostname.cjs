/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload, loaded with node --require */
// Preload for the Vercel CLI only: this PC's name contains non-ASCII characters,
// which can't go into an HTTP header (the CLI puts the hostname in its User-Agent).
// Use: $env:NODE_OPTIONS="--require ./scripts/ascii-hostname.cjs"; npx vercel ...
const os = require("node:os");
const name = os.hostname();
if (/[^\x20-\x7e]/.test(name)) os.hostname = () => "soonertogether-dev";
