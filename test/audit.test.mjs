import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

globalThis.crypto ??= webcrypto;

const workerSource = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);
const worker = workerModule.default;

function mockDb({ all = [] } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push(sql);
      return {
        bind() { return this; },
        async first() { return null; },
        async all() { return { results: all }; },
        async run() { return { meta: { changes: 0 } }; },
      };
    },
  };
}

test('Worker health route returns successful JSON', async () => {
  const response = await worker.fetch(new Request('https://unit.test/api/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('admin API denies unauthenticated access without querying D1', async () => {
  const DB = mockDb();
  const response = await worker.fetch(new Request('https://unit.test/api/me'), { DB });
  assert.equal(response.status, 401);
  assert.equal(DB.calls.length, 0);
});

test('public albums API returns published rows', async () => {
  const rows = [{ id: 'public-album', title: 'Album public', status: 'published' }];
  const DB = mockDb({ all: rows });
  const response = await worker.fetch(new Request('https://unit.test/api/public/albums'), { DB });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), rows);
  assert.match(DB.calls[0], /status='published'/);
});

test('named donation route delegates to the asset binding', async () => {
  let requestedAsset;
  const ASSETS = { async fetch(request) { requestedAsset = new URL(request.url).pathname; return new Response('asset'); } };
  const response = await worker.fetch(new Request('https://unit.test/faire-un-don'), { ASSETS });
  assert.equal(response.status, 200);
  assert.equal(requestedAsset, '/faire-un-don.html');
});

test('contact endpoint is not implemented on the clean baseline', async () => {
  assert.doesNotMatch(workerSource, /p\s*===\s*['"]\/api\/contact['"]/);
  const DB = mockDb();
  const response = await worker.fetch(new Request('https://unit.test/api/contact', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'test@example.org', subject: 'Test', message: 'Test message' }),
  }), { DB });
  // Unrecognized API writes fall behind the existing admin-auth guard; do not mistake this for delivery.
  assert.equal(response.status, 401);
  assert.equal(DB.calls.length, 0);
});

test('sitemap contains absolute public URLs and excludes private paths', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.match(sitemap, /^<\?xml/);
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locations.length > 0);
  for (const location of locations) {
    const parsed = new URL(location);
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.hostname, 'actuscout.rigobertmumbere2018.workers.dev');
    assert.doesNotMatch(parsed.pathname, /^\/(admin|admin-blogueurs|blogueur|api)(\/|$)/);
  }
  assert.ok(locations.includes('https://actuscout.rigobertmumbere2018.workers.dev/'));
});

test('robots.txt allows public crawling, excludes private routes, and points at sitemap', async () => {
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /^User-agent:\s*\*/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  for (const path of ['/admin', '/admin/', '/admin-blogueurs', '/blogueur', '/blogueur/', '/api/']) {
    assert.ok(robots.split(/\r?\n/).some((line) => line.trim() === `Disallow: ${path}`), `missing Disallow for ${path}`);
  }
  assert.match(robots, /^Sitemap:\s+https:\/\/actuscout\.rigobertmumbere2018\.workers\.dev\/sitemap\.xml$/m);
});
