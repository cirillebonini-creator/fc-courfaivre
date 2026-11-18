import { assets, seed } from './assets.mjs';

const teams = Object.keys(seed);
const originals = new Map(Object.values(seed).flat().map(player => [player.id, player]));
const playerId = /^[a-f0-9-]{24,36}$/;
const noStore = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: noStore });

function readPlayer(row, id) {
  if (!row) return originals.get(id);
  if (row.player === null) return undefined;
  return {
    ...JSON.parse(row.player),
    id,
    revision: row.revision,
    photo: row.has_portrait ? '/api/portrait/' + id + '?v=' + row.revision : null
  };
}

async function roster(db) {
  const { results } = await db.prepare('SELECT id, revision, player, portrait IS NOT NULL AS has_portrait FROM roster_changes').all();
  const players = new Map(originals);
  for (const row of results) {
    const player = readPlayer(row, row.id);
    if (player) players.set(row.id, player);
    else players.delete(row.id);
  }
  const grouped = Object.fromEntries(teams.map(team => [team, []]));
  for (const player of players.values()) grouped[player.team].push(player);
  for (const group of Object.values(grouped)) group.sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));
  return json(grouped);
}

async function updatePlayer(request, db, suppliedId) {
  if (request.headers.get('Origin') !== new URL(request.url).origin
      || !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return json({ error: 'Requête non autorisée.' }, 403);
  }
  const raw = await request.text();
  if (raw.length > 510000) return json({ error: 'Photo trop volumineuse.' }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Données invalides.' }, 400); }
  if (!input || typeof input !== 'object') return json({ error: 'Données invalides.' }, 400);

  const creating = !suppliedId;
  const id = suppliedId || crypto.randomUUID();
  const row = !creating && await db.prepare('SELECT revision, player, portrait FROM roster_changes WHERE id = ?').bind(id).first();
  if (!creating && !readPlayer(row, id)) return json({ error: 'Joueur introuvable.' }, 404);
  const revision = row?.revision ?? 0;
  if (!creating && input.revision !== revision) return json({ error: 'Cette fiche a changé. Recharge la page avant de réessayer.' }, 409);

  let data = null;
  let portrait = row?.portrait ?? null;
  if (request.method !== 'DELETE') {
    const { team, firstName, lastName, nationality, position } = input;
    if (!teams.includes(team) || ![firstName, lastName, nationality, position].every(value => typeof value === 'string' && value.length <= 100)
        || !firstName.trim() || !lastName.trim()) return json({ error: 'Vérifie le prénom, le nom et l’équipe.' }, 400);
    data = JSON.stringify({ team, firstName: firstName.trim(), lastName: lastName.trim(), nationality: nationality.trim(), position: position.trim() });
    if (input.portrait === null) portrait = null;
    else if (input.portrait !== undefined) {
      if (typeof input.portrait !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.portrait) || input.portrait.length > 500000) {
        return json({ error: 'Portrait invalide ou trop volumineux.' }, 400);
      }
      let prefix;
      try { prefix = atob(input.portrait.slice(0, 16)); } catch { return json({ error: 'Portrait invalide.' }, 400); }
      if (!prefix.startsWith('RIFF') || prefix.slice(8) !== 'WEBP') return json({ error: 'Portrait invalide.' }, 400);
      portrait = input.portrait;
    }
  } else {
    portrait = null;
  }

  const result = await db.prepare(
    'INSERT INTO roster_changes (id, revision, player, portrait) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET revision = roster_changes.revision + 1, player = excluded.player, portrait = excluded.portrait WHERE roster_changes.revision = ?'
  ).bind(id, data, portrait, revision).run();
  if (result.meta.changes !== 1) return json({ error: 'Cette fiche a changé. Recharge la page avant de réessayer.' }, 409);
  return json({ id, revision: revision + 1 }, creating ? 201 : 200);
}

function assetResponse(path, head) {
  const asset = assets[path];
  if (!asset) return new Response('Page introuvable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const [type, body, binary] = asset;
  return new Response(head ? null : binary ? Uint8Array.from(atob(body), c => c.charCodeAt(0)) : body, {
    headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }
  });
}

const standingsSources = {
  veterans: 'https://widget.football.ch/fr/Widgets.aspx/v-1226/t-35935/a-trr/',
  premiere: 'https://widget.football.ch/fr/Widgets.aspx/v-1226/t-35933/a-trr/',
  deuxieme: 'https://widget.football.ch/fr/Widgets.aspx/v-1226/t-35934/a-trr/'
};

async function standings(team) {
  const source = standingsSources[team];
  const response = await fetch(source, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('ASF unavailable');
  const html = await response.text();
  const table = html.match(/<table\b[^>]*id="[^"]*tbRangliste"[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw new Error('ASF table unavailable');
  const decode = value => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => decode(cell[1])));
  const valid = rows.filter(c => /^\d+\.$/.test(c[0] || ''));
  if (!valid.length || valid.some(c => c.length < 12 || c[8] !== ':' || !/^\d+$/.test(c[11]))) throw new Error('Invalid ASF table');
  return Response.json({ source, fetchedAt: new Date().toISOString(), rows: valid.map(c => ({
    rank: c[0], club: c[1], played: c[2], wins: c[3], draws: c[4], losses: c[5], fairplay: c[6], goals: c[7] + ' : ' + c[9], difference: c[10], points: c[11]
  })) }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}

function upcomingMatches(data) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
  return { ...data, matches: data.matches.filter(match => match.date >= today && !match.status && !match.played).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '23:59').localeCompare(b.time || '23:59')).slice(0, 3) };
}

async function fixtures(team) {
  const source = fixturesSnapshot[team].source;
  const response = await fetch(source, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('ASF calendar unavailable');
  const matches = parseFixtures(await response.text());
  return Response.json(upcomingMatches({ source, matches, fetchedAt: new Date().toISOString() }), { headers: { 'Cache-Control': 'private, max-age=300' } });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const method = request.method;
    const isRead = method === 'GET' || method === 'HEAD';
    const standingMatch = path.match(/^\/api\/classement\/(premiere|deuxieme|veterans)$/);
    if (standingMatch && method === 'GET') {
      try { return await standings(standingMatch[1]); }
      catch (error) {
        console.error('ASF standings:', standingMatch[1], error.message);
        return json({ ...standingsSnapshot[standingMatch[1]], stale: true });
      }
    }
    const fixtureMatch = path.match(/^\/api\/prochains-matchs\/(premiere|deuxieme)$/);
    if (fixtureMatch && method === 'GET') {
      try { return await fixtures(fixtureMatch[1]); }
      catch { return json(upcomingMatches({ ...fixturesSnapshot[fixtureMatch[1]], stale: true })); }
    }
    const signedIn = Boolean(request.headers.get('oai-authenticated-user-id'));
    if (path === '/admin' || path === '/admin/' || path === '/admin.html') {
      if (!signedIn) return new Response('Connexion administrateur requise.', { status: 401, headers: noStore });
      return isRead ? assetResponse('/admin.html', method === 'HEAD') : new Response(null, { status: 405 });
    }
    try {
      if (path === '/api/joueurs' && method === 'GET') return await roster(env.DB);
      const portraitMatch = path.match(/^\/api\/portrait\/([^/]+)$/);
      if (portraitMatch && isRead && playerId.test(portraitMatch[1])) {
        const row = await env.DB.prepare('SELECT portrait FROM roster_changes WHERE id = ? AND player IS NOT NULL').bind(portraitMatch[1]).first();
        if (!row?.portrait) return new Response(null, { status: 404 });
        return new Response(method === 'HEAD' ? null : Uint8Array.from(atob(row.portrait), c => c.charCodeAt(0)), {
          headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', ...noStore }
        });
      }
      const item = path.match(/^\/api\/joueurs\/([^/]+)$/);
      if ((path === '/api/joueurs' && method === 'POST') || (item && playerId.test(item[1]) && ['PUT', 'DELETE'].includes(method))) {
        if (!signedIn) return json({ error: 'Connexion administrateur requise.' }, 401);
        return await updatePlayer(request, env.DB, item?.[1]);
      }
      return isRead ? assetResponse(path === '/' ? '/index.html' : path, method === 'HEAD') : new Response(null, { status: 405 });
    } catch {
      return json({ error: 'Le service des effectifs est momentanément indisponible.' }, 503);
    }
  }
};
