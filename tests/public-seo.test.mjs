import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDynamicSitemap, renderPublicDetail } from '../src/public-seo.mjs';

function database(rows = {}) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() { return rows[`${sql}:first:${args[0]}`] ?? null; },
            async all() { return { results: rows[`${sql}:all:${args[0]}`] ?? [] }; },
          };
        },
        async all() { return { results: rows[`${sql}:all`] ?? [] }; },
      };
    },
  };
}

test('public article HTML contains actual text, canonical and article metadata', async () => {
  const sql = "SELECT id,title,category,excerpt,body,cover_url,author,status,created_at,updated_at,original_published_at,original_updated_at FROM articles WHERE id=? AND status='published'";
  const env = { DB: database({ [`${sql}:first:article-1`]: { id: 'article-1', title: 'Titre & actualité', excerpt: 'Résumé', body: '<p>Corps de l’article</p>', author: 'ActuScout', status: 'published' } }) };
  const response = await renderPublicDetail(new Request('https://actuscout.com/articles/article-1'), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<h1>Titre &amp; actualité<\/h1>/);
  assert.match(html, /Corps de l’article/);
  assert.match(html, /canonical" href="https:\/\/actuscout\.com\/articles\/article-1/);
  assert.match(html, /NewsArticle/);
});

test('unpublished and missing records return noindex 404 rather than content', async () => {
  const response = await renderPublicDetail(new Request('https://actuscout.com/articles/secret'), { DB: database() });
  assert.equal(response.status, 404);
  assert.match(await response.text(), /noindex/);
});

test('dynamic sitemap lists only published records and escapes XML', async () => {
  const env = { DB: database({
    "SELECT id,updated_at,original_updated_at FROM articles WHERE status='published' ORDER BY created_at DESC LIMIT 49998:all": [{ id: 'a&b', updated_at: '2026-01-03T00:00:00Z' }],
    "SELECT id,updated_at FROM albums WHERE status='published' ORDER BY created_at DESC LIMIT 49998:all": [{ id: 'album-1', updated_at: null }],
  }) };
  const response = await renderDynamicSitemap(env);
  const xml = await response.text();
  assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
  assert.match(xml, /https:\/\/actuscout\.com\/articles\/a%26b/);
  assert.match(xml, /<lastmod>2026-01-03T00:00:00\.000Z<\/lastmod>/);
  assert.match(xml, /https:\/\/actuscout\.com\/albums\/album-1/);
  assert.doesNotMatch(xml, /www\.actuscout\.com|\/api\/|\/admin/);
});
