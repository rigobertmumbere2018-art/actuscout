const CANONICAL_ORIGIN = 'https://actuscout.com';
const MAX_SITEMAP_URLS = 50_000;

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function escapeXml(value = '') {
  return escapeHtml(value);
}

function safeText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function pageResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600' : 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function notFound() {
  return pageResponse('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page introuvable | ActuScout</title></head><body><main><h1>Page introuvable</h1><p>Cette publication n’existe pas ou n’est pas publique.</p><a href="/">Retour à l’accueil</a></main></body></html>', 404);
}

function metadata({ title, description, canonical, type = 'website', image }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const imageTags = image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : '';
  return `<meta name="description" content="${safeDescription}"><link rel="canonical" href="${safeCanonical}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="${type}"><meta property="og:site_name" content="ActuScout"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}"><meta property="og:url" content="${safeCanonical}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${safeTitle}"><meta name="twitter:description" content="${safeDescription}">${imageTags}`;
}

function articleDocument(article) {
  const title = safeText(article.title) || 'Article ActuScout';
  const description = safeText(article.excerpt) || safeText(article.body).slice(0, 300) || title;
  const canonical = `${CANONICAL_ORIGIN}/articles/${encodeURIComponent(article.id)}`;
  const published = validIsoDate(article.original_published_at) || validIsoDate(article.created_at);
  const modified = validIsoDate(article.original_updated_at) || validIsoDate(article.updated_at);
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    mainEntityOfPage: canonical,
    author: { '@type': 'Organization', name: safeText(article.author) || 'ActuScout' },
    publisher: { '@type': 'Organization', name: 'ActuScout', url: `${CANONICAL_ORIGIN}/` },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    ...(article.cover_url ? { image: [article.cover_url] } : {}),
    inLanguage: 'fr',
  };
  // Render stored body as escaped text. This keeps first-response content readable without
  // trusting arbitrary editor/import HTML in a server-side HTML response.
  const body = escapeHtml(safeText(article.body)).replace(/\n/g, '<br>');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metadata({ title: `${title} | ActuScout`, description, canonical, type: 'article', image: article.cover_url })}<title>${escapeHtml(title)} | ActuScout</title><script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script></head><body><header><a href="/">ActuScout</a> · <a href="/#actualites">Actualités</a></header><main><article><h1>${escapeHtml(title)}</h1>${article.category ? `<p>${escapeHtml(article.category)}</p>` : ''}${published ? `<time datetime="${published}">${published.slice(0, 10)}</time>` : ''}<div>${body}</div>${article.cover_url ? `<img src="${escapeHtml(article.cover_url)}" alt="Illustration de l’article ${escapeHtml(title)}" loading="lazy">` : ''}<p>Par ${escapeHtml(safeText(article.author) || 'ActuScout')}</p></article></main></body></html>`;
}

function albumDocument(album, photos) {
  const title = safeText(album.title) || 'Album photo ActuScout';
  const description = safeText(album.description) || title;
  const canonical = `${CANONICAL_ORIGIN}/albums/${encodeURIComponent(album.id)}`;
  const image = album.cover_url || photos.find((photo) => String(photo.mime_type || '').startsWith('image/'))?.public_url;
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: title,
    description,
    url: canonical,
    inLanguage: 'fr',
    ...(image ? { image } : {}),
  };
  const photoHtml = photos.filter((photo) => photo.public_url).map((photo) => {
    const src = escapeHtml(photo.public_url);
    const alt = escapeHtml(`${title} — photographie ActuScout`);
    return String(photo.mime_type || '').startsWith('video/')
      ? `<video controls preload="none" aria-label="Vidéo de l’album ${escapeHtml(title)}"><source src="${src}" type="${escapeHtml(photo.mime_type || 'video/mp4')}"></video>`
      : `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
  }).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metadata({ title: `${title} | ActuScout`, description, canonical, image })}<title>${escapeHtml(title)} | ActuScout</title><script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script></head><body><header><a href="/">ActuScout</a> · <a href="/albums">Albums</a></header><main><article><h1>${escapeHtml(title)}</h1>${album.event_date ? `<p>${escapeHtml(album.event_date)}</p>` : ''}<p>${escapeHtml(description)}</p>${photoHtml}${album.source_url ? `<p><a href="${escapeHtml(album.source_url)}" rel="noopener">Consulter la source</a></p>` : ''}</article></main></body></html>`;
}

export async function renderPublicDetail(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/(articles|albums)\/([^/]+)\/?$/);
  if (!match || request.method !== 'GET') return null;
  let id;
  try { id = decodeURIComponent(match[2]); } catch { return notFound(); }
  if (!id || id.length > 200) return notFound();

  if (match[1] === 'articles') {
    const article = await env.DB.prepare("SELECT id,title,category,excerpt,body,cover_url,author,status,created_at,updated_at,original_published_at,original_updated_at FROM articles WHERE id=? AND status='published'").bind(id).first();
    return article ? pageResponse(articleDocument(article)) : notFound();
  }
  const album = await env.DB.prepare("SELECT id,title,description,event_date,source_url,cover_url,status,created_at,updated_at FROM albums WHERE id=? AND status='published'").bind(id).first();
  if (!album) return notFound();
  const result = await env.DB.prepare('SELECT public_url,mime_type FROM album_photos WHERE album_id=? ORDER BY created_at ASC').bind(id).all();
  return pageResponse(albumDocument(album, result.results || []));
}

export async function renderDynamicSitemap(env) {
  const [articles, albums] = await Promise.all([
    env.DB.prepare("SELECT id,updated_at,original_updated_at FROM articles WHERE status='published' ORDER BY created_at DESC LIMIT 49998").all(),
    env.DB.prepare("SELECT id,updated_at FROM albums WHERE status='published' ORDER BY created_at DESC LIMIT 49998").all(),
  ]);
  const fixed = ['/', '/albums', '/faire-un-don', '/devenir-blogueur', '/qui-sommes-nous'];
  const urls = new Map();
  for (const path of fixed) urls.set(`${CANONICAL_ORIGIN}${path}`, null);
  for (const item of articles.results || []) {
    const loc = `${CANONICAL_ORIGIN}/articles/${encodeURIComponent(item.id)}`;
    if (!urls.has(loc)) urls.set(loc, validIsoDate(item.original_updated_at) || validIsoDate(item.updated_at));
  }
  for (const item of albums.results || []) {
    const loc = `${CANONICAL_ORIGIN}/albums/${encodeURIComponent(item.id)}`;
    if (!urls.has(loc)) urls.set(loc, validIsoDate(item.updated_at));
  }
  const entries = [...urls].slice(0, MAX_SITEMAP_URLS).map(([loc, lastmod]) => `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600', 'x-content-type-options': 'nosniff' },
  });
}

export const CANONICAL_SITE_ORIGIN = CANONICAL_ORIGIN;
