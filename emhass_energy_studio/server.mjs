import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8080);
const source = process.env.EMHASS_URL?.trim()?.replace(/\/+$/, '') || '';
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
};
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.ico':'image/x-icon' };

function json(res, code, data) {
  const value = JSON.stringify(data);
  res.writeHead(code, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(value) });
  res.end(value);
}

export function startServer({ hostname = host, listenPort = port, upstreamUrl = source, ingressOnly = process.env.INGRESS_ONLY === '1' } = {}) {
  let baseUrl;
  try {
    if (upstreamUrl) {
      const parsed = new URL(upstreamUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new Error('EMHASS_URL moet een http(s)-adres zijn zonder wachtwoord of query.');
      }
      baseUrl = parsed;
    }
  } catch (error) { throw new Error(`Ongeldige EMHASS_URL: ${error.message}`); }

  const server = createServer(async (req, res) => {
    // Home Assistant Ingress forwards requests from the Supervisor at 172.30.32.2.
    // Do not trust X-Forwarded-For: only the TCP peer is authoritative here.
    if (ingressOnly && !['172.30.32.2', '::ffff:172.30.32.2'].includes(req.socket.remoteAddress)) {
      return json(res, 403, { error: 'Alleen toegang via Home Assistant Ingress toegestaan.' });
    }
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return json(res, 405, { error: 'Deze frontend is alleen-lezen. Alleen GET is toegestaan.' });
    }
    if (pathname === '/health') return json(res, 200, { status: 'ok', configured: !!baseUrl });
    if (pathname.startsWith('/api/')) {
      const paths = { '/api/plan': '/api/v1/plan', '/api/last-run': '/api/v1/last-run' };
      const target = paths[pathname];
      if (!target) return json(res, 404, { error: 'Onbekende API-route' });
      if (!baseUrl) return json(res, 503, { error: 'EMHASS_URL ontbreekt. Gebruik de demomodus of configureer de EMHASS-host.' });
      try {
        const upstream = new URL(baseUrl.toString());
        upstream.pathname = upstream.pathname.replace(/\/+$/, '') + target;
        const response = await fetch(upstream, { method: 'GET', signal: AbortSignal.timeout(8500), headers: { 'Accept': 'application/json' } });
        if (!response.ok) return json(res, 502, { error: `EMHASS gaf HTTP ${response.status} voor ${target}.` });
        if (!(response.headers.get('content-type') || '').includes('json')) return json(res, 502, { error: `EMHASS gaf geen JSON voor ${target}. Controleer adres en add-on toegang.` });
        const buffer = await response.text();
        if (Buffer.byteLength(buffer, 'utf8') > 3_000_000) return json(res, 502, { error: 'API-resultaat is te groot (>3 MB).' });
        return json(res, 200, JSON.parse(buffer));
      } catch (e) {
        return json(res, 502, { error: `Kan EMHASS niet bereiken (${e.name === 'TimeoutError' ? 'time-out' : 'verbinding of ongeldig antwoord'}).` });
      }
    }
    try {
      const file = pathname === '/' ? '/index.html' : pathname;
      const safe = resolve(root, '.' + decodeURIComponent(file));
      if (safe !== resolve(root) && !safe.startsWith(resolve(root) + sep)) return json(res, 403, { error: 'Ongeldig pad' });
      const info = await stat(safe);
      if (!info.isFile()) return json(res, 404, { error: 'Niet gevonden' });
      const body = await readFile(safe);
      res.writeHead(200, { ...headers, 'Content-Type': mime[extname(safe)] || 'application/octet-stream', 'Content-Length': body.length });
      if (req.method === 'HEAD') return res.end();
      return res.end(body);
    } catch { return json(res, 404, { error: 'Niet gevonden' }); }
  });
  server.listen(listenPort, hostname);
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
  console.log(`EMHASS Frontend op http://${host}:${port} (upstream: ${source || 'niet ingesteld'})`);
}
