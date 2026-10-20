import { readFile } from 'node:fs/promises';
import { startServer } from './server.mjs';
import {SENSOR_DEFAULTS} from './ha_actuals.mjs';

// HA OS puts this app's validated options in /data/options.json.
const optionsFile = process.env.HA_OPTIONS_PATH || '/data/options.json';
let slug = '';
let languagePreference = 'auto';
let haEntities = {...SENSOR_DEFAULTS};
try {
  const options = JSON.parse(await readFile(optionsFile, 'utf8'));
  slug = String(options.emhass_slug || '').trim();
  languagePreference = ['auto', 'en', 'nl'].includes(options.language) ? options.language : 'auto';
  haEntities = Object.fromEntries(Object.entries(SENSOR_DEFAULTS).map(([key, fallback]) => [key, String(options[key] ?? fallback).trim()]));
} catch (err) {
  console.warn(`Geen add-on configuratie gelezen uit ${optionsFile}: ${err.message}`);
}

// Only use a Home Assistant add-on slug, never an arbitrary URL/credential.
// Supervisor DNS uses hyphens, while add-on IDs use underscores.
const valid = !slug || /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(slug);
if (!valid) {
  console.error('Ongeldige emhass_slug. Vul uitsluitend de volledige EMHASS add-on-id in.');
  process.exitCode = 1;
} else {
  const upstreamUrl = slug ? `http://${slug.replaceAll('_', '-')}:5000` : '';
  // HAOS stores /data/options.json as root-only (0600). Read it first, then
  // drop privileges BEFORE creating any network listener or processing requests.
  if (process.getuid?.() === 0) {
    process.setgid(1000);
    process.setuid(1000);
  }
  startServer({
    hostname: '0.0.0.0',
    listenPort: 8099,
    upstreamUrl,
    languagePreference,
    haEntities,
    ingressOnly: true,
  });
  console.log(`EMHASS Energy Studio v0.3.3 - Home Assistant Ingress actief op poort 8099. EMHASS ${upstreamUrl || 'niet geconfigureerd'}.`);
}
