import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';

const password = 'test-only-strong-password';
const authorization = 'Basic ' + Buffer.from('fcc:' + password).toString('base64');
async function start(dataDir) {
  const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), SITE_URL: origin, DATA_DIR: dataDir, ADMIN_PASSWORD: password, ADMIN_USER: 'fcc' }, stdio: ['ignore','pipe','pipe'] });
  await new Promise((resolve,reject) => { child.stdout.once('data', resolve); child.once('exit', code => reject(new Error('Server exited: '+code))); });
  return { origin, child, stop: () => new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); }) };
}
test('Pages, authentication, roster writes, conflict protection and persistence', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'fcc-test-')); let server;
  try {
    server = await start(dataDir);
    let response = await fetch(server.origin + '/'); assert.equal(response.status,200); assert.match(await response.text(),/club-banner/);
    for (const page of ['histoire','mot-du-president','comite','buvette','veterans']) assert.equal((await fetch(`${server.origin}/${page}.html`)).status,200);
    assert.equal((await fetch(server.origin+'/admin')).status,401);
    assert.equal((await fetch(server.origin+'/admin',{headers:{'oai-authenticated-user-id':'spoofed'}})).status,401);
    assert.equal((await fetch(server.origin+'/admin',{headers:{authorization}})).status,200);
    const groups = await (await fetch(server.origin+'/api/joueurs')).json(); assert.equal(Object.values(groups).flat().length,82);
    const player = groups.premiere[0];
    const options = {method:'PUT',headers:{authorization,origin:server.origin,'Content-Type':'application/json'},body:JSON.stringify({...player,firstName:'Test Persistant'})};
    assert.equal((await fetch(server.origin+'/api/joueurs/'+player.id,{...options,headers:{...options.headers,authorization:''}})).status,401);
    assert.equal((await fetch(server.origin+'/api/joueurs/'+player.id,{...options,headers:{...options.headers,origin:'https://invalid.example'}})).status,403);
    assert.equal((await fetch(server.origin+'/api/joueurs/'+player.id,options)).status,200);
    assert.equal((await fetch(server.origin+'/api/joueurs/'+player.id,options)).status,409);
    await server.stop(); server = await start(dataDir);
    const updated = Object.values(await (await fetch(server.origin+'/api/joueurs')).json()).flat().find(p=>p.id===player.id);
    assert.equal(updated.firstName,'Test Persistant'); assert.equal(updated.revision,2);
    assert.equal((await fetch(server.origin+'/.env')).status,404); assert.equal((await fetch(server.origin+'/server.mjs')).status,404);
  } finally { if (server) await server.stop(); await rm(dataDir,{recursive:true,force:true}); }
});
