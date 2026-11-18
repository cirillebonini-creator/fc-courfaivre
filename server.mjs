import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { createHash, timingSafeEqual } from 'node:crypto';
import app from './dist/server/index.js';

const port = Number(process.env.PORT || 8080);
const origin = new URL(process.env.SITE_URL || `http://localhost:${port}`).origin;
const dataDir = resolve(process.env.DATA_DIR || join(homedir(), '.local/share/fc-courfaivre'));
if (!relative(process.cwd(), dataDir).startsWith('..')) throw new Error('DATA_DIR doit être situé hors du dossier du code du site.');
if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 16) throw new Error('ADMIN_PASSWORD doit contenir au moins 16 caractères.');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const sqlite = new DatabaseSync(join(dataDir, 'fcc.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS roster_changes (id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, player TEXT, portrait TEXT); CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT);');
if (!sqlite.prepare("SELECT value FROM app_metadata WHERE key = 'initialized'").get()) {
  const roster = JSON.parse(readFileSync('dist/effectifs.json', 'utf8'));
  const photos = JSON.parse(readFileSync('seed-portraits.json', 'utf8'));
  sqlite.exec('BEGIN');
  try {
    const insert = sqlite.prepare('INSERT OR IGNORE INTO roster_changes (id,revision,player,portrait) VALUES (?,1,?,?)');
    for (const player of Object.values(roster).flat()) {
      const { id, revision, photo, ...record } = player;
      insert.run(id, JSON.stringify(record), photos[id] || null);
    }
    sqlite.prepare("INSERT INTO app_metadata (key,value) VALUES ('initialized',?)").run(new Date().toISOString());
    sqlite.exec('COMMIT');
  } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
}
const DB = { prepare(sql) {
  const statement = sqlite.prepare(sql);
  const wrapper = args => ({ bind: (...values) => wrapper(values), first: () => statement.get(...args), all: () => ({ results: statement.all(...args) }), run: () => ({ meta: { changes: Number(statement.run(...args).changes) } }) });
  return wrapper([]);
} };
const digest = text => createHash('sha256').update(text).digest();
const expected = digest((process.env.ADMIN_USER || 'fcc') + ':' + (process.env.ADMIN_PASSWORD || ''));
const attempts = new Map();
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    const needsAuth = /^\/admin(?:\/|\.html)?$/.test(url.pathname) || (url.pathname.startsWith('/api/joueurs') && !['GET', 'HEAD'].includes(req.method));
    if (needsAuth) {
      if (!process.env.ADMIN_PASSWORD) { res.writeHead(503, { 'Cache-Control': 'no-store' }); res.end('Administration à configurer dans les variables d’environnement.'); return; }
      const key = req.socket.remoteAddress;
      const now = Date.now();
      for (const [ip, record] of attempts) if (now > record.until) attempts.delete(ip);
      const record = attempts.get(key) || { count: 0, until: now + 60000 };
      if (record.count >= 10) { res.writeHead(429, { 'Retry-After': '60', 'Cache-Control': 'no-store' }); res.end('Réessaie dans une minute.'); return; }
      const auth = req.headers.authorization || '';
      const decoded = auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64').toString('utf8') : '';
      if (!timingSafeEqual(digest(decoded), expected)) {
        record.count++; attempts.set(key, record);
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Administration FCC", charset="UTF-8"', 'Cache-Control': 'no-store' }); res.end('Connexion administrateur requise.'); return;
      }
      attempts.delete(key);
    }
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 520000) { res.writeHead(413); res.end('Requête trop volumineuse.'); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [name,value] of Object.entries(req.headers)) {
      if (!['authorization','host','oai-authenticated-user-id','content-length'].includes(name) && value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    // Identity is supplied only after local authentication; never trust a client header.
    if (needsAuth) headers.set('oai-authenticated-user-id', 'fcc-admin');
    const request = new Request(url, { method: req.method, headers, body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = await app.fetch(request, { DB });
    const out = Object.fromEntries(response.headers);
    out['X-Content-Type-Options'] = 'nosniff'; out['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    res.writeHead(response.status, out); res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error('Request failed:', error.message); if (!res.headersSent) res.writeHead(500); res.end('Service momentanément indisponible.'); }
});
server.listen(port, '0.0.0.0', () => console.log(`FCC démarré sur le port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => { sqlite.close(); process.exit(0); }));
